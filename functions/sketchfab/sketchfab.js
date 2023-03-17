const functions = require('firebase-functions');
const cors = require('cors')({origin: true});
const { uploadLocalFileToBucket, uploadExternalFileToBucket, getExternalAPIData, getExternalAPIDataTest, getJSONParsedExternalAPIData, cropImage, resizeImageV2, resizeImage, roundImage, downloadFileFromURL  } = require('../misc/common');
const { db, storage } = require('../misc/initFirebase');
// const StreamZip = require('node-stream-zip');

const SERVER_SIDE_DATA_REFRESH_INTERVAL = 86400000; // 24 hours in ms
const GLTF_MODEL_BUCKET_PATH = 'ar/models/sketchfab/model.gltf';
const SCENE_BIN_BUCKET_PATH = 'ar/models/sketchfab/scene.bin';
const MODEL_ARCHIVE_BUCKET_PATH = 'ar/models/sketchfab/model.zip';
// const PROFILE_IMAGE_BUCKET_PATH = 'ar/images/sketchfab/profileImage.jpg';
const PROFILE_IMAGE_BUCKET_PATH = 'ar/images/sketchfab/profileImage.png';
const MODEL_PREVIEW_IMAGE_BUCKET_PATH = 'ar/images/sketchfab/modelPreviewImage.jpeg'

function generateProfileRequestOptions(auth) {
	return {
		method: 'GET',
		url: 'https://api.sketchfab.com/v3/me',
		headers: {
			Authorization: 'Token ' + auth.apiToken
		}
	};
}

function generateModelDetailsRequestOptions(auth, modelID) {
	return {
		method: 'GET',
		url: 'https://api.sketchfab.com/v3/models/' + modelID,
		headers: {
			Authorization: 'Token ' + auth.apiToken
		}
	};
}

function generateDownloadableModelsRequestOptions(auth) {
	return {
		method: 'GET',
		url: 'https://api.sketchfab.com/v3/me/models?downloadable=true',
		headers: {
			Authorization: 'Token ' + auth.apiToken
		}
	};
}

function generateRefreshTokenRequestOptions(auth) {
	return {
		method: 'POST',
		url: 'https://sketchfab.com/oauth2/token/',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded',
		},
		form: {
			'grant_type':'refresh_token',
			'client_id': auth.clientID,
			'client_secret': auth.clientSecret,
			'refresh_token':  auth.refreshToken,
		}
	};
}

function generateDownloadableModelRequestOptions(modelID, accessToken) {
	return {
		method: 'GET',
		url: 'https://api.sketchfab.com/v3/models/' + modelID + '/download',
		headers: {
			'Authorization': 'Bearer ' + accessToken,
		},
		mode: 'cors'
	}
}

exports.sketchfab = functions.https.onRequest( async (req, res) => {	
	await cors(req, res, async () => {
		const authDocument = await db.collection('auth').doc('sketchfab').get();

		if(!authDocument.exists) {
			return res.send({'error': 'something went wrong, try again later'});
		}

		const auth = authDocument.data();

		const refreshTokenRequestOptions = generateRefreshTokenRequestOptions(auth);
		const refreshTokenData = await getJSONParsedExternalAPIData(refreshTokenRequestOptions);

		await db.collection('auth').doc('sketchfab').update({ 'accessToken': refreshTokenData.access_token, 'refreshToken': refreshTokenData.refresh_token});

		const sketchfabDocument = await db.collection('data').doc('sketchfab').get();
		
		var previousModelID = undefined; 

		if(sketchfabDocument.exists) {
			if(Date.now() - sketchfabDocument.data().timestamp <= SERVER_SIDE_DATA_REFRESH_INTERVAL) {
				return res.send(sketchfabDocument.data());
			}

			previousModelID = sketchfabDocument.data().previousTrackID;
		}

		const profileRequestOptions = generateProfileRequestOptions(auth);
		const profileJSON = await getJSONParsedExternalAPIData(profileRequestOptions);
		const parsedProfileJSON = await parseProfileJSON(profileJSON);

		const downloadableModelsRequestOptions = generateDownloadableModelsRequestOptions(auth);
		const downloadableModelsJSON = await getJSONParsedExternalAPIData(downloadableModelsRequestOptions);
		const latestDownloadableModelJSON = parseDownloadableModelsJSON(downloadableModelsJSON);

		const modelDetailsRequestOptions = generateModelDetailsRequestOptions(auth, latestDownloadableModelJSON['modelID']);
		const modelDetailsJSON = await getJSONParsedExternalAPIData(modelDetailsRequestOptions);
		const parsedModelDetailsJSON = await parseModelDetailsJSON(modelDetailsJSON);

		const parsedJSON = Object.assign(parsedProfileJSON, latestDownloadableModelJSON, parsedModelDetailsJSON);

		if(parsedJSON.modelID === previousModelID) {
			return res.send(parsedJSON);
		}
		
		const downloadableModelRequestOptions = generateDownloadableModelRequestOptions(parsedJSON.modelID, refreshTokenData.access_token);
		const downloadableModelJSON = await getJSONParsedExternalAPIData(downloadableModelRequestOptions);
		
		await uploadExternalFileToBucket(downloadableModelJSON['gltf']['url'], MODEL_ARCHIVE_BUCKET_PATH, 'application/zip')

		parsedJSON.previousModelID = parsedJSON.modelID;

		await db.collection('data').doc('sketchfab').set(parsedJSON);
		return res.send(parsedJSON);
	});
});


