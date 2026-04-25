const { getExternalAPIData, getExternalAPICookie, uploadExternalFileToBucketUsingCookies, getExternalAPIResponseStatus, getExternalAPIDataWithCookies, getJSONParsedExternalAPIData, uploadExternalFileToBucket, deleteFirestoreDataForPath, generateCookieForHeader, parseCookieData, getExternalHTML, cropImage, uploadLocalFileToBucket, downloadFileFromURL, cropImageButKeepAspectRatio } = require('../misc/common');
const { db, storage } = require('../misc/initFirebase');

const { v4: uuidv4 } = require('uuid');
const functions = require('firebase-functions');
const cors = require('cors')({origin: true});
const querystring = require('querystring');

const SERVER_SIDE_REFRESH_INTERVAL = 3600000;
const SERVER_SIDE_DATA_REFRESH_INTERVAL = SERVER_SIDE_REFRESH_INTERVAL - 1000;

const PROGRAM_IMAGE_BUCKET_PATH = 'ar/images/disneyplus/programImage.png';
const PROGRAM_TITLE_LAYER_IMAGE_BUCKET_PATH = 'ar/images/disneyplus/programTitleLayerImage.png';
const PROFILE_IMAGE_BUCKET_PATH = 'ar/images/disneyplus/profileImage.png';

function generateLoginPageRequestOptions() {
	return {
		method: 'GET',
		uri: 'https://www.disneyplus.com/login',
		headers: {
			'User-Agent': 'PostmanRuntime/7.28.1'
		}
	}
}

function generateDevicesRequestOptions(accessToken) {
	return {
		method: 'POST',
		uri: 'https://global.edge.bamgrid.com/devices',
		json: {"deviceFamily":"browser","applicationRuntime":"firefox","deviceProfile":"windows","attributes":{}},
		headers: {
			'Authorization': 'Bearer ' + accessToken,
			'Content-Type': 'application/json'

		}
	}
}

function generateTokenRequestOptions(accessToken, form) {
	return {
		method: 'POST',
		uri: 'https://global.edge.bamgrid.com/token',
		body: querystring.stringify(form),
		headers: {
			'Authorization': 'Bearer ' + accessToken,
			'Content-Type': 'application/x-www-form-urlencoded'
		}
	}
}

function generateSessionRequestOptions(accessToken) {
	return {
		method: 'GET',
		uri: 'https://global.edge.bamgrid.com/session',
		headers: {
			'Authorization': accessToken,
			'Content-Type': 'application/json',
			'Accept': 'application/vnd.session-service+json; version=1'
		}
	}
}

function generateGraphQLRequestOptions(auth, accessToken) {
	return {
		method: 'POST',
		uri: 'https://global.edge.bamgrid.com/v1/public/graphql',
		body: '{"query": "mutation login($input: LoginInput!) { login(login: $input) { account { ...account profiles { ...profile } } actionGrant } } fragment account on Account { id } fragment profile on Profile { id name attributes { avatar { id userSelected } isDefault kidsModeEnabled languagePreferences { appLanguage } } } ", "variables": { "input": { "email": "' + auth.email + '", "password": "' + auth.password + '" } } }',
		headers: {
			'Authorization': 'Bearer ' + accessToken,
			'Content-Type': 'application/json'
		}
	}
}

function generateActiveProfileRequestOptions(auth, accessToken) {
	return {
		method: 'PUT',
		uri: 'https://global.edge.bamgrid.com/accounts/me/active-profile/' + auth.profileID,
		headers: {
			'Authorization': 'Bearer ' + accessToken,
		}
	}
}

function generatePersonalizedCollectionsRequestOptions(accessToken, version, region, kidsModeEnabled, impliedMaturityRating, appLanguage) {
	return {
		method: 'GET',
		uri: 'https://content.global.edge.bamgrid.com/svc/content/Collection/PersonalizedCollection/version/' + version + '/region/' + region + '/audience/' + kidsModeEnabled + '/maturity/' + impliedMaturityRating + '/language/' + appLanguage + '/contentClass/home/slug/home',
		headers: {
			'Authorization': 'Bearer ' + accessToken,
		}
	}
}

function generateAvatarRequestOptions(accessToken, avatarID, version, region, kidsModeEnabled, impliedMaturityRating, appLanguage) {
	return {
		method: 'GET',
		uri: 'https://content.global.edge.bamgrid.com/svc/content/Avatars/version/' + version + '/region/' + region + '/audience/' + kidsModeEnabled + '/maturity/' + impliedMaturityRating + '/language/' + appLanguage + '/avatarIds/' + avatarID,
		headers: {
			'Authorization': 'Bearer ' + accessToken,
		}
	}
}

