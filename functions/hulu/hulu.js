const { getExternalAPIData, getExternalAPICookie, uploadExternalFileToBucketUsingCookies, getExternalAPIResponseStatus, getExternalAPIDataWithCookies, getJSONParsedExternalAPIData, uploadExternalFileToBucket, deleteFirestoreDataForPath, generateCookieForHeader, parseCookieData, cropImage, downloadFileFromURL, uploadLocalFileToBucket } = require('../misc/common');
const { db, storage } = require('../misc/initFirebase');
const { defeatRecaptchaV3Enterprise } = require('../misc/anticaptcha');

const { v4: uuidv4 } = require('uuid');
const functions = require('firebase-functions');
const cors = require('cors')({origin: true});
const querystring = require('querystring');

const SERVER_SIDE_REFRESH_INTERVAL = 3600000;
const SERVER_SIDE_DATA_REFRESH_INTERVAL = SERVER_SIDE_REFRESH_INTERVAL - 1000;

const SHOW_FRAME_BUCKET_PATH = 'ar/images/hulu/showFrame.jpg';
const SHOW_IMAGE_BUCKET_PATH = 'ar/images/hulu/showImage.jpg';

function generateCSRFTokenRequestOptions() {
	return {
		method: 'GET',
		uri: 'https://secure.hulu.com/api/4.0/generate_csrf_value?for_hoth=true&path=/v2/web/password/authenticate',
	}
}

function generatePasswordAuthenticateRequestOptions(auth, csrfCookies, recaptchaValue) {
	const form = {
		"csrf": csrfCookies._tcv,
		"user_email": auth.email,
		"password": auth.password,
		'recaptcha_type': 'web_invisible',
		'rrventerprise': recaptchaValue
	};

	return {
		method: 'POST',
		uri: 'https://auth.hulu.com/v2/web/password/authenticate',
		body: querystring.stringify(form),
		headers: {
			'Cookie': '_h_csrf_id=' + csrfCookies._h_csrf_id,
			'Content-Type': 'application/x-www-form-urlencoded'
		}
	}
}

function generateHomeHubRequestOptions(sessionToken) {
	return {
		method: 'GET',
		uri: 'https://discover.hulu.com/content/v5/view_hubs/home?schema=1&limit=1',
		headers: {
			'Cookie': '_hulu_session=' + sessionToken
		}
	}
}

function generateContentStateRequestOptions(eabID, sessionToken) {
	return {
		method: 'GET',
		uri: 'https://discover.hulu.com/content/v5/me/state?eab_ids=' + eabID + '&bowie_context=smart_start',
		headers: {
			'Cookie': '_hulu_session=' + sessionToken
		}
	}
}

exports.hulu = functions.https.onRequest( async (req, res) => {	
	await cors(req, res, async () => {
		const authDocument = await db.collection('auth').doc('hulu').get();

		if(!authDocument.exists) {
			return res.send({'error': 'something went wrong, try again later'});
		}

		const auth = authDocument.data();

		const huluDocument = await db.collection('data').doc('hulu').get();

		if(huluDocument.exists) {
			if(Date.now() - huluDocument.data().timestamp <= SERVER_SIDE_DATA_REFRESH_INTERVAL) { 
				return res.send(huluDocument.data());
			} 
		}
		
		const sessionTokenTestRequestOptions = generateHomeHubRequestOptions(auth.sessionToken);
		const sessionTokenTestResponseStatus = await getExternalAPIResponseStatus(sessionTokenTestRequestOptions);
		
		var sessionToken;

		if(auth.sessionToken === undefined || auth.sessionToken === null || sessionTokenTestResponseStatus !== 200) {
			console.log('Refreshing session token');
			const recaptchaResponse = await defeatRecaptchaV3Enterprise(auth.anticaptchaDomain, auth.anticaptchaSitekey);

			const csrfTokenRequestOptions = generateCSRFTokenRequestOptions();
			const csrfTokenCookieData = await getExternalAPICookie(csrfTokenRequestOptions);
			const csrfTokenCookies = parseCookieData(csrfTokenCookieData);

			if(csrfTokenCookies._h_csrf_id === undefined || csrfTokenCookies._tcv === undefined) {
				throw new Error("Could not get cookies required");
			}

			const passwordAuthenticationRequestOptions = generatePasswordAuthenticateRequestOptions(auth, csrfTokenCookies, recaptchaResponse);
			const passwordAuthenticationData = await getExternalAPICookie(passwordAuthenticationRequestOptions);
			const sessionCookies = parseCookieData(passwordAuthenticationData);
			sessionToken = sessionCookies._hulu_session;

			await db.collection('auth').doc('hulu').update({ 'sessionToken': sessionToken })
		} else {
			sessionToken = auth.sessionToken;
		}

		const discoverRequestOptions = generateHomeHubRequestOptions(sessionToken);
		const discoverData = await getJSONParsedExternalAPIData(discoverRequestOptions);
		const homeHubJSON = await parseHomeHubJSON(discoverData);

		const contentStateRequestOptions = generateContentStateRequestOptions(homeHubJSON.eab, sessionToken);
		const contentStateData = await getJSONParsedExternalAPIData(contentStateRequestOptions);
		const contentStateJSON = parseContentStateJSON(contentStateData); 

		const showFrameDownloadOptions = {
			method: 'GET',
			uri: 'https://ib.hulu.com/thumb?eab_id=' + homeHubJSON.eab + '&s=' + Math.round(homeHubJSON.duration * contentStateJSON.progress) + '&size=512x288',
			headers: {
				'Cookie': '_hulu_session=' + sessionToken
			}
		};

		const showFrameLocalFilepath = await downloadFileFromURL(showFrameDownloadOptions, 'huluShowFrame', '.jpg');
		const croppedShowFrameImage = await cropImage(showFrameLocalFilepath, 'huluShowFrame', 512, 128);
		await uploadLocalFileToBucket(croppedShowFrameImage, SHOW_FRAME_BUCKET_PATH, 'image/jpeg');
		// await uploadExternalFileToBucketUsingCookies('https://ib.hulu.com/thumb?eab_id=' + homeHubJSON.eab + '&s=' + Math.round(homeHubJSON.duration * contentStateJSON.progress) + '&size=512x288', '_hulu_session=' + sessionToken, SHOW_FRAME_BUCKET_PATH, 'image/jpeg')

		const parsedJSON = Object.assign(homeHubJSON, contentStateJSON);
		await db.collection('data').doc('hulu').set(parsedJSON);
		return res.send(parsedJSON);
	});
});

