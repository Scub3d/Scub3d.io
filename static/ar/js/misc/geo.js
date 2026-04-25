// Frontend geo utilities — mirror of functions/misc/geo.js with additions
// specific to browser rendering (polyline decode, UV projection).

const METERS_PER_DEG_LAT = 111320;

function metersPerDegLngAtLatitude(latDeg) {
	return METERS_PER_DEG_LAT * Math.cos(latDeg * Math.PI / 180);
}

// Expand a bbox around its center to match `targetAspect` width/height in
// real meters, then symmetrically pad by `paddingFraction` (default 10%).
// Input bounds may use either plain {minLat,maxLat,minLng,maxLng} or the
// AllTrails naming (latitudeTopLeft/Bottom, longitudeTopLeft/Bottom).
function expandBoundsToAspect(bounds, targetAspect, paddingFraction) {
	const minLat = bounds.minLat !== undefined ? bounds.minLat : parseFloat(bounds.latitudeBottomRight);
	const maxLat = bounds.maxLat !== undefined ? bounds.maxLat : parseFloat(bounds.latitudeTopLeft);
	const minLng = bounds.minLng !== undefined ? bounds.minLng : parseFloat(bounds.longitudeTopLeft);
	const maxLng = bounds.maxLng !== undefined ? bounds.maxLng : parseFloat(bounds.longitudeBottomRight);

	const midLat = (minLat + maxLat) / 2;
	const midLng = (minLng + maxLng) / 2;

	const latMeters = (maxLat - minLat) * METERS_PER_DEG_LAT;
	const lngMeters = (maxLng - minLng) * metersPerDegLngAtLatitude(midLat);

	const currentAspect = lngMeters / latMeters;

	let paddedLatMeters = latMeters;
	let paddedLngMeters = lngMeters;
	if (currentAspect < targetAspect) {
		paddedLngMeters = latMeters * targetAspect;
	} else {
		paddedLatMeters = lngMeters / targetAspect;
	}

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
		widthMeters: paddedLngMeters,
		heightMeters: paddedLatMeters
	};
}

// Decode a Google-encoded polyline string into an array of {lat, lng}.
// Standard algorithm: https://developers.google.com/maps/documentation/utilities/polylinealgorithm
function decodePolyline(encoded) {
	const points = [];
	let index = 0;
	let lat = 0;
	let lng = 0;
	while (index < encoded.length) {
		let b, shift = 0, result = 0;
		do {
			b = encoded.charCodeAt(index++) - 63;
			result |= (b & 0x1f) << shift;
			shift += 5;
		} while (b >= 0x20);
		const dlat = (result & 1) ? ~(result >> 1) : (result >> 1);
		lat += dlat;

		shift = 0;
		result = 0;
		do {
			b = encoded.charCodeAt(index++) - 63;
			result |= (b & 0x1f) << shift;
			shift += 5;
		} while (b >= 0x20);
		const dlng = (result & 1) ? ~(result >> 1) : (result >> 1);
		lng += dlng;

		points.push({ lat: lat * 1e-5, lng: lng * 1e-5 });
	}
	return points;
}

// Project a lat/lng point into a plane's UV space [0,1] given the plane's
// bbox (the padded bounds used to request the terrain/satellite tiles).
// UV convention: u grows east (minLng → maxLng), v grows north (minLat → maxLat).
// Returns null if the point is outside the bbox so the caller can skip it.
function projectLatLngToUV(latLng, bounds) {
	const u = (latLng.lng - bounds.minLng) / (bounds.maxLng - bounds.minLng);
	const v = (latLng.lat - bounds.minLat) / (bounds.maxLat - bounds.minLat);
	if (u < 0 || u > 1 || v < 0 || v > 1) return null;
	return { u, v };
}

// Project a lat/lng into the trail-aligned rectangle's UV space. Bearing is
// CCW radians from east — matches the server's `paddedBearingRadians`. The
// rectangle is centered on (oriented.midLat, oriented.midLng); its long axis
// points along the bearing direction, with display-long extent longMeters.
// Returns null if the point falls outside the rectangle.
//
// UV convention: u grows along the trail direction (+cos θ east, +sin θ north),
// v grows across the trail, flipped so v=0 is at the image-top (+y in world
// after rotation) — matching how canvas/texture images are addressed.
function projectLatLngToOrientedUV(latLng, oriented) {
	const dx = (latLng.lng - oriented.midLng) * metersPerDegLngAtLatitude(oriented.midLat);
	const dy = (latLng.lat - oriented.midLat) * METERS_PER_DEG_LAT;
	const cosT = Math.cos(oriented.bearingRadians);
	const sinT = Math.sin(oriented.bearingRadians);
	const along =  dx * cosT + dy * sinT;
	const across = -dx * sinT + dy * cosT;
	const u = 0.5 + along / oriented.longMeters;
	const v = 0.5 - across / oriented.shortMeters;
	if (u < 0 || u > 1 || v < 0 || v > 1) return null;
	return { u, v };
}

// Rough great-circle distance in km between two lat/lng points. Used to
// estimate the padded-bbox diagonal for trail-length-driven stroke-width
// scaling. Haversine is overkill at widget-bbox scales — equirectangular
// is accurate enough and cheaper.
function approxDistanceKm(a, b) {
	const midLat = (a.lat + b.lat) / 2;
	const dxKm = (b.lng - a.lng) * (metersPerDegLngAtLatitude(midLat) / 1000);
	const dyKm = (b.lat - a.lat) * (METERS_PER_DEG_LAT / 1000);
	return Math.sqrt(dxKm * dxKm + dyKm * dyKm);
}