function generateContinueWatchingSetRequestOptions(accessToken, setID, version, region, kidsModeEnabled, impliedMaturityRating, appLanguage) {
	return {
		method: 'GET',
		uri: 'https://content.global.edge.bamgrid.com/svc/content/ContinueWatching/Set/version/' + version + '/region/' + region + '/audience/' + kidsModeEnabled + '/maturity/' + impliedMaturityRating + '/language/' + appLanguage + '/setId/' + setID,
		headers: {
			'Authorization': 'Bearer ' + accessToken,
		}
	}
}

exports.disneyplus = functions.https.onRequest( async (req, res) => {
	await cors(req, res, async () => {
		const authDocument = await db.collection('auth').doc('disneyplus').get();

		if(!authDocument.exists) {
			return res.send({'error': 'something went wrong, try again later'});
		}

		const auth = authDocument.data();

		const disneyPlusDocument = await db.collection('data').doc('disneyplus').get();

		if(disneyPlusDocument.exists) {
			if(Date.now() - disneyPlusDocument.data().timestamp <= SERVER_SIDE_DATA_REFRESH_INTERVAL) { 
				return res.send(disneyPlusDocument.data());
			} 
		} 

		const loginRequestOptions = generateLoginPageRequestOptions();
		const loginPageHTML = await getExternalHTML(loginRequestOptions);
		const loginJSON = parseLoginPageHTMLForClientAPIKey(loginPageHTML.a); 

		const devicesRequestOptions = generateDevicesRequestOptions(loginJSON.clientAPIKey);
		const devicesData = await getExternalAPIData(devicesRequestOptions);
		const deviceAccessToken = parseDeviceAccessToken(devicesData);

		const initialAccessTokenRequestOptionsForm = {
			grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
			subject_token: deviceAccessToken,
			subject_token_type: 'urn:bamtech:params:oauth:token-type:device'
		};
		
		const initialAccessTokenRequestOptions = generateTokenRequestOptions(loginJSON.clientAPIKey, initialAccessTokenRequestOptionsForm);
		const initialAccessTokenData = await getExternalAPIData(initialAccessTokenRequestOptions);
		const initialAccessToken = parseTokenJSON(JSON.parse(initialAccessTokenData.toString()));

		const sessionRequestOptions = generateSessionRequestOptions(initialAccessToken);
		const sessionData = await getJSONParsedExternalAPIData(sessionRequestOptions);

		const graphQLRequestOptions = generateGraphQLRequestOptions(auth, initialAccessToken)
		const graphQLData = await getJSONParsedExternalAPIData(graphQLRequestOptions)
		const graphQLJSON = parseGraphQLJSON(graphQLData);

		const activeProfileRequestOptions = generateActiveProfileRequestOptions(auth, graphQLJSON.accessToken);
		const activeProfileData = await getJSONParsedExternalAPIData(activeProfileRequestOptions);
		const activeProfileAccessToken = parseActiveProfileJSON(activeProfileData);

		const authenticatedAcessTokenRequestOptionsForm = {
			grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
			subject_token: activeProfileAccessToken,
			subject_token_type: 'urn:bamtech:params:oauth:token-type:account'
		};
		const authenticatedAcessTokenRequestOptions = generateTokenRequestOptions(loginJSON.clientAPIKey, authenticatedAcessTokenRequestOptionsForm);
		const authenticatedAcessTokenData = await getExternalAPIData(authenticatedAcessTokenRequestOptions);
		const authenticatedAccessToken = parseTokenJSON(JSON.parse(authenticatedAcessTokenData.toString()));

		const avatarRequestOptions = generateAvatarRequestOptions(authenticatedAccessToken, graphQLJSON.avatarID, loginJSON.personalizedCollectionAPIVersion, graphQLJSON.region, graphQLJSON.kidsModeEnabled, 1450, graphQLJSON.appLanguage);
		const avatarData = await getJSONParsedExternalAPIData(avatarRequestOptions);
		await parseAvatarJSON(avatarData);

		const personalizedCollectionRequestOptions = generatePersonalizedCollectionsRequestOptions(authenticatedAccessToken, loginJSON.personalizedCollectionAPIVersion, graphQLJSON.region, graphQLJSON.kidsModeEnabled, 1450, graphQLJSON.appLanguage);
		const personalizedCollectionData = await getJSONParsedExternalAPIData(personalizedCollectionRequestOptions);
		const continueWatchingSetID = parsePersonalizedCollectionJSON(personalizedCollectionData);

		const continueWatchingRequestOptions = generateContinueWatchingSetRequestOptions(authenticatedAccessToken, continueWatchingSetID, loginJSON.personalizedCollectionAPIVersion, graphQLJSON.region, graphQLJSON.kidsModeEnabled, 1450, graphQLJSON.appLanguage);
		const continueWatchingSetData = await getJSONParsedExternalAPIData(continueWatchingRequestOptions);
		const continueWatchingJSON = await parseContinueWatchingSetJSON(continueWatchingSetData);

		await db.collection('data').doc('disneyplus').set(continueWatchingJSON);
		return res.send(continueWatchingJSON);
	});
});


