const { uploadExternalFileToBucket, uploadFile } = require('../misc/common');
const { expandBoundsToAspect, decodePolyline, computeOrientedBoundsForPolyline } = require('../misc/geo');
const { uploadSatelliteTilesOrientedByBbox, uploadTerrainRGBForBbox } = require('../misc/mapboxTiles');
const { db } = require('../misc/initFirebase');

const request = require('request').defaults({ encoding: null });
const functions = require('firebase-functions');
const cors = require('cors')({ origin: true });

const CLIENT_SIDE_REFRESH_INTERVAL = 3600000;
const SERVER_SIDE_DATA_REFRESH_INTERVAL = CLIENT_SIDE_REFRESH_INTERVAL - 1000;

const PROFILE_IMAGE_BUCKET_PATH = 'ar/images/alltrails/profileImage.jpg';
const TRAIL_MAP_IMAGE_BUCKET_PATH = 'ar/images/alltrails/trailMapImage.jpg';
const TRAIL_IMAGE_IMAGE_BUCKET_PATH = 'ar/images/alltrails/trailImage.jpg';
const TRAIL_SATELLITE_BUCKET_PATH = 'ar/images/alltrails/satellite.png';
const TRAIL_TERRAIN_RGB_BUCKET_PATH = 'ar/images/alltrails/terrain_rgb.png';
const TRAIL_POLYLINE_BUCKET_PATH = 'ar/data/alltrails/polyline.txt';

// Widget face aspect ratio (512x128 in mesh units — same plane geometry as
// mapbox.js). Padding is a symmetric buffer added after aspect expansion so
// the trail isn't jammed against the frame — and scales down as the bbox
// grows so thru-hikes don't gain a half-pane of empty satellite around them.
const WIDGET_ASPECT_RATIO = 4.0;
// Satellite is rendered + rotated + cropped on the server; 1024×256 is the
// sweet spot where the pre-rotation fetch stays inside mapbox's 1280×1280
// @2x cap across all bearings, while giving the post-crop satellite enough
// pixel density to read crisply on the 4:1 widget face at AR-viewing scales.
const SATELLITE_OUTPUT_WIDTH = 1024;
const SATELLITE_OUTPUT_HEIGHT = 256;
// Terrain RGB drives the mesh displacement — no need to match the
// satellite's pixel density since the mesh vertex count is 512×128 and
// encoded-elevation bytes can't be interpolated anyway.
const TERRAIN_OUTPUT_WIDTH = 512;
const TERRAIN_OUTPUT_HEIGHT = 128;

// Return a padding fraction inversely proportional to the source bbox size,
// clamped to [0.15, 0.6]. Short loops (≤5km) get the max to breathe; 50km+
// trails approach the min. Input is the bbox's aspect-normalized width in
// meters so both a tall thin trail and a short wide one pad consistently.
function paddingForSourceWidth(widthMeters) {
	const REFERENCE_WIDTH_METERS = 7500;
	return Math.max(0.15, Math.min(0.6, REFERENCE_WIDTH_METERS / widthMeters));
}

// Return the first argument that is a finite number; null if none qualify.
// Used to prefer canonical trail stats (editorial length/elevationGain) over
// potentially-corrupt user GPS recordings.
function pickFirstNumber() {
	for(let i = 0; i < arguments.length; i++) {
		if(typeof arguments[i] === 'number' && isFinite(arguments[i])) return arguments[i];
	}
	return null;
}

