const { getJSONParsedExternalAPIData, uploadExternalFileToBucket, downloadFileFromURL, uploadLocalFileToBucket } = require('../misc/common');
const { db, storage } = require('../misc/initFirebase');

const functions = require('firebase-functions');
const cors = require('cors')({origin: true});
const sharp = require('sharp');
const os = require('os');
const path = require('path');

const SERVER_SIDE_REFRESH_INTERVAL = 14400000
const SERVER_SIDE_DATA_REFRESH_INTERVAL = SERVER_SIDE_REFRESH_INTERVAL - 1000;

const LOCATION_MAP_IMAGE_BUCKET_PATH = 'ar/images/mapbox/location_map.png';
const TERRAIN_RGB_IMAGE_BUCKET_PATH = 'ar/images/mapbox/terrain_rgb.png';
const SATELLITE_IMAGE_BUCKET_PATH = 'ar/images/mapbox/satellite.png';

const MAP_ZOOM_LEVEL = 9;
const TERRAIN_TILE_SIZE = 256;
const TERRAIN_OUTPUT_WIDTH = 512;
const TERRAIN_OUTPUT_HEIGHT = 128;

function generateReverseGeocodingRequestOptions(auth) {
	return {
		method: 'GET',
		uri: 'https://api.mapbox.com/geocoding/v5/mapbox.places/' + auth.longitude + ',' + auth.latitude + '.json?limit=1&types=place&access_token=' + auth.token,
	}
}

exports.mapbox = functions.https.onRequest( async (req, res) => {	
	await cors(req, res, async () => {
		const authDocument = await db.collection('auth').doc('mapbox').get();

		if(!authDocument.exists) {
			return res.send({'error': 'something went wrong, try again later'});
		}

		const auth = authDocument.data();

		const mapboxDocument = await db.collection('data').doc('mapbox').get();

		if(mapboxDocument.exists) {
			if(Date.now() - mapboxDocument.data().timestamp <= SERVER_SIDE_DATA_REFRESH_INTERVAL) { 
				return res.send(mapboxDocument.data());
			} 
		} 

		const reverseGeocodingRequestOptions = generateReverseGeocodingRequestOptions(auth);
		const reverseGeocodingData = await getJSONParsedExternalAPIData(reverseGeocodingRequestOptions);
		const parsedReverseGeocodingJSON = parseReverseGeocodingData(reverseGeocodingData);

		let staticImageURL = 'https://api.mapbox.com/styles/v1/mapbox/outdoors-v11/static/' + parsedReverseGeocodingJSON['roughLongitude'] + ',' + parsedReverseGeocodingJSON['roughLatitude'] + ',' + MAP_ZOOM_LEVEL + ',0/512x128@2x?access_token=' + auth.token;
		await uploadExternalFileToBucket(staticImageURL, LOCATION_MAP_IMAGE_BUCKET_PATH, 'image/png');

		const terrainLocalPath = await buildStitchedTileImage(
			'mapbox.terrain-rgb',
			parsedReverseGeocodingJSON['roughLongitude'],
			parsedReverseGeocodingJSON['roughLatitude'],
			MAP_ZOOM_LEVEL,
			auth.token,
			'.pngraw'
		);
		await uploadLocalFileToBucket(terrainLocalPath, TERRAIN_RGB_IMAGE_BUCKET_PATH, 'image/png');

		// Satellite used to come from the mapbox static-image API, but that
		// endpoint renders dynamically and its pixel grid isn't guaranteed
		// to align with raw mercator tiles — a 1-2 pixel horizontal shift
		// vs terrain-rgb was visible on tall peaks. Stitching satellite
		// tiles from mapbox.satellite via the same tile math as terrain-rgb
		// guarantees pixel-perfect alignment between the two.
		const satelliteLocalPath = await buildStitchedTileImage(
			'mapbox.satellite',
			parsedReverseGeocodingJSON['roughLongitude'],
			parsedReverseGeocodingJSON['roughLatitude'],
			MAP_ZOOM_LEVEL,
			auth.token,
			'.png'
		);
		await uploadLocalFileToBucket(satelliteLocalPath, SATELLITE_IMAGE_BUCKET_PATH, 'image/png');

		await db.collection('data').doc('mapbox').set(parsedReverseGeocodingJSON);
		return res.send(parsedReverseGeocodingJSON);
	});
});

