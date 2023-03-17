const { getJSONParsedExternalAPIData, isEmptyObject, shuffle, uploadExternalFileToBucket, getColorPaletteForImage, getColorLuma, downloadFileFromURL, uploadLocalFileToBucket } = require('../misc/common');
const { db } = require('../misc/initFirebase');
const functions = require('firebase-functions');
const cors = require('cors')({origin: true});

const CLIENT_SIDE_REFRESH_INTERVAL = 30000;
const SERVER_SIDE_DATA_REFRESH_INTERVAL = CLIENT_SIDE_REFRESH_INTERVAL - 1000;

const NUMBER_OF_BARS = 90;

const PROFILE_IMAGE_BUCKET_PATH = 'ar/images/spotify/profileImage.jpg';
const TRACK_COVER_IMAGE_BUCKET_PATH = 'ar/images/spotify/trackCover.jpg';

function generateTokenRequestOptions(auth) {
	return {
		'method': 'POST',
		'url': 'https://accounts.spotify.com/api/token',
		'headers': {
			'Authorization': 'Basic ' + Buffer.from(auth.clientID + ':' + auth.clientSecret).toString('base64'),
			'Content-Type': 'application/x-www-form-urlencoded',
		},
		form: {
			'grant_type': 'refresh_token',
			'refresh_token': auth.refreshToken
		}
	};
}

function generateRequestOptions(url, accessToken) {
	return {
		url: url,
		headers: {
			'Accept': 'application/json',
			'Content-Type': 'application/json',
			'Authorization': 'Bearer ' + accessToken
		}
	};
}

function generateProfileURL() {
	return 'https://api.spotify.com/v1/me';
}

function generateNowPlayingURL() {
	return 'https://api.spotify.com/v1/me/player/currently-playing?market=us';
}

function generateAvailabledDevicesURL() {
	return 'https://api.spotify.com/v1/me/player/devices';
}

exports.spotify = functions.https.onRequest( async (req, res) => {	
	await cors(req, res, async () => {
		const authDocument = await db.collection('auth').doc('spotify').get();

		if(!authDocument.exists) {
			return res.send({'error': 'something went wrong, try again later'});
		}

		const auth = authDocument.data();

		const spotifyDocument = await db.collection('data').doc('spotify').get();
		
		var previousTrackID = undefined; 

		if(spotifyDocument.exists) {
			if(Date.now() - spotifyDocument.data().timestamp <= SERVER_SIDE_DATA_REFRESH_INTERVAL) {
				return res.send(spotifyDocument.data());
			}

			previousTrackID = spotifyDocument.data().previousTrackID;
		}

		const tokenRequestOptions = generateTokenRequestOptions(auth);
		const tokenData = await getJSONParsedExternalAPIData(tokenRequestOptions);

		const accessToken = tokenData['access_token']

		const profileRequestOptions = generateRequestOptions(generateProfileURL(), accessToken);
		const profileJSON = await getJSONParsedExternalAPIData(profileRequestOptions);
		const parsedProfileJSON = await parseProfileJSON(profileJSON);

		const nowPlayingRequestOptions = generateRequestOptions(generateNowPlayingURL(), accessToken);
		const nowPlayingJSON = await getJSONParsedExternalAPIData(nowPlayingRequestOptions);

		var parsedNowPlayingJSON = {}; // The only API call that can give a 204 response

		if(!isEmptyObject(nowPlayingJSON)) {
			parsedNowPlayingJSON = await parseNowPlayingJSON(nowPlayingJSON);
		} else {
			await db.collection('data').doc('spotify').set(parsedProfileJSON);
			return res.send(parsedProfileJSON);
		}

		const availableDevicesRequestOptions = generateRequestOptions(generateAvailabledDevicesURL(), accessToken);
		const availableDevicesJSON = await getJSONParsedExternalAPIData(availableDevicesRequestOptions);
		const parsedAvailableDevicesJSON = parseAvailableDevicesJSON(availableDevicesJSON);

		const parsedJSON = Object.assign(parsedProfileJSON, parsedNowPlayingJSON, parsedAvailableDevicesJSON);

		if(previousTrackID === undefined || previousTrackID !== parsedJSON['trackID']) {
			parsedJSON['barAnimationDelay'] = generateBarAnimationDelay();
			parsedJSON['barAnimationDurations'] = generateBarAnimationDurations();
		} else if(previousTrackID === parsedJSON['trackID']) {
			parsedJSON['barAnimationDelay'] = spotifyDocument.data().barAnimationDelay;
			parsedJSON['barAnimationDurations'] = spotifyDocument.data().barAnimationDurations;
		}

		parsedJSON['previousTrackID'] = parsedJSON['trackID'];

		await db.collection('data').doc('spotify').set(parsedJSON);
		return res.send(parsedJSON);
	});
});