// Sum `summaryStats.distanceTotal` / `elevationGain` / `timeMoving` across
// every activity in the user's stats response. AllTrails returns the calendar
// tree as `{activities: {year: {month: {day: [activityObj, …]}}}}` in metric
// (meters + seconds) regardless of the viewer's display-unit preference.
function sumActivitiesStats(activitiesTree) {
	const result = { distanceMeters: 0, elevationGainMeters: 0, movingSeconds: 0, activityCount: 0 };
	if(!activitiesTree || typeof activitiesTree !== 'object') return result;
	for(const year of Object.keys(activitiesTree)) {
		const months = activitiesTree[year];
		if(!months || typeof months !== 'object') continue;
		for(const month of Object.keys(months)) {
			const days = months[month];
			if(!days || typeof days !== 'object') continue;
			for(const day of Object.keys(days)) {
				const dayActivities = days[day];
				if(!Array.isArray(dayActivities)) continue;
				for(const activity of dayActivities) {
					const s = activity && activity.summaryStats;
					if(!s) continue;
					if(typeof s.distanceTotal === 'number') result.distanceMeters += s.distanceTotal;
					if(typeof s.elevationGain === 'number') result.elevationGainMeters += s.elevationGain;
					if(typeof s.timeMoving === 'number') result.movingSeconds += s.timeMoving;
					result.activityCount++;
				}
			}
		}
	}
	return result;
}

// x-at-key for the AllTrails JSON API. Embedded in funnel-*.js; observed unchanged
// across multiple Charles captures. Rescrape from the funnel bundle if the API
// starts returning 401 with otherwise-valid cookies.
const X_AT_KEY = '3p0t5s6b5g4g0e8k3c1j3w7y5c3m4t8i';

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36 Edg/147.0.0.0';

// The login flow is *not* automated. AllTrails is protected by DataDome, which
// gates /login behind a JS-fingerprint challenge that server-side Node cannot
// pass (confirmed via direct curl from the user's residential IP: 403 with a
// 776-byte "enable JS" challenge page). Instead, the user pastes a logged-in
// browser's cookies into Firestore `auth/alltrails.cookies` (map of cookie
// name → value). Required keys at minimum:
//   _alltrails_session   — Rails session (rotates per request)
//   datadome             — DataDome session token (rotates per request)
//   access_token         — OAuth bearer; Max-Age 1yr
//   refresh_token        — OAuth refresh; Max-Age 2yr
//   auth_client_id       — OAuth client id; Max-Age 2yr
// Plus `auth.userId` (the integer AllTrails user id, e.g. 53575098).
//
// When the cookies expire (the widget starts returning 401/403), refresh them:
// open alltrails.com in a browser, sign in, copy the document.cookie output
// into Firestore, and redeploy isn't needed — the function picks it up on the
// next run.
//
// Everything *else* (username, reputation, trail count, map metadata, photos)
// is fetched live from the AllTrails API — auth/ is only for credentials.
function buildCookieHeader(cookieMap) {
	return Object.keys(cookieMap).map(k => k + '=' + cookieMap[k]).join('; ');
}

function mergeSetCookies(cookieMap, setCookieHeaders) {
	if(!setCookieHeaders) return cookieMap;
	setCookieHeaders.forEach(entry => {
		const key = entry.split('=')[0];
		const value = entry.split(key + '=')[1].split(';')[0];
		cookieMap[key] = value;
	});
	return cookieMap;
}

// Low-level request wrapper that surfaces status + body snippet on failure.
// locationHeader is surfaced for callers that intentionally don't follow
// redirects (the static_map polyline extraction needs it).
function fetchAT(options) {
	return new Promise((resolve, reject) => {
		request(options, (error, response, body) => {
			if(error) {
				reject(error);
				return;
			}
			const text = Buffer.isBuffer(body) ? body.toString() : (typeof body === 'string' ? body : JSON.stringify(body));
			let json;
			if(typeof body === 'object' && body !== null && !Buffer.isBuffer(body)) {
				json = body;
			} else {
				try { json = JSON.parse(text); } catch(_) { /* not JSON */ }
			}
			resolve({
				statusCode: response.statusCode,
				cookies: response.headers['set-cookie'],
				locationHeader: response.headers['location'],
				text,
				json
			});
		});
	});
}

function authenticatedGetOptions(auth, cookieMap, url) {
	return {
		method: 'GET',
		url: url,
		headers: {
			'User-Agent': USER_AGENT,
			'Accept': 'application/json',
			'Accept-Language': 'en-US,en;q=0.9',
			'x-at-key': X_AT_KEY,
			'x-at-caller': 'Mugen',
			'x-language-locale': 'en-US',
			'Cookie': buildCookieHeader(cookieMap)
		},
		gzip: true,
		proxy: auth.proxyIP
	};
}


