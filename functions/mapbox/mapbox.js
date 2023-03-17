const { getJSONParsedExternalAPIData, uploadExternalFileToBucket, resizeImageV2, roundImageCorners, downloadFileFromURL, uploadLocalFileToBucket } = require('../misc/common');
const { db, storage } = require('../misc/initFirebase');

const functions = require('firebase-functions');
const cors = require('cors')({origin: true});

const SERVER_SIDE_REFRESH_INTERVAL = 14400000
const SERVER_SIDE_DATA_REFRESH_INTERVAL = SERVER_SIDE_REFRESH_INTERVAL - 1000;

const LOCATION_MAP_IMAGE_BUCKET_PATH = 'ar/images/mapbox/location_map.png';
const TERRAIN_RGB_IMAGE_BUCKET_PATH = 'ar/images/mapbox/terrain_rgb.png';
const SATELLITE_IMAGE_BUCKET_PATH = 'ar/images/mapbox/satellite.png';

const MAP_ZOOM_LEVEL = 9;

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

		let tileX = long2tile(parsedReverseGeocodingJSON['roughLongitude'], MAP_ZOOM_LEVEL);
		let tileY = lat2tile(parsedReverseGeocodingJSON['roughLatitude'], MAP_ZOOM_LEVEL);

		let terrainRGBImageURL = 'https://api.mapbox.com/v4/mapbox.terrain-rgb/' + MAP_ZOOM_LEVEL + '/' + tileX + '/' + tileY + '@2x.pngraw?access_token=' + auth.token;
		const terrainRGBImageLocalFilepath = await downloadFileFromURL(terrainRGBImageURL, 'mapboxTerrainRGBImage', '.png');
		const croppedTerrainRGBImageLocalFilepath = await resizeImageV2(terrainRGBImageLocalFilepath, 'mapboxTerrainRGBImage', 512, 128)
		// const roundedCornerTerrainRGBImageLocalFilepath = await roundImageCorners(terrainRGBImageLocalFilepath, 'mapboxTerrainRGBImage')
		await uploadLocalFileToBucket(croppedTerrainRGBImageLocalFilepath, TERRAIN_RGB_IMAGE_BUCKET_PATH, 'image/png');

		let satelliteImageURL = 'https://api.mapbox.com/styles/v1/mapbox/satellite-v9/static/' + parsedReverseGeocodingJSON['roughLongitude'] + ',' + parsedReverseGeocodingJSON['roughLatitude'] + ',' + MAP_ZOOM_LEVEL + ',0/512x128@2x?access_token=' + auth.token;
		// const satelliteImageLocalFilepath = await downloadFileFromURL(satelliteImageURL, 'mapboxSatelliteImage', '.png');
		// const roundedCornerSatelliteImageLocalFilepath = await roundImageCorners(satelliteImageLocalFilepath, 'mapboxSatelliteImage')
		// await uploadLocalFileToBucket(roundedCornerSatelliteImageLocalFilepath, SATELLITE_IMAGE_BUCKET_PATH, 'image/png');
		await uploadExternalFileToBucket(satelliteImageURL, SATELLITE_IMAGE_BUCKET_PATH, 'image/png')

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