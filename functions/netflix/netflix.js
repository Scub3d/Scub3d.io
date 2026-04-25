const { getExternalAPIData, getExternalAPICookie, uploadExternalFileToBucketUsingCookies, getExternalAPIResponseStatus, getExternalAPIDataWithCookies, getJSONParsedExternalAPIData, uploadExternalFileToBucket, deleteFirestoreDataForPath, generateCookieForHeader, parseCookieData, getExternalHTML, cropImage, downloadFileFromURL, uploadLocalFileToBucket, roundImage,cropImageButKeepAspectRatio } = require('../misc/common');
const { db, storage } = require('../misc/initFirebase');
const { defeatCaptcha } = require('../misc/anticaptcha');

const { v4: uuidv4 } = require('uuid');
const functions = require('firebase-functions');
const cors = require('cors')({origin: true});
const querystring = require('querystring');

const SERVER_SIDE_REFRESH_INTERVAL = 3600000;
const SERVER_SIDE_DATA_REFRESH_INTERVAL = SERVER_SIDE_REFRESH_INTERVAL - 1000;

const PROFILE_IMAGE_BUCKET_PATH = 'ar/images/netflix/profileImage.png'
const SHOW_BOX_ART_BUCKET_PATH = 'ar/images/netflix/showBoxArt.jpg';
const SHOW_IMAGE_BUCKET_PATH = 'ar/images/netflix/showImage.jpg';

function generateManageProfilesHTMLRequestOptions(auth, cookies) {
	return {
		method: 'GET',
		uri: 'https://www.netflix.com/profiles/manage',
		headers: {
			'Cookie': 'NetflixId=' + cookies.NetflixId,
			'User-Agent': 'PostmanRuntime/7.29.0',
			'Accept': '*/*',
			'Accept-Encoding': 'gzip, deflate, br',
			'Connection': 'keep-alive'
		},
		proxy: auth.proxyIP
	}
}

function generatePathEvaluatorRequestOptions(auth, apiName, apiVersion, cookies, form) {
	return {
		method: 'POST',
		uri: 'https://www.netflix.com/nq/website/memberapi/' + apiVersion + '/pathEvaluator?original_path=/' + apiName + '/mre/pathEvaluator',
		body: form,
		headers: {
			'Cookie': 'NetflixId=' + cookies.NetflixId + '; SecureNetflixId=' + cookies.SecureNetflixId,
			'Content-Type': 'application/x-www-form-urlencoded',
			'x-netflix.request.client.user.guid': auth.profileID,
			'User-Agent': 'PostmanRuntime/7.29.0',
			'Accept': '*/*',
			'Accept-Encoding': 'gzip, deflate, br',
			'Connection': 'keep-alive'
		},
		proxy: auth.proxyIP
	}
}

function generateMetadataRequestOptions(auth, apiVersion, videoID, cookies) {
	return {
		method: 'POST',
		uri: 'https://www.netflix.com/nq/website/memberapi/' + apiVersion + '/metadata?movieid=' + videoID,
		headers: {
			'Cookie': 'NetflixId=' + cookies.NetflixId + '; SecureNetflixId=' + cookies.SecureNetflixId,
			'x-netflix.request.client.user.guid': auth.profileID,
			'User-Agent': 'PostmanRuntime/7.29.0',
			'Accept': '*/*',
			'Accept-Encoding': 'gzip, deflate, br',
			'Connection': 'keep-alive'
		},
		proxy: auth.proxyIP
	}
}