// Next.js React-Server-Component GET (for /members/{username}). The plain
// HTML page doesn't inline stats — they're fetched via RSC after hydration.
// The `rsc: 1` header plus `next-*` cookies get us the serialized component
// payload in `text/x-component` with the embedded `profileOwner` blob.
function rscGetOptions(auth, cookieMap, path) {
	return {
		method: 'GET',
		url: 'https://www.alltrails.com' + path + (path.includes('?') ? '&' : '?') + '_rsc=vounv',
		headers: {
			'User-Agent': USER_AGENT,
			'Accept': '*/*',
			'Accept-Language': 'en-US,en;q=0.9',
			'rsc': '1',
			'next-url': '/en',
			'next-router-state-tree': '%5B%22%22%2C%7B%22children%22%3A%5B%5B%22locale%22%2C%22en%22%2C%22d%22%2Cnull%5D%2C%7B%22children%22%3A%5B%22__PAGE__%22%2C%7B%7D%2Cnull%2Cnull%2C0%5D%7D%2Cnull%2Cnull%2C16%5D%7D%2Cnull%2Cnull%2C0%5D',
			'sec-ch-ua': '"Microsoft Edge";v="147", "Not.A/Brand";v="8", "Chromium";v="147"',
			'sec-ch-ua-mobile': '?0',
			'sec-ch-ua-platform': '"Windows"',
			'sec-fetch-dest': 'empty',
			'sec-fetch-mode': 'cors',
			'sec-fetch-site': 'same-origin',
			'Referer': 'https://www.alltrails.com/',
			'Cookie': buildCookieHeader(cookieMap)
		},
		gzip: true,
		proxy: auth.proxyIP
	};
}

// The member page embeds a `"profileOwner":{...}` JSON blob inside the
// Next.js server-rendered payload. Pull it out with a brace-matching scan
// rather than a regex so we don't trip on nested objects.
function parseProfileOwner(html) {
	const anchor = '"profileOwner":';
	const start = html.indexOf(anchor);
	if(start === -1) return null;
	const objStart = html.indexOf('{', start + anchor.length);
	if(objStart === -1) return null;
	let depth = 0;
	let inString = false;
	let escape = false;
	for(let i = objStart; i < html.length; i++) {
		const ch = html[i];
		if(escape) { escape = false; continue; }
		if(ch === '\\') { escape = true; continue; }
		if(ch === '"') { inString = !inString; continue; }
		if(inString) continue;
		if(ch === '{') depth++;
		else if(ch === '}') {
			depth--;
			if(depth === 0) {
				try { return JSON.parse(html.substring(objStart, i + 1)); }
				catch(_) { return null; }
			}
		}
	}
	return null;
}