function parseLoginPageHTMLForClientAPIKey(html) {
	return {
		clientAPIKey: html.split('"clientApiKey":"')[1].split('","')[0],
		avatarAPIVersion: html.split('"endpointsConfiguration":{')[1].split('"apiVersion":"')[1].split('","')[0],
		personalizedCollectionAPIVersion: html.split('"endpointsConfiguration":{')[1].split('"completeStandardCollection":{')[1].split('"apiVersion":"')[1].split('","')[0],
		continueWatchingSetAPIVersion: html.split('"endpointsConfiguration":{')[1].split('"completeStandardCollection":{')[1].split('"apiVersion":"')[1].split('","')[0],
	}
}

function parseDeviceAccessToken(json) {
	return json['assertion'];
}

function parseTokenJSON(json) {
	return json['access_token'];
}

function parseGraphQLJSON(json) {
	return {
		avatarID: json['data']['login']['account']['profiles'][0]['attributes']['avatar']['id'],
		kidsModeEnabled: json['data']['login']['account']['profiles'][0]['attributes']['kidsModeEnabled'],
		appLanguage: json['data']['login']['account']['profiles'][0]['attributes']['languagePreferences']['appLanguage'],
		region: json['extensions']['sdk']['session']['location']['countryCode'],
		accessToken: json['extensions']['sdk']['token']['accessToken'],
	}
}

function parseActiveProfileJSON(json) {
	return json['assertion'];
}

function parsePersonalizedCollectionJSON(json) {
	var continueWatchingContainer;
	for(var containerIndex = 0; containerIndex < json['data']['Collection']['containers'].length; containerIndex++) {
		if(json['data']['Collection']['containers'][containerIndex]['style'] === 'ContinueWatchingSet') {
			continueWatchingContainer = json['data']['Collection']['containers'][containerIndex];
			break;
		}
	}

	return continueWatchingContainer['set']['refId'];
}