async function parseProfileJSON(json) {
	const profileImageDownloadOptions = {
		method: 'GET',
		uri: json['avatar']['images'][json['avatar']['images'].length - 1]['url'],
	};

	const profileImageFilepath = await downloadFileFromURL(profileImageDownloadOptions, 'sketchfabProfileImage', '.jpg');
	const roundedProfileImage = await roundImage(profileImageFilepath, 'sketchfabProfileImage', 100, 100);
	await uploadLocalFileToBucket(roundedProfileImage, PROFILE_IMAGE_BUCKET_PATH, 'image/png');

	return {
		username: json['displayName'],
		modelsCount: json['modelCount'],
		followerCount: json['followerCount'],
		followingCount: json['followingCount'],
		timestamp: Date.now()
	}
}

function parseDownloadableModelsJSON(json) {
	return {
		modelID: json['results'][0]['uid'],
		modelName: json['results'][0]['name'],
		modelPublishedDate: json['results'][0]['publishedAt'],
		modelViewCount: json['results'][0]['viewCount'],
		modelLikeCount: json['results'][0]['likeCount'],
		modelVertexCount: json['results'][0]['vertexCount'],
		modelFaceCount: json['results'][0]['faceCount'],
		modelURL: json['results'][0]['viewerUrl']
		// isModelStaffPicked: json['results'][0]['staffpickedAt'] === null ? false : true
	}
}

async function parseModelDetailsJSON(json) {
	// const croppedLocalFilePath = await cropImage(json['thumbnails']['images'][1]['url'], 'jpg', 'sketchfabModelPreviewImage', 128, 128);
	// await uploadLocalFileToBucket(croppedLocalFilePath, MODEL_PREVIEW_IMAGE_BUCKET_PATH,'image/jpeg');

	const modelPreviewImageDownloadOptions = {
		method: 'GET',
		uri: json['thumbnails']['images'][1]['url']
	};

	const modelPreviewImageLocalFilepath = await downloadFileFromURL(modelPreviewImageDownloadOptions, 'sketchfabModelPreviewImage', '.jpg');
	const resizedModelPreviewImageLocalFilepath = await resizeImageV2(modelPreviewImageLocalFilepath, 'sketchfabModelPreviewImage', 256, 256);
	// const croppedModelPreviewImage = await cropImage(resizedModelPreviewImageLocalFilepath, 'sketchfabModelPreviewImage', 256, 256);
	await uploadLocalFileToBucket(resizedModelPreviewImageLocalFilepath, MODEL_PREVIEW_IMAGE_BUCKET_PATH, 'image/jpeg');

	// await uploadExternalFileToBucket(json['thumbnails']['images'][1]['url'], MODEL_PREVIEW_IMAGE_BUCKET_PATH,'image/jpeg');
	return {
		"modelDownloadCount": json['downloadCount'],
	}
}	