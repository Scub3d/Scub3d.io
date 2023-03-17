const { getJSONParsedExternalAPIData, isEmptyObject, shuffle, uploadExternalFileToBucket, getColorPaletteForImage, getColorLuma, cropImageButKeepAspectRatio, downloadFileFromURL, uploadLocalFileToBucket, roundImage, resizeImageV2 } = require('../misc/common');
const { db } = require('../misc/initFirebase');
const functions = require('firebase-functions');
const cors = require('cors')({origin: true});

const CLIENT_SIDE_REFRESH_INTERVAL = 3600000;
const SERVER_SIDE_DATA_REFRESH_INTERVAL = CLIENT_SIDE_REFRESH_INTERVAL - 1000;

const PROFILE_IMAGE_BUCKET_PATH = 'ar/images/instagram/profileImage.png';
const GALLERY_IMAGE_PATH = 'ar/images/instagram/gallery_image_';
const GALLERY_IMAGE_TYPE = '.jpg';
const GALLERY_IMAGE_COUNT = 4;

function generateUserProfileRequestOptions(auth) {
	return {
		method: 'GET',
		uri: 'https://graph.facebook.com/' + auth.apiVersion + '/' + auth.userID + '?access_token=' + auth.accessToken + '&fields=biography,username,name,media_count,followers_count,follows_count,profile_picture_url'
	};
}

function generateUserMediaRequestOptions(auth) {
	return {
		method: 'GET',
		uri: 'https://graph.facebook.com/' + auth.apiVersion + '/' + auth.userID + '/media?access_token=' + auth.accessToken
	};
}

function generateMediaRequestOptions(auth, mediaID) {
	return {
		method: 'GET',
		uri: 'https://graph.facebook.com/' + auth.apiVersion + '/' + mediaID + '?access_token=' + auth.accessToken + '&fields=caption,comments_count,like_count,media_type,media_url,thumbnail_url',
	}
}

function generateMediaChildrenRequestOptions(auth, mediaID) {
	return {
		method: 'GET',
		uri: 'https://graph.facebook.com/' + auth.apiVersion + '/' + mediaID + '/children?access_token=' + auth.accessToken + '&fields=media_type,media_url,thumbnail_url',
	}
}

exports.instagram = functions.https.onRequest( async (req, res) => {	
	await cors(req, res, async () => {
		const authDocument = await db.collection('auth').doc('instagram').get();

		if(!authDocument.exists) {
			return res.send({'error': 'something went wrong, try again later'});
		}

		const auth = authDocument.data();
		const instagramDocument = await db.collection('data').doc('instagram').get();

		if(instagramDocument.exists) {
			if(Date.now() - instagramDocument.data().timestamp <= SERVER_SIDE_DATA_REFRESH_INTERVAL) {
				return res.send(instagramDocument.data());
			}
		}

		const userProfileRequestOptions = generateUserProfileRequestOptions(auth);
		const userProfileJSON = await getJSONParsedExternalAPIData(userProfileRequestOptions);
		const parsedUserProfileJSON = await parseUserProfileJSON(userProfileJSON);

		const userMediaRequestOptions = generateUserMediaRequestOptions(auth);
		const userMediaJSON = await getJSONParsedExternalAPIData(userMediaRequestOptions);

		const initialMediaID = await parseUserMediaJSON(auth, userMediaJSON, instagramDocument.data().initialMediaID);

		const parsedJSON = Object.assign(parsedUserProfileJSON, { 'initialMediaID': initialMediaID });

		await db.collection('data').doc('instagram').set(parsedJSON);
		return res.send(parsedJSON);
	});
});

async function parseUserProfileJSON(json) {
	const profileImageDownloadOptions = {
		method: 'GET',
		uri: json['profile_picture_url']
	};

	const profileImageLocalFilepath = await downloadFileFromURL(profileImageDownloadOptions, 'instagramProfileImage', '.png');
	const roundedProfileImage = await roundImage(profileImageLocalFilepath, 'instagramProfileImage', 256, 256);
	await uploadLocalFileToBucket(roundedProfileImage, PROFILE_IMAGE_BUCKET_PATH, 'image/png');

	return {
		'username': json['username'],
		'name': json['name'],
		'media_count': json['media_count'],
		'followers_count': json['followers_count'],
		'follows_count': json['follows_count'],
		'timestamp': Date.now(),
	};
}

async function parseUserMediaJSON(auth, json, currentInitialMediaID) {
	var galleryImageIndex = 0;

	for(var mediaIndex = 0; mediaIndex < json['data'].length; mediaIndex++) {
		const mediaRequestOptions = generateMediaRequestOptions(auth, json['data'][mediaIndex]['id']);
		const mediaJSON = await getJSONParsedExternalAPIData(mediaRequestOptions);

		if(mediaJSON['media_type'] === 'CAROUSEL_ALBUM') {
			const mediaChildrenRequestOptions = generateMediaChildrenRequestOptions(auth, json['data'][mediaIndex]['id']);
			const mediaChildrenJSON = await getJSONParsedExternalAPIData(mediaChildrenRequestOptions);

			for(var childIndex = 0; childIndex < mediaChildrenJSON['data'].length; childIndex++) {
				let childMediaURL = mediaChildrenJSON['data'][childIndex]['media_url'];

				if(mediaChildrenJSON['data'][childIndex]['media_type'] === 'VIDEO') {
					childMediaURL = mediaChildrenJSON['data'][childIndex]['thumbnail_url'];
				}

				const childImageLocalFilepath = await downloadFileFromURL({ method: 'GET', uri: childMediaURL }, 'instagramGalleryImage_' + galleryImageIndex, '.jpg');
				const resizedChildImage = await resizeImageV2(childImageLocalFilepath, 'instagramGalleryImage_' + galleryImageIndex, 256, 256);
				await uploadLocalFileToBucket(resizedChildImage, GALLERY_IMAGE_PATH + galleryImageIndex + GALLERY_IMAGE_TYPE, 'image/jpeg');

				galleryImageIndex++;
			}
		} else {
			let mediaURL = mediaJSON['media_url'];

			if(mediaJSON['media_type'] === 'VIDEO') {
				mediaURL = json['thumbnail_url'];
			}

			const galleryImageLocalFilepath = await downloadFileFromURL({ method: 'GET', uri: mediaURL }, 'instagramGalleryImage_' + galleryImageIndex, '.jpg');
			const resizedGalleryImage = await resizeImageV2(galleryImageLocalFilepath, 'instagramGalleryImage_' + galleryImageIndex, 256, 256);
			await uploadLocalFileToBucket(resizedGalleryImage, GALLERY_IMAGE_PATH + galleryImageIndex + GALLERY_IMAGE_TYPE, 'image/jpeg');
			galleryImageIndex++;
		}
	}

	return json['data'][0]['id'];
}