async function parseHomeHubJSON(json) {
	// console.log("JSON: " + JSON.stringify(json));
	var currentlyWatchingJSON;

	// Should be the 2nd one in the list but just to be sure
	for(var componentIndex = 0; componentIndex < json['components'].length; componentIndex++) {
		if(json['components'][componentIndex]['name'] === 'Keep Watching') {
			currentlyWatchingJSON = json['components'][componentIndex];
			break;
		}
	}

	// For 'series', *_video pertains to the episode while * pertains to the series artwork itself and *_tile is the series artwork with text (looks like the name of the series overlayed on the * artwork)	

	await uploadExternalFileToBucket(currentlyWatchingJSON['items'][0]['visuals']['artwork']['vertical_tile']['image']['path'] + '&operations=[{"resize":"600x600|max"},{"format":"jpeg"}]', SHOW_IMAGE_BUCKET_PATH, 'image/jpeg');

	console.log("Entity Type: " + currentlyWatchingJSON['items'][0]['metrics_info']['target_type'])

	if(currentlyWatchingJSON['items'][0]['metrics_info']['target_type'] === 'movie') {
		return {
			movieTitle: currentlyWatchingJSON['items'][0]['visuals']['headline'],
			eab: currentlyWatchingJSON['items'][0]['personalization']['eab'],
			duration: currentlyWatchingJSON['items'][0]['actions']['playback']['bundle']['duration'],
			timestamp: Date.now()
		}
	} else if(currentlyWatchingJSON['items'][0]['metrics_info']['target_type'] === 'series') {
		return {
			seriesTitle: currentlyWatchingJSON['items'][0]['visuals']['headline'],
			episodeTitle: currentlyWatchingJSON['items'][0]['visuals']['subtitle'] !== undefined ? currentlyWatchingJSON['items'][0]['visuals']['subtitle'].split(' - ')[1] : null,
			eab: currentlyWatchingJSON['items'][0]['personalization']['eab'],
			duration: currentlyWatchingJSON['items'][0]['actions']['playback']['bundle']['duration'],
			timestamp: Date.now()
		}
	}	
}

function parseContentStateJSON(json) {
	// console.log("Content State JSON: " + JSON.stringify(json));
	return {
		progress: json['items'][0]['progress_percentage'] / 100
	}
}






// locked behind a grecaptcha system. I don't care enough about this to try to defeat that


// get hulu_session cookie from auth.hulu.com/v2/web/profiles/switch/
// set cookies _h_csrf_id and _hulu_dt
// 	- _h_csrf_id comes from the secure.hulu.blahblah generate_csrf_value
// 	- _hulu_dt comes from auth.hulu.com/v3/web/password/authenticate cookies