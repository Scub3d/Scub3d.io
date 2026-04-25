// Geographic utilities shared across widgets. Keep this file pure (no I/O,
// no module-level side effects) — it's imported by both widget cloud
// functions and tile-fetching helpers.

const METERS_PER_DEG_LAT = 111320;

function metersPerDegLngAtLatitude(latDeg) {
	return METERS_PER_DEG_LAT * Math.cos(latDeg * Math.PI / 180);
}

// Widen a rectangular lat/lng bbox around its center until it matches the
// target width-to-height aspect ratio (in real-world meters, not degrees —
// longitude gets corrected by cos(midLat) so the output isn't squashed at
// non-equatorial latitudes). Then apply a symmetric padding so the subject
// doesn't sit right on the edge.
//
// When the subject is taller (N-S) than wide (E-W) — e.g. a canyon trail
// that runs along a ridgeline — expanding lng to hit the 4:1 widget aspect
// inflates the short axis 4× and wastes most of the tile area on empty
// satellite. In that case we flip into "rotated" mode: the trail's N-S
// extent becomes the DISPLAY's long axis, and lng is the one padded. Caller
// rotates the resulting satellite/terrain images 90° CW after download and
// passes the `rotated` flag through to the widget so polyline UVs line up.
//
// Input bounds can use either AllTrails naming (latitudeTopLeft / etc.) or
// plain {minLat, maxLat, minLng, maxLng}. Output is always the plain shape
// plus midLat/midLng for downstream consumers, and a `rotated` boolean.
// `widthMeters`/`heightMeters` reflect the DISPLAY orientation, so in
// rotated mode they're swapped relative to lat/lng extents — callers that
// need the native lat/lng extents should use maxLat-minLat / maxLng-minLng
// directly.
function expandBoundsToAspect(bounds, targetAspect, paddingFraction) {
	const minLat = bounds.minLat !== undefined ? bounds.minLat : parseFloat(bounds.latitudeBottomRight);
	const maxLat = bounds.maxLat !== undefined ? bounds.maxLat : parseFloat(bounds.latitudeTopLeft);
	const minLng = bounds.minLng !== undefined ? bounds.minLng : parseFloat(bounds.longitudeTopLeft);
	const maxLng = bounds.maxLng !== undefined ? bounds.maxLng : parseFloat(bounds.longitudeBottomRight);

	const midLat = (minLat + maxLat) / 2;
	const midLng = (minLng + maxLng) / 2;

	const latMeters = (maxLat - minLat) * METERS_PER_DEG_LAT;
	const lngMeters = (maxLng - minLng) * metersPerDegLngAtLatitude(midLat);

	// Long display axis = whichever dimension (E-W or N-S) is already larger.
	// Rotated = true means the long axis is N-S (lat).
	const rotated = latMeters > lngMeters;
	const longMeters = rotated ? latMeters : lngMeters;
	const shortMeters = rotated ? lngMeters : latMeters;
	const currentAspect = longMeters / shortMeters;

	// Expand (never shrink) whichever axis is needed to reach targetAspect so
	// the subject is fully contained. If the subject is less elongated than
	// the widget (currentAspect < target), grow the long axis — trail stays
	// fully visible, extra space fills the long-axis ends. If the subject is
	// more elongated (currentAspect > target, e.g. a thru-hike), grow the
	// short axis instead so the trail's long extent isn't clipped.
	let paddedLongMeters = longMeters;
	let paddedShortMeters = shortMeters;
	if (currentAspect < targetAspect) {
		paddedLongMeters = shortMeters * targetAspect;
	} else {
		paddedShortMeters = longMeters / targetAspect;
	}

	// Map long/short back onto lat/lng based on orientation.
	let paddedLatMeters = rotated ? paddedLongMeters : paddedShortMeters;
	let paddedLngMeters = rotated ? paddedShortMeters : paddedLongMeters;

	const pad = 1 + (paddingFraction == null ? 0.1 : paddingFraction);
	paddedLatMeters *= pad;
	paddedLngMeters *= pad;

	const paddedLatDeg = paddedLatMeters / METERS_PER_DEG_LAT;
	const paddedLngDeg = paddedLngMeters / metersPerDegLngAtLatitude(midLat);

	return {
		minLat: midLat - paddedLatDeg / 2,
		maxLat: midLat + paddedLatDeg / 2,
		minLng: midLng - paddedLngDeg / 2,
		maxLng: midLng + paddedLngDeg / 2,
		midLat: midLat,
		midLng: midLng,
		// widthMeters/heightMeters are DISPLAY-oriented, not lat/lng-oriented:
		// widthMeters = meters across the display's long axis (whatever that
		// maps to geographically), heightMeters = meters across the short.
		widthMeters: rotated ? paddedLatMeters : paddedLngMeters,
		heightMeters: rotated ? paddedLngMeters : paddedLatMeters,
		rotated: rotated
	};
}