exports.alltrails = functions.runWith({ timeoutSeconds: 120, memory: '1GB' }).https.onRequest(async (req, res) => {
	await cors(req, res, async () => {
		const authDocument = await db.collection('auth').doc('alltrails').get();
		if(!authDocument.exists) {
			return res.send({ error: 'something went wrong, try again later' });
		}
		const auth = authDocument.data();

		const configDocument = await db.collection('auth').doc('scub3d').get();
		// In prod the residential proxy is required to beat DataDome's GCP-IP
		// block; inside the emulator we're already on the residential IP, so
		// tunneling through the proxy would just self-loop.
		auth.proxyIP = (process.env.FUNCTIONS_EMULATOR === 'true' || !configDocument.exists) ? undefined : configDocument.data().proxyIP;

		if(!auth.cookies || !auth.userId) {
			return res.status(500).send({ error: 'missing_cookies_or_userId', hint: 'paste browser cookies into auth/alltrails.cookies in Firestore' });
		}

		// Debug override: `?trailId=X` bypasses the "most recent activity"
		// discovery and renders the given AllTrails trail directly. Useful
		// for previewing the widget against a specific trail's geometry
		// without waiting for that trail to become the user's latest logged
		// activity. Always bypasses the refresh cache so overrides iterate
		// quickly.
		const overrideTrailId = req.query.trailId ? String(req.query.trailId) : null;

		const alltrailsDocument = await db.collection('data').doc('alltrails').get();
		if(!req.query.force && !overrideTrailId && alltrailsDocument.exists) {
			if(Date.now() - alltrailsDocument.data().timestamp <= SERVER_SIDE_DATA_REFRESH_INTERVAL) {
				return res.send(alltrailsDocument.data());
			}
		}

		const cookieMap = Object.assign({}, auth.cookies);

		// 1. Fetch the user's first few maps — we only need `firstMap` for trail
		//    detail + the owner's username slug. Lifetime totals come from
		//    `/members/{username}/stats` below, not per-map summation.
		const mapsURL = 'https://www.alltrails.com/api/alltrails/users/' + auth.userId + '/maps?limit=5&presentation_type=track';
		const mapsResp = await fetchAT(authenticatedGetOptions(auth, cookieMap, mapsURL));
		if(mapsResp.statusCode !== 200) {
			return res.status(500).send({ error: 'user_maps_failed', status: mapsResp.statusCode, hint: 'refresh cookies in auth/alltrails.cookies' });
		}
		mergeSetCookies(cookieMap, mapsResp.cookies);
		const maps = mapsResp.json && mapsResp.json.maps;
		if(!maps || !maps.length) {
			return res.status(500).send({ error: 'no_maps' });
		}
		const firstMap = maps[0];
		// The map object carries the owner's slug — this is the /members/{slug}
		// path segment and identifies the profile page for profile-stats fetch.
		const username = firstMap.user && firstMap.user.username;
		if(!username) {
			return res.status(500).send({ error: 'missing_username_in_maps' });
		}

		// 2. Fetch the member profile via the Next.js RSC endpoint and parse the
		//    embedded profileOwner blob — gives us reputation/reviews/completed/
		//    favorites/following/followers/profilePhoto without the login endpoint.
		const profileResp = await fetchAT(rscGetOptions(auth, cookieMap, '/members/' + encodeURIComponent(username)));
		if(profileResp.statusCode !== 200) {
			return res.status(500).send({ error: 'member_page_failed', status: profileResp.statusCode, hint: 'refresh cookies in auth/alltrails.cookies' });
		}
		mergeSetCookies(cookieMap, profileResp.cookies);
		const profileOwner = parseProfileOwner(profileResp.text);
		if(!profileOwner) {
			return res.status(500).send({ error: 'profile_parse_failed' });
		}

		// 2a. Fetch the user's full activity calendar and sum lifetime stats.
		//     AllTrails doesn't expose a pre-aggregated totals endpoint — the
		//     /members/{slug}/stats page hydrates client-side by calling this
		//     endpoint (confirmed via Charles proxy capture) and summing
		//     `summaryStats` across every activity itself. The response is a
		//     nested `{activities: {year: {month: {day: [...]}}}}` tree in
		//     metric units (meters, seconds). Single call, no pagination.
		let lifetimeDistanceMeters = null;
		let lifetimeElevationGainMeters = null;
		let lifetimeMovingSeconds = null;

		const statsURL = 'https://www.alltrails.com/api/alltrails/v2/users/' + auth.userId + '/stats';
		const statsResp = await fetchAT(authenticatedGetOptions(auth, cookieMap, statsURL));
		if(statsResp.statusCode === 200 && statsResp.json && statsResp.json.activities) {
			mergeSetCookies(cookieMap, statsResp.cookies);
			const totals = sumActivitiesStats(statsResp.json.activities);
			lifetimeDistanceMeters = totals.distanceMeters;
			lifetimeElevationGainMeters = totals.elevationGainMeters;
			lifetimeMovingSeconds = totals.movingSeconds;
		}

		// 3. Extract the Google-encoded polyline for the *default trail path* —
		//    the editorial AllTrails route, not the user's GPS recording (which
		//    is jittery and only accessible via the /maps/{trackId} detail
		//    endpoint in a shape we can't reach). The `?detail=deep` query
		//    param unlocks `routes[0].lineSegments[0].polyline.pointsData` on
		//    curated trail maps — same flow as tooling/scrape_alltrails_add_trails.js.
		const effectiveTrailId = overrideTrailId || firstMap.trailId;
		const trailDetailURL = 'https://www.alltrails.com/api/alltrails/trails/' + effectiveTrailId + '?detail=deep';
		const trailDetailResp = await fetchAT(authenticatedGetOptions(auth, cookieMap, trailDetailURL));
		if(trailDetailResp.statusCode !== 200) {
			return res.status(500).send({ error: 'trail_detail_failed', status: trailDetailResp.statusCode });
		}
		mergeSetCookies(cookieMap, trailDetailResp.cookies);
		const trail = trailDetailResp.json && trailDetailResp.json.trails && trailDetailResp.json.trails[0];
		const trailDefaultMap = trail && trail.defaultMap;
		const trailDefaultMapId = trailDefaultMap && (trailDefaultMap.id || (typeof trailDefaultMap === 'number' ? trailDefaultMap : null));

		let polylineEncoded = null;
		let trailBounds = null;
		let trailDefaultRoute = null;
		let trailDefaultMapSummary = null;

		if(trailDefaultMapId) {
			const dmURL = 'https://www.alltrails.com/api/alltrails/maps/' + trailDefaultMapId + '?detail=deep';
			const dmResp = await fetchAT(authenticatedGetOptions(auth, cookieMap, dmURL));
			if(dmResp.statusCode === 200) {
				mergeSetCookies(cookieMap, dmResp.cookies);
				const envelope = dmResp.json && dmResp.json.maps && dmResp.json.maps[0];
				const tm = envelope && (envelope.map || envelope);
				trailBounds = tm && tm.bounds;
				trailDefaultRoute = tm && tm.routes && tm.routes[0];
				trailDefaultMapSummary = tm && tm.summaryStats;
				const seg = trailDefaultRoute && trailDefaultRoute.lineSegments && trailDefaultRoute.lineSegments[0];
				polylineEncoded = seg && seg.polyline && seg.polyline.pointsData;
			}
		}

		if(!polylineEncoded) {
			return res.status(500).send({ error: 'polyline_missing' });
		}

		await uploadFile(Buffer.from(polylineEncoded, 'utf8'), TRAIL_POLYLINE_BUCKET_PATH, 'text/plain');

		// 4. Fit the decoded polyline into a trail-aligned 4:1 rectangle
		//    (PCA on the polyline points → principal bearing). The server
		//    fetches an axis-aligned mercator bbox that fully contains the
		//    rotated rect; satellite gets rotated + center-cropped so the
		//    trail always runs along the widget's horizontal long axis.
		//    Terrain RGB stays axis-aligned — the widget samples it
		//    per-mesh-vertex at each vertex's world lat/lng so encoded
		//    elevation bytes are never interpolated.
		const sourceBounds = trailBounds || firstMap.bounds;
		const polylinePoints = decodePolyline(polylineEncoded);
		// Pre-pass at zero padding gives us the aspect-normalized long-axis
		// width; use it to scale padding (short loops breathe, long trails
		// don't drag a big empty frame along).
		const rawOriented = computeOrientedBoundsForPolyline(polylinePoints, WIDGET_ASPECT_RATIO, 0);
		const paddingFraction = paddingForSourceWidth(rawOriented.longMeters);
		const oriented = computeOrientedBoundsForPolyline(polylinePoints, WIDGET_ASPECT_RATIO, paddingFraction);

		const mapboxAuthDoc = await db.collection('auth').doc('mapbox').get();
		if(!mapboxAuthDoc.exists) {
			return res.status(500).send({ error: 'mapbox_auth_missing' });
		}
		const mapboxToken = mapboxAuthDoc.data().token;

		// Size the terrain-rgb axis-aligned fetch so its pixel density along
		// the diagonal matches the satellite's. Same formula as the oriented
		// satellite uploader uses for its fetch-dim scaling.
		const absC = Math.abs(Math.cos(oriented.bearingRadians));
		const absS = Math.abs(Math.sin(oriented.bearingRadians));
		const shortToLong = oriented.shortMeters / oriented.longMeters;
		const terrainWidthPx = Math.max(1, Math.ceil(TERRAIN_OUTPUT_WIDTH * (absC + shortToLong * absS)));
		const terrainHeightPx = Math.max(1, Math.ceil(TERRAIN_OUTPUT_WIDTH * (absS + shortToLong * absC)));

		await uploadSatelliteTilesOrientedByBbox(oriented, SATELLITE_OUTPUT_WIDTH, SATELLITE_OUTPUT_HEIGHT, mapboxToken, TRAIL_SATELLITE_BUCKET_PATH);
		await uploadTerrainRGBForBbox(oriented.enclosingBbox, terrainWidthPx, terrainHeightPx, mapboxToken, TRAIL_TERRAIN_RGB_BUCKET_PATH);

		// 5. Fetch the trail's photo carousel for the "trail photo" image.
		//    Best-effort: if it fails we still publish the rest.
		let trailPhotoId, trailPhotoHash;
		try {
			const photosURL = 'https://www.alltrails.com/api/alltrails/trails/' + effectiveTrailId + '/photos/carousel';
			const photosResp = await fetchAT(authenticatedGetOptions(auth, cookieMap, photosURL));
			if(photosResp.statusCode === 200) {
				mergeSetCookies(cookieMap, photosResp.cookies);
				const firstPhoto = photosResp.json && photosResp.json.locations && photosResp.json.locations[0] && photosResp.json.locations[0].photo;
				if(firstPhoto) {
					trailPhotoId = firstPhoto.id;
					trailPhotoHash = firstPhoto.photoHash;
				}
			}
		} catch(_) { /* best-effort — trail image is optional */ }

		// 4. Upload images. Profile photo is embedded in profileOwner; static map
		//    renders via /maps/:id/static_map; trail photo is from the carousel.
		if(profileOwner.profilePhoto && profileOwner.profilePhoto.id && profileOwner.profilePhoto.photoHash) {
			await uploadExternalFileToBucket(
				'https://images.alltrails.com/' + generateImageURLBase64(profileOwner.profilePhoto.id, profileOwner.profilePhoto.photoHash),
				PROFILE_IMAGE_BUCKET_PATH,
				'image/jpeg'
			);
		}

		// Under a trailId override, firstMap.id points at the user's latest
		// activity — unrelated to the trail we're rendering. Prefer the
		// trail's editorial default map for the static-map image so the
		// "trail map" visual matches the overridden geometry.
		const effectiveMapId = (overrideTrailId && trailDefaultMapId) ? trailDefaultMapId : firstMap.id;
		await uploadExternalFileToBucket(
			'https://www.alltrails.com/api/alltrails/maps/' + effectiveMapId + '/static_map?key=' + X_AT_KEY + '&size=480x200',
			TRAIL_MAP_IMAGE_BUCKET_PATH,
			'image/jpeg'
		);

		if(trailPhotoId && trailPhotoHash) {
			await uploadExternalFileToBucket(
				'https://images.alltrails.com/' + generateImageURLBase64(trailPhotoId, trailPhotoHash),
				TRAIL_IMAGE_IMAGE_BUCKET_PATH,
				'image/jpeg'
			);
		}

		const summaryStats = firstMap.summaryStats || {};
		const parsedJSON = {
			username: profileOwner.username,
			reputation: profileOwner.reputation,
			reviews: profileOwner.reviews,
			completed: profileOwner.completed,
			favorites: profileOwner.favorites,
			following: profileOwner.following,
			followers: profileOwner.followers,
			// Hiking-forward profile counters from the member RSC blob. `tracks`
			// is the user's recorded-activity count (the thing most like "hikes
			// logged"); `maps` is custom routes they've drawn/saved; `photos`
			// and `lists` round out the hiking-related activity footprint.
			tracks: profileOwner.tracks,
			maps: profileOwner.maps,
			photos: profileOwner.photos,
			lists: profileOwner.lists,

			// Lifetime totals read directly from /members/{slug}/stats. Values
			// are in metric (meters / seconds) since AllTrails returns metric
			// in raw JSON regardless of the user's display-unit preference.
			// Conversion to km/hours happens client-side at render time so the
			// widget UI can relabel without redeploy.
			lifetimeDistanceMeters: lifetimeDistanceMeters,
			lifetimeElevationGainMeters: lifetimeElevationGainMeters,
			lifetimeMovingSeconds: lifetimeMovingSeconds,

			mapID: effectiveMapId,
			trailID: effectiveTrailId,
			// Canonical trail name ("Granite Lakes") — trail detail is the
			// editorial source. Fall back to the user's activity name if
			// we somehow didn't get the trail detail.
			trailName: (trail && trail.name) || firstMap.name,
			trailRouteType: firstMap.activity && firstMap.activity.name,

			// Native (unpadded) bounds of the default trail — truth frame for
			// the polyline. Fall back to the user's track bounds if the trail
			// endpoint didn't return them.
			trailLatitudeTopLeft: sourceBounds && sourceBounds.latitudeTopLeft,
			trailLatitudeBottomRight: sourceBounds && sourceBounds.latitudeBottomRight,
			trailLongitudeTopLeft: sourceBounds && sourceBounds.longitudeTopLeft,
			trailLongitudeBottomRight: sourceBounds && sourceBounds.longitudeBottomRight,

			// Trail-aligned 4:1 rectangle (PCA bearing) — the satellite was
			// rotated + center-cropped to match this frame, so the widget
			// renders the mesh directly at these dimensions. Terrain RGB is
			// axis-aligned over `terrainMin/MaxLat/Lng` (the enclosing bbox);
			// widget samples it per-vertex using the oriented rotation.
			paddedCenterLat: oriented.midLat,
			paddedCenterLng: oriented.midLng,
			paddedBearingRadians: oriented.bearingRadians,
			paddedLongMeters: oriented.longMeters,
			paddedShortMeters: oriented.shortMeters,
			terrainMinLat: oriented.enclosingBbox.minLat,
			terrainMaxLat: oriented.enclosingBbox.maxLat,
			terrainMinLng: oriented.enclosingBbox.minLng,
			terrainMaxLng: oriented.enclosingBbox.maxLng,

			// Canonical trail stats — user's GPS recording can drop signal,
			// restart, or misreport elevation gain, so prefer the editorial
			// trail object's own length/elevationGain. Fall through to the
			// trail's default map summaryStats, then to the user's own
			// recording only as a last resort. Time stats stay on the user's
			// recording since "how long did the hike take" is only meaningful
			// for an actual recorded session.
			trailTotalDistance: pickFirstNumber(trail && trail.length, trailDefaultMapSummary && trailDefaultMapSummary.distanceTotal, summaryStats.distanceTotal),
			trailElevationGain: pickFirstNumber(trail && trail.elevationGain, trailDefaultMapSummary && trailDefaultMapSummary.elevationGain, summaryStats.elevationGain),
			trailElevationLoss: pickFirstNumber(trailDefaultMapSummary && trailDefaultMapSummary.elevationLoss, summaryStats.elevationLoss),
			trailElevationMax: pickFirstNumber(trailDefaultMapSummary && trailDefaultMapSummary.elevationMax, summaryStats.elevationMax),
			trailTotalTime: summaryStats.timeTotal,
			trailMovingTime: summaryStats.timeMoving,

			timestamp: Date.now()
		};

		await db.collection('data').doc('alltrails').set(parsedJSON);
		return res.send(parsedJSON);
	});
});

function generateImageURLBase64(id, hash) {
	return Buffer.from('{"bucket":"assets.alltrails.com","key":"uploads/photo/image/' + id + '/' + hash + '.jpg","edits":{"toFormat":"jpeg","resize":{"width":256,"height":256,"fit":"cover"},"rotate":null}}').toString('base64');
}