exports.netflix = functions.https.onRequest( async (req, res) => {	
	await cors(req, res, async () => {

		const authDocument = await db.collection('auth').doc('netflix').get();

		if(!authDocument.exists) {
			return res.send({'error': 'something went wrong, try again later'});
		}

		const auth = authDocument.data();

		const configDocument = await db.collection('auth').doc('scub3d').get();

		const netflixDocument = await db.collection('data').doc('netflix').get();

		auth['proxyIP'] = configDocument.data().proxyIP;

		if(netflixDocument.exists) {
			if(Date.now() - netflixDocument.data().timestamp <= SERVER_SIDE_DATA_REFRESH_INTERVAL) { 
				return res.send(netflixDocument.data());
			} 
		} 

		const loginPageCookieRequestOptions = { 
			method: 'GET', 
			uri: 'https://www.netflix.com/login',
			headers: {
				'User-Agent': 'PostmanRuntime/7.29.0',
				'Connection': 'keep-alive'
			},
			proxy: auth.proxyIP
		 }
		const loginPageData = await getExternalAPIDataWithCookies(loginPageCookieRequestOptions);
		const loginPageCookies = parseCookieData(loginPageData.cookies);
		// console.log('loginPageCookies: ' + JSON.stringify(loginPageCookies));

		const authURL = Buffer.from(loginPageData.data).toString().split('<input type="hidden" name="authURL" value="')[1].split('"/>')[0];
		// console.log("authURL: " + authURL);

		const form = {
			"userLoginId": auth.email,
			"password": auth.password,
			"action": 'loginAction',
			"withFields": 'userLoginId,password',
			"authURL": authURL,
		};

		const loginRequestOptions = {
			method: 'POST',
			uri: 'https://www.netflix.com/login',
			body: querystring.stringify(form),
			headers: {
				'Cookie': 'nfvdid=' + loginPageCookies.nfvdid + '; SecureNetflixId=' + loginPageCookies.SecureNetflixId + '; NetflixId=' + loginPageCookies.NetflixId,
				'Content-Type': 'application/x-www-form-urlencoded',
				'User-Agent': 'PostmanRuntime/7.29.0',
				'Accept': '*/*',
				'Accept-Encoding': 'gzip, deflate, br',
				'Connection': 'keep-alive'
			},
			proxy: auth.proxyIP
		};

		const loginCookieData = await getExternalAPICookie(loginRequestOptions);
		const loginCookies = parseCookieData(loginCookieData);	
		
		const browseHTMLRequestOptions = {
			method: 'GET',
			uri: 'https://www.netflix.com/browse',
			headers: {
				'Cookie': 'NetflixId=' + loginCookies.NetflixId + '; SecureNetflixId=' + loginCookies.SecureNetflixId,
				'User-Agent': 'PostmanRuntime/7.29.0',
				'Accept': '*/*',
				'Accept-Encoding': 'gzip, deflate, br',
				'Connection': 'keep-alive'
			},
			proxy: auth.proxyIP
		};

		const browsePageData = await getExternalAPIDataWithCookies(browseHTMLRequestOptions);
		const workingAPIInfo = parseBrowseHTML(Buffer.from(browsePageData.data).toString());

		const continueWatchingListRequestOptions = generatePathEvaluatorRequestOptions(auth, workingAPIInfo.apiName, workingAPIInfo.apiVersion, loginCookies, 'path=["loco",["continueWatching"],0,"itemSummary"]');
		const continueWatchingListData = await getJSONParsedExternalAPIData(continueWatchingListRequestOptions);
		const continueWatchingLatestVideoID = await parseContinueWatchingListJSON(continueWatchingListData);
		// console.log("parseContinueWatchingLatestVideoID: " + continueWatchingLatestVideoID)

		const metadataRequestOptions = generateMetadataRequestOptions(auth, workingAPIInfo.apiVersion, continueWatchingLatestVideoID, loginCookies);
		const metadataData = await getJSONParsedExternalAPIData(metadataRequestOptions);
		const metadataJSON = await parseMetadataJSON(metadataData);

		const manageProfilesHTMLRequestOptions = generateManageProfilesHTMLRequestOptions(auth, loginCookies);
		const manageProfilesHTML = await getExternalHTML(manageProfilesHTMLRequestOptions);
		await uploadProfileImageToBucket(manageProfilesHTML.a, auth);

		await db.collection('data').doc('netflix').set(metadataJSON);
		return res.send(metadataJSON);
	});
});

function parseBrowseHTML(html) {
	return {
		apiVersion: html.split('"headers":{')[1].split('"X-Netflix.uiVersion":"')[1].split('",')[0],
		apiName: html.split('"services":{"data":{"api":{')[1].split('"path":["api","')[1].split('"')[0]
	}
}