// Web Mercator tile projection helpers. Used for stitching mapbox raster
// tiles that cover an arbitrary bbox at a chosen zoom level.
function lngToTileX(lng, zoom) {
	return (lng + 180) / 360 * Math.pow(2, zoom);
}

function latToTileY(lat, zoom) {
	return (1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom);
}

// Standard Google encoded-polyline decoder. Returns [{lat, lng}, ...].
// https://developers.google.com/maps/documentation/utilities/polylinealgorithm
function decodePolyline(encoded) {
	const points = [];
	let index = 0, lat = 0, lng = 0;
	while (index < encoded.length) {
		let b, shift = 0, result = 0;
		do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
		const dlat = (result & 1) ? ~(result >> 1) : (result >> 1);
		lat += dlat;

		shift = 0; result = 0;
		do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
		const dlng = (result & 1) ? ~(result >> 1) : (result >> 1);
		lng += dlng;

		points.push({ lat: lat * 1e-5, lng: lng * 1e-5 });
	}
	return points;
}

// Fit `points` (an array of {lat, lng}) into a rectangle whose long axis is
// aligned with the trail's principal bearing (PCA), so a 4:1 widget gets the
// trail running fully along its long display axis instead of letterboxed
// inside an axis-aligned diagonal bbox.
//
// Output:
//   midLat, midLng       — center of the oriented (rotated) rectangle
//   bearingRadians       — CCW from east; the long axis direction in world
//                          coords (x=east, y=north). PCA is undirected so the
//                          value is folded into [-π/2, π/2).
//   longMeters,
//   shortMeters          — extents of the oriented rectangle (display long
//                          and short respectively), AFTER aspect-fit + pad.
//   enclosingBbox        — axis-aligned mercator bbox that fully contains
//                          the rotated rectangle. Used to fetch axis-aligned
//                          mapbox imagery (terrain RGB stays in this frame so
//                          the widget can sample it without interpolation).
//
// Degenerate paths (loops / very short / sparse polylines) fall through to
// `expandBoundsToAspect` with bearing=0 so the trail still renders, just
// without rotation.
function computeOrientedBoundsForPolyline(points, targetAspect, paddingFraction) {
	const N = points && points.length || 0;
	if (N < 3) {
		return _orientedFromAxisAlignedFallback(points || [], targetAspect, paddingFraction);
	}

	// 1. Initial centroid in lat/lng → local meters around it.
	let sumLat = 0, sumLng = 0;
	for (let i = 0; i < N; i++) { sumLat += points[i].lat; sumLng += points[i].lng; }
	const cLat0 = sumLat / N;
	const cLng0 = sumLng / N;
	const mPerLng0 = metersPerDegLngAtLatitude(cLat0);

	const xs = new Array(N), ys = new Array(N);
	let cx = 0, cy = 0;
	for (let i = 0; i < N; i++) {
		xs[i] = (points[i].lng - cLng0) * mPerLng0;
		ys[i] = (points[i].lat - cLat0) * METERS_PER_DEG_LAT;
		cx += xs[i]; cy += ys[i];
	}
	cx /= N; cy /= N;

	// Quick degeneracy check on the cloud's spread.
	let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
	for (let i = 0; i < N; i++) {
		if (xs[i] < minX) minX = xs[i]; if (xs[i] > maxX) maxX = xs[i];
		if (ys[i] < minY) minY = ys[i]; if (ys[i] > maxY) maxY = ys[i];
	}
	if (Math.max(maxX - minX, maxY - minY) < 1) {
		return _orientedFromAxisAlignedFallback(points, targetAspect, paddingFraction);
	}

	// 2. PCA → principal-axis angle θ (CCW from east).
	let sxx = 0, syy = 0, sxy = 0;
	for (let i = 0; i < N; i++) {
		const dx = xs[i] - cx, dy = ys[i] - cy;
		sxx += dx * dx; syy += dy * dy; sxy += dx * dy;
	}
	sxx /= N; syy /= N; sxy /= N;
	let theta = 0.5 * Math.atan2(2 * sxy, sxx - syy);
	// Fold into [-π/2, π/2) — PCA axis is undirected.
	if (theta >= Math.PI / 2) theta -= Math.PI;
	if (theta < -Math.PI / 2) theta += Math.PI;

	// Loop detection: eigenvalues from the 2x2 covariance.
	const trace = sxx + syy;
	const det = sxx * syy - sxy * sxy;
	const disc = Math.max(0, (trace * trace) / 4 - det);
	const sqrtDisc = Math.sqrt(disc);
	const lambda1 = trace / 2 + sqrtDisc;
	const lambda2 = trace / 2 - sqrtDisc;
	if (lambda1 <= 0 || lambda2 / lambda1 > 0.9) {
		return _orientedFromAxisAlignedFallback(points, targetAspect, paddingFraction);
	}

	// 3. Project points into trail frame (along, across).
	const cosT = Math.cos(theta), sinT = Math.sin(theta);
	let alongMin = Infinity, alongMax = -Infinity, acrossMin = Infinity, acrossMax = -Infinity;
	for (let i = 0; i < N; i++) {
		const dx = xs[i] - cx, dy = ys[i] - cy;
		const along  =  dx * cosT + dy * sinT;
		const across = -dx * sinT + dy * cosT;
		if (along  < alongMin)  alongMin  = along;  if (along  > alongMax)  alongMax  = along;
		if (across < acrossMin) acrossMin = across; if (across > acrossMax) acrossMax = across;
	}
	let alongExtent = alongMax - alongMin;
	let acrossExtent = acrossMax - acrossMin;
	const alongMid = (alongMin + alongMax) / 2;
	const acrossMid = (acrossMin + acrossMax) / 2;

	// 4. Refine center: PCA's principal axis goes through (cx, cy), but the
	//    trail's true rectangle midpoint along that axis may be offset.
	const cxRef = cx + alongMid * cosT - acrossMid * sinT;
	const cyRef = cy + alongMid * sinT + acrossMid * cosT;
	const midLat = cLat0 + cyRef / METERS_PER_DEG_LAT;
	const midLng = cLng0 + cxRef / mPerLng0;

	// 5. Aspect fit — grow whichever axis falls short. Never shrink.
	const currentAspect = alongExtent / acrossExtent;
	if (currentAspect < targetAspect) {
		alongExtent = acrossExtent * targetAspect;
	} else {
		acrossExtent = alongExtent / targetAspect;
	}

	// 6. Symmetric padding.
	const pad = 1 + (paddingFraction == null ? 0.1 : paddingFraction);
	const longMeters = alongExtent * pad;
	const shortMeters = acrossExtent * pad;

	// 7. Axis-aligned bbox enclosing the rotated rectangle.
	const absC = Math.abs(cosT), absS = Math.abs(sinT);
	const halfEW = 0.5 * (longMeters * absC + shortMeters * absS);
	const halfNS = 0.5 * (longMeters * absS + shortMeters * absC);
	const mPerLngMid = metersPerDegLngAtLatitude(midLat);
	const ewDeg = halfEW / mPerLngMid;
	const nsDeg = halfNS / METERS_PER_DEG_LAT;

	return {
		midLat: midLat,
		midLng: midLng,
		bearingRadians: theta,
		longMeters: longMeters,
		shortMeters: shortMeters,
		enclosingBbox: {
			minLat: midLat - nsDeg, maxLat: midLat + nsDeg,
			minLng: midLng - ewDeg, maxLng: midLng + ewDeg
		}
	};
}