async function parseContinueWatchingSetJSON(json) {
	const programData = json['data']['ContinueWatchingSet']['items'][0];
	const programType = programData['programType'];

	const programTitleLayerImageDownloadOptions = {
		method: 'GET',
		uri: programData['image']['title_treatment_layer']['3.91'][programType === 'movie' ? 'program' : 'series']['default']['url'],
	};

	const programTitleLayerImageLocalFilepath = await downloadFileFromURL(programTitleLayerImageDownloadOptions, 'disneyplusProgramTitleLayerImage', '.png');
	const initialCroppedProgramTitleLayerImagePath = await cropImageButKeepAspectRatio(programTitleLayerImageLocalFilepath, 'disneyplusProgramTitleLayerImage', 512 * 2, 128 * 2)
	const croppedProgramTitleLayerImage = await cropImage(initialCroppedProgramTitleLayerImagePath, 'disneyplusProgramTitleLayerImage', 512 * 2, 128 * 2);
	await uploadLocalFileToBucket(croppedProgramTitleLayerImage, PROGRAM_TITLE_LAYER_IMAGE_BUCKET_PATH, 'image/png');

	const programImageDownloadOptions = {
		method: 'GET',
		uri: programData['image']['hero_tile']['3.91'][programType === 'movie' ? 'program' : 'series']['default']['url'],
	};

	const programImageLocalFilepath = await downloadFileFromURL(programImageDownloadOptions, 'disneyplusProgramImage', '.png');
	const initialCroppedProgramImagePath = await cropImageButKeepAspectRatio(programImageLocalFilepath, 'disneyplusProgramImage', 512 * 2, 128 * 2)	
	const croppedProgramImage = await cropImage(initialCroppedProgramImagePath, 'disneyplusProgramImage', 512 * 2, 128 * 2);
	await uploadLocalFileToBucket(croppedProgramImage, PROGRAM_IMAGE_BUCKET_PATH, 'image/png');

	if(programType === 'movie') {
		return {
			duration: programData['meta']['bookmarkData']['runtime'],
			progress: programData['meta']['bookmarkData']['playhead'],
			movieTitle: programData['text']['title']['full']['program']['default']['content'],
			timestamp: Date.now()
		}
	} else if(programType === 'episode') {
		return {
			duration: programData['meta']['bookmarkData']['runtime'],
			progress: programData['meta']['bookmarkData']['playhead'],
			seriesTitle: programData['text']['title']['full']['series']['default']['content'],
			episodeTitle: programData['text']['title']['full']['program']['default']['content'],
			timestamp: Date.now()
		}
	}


	// if(programType === 'movie') {
	// 	// await uploadExternalFileToBucket(programData['image']['title_treatment_layer']['3.91']['program']['default']['url'], PROGRAM_TITLE_LAYER_IMAGE_BUCKET_PATH, 'image/png');

	// 	// const croppedProgramTitleLayerImageLocalFilePath = await cropImage(programData['image']['title_treatment_layer']['3.91']['program']['default']['url'], 'png', 'disneyplusProgramTitleLayerImage', 512, 128);
	// 	// await uploadLocalFileToBucket(croppedProgramTitleLayerImageLocalFilePath, PROGRAM_TITLE_LAYER_IMAGE_BUCKET_PATH, 'image/png');

	// 	const programTitleLayerImageDownloadOptions = {
	// 		method: 'GET',
	// 		uri: programData['image']['title_treatment_layer']['3.91']['program']['default']['url'],
	// 	};

	// 	const programTitleLayerImageLocalFilepath = await downloadFileFromURL(programTitleLayerImageDownloadOptions, 'disneyplusProgramTitleLayerImage', '.png');
	// 	const croppedProgramTitleLayerImage = await cropImage(programTitleLayerImageLocalFilepath, 'disneyplusProgramTitleLayerImage', 512, 128);
	// 	await uploadLocalFileToBucket(croppedProgramTitleLayerImage, PROGRAM_TITLE_LAYER_IMAGE_BUCKET_PATH, 'image/png');

	// 	// await uploadExternalFileToBucket(programData['image']['hero_tile']['3.91']['program']['default']['url'], PROGRAM_IMAGE_BUCKET_PATH, 'image/png');

	// 	// const croppedProgramImageLocalFilePath = await cropImage(programData['image']['hero_tile']['3.91']['program']['default']['url'], 'png', 'disneyplusProgramImage', 512, 128);
	// 	// await uploadLocalFileToBucket(croppedProgramImageLocalFilePath, PROGRAM_IMAGE_BUCKET_PATH, 'image/png');

	// 	const programImageDownloadOptions = {
	// 		method: 'GET',
	// 		uri: programData['image']['hero_tile']['3.91']['program']['default']['url'],
	// 	};

	// 	const programImageLocalFilepath = await downloadFileFromURL(programImageDownloadOptions, 'disneyplusProgramImage', '.png');
	// 	const croppedProgramImage = await cropImage(programImageLocalFilepath, 'disneyplusProgramImage', 512, 128);
	// 	await uploadLocalFileToBucket(croppedProgramImage, PROGRAM_IMAGE_BUCKET_PATH, 'image/png');

	// 	return {
	// 		duration: programData['meta']['bookmarkData']['runtime'],
	// 		progress: programData['meta']['bookmarkData']['playhead'],
	// 		movieTitle: programData['text']['title']['full']['program']['default']['content'],
	// 		timestamp: Date.now()
	// 	}
	// } else if(programType === 'episode') {
	// 	// await uploadExternalFileToBucket(programData['image']['title_treatment_layer']['3.91']['series']['default']['url'], PROGRAM_TITLE_LAYER_IMAGE_BUCKET_PATH, 'image/png');

	// 	const croppedProgramTitleLayerImageLocalFilePath = await cropImage(programData['image']['title_treatment_layer']['3.91']['series']['default']['url'], 'png', 'disneyplusProgramTitleLayerImage', 512, 128);
	// 	await uploadLocalFileToBucket(croppedProgramTitleLayerImageLocalFilePath, PROGRAM_TITLE_LAYER_IMAGE_BUCKET_PATH, 'image/png');

	// 	// await uploadExternalFileToBucket(programData['image']['hero_tile']['3.91']['series']['default']['url'], PROGRAM_IMAGE_BUCKET_PATH, 'image/png');

	// 	const croppedProgramImageLocalFilePath = await cropImage(programData['image']['hero_tile']['3.91']['series']['default']['url'], 'png', 'disneyplusProgramImage', 512, 128);
	// 	await uploadLocalFileToBucket(croppedProgramImageLocalFilePath, PROGRAM_IMAGE_BUCKET_PATH, 'image/png');

	// 	return {
	// 		duration: programData['meta']['bookmarkData']['runtime'],
	// 		progress: programData['meta']['bookmarkData']['playhead'],
	// 		seriesTitle: programData['text']['title']['full']['series']['default']['content'],
	// 		episodeTitle: programData['text']['title']['full']['program']['default']['content'],
	// 		timestamp: Date.now()
	// 	}
	// }
}

async function parseAvatarJSON(json) {
	await uploadExternalFileToBucket(json['data']['Avatars']['avatars'][0]['image']['tile']['1.00']['avatar']['default']['url'], PROFILE_IMAGE_BUCKET_PATH, 'image/png');
}