function parseContinueWatchingListJSON(json) {
	const listID = Object.keys(json['jsonGraph']['lists'])[0];
	return json['jsonGraph']['lists'][listID]["0"]["itemSummary"]['value']["id"];
}

async function parseMetadataJSON(json) {
	const showBoxArtDownloadOptions = {
		method: 'GET',
		uri: json['video']['boxart'][0]['url']
	};

	const showBoxArtLocalFilepath = await downloadFileFromURL(showBoxArtDownloadOptions, 'netflixShowBoxArtImage', '.jpg');
	const initialCroppedShowBoxArtPath = await cropImageButKeepAspectRatio(showBoxArtLocalFilepath, 'netflixShowBoxArtImage', 91*2, 128*2)
	const croppedShowBoxArtImage = await cropImage(initialCroppedShowBoxArtPath, 'netflixShowBoxArtImage', 91*2, 128*2);
	await uploadLocalFileToBucket(croppedShowBoxArtImage, SHOW_BOX_ART_BUCKET_PATH, 'image/jpeg');

	if(json['video']['type'] === 'movie') {
		const showImageDownloadOptions = {
			method: 'GET',
			uri: json['video']['storyart'][0]['url']
		};

		const showImageLocalFilepath = await downloadFileFromURL(showImageDownloadOptions, 'netflixShowImage', '.jpg');
		const initialCroppedShowImagePath = await cropImageButKeepAspectRatio(showImageLocalFilepath, 'netflixShowImage', 421*2, 128*2)
		const croppedShowImage = await cropImage(initialCroppedShowImagePath, 'netflixShowImage', 421*2, 128*2);
		await uploadLocalFileToBucket(croppedShowImage, SHOW_IMAGE_BUCKET_PATH, 'image/jpeg');

		return {
			timestamp: Date.now(),		
			progress: json['video']['bookmark']['offset'],
			duration: json['video']['runtime'],
			movieTitle: json['video']['title']
		}
	}

	const currentEpisodeID = json['video']['currentEpisode'];
	const seriesTitle = json['video']['title'];

	for(var seasonIndex = 0; seasonIndex < json['video']['seasons'].length; seasonIndex++) {
		for(var episodeIndex = 0; episodeIndex < json['video']['seasons'][seasonIndex]['episodes'].length; episodeIndex++) {
			if(currentEpisodeID === json['video']['seasons'][seasonIndex]['episodes'][episodeIndex]['episodeId']) {
				const episodeJSON = json['video']['seasons'][seasonIndex]['episodes'][episodeIndex];

				const showImageDownloadOptions = {
					method: 'GET',
					uri: episodeJSON['stills'][0]['url']
				};

				const showImageLocalFilepath = await downloadFileFromURL(showImageDownloadOptions, 'netflixShowImage', '.jpg');
				const initialCroppedShowImagePath = await cropImageButKeepAspectRatio(showImageLocalFilepath, 'netflixShowImage', 421*2, 128*2)
				const croppedShowImagePath = await cropImage(initialCroppedShowImagePath, 'netflixShowImage', 421*2, 128*2);
				await uploadLocalFileToBucket(croppedShowImagePath, SHOW_IMAGE_BUCKET_PATH, 'image/jpeg');

				return {
					timestamp: Date.now(),		
					progress: episodeJSON['bookmark']['offset'],
					duration: episodeJSON['runtime'],
					seriesTitle: seriesTitle,
					episodeTitle: episodeJSON['title']
				}
			}
		}
	}
}

async function uploadProfileImageToBucket(html, auth) {
	const profileImageDownloadOptions = {
		method: 'GET',
		uri: html.split('data-profile-guid="' + auth.profileID + '"')[1].split('"background-image:url(')[1].split(')"')[0]
	};

	const profileImageLocalFilepath = await downloadFileFromURL(profileImageDownloadOptions, 'netflixProfileImage', '.png');
	const roundedProfileImage = await roundImage(profileImageLocalFilepath, 'netflixProfileImage', 256, 256);
	await uploadLocalFileToBucket(roundedProfileImage, PROFILE_IMAGE_BUCKET_PATH, 'image/png');
}