// Degenerate path — produce an oriented-bounds shape from an axis-aligned
// fit so consumers don't need a separate code path. bearingRadians = 0 means
// "no rotation"; longMeters maps to E-W, shortMeters to N-S.
function _orientedFromAxisAlignedFallback(points, targetAspect, paddingFraction) {
	let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
	for (const p of points) {
		if (p.lat < minLat) minLat = p.lat; if (p.lat > maxLat) maxLat = p.lat;
		if (p.lng < minLng) minLng = p.lng; if (p.lng > maxLng) maxLng = p.lng;
	}
	// If no points at all, return a zero-extent placeholder; caller should
	// have errored upstream before reaching this.
	if (!isFinite(minLat)) {
		return {
			midLat: 0, midLng: 0, bearingRadians: 0,
			longMeters: 0, shortMeters: 0,
			enclosingBbox: { minLat: 0, maxLat: 0, minLng: 0, maxLng: 0 }
		};
	}
	const aa = expandBoundsToAspect({ minLat, maxLat, minLng, maxLng }, targetAspect, paddingFraction);
	// Whichever axis is the display long: in expandBoundsToAspect, widthMeters
	// is always display-long. For axis-aligned fallback we set bearing=0 so
	// long=E-W, short=N-S. If the trail is N-S dominant the fallback would
	// otherwise need bearing=π/2, but the whole point of the fallback is the
	// trail's principal axis isn't well-defined — just letterbox it.
	return {
		midLat: aa.midLat,
		midLng: aa.midLng,
		bearingRadians: 0,
		longMeters: aa.rotated ? aa.heightMeters : aa.widthMeters,
		shortMeters: aa.rotated ? aa.widthMeters : aa.heightMeters,
		enclosingBbox: {
			minLat: aa.minLat, maxLat: aa.maxLat,
			minLng: aa.minLng, maxLng: aa.maxLng
		}
	};
}

module.exports = {
	METERS_PER_DEG_LAT,
	metersPerDegLngAtLatitude,
	expandBoundsToAspect,
	lngToTileX,
	latToTileY,
	decodePolyline,
	computeOrientedBoundsForPolyline
};