function sanitizeArtistText(artist) {
	return artist/*.replace("&", "&amp;")*/.trim();
}

function sanitizeTrackText(track) {
	return track.replace(/ *\([^)]*\)*/g, "").replace(/ \[[^)]*\]*/g, "")/*.replace("&", "&amp;")*/.split(" - ")[0].trim();
}

function generateBarAnimationDelay() { // barAnimationDelay
	return "-" + Math.floor(Math.random() * 100000);
}

function generateBarAnimationDurations() {
	arrayToReturn = [];

	for (var barIndex = 0; barIndex < NUMBER_OF_BARS; barIndex++) {
		arrayToReturn.push(800 + 5.778 * barIndex);
	}
		
	return shuffle(arrayToReturn);
}

async function parseProfileJSON(json) {
	uploadExternalFileToBucket(json['images'][0]['url'], PROFILE_IMAGE_BUCKET_PATH, 'image/jpeg');

	return {
		'timestamp': Date.now(),
		'userID': json['id'],
		'displayName': json['display_name'],
		'isPlaying': false
	}
}

async function calculateBarHexForTrackCover(url) {
	const colorPalette = await getColorPaletteForImage(url);
		
	var barHex = colorPalette[0]
	var secondaryBarHex = colorPalette[1];

	if(getColorLuma(colorPalette[0]) < 60) {
		for(var colorIndex = 1; colorIndex < colorPalette.length; colorIndex++) {
			if(getColorLuma(colorPalette[colorIndex]) >= 60) {
				barHex = colorPalette[colorIndex];
				break;
			}
		}
	}

	if(barHex === secondaryBarHex || getColorLuma(secondaryBarHex) < 60) {
		for(var colorIndex = 1; colorIndex < colorPalette.length; colorIndex++) {
			if(getColorLuma(colorPalette[colorIndex]) >= 60 && barHex !== colorPalette[colorIndex]) {
				secondaryBarHex = colorPalette[colorIndex];
				break;
			}
		}
	}

	return { barHex, secondaryBarHex };
}

async function parseNowPlayingJSON(json) {
	if(json["item"] === null) return { 'isPlaying': false };

	artists = '';
	json['item']['artists'].forEach(function(artist) {
		artists += artist['name'] + ', ';
	})

	artists = artists.substring(0, artists.length - 2);

	await uploadExternalFileToBucket(json['item']['album']['images'][1]['url'], TRACK_COVER_IMAGE_BUCKET_PATH, 'image/jpeg');

	const { barHex, secondaryBarHex } = await calculateBarHexForTrackCover(json['item']['album']['images'][1]['url']);

	return {
		'trackProgressMS': json['progress_ms'],
		'trackArtist': sanitizeArtistText(artists),
		'trackName': sanitizeTrackText(json['item']['name']),
		'trackURL': json['item']['external_urls']['spotify'],
		'trackDurationMS': json['item']['duration_ms'],
		'isPlaying': json['is_playing'],
		'trackID': json['item']['id'],
		'barHex': barHex,
		'secondaryBarHex': secondaryBarHex
	}
}

function parseAvailableDevicesJSON(json) {
	for(var deviceIndex = 0; deviceIndex < json['devices'].length; deviceIndex++) {
		if(json['devices'][deviceIndex]['is_active']) {
			return {
				'deviceType': json['devices'][deviceIndex]['type'],
				'deviceVolume': json['devices'][deviceIndex]['volume_percent']
			}
		}
	}
}