function parseReverseGeocodingData(json) {
	return {
		roughLatitude: json['features'][0]['center'][1],
		roughLongitude: json['features'][0]['center'][0],
		featureID: json['features'][0]['id'],
		placeNameShort: json['features'][0]['text'],
		placeNameLong: json['features'][0]['place_name'],
		timestamp: Date.now()
	}
}

function long2tile(lon,zoom) {
	return (Math.floor((lon+180)/360*Math.pow(2,zoom)));
}

function lat2tile(lat,zoom) {
	return (Math.floor((1-Math.log(Math.tan(lat*Math.PI/180) + 1/Math.cos(lat*Math.PI/180))/Math.PI)/2 *Math.pow(2,zoom)));
}

function long2tileFloat(lon, zoom) {
	return (lon + 180) / 360 * Math.pow(2, zoom);
}

function lat2tileFloat(lat, zoom) {
	return (1 - Math.log(Math.tan(lat*Math.PI/180) + 1/Math.cos(lat*Math.PI/180))/Math.PI) / 2 * Math.pow(2, zoom);
}

// Download tiles from a mapbox raster tileset (e.g. mapbox.terrain-rgb,
// mapbox.satellite) and stitch a TERRAIN_OUTPUT_WIDTH x TERRAIN_OUTPUT_HEIGHT
// PNG centered on (lon, lat). Because both the terrain and satellite inputs
// share this function, their geographic coverage is guaranteed identical
// down to the pixel — which the mapbox static-image API does NOT guarantee
// against raw tile math.
async function buildStitchedTileImage(tilesetId, lon, lat, zoom, token, tileFileExt) {
	const exactTileX = long2tileFloat(lon, zoom);
	const exactTileY = lat2tileFloat(lat, zoom);

	const halfWidthInTiles = (TERRAIN_OUTPUT_WIDTH / 2) / TERRAIN_TILE_SIZE;
	const halfHeightInTiles = (TERRAIN_OUTPUT_HEIGHT / 2) / TERRAIN_TILE_SIZE;

	const xMinFloat = exactTileX - halfWidthInTiles;
	const xMaxFloat = exactTileX + halfWidthInTiles;
	const yMinFloat = exactTileY - halfHeightInTiles;
	const yMaxFloat = exactTileY + halfHeightInTiles;

	const tileXStart = Math.floor(xMinFloat);
	const tileXEnd = Math.ceil(xMaxFloat) - 1;
	const tileYStart = Math.floor(yMinFloat);
	const tileYEnd = Math.ceil(yMaxFloat) - 1;

	const tileCols = tileXEnd - tileXStart + 1;
	const tileRows = tileYEnd - tileYStart + 1;

	const tilesetSlug = tilesetId.replace(/[^A-Za-z0-9]/g, '_');
	const downloadJobs = [];
	for(let ty = tileYStart; ty <= tileYEnd; ty++) {
		for(let tx = tileXStart; tx <= tileXEnd; tx++) {
			const url = 'https://api.mapbox.com/v4/' + tilesetId + '/' + zoom + '/' + tx + '/' + ty + tileFileExt + '?access_token=' + token;
			downloadJobs.push(
				downloadFileFromURL(url, tilesetSlug + '_' + tx + '_' + ty, '.png')
					.then(localPath => ({ tx, ty, localPath }))
			);
		}
	}
	const tiles = await Promise.all(downloadJobs);

	const composites = tiles.map(({ tx, ty, localPath }) => ({
		input: localPath,
		left: (tx - tileXStart) * TERRAIN_TILE_SIZE,
		top: (ty - tileYStart) * TERRAIN_TILE_SIZE,
	}));

	const stitchedBuffer = await sharp({
		create: {
			width: tileCols * TERRAIN_TILE_SIZE,
			height: tileRows * TERRAIN_TILE_SIZE,
			channels: 3,
			background: { r: 0, g: 0, b: 0 },
		},
	}).composite(composites).png().toBuffer();

	const extractLeft = Math.round((xMinFloat - tileXStart) * TERRAIN_TILE_SIZE);
	const extractTop = Math.round((yMinFloat - tileYStart) * TERRAIN_TILE_SIZE);

	const outputPath = path.join(os.tmpdir(), tilesetSlug + '_stitched.png');
	await sharp(stitchedBuffer)
		.extract({
			left: extractLeft,
			top: extractTop,
			width: TERRAIN_OUTPUT_WIDTH,
			height: TERRAIN_OUTPUT_HEIGHT,
		})
		.png()
		.toFile(outputPath);

	return outputPath;
}