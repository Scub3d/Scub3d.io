const { getJSONParsedExternalAPIData, isEmptyObject, shuffle, uploadExternalFileToBucket, getColorPaletteForImage, getColorLuma, roundImage, downloadFileFromURL, uploadLocalFileToBucket } = require('../misc/common');
const { db } = require('../misc/initFirebase');
const functions = require('firebase-functions');
const cors = require('cors')({origin: true});

const CLIENT_SIDE_REFRESH_INTERVAL = 3600000;
const SERVER_SIDE_DATA_REFRESH_INTERVAL = CLIENT_SIDE_REFRESH_INTERVAL - 1000;

const PROFILE_IMAGE_BUCKET_PATH = 'ar/images/twitter/profileImage.png';
// const MEDIA_IMAGE_BUCKET_PATH = 'ar/images/twitter/tweetMedia.jpg';

function generateProfileRequestOptions(auth) {
	return {
		'method': 'GET',
		'url': 'https://api.twitter.com/2/users/' + auth.userID + '?user.fields=description,pinned_tweet_id,profile_image_url,url,public_metrics',
		headers: {
			'Authorization': 'Bearer ' + auth.bearerToken
		}
	};
}

function generateTimelineTweetRequestOptions(auth) {
	return {
		'method': 'GET',
		'url': 'https://api.twitter.com/2/users/' + auth.userID + '/tweets?max_results=5',
		headers: {
			'Authorization': 'Bearer ' + auth.bearerToken
		}
	};
}

function generateSpecificTweetRequestOptions(auth, tweetID) {
	return {
		'method': 'GET',
		'url': 'https://api.twitter.com/2/tweets/' + tweetID + '?tweet.fields=attachments,created_at,lang,public_metrics&expansions=attachments.media_keys&media.fields=height,preview_image_url,public_metrics,media_key,type,url,width',
		headers: {
			'Authorization': 'Bearer ' + auth.bearerToken
		}
	};
}

function generateSpecificTweetLikingUsersRequestOptions(auth, tweetID) {
	return {
		'method': 'GET',
		'url': 'https://api.twitter.com/2/tweets/' + tweetID + '/liking_users',
		headers: {
			'Authorization': 'Bearer ' + auth.bearerToken
		}
	};
}

function generateSpecificTweetRetweetedByRequestOptions(auth, tweetID) {
	return {
		'method': 'GET',
		'url': 'https://api.twitter.com/2/tweets/' + tweetID + '/retweeted_by',
		headers: {
			'Authorization': 'Bearer ' + auth.bearerToken
		}
	};
}

exports.twitter = functions.https.onRequest( async (req, res) => {	
	await cors(req, res, async () => {
		const authDocument = await db.collection('auth').doc('twitter').get();

		if(!authDocument.exists) {
			return res.send({'error': 'something went wrong, try again later'});
		}

		const auth = authDocument.data();

		const twitterDocument = await db.collection('data').doc('twitter').get();
		
		if(twitterDocument.exists) {
			if(Date.now() - twitterDocument.data().timestamp <= SERVER_SIDE_DATA_REFRESH_INTERVAL) {
				return res.send(twitterDocument.data());
			}
		}

		const profileRequestOptions = generateProfileRequestOptions(auth);
		const profileJSON = await getJSONParsedExternalAPIData(profileRequestOptions);
		const parsedProfileJSON = parseProfileJSON(profileJSON);

		if(parsedProfileJSON.profileImageURL !== twitterDocument.data().profileImageURL) {
			const profileImageDownloadOptions = {
				method: 'GET',
				uri: parsedProfileJSON.profileImageURL.split("_normal")[0] + parsedProfileJSON.profileImageURL.split("_normal")[1]
			};

			const profileImageLocalFilepath = await downloadFileFromURL(profileImageDownloadOptions, 'twitterProfileImage', '.png');
			const roundedProfileImage = await roundImage(profileImageLocalFilepath, 'twitterProfileImage', 256, 256);
			await uploadLocalFileToBucket(roundedProfileImage, PROFILE_IMAGE_BUCKET_PATH, 'image/png');
		}

		if(parsedProfileJSON.pinnedTweetID === twitterDocument.data().pinnedTweetID && parsedProfileJSON.pinnedTweetID !== null && twitterDocument.data().pinnedTweetID !== null) {
			return res.send(twitterDocument.data());
		}

		const timelineRequestOptions = generateTimelineTweetRequestOptions(auth);
		const timelineJSON = await getJSONParsedExternalAPIData(timelineRequestOptions);
		const parsedTimelineJSON = await parseTimelineJSON(timelineJSON);

		const latestTweetID = (parsedProfileJSON.pinnedTweetID !== null && parsedProfileJSON.pinnedTweetID !== undefined) ? parsedTimelineJSON.pinnedTweetID : parsedTimelineJSON.tweetID;

		const specificTweetRequestOptions = generateSpecificTweetRequestOptions(auth, latestTweetID);
		const specificTweetJSON = await getJSONParsedExternalAPIData(specificTweetRequestOptions);
		const parsedSpecificTweetJSON = await parseSpecificTweetJSON(specificTweetJSON);


		const specificTweetLikingUsersRequestOptions = generateSpecificTweetLikingUsersRequestOptions(auth, latestTweetID);
		const specificTweetLikingUsersData = await getJSONParsedExternalAPIData(specificTweetLikingUsersRequestOptions);

		const hasUserLikedOwnTweet = determineIfUserIsInList(specificTweetLikingUsersData, auth.userID);

		const specificTweetRetweetedByRequestOptions = generateSpecificTweetRetweetedByRequestOptions(auth, latestTweetID);
		const specificTweetRetweetedByData = await getJSONParsedExternalAPIData(specificTweetRetweetedByRequestOptions);
		const hasUserRetweetedOwnTweet = determineIfUserIsInList(specificTweetRetweetedByData, auth.userID);

		const parsedJSON = Object.assign(parsedProfileJSON, parsedTimelineJSON, parsedSpecificTweetJSON, { 'hasLikedOwnTweet': hasUserLikedOwnTweet, 'hasRetweetedOwnTweet': hasUserRetweetedOwnTweet });

		await db.collection('data').doc('twitter').set(parsedJSON);
		return res.send(parsedJSON);
	});
});

function parseProfileJSON(json) {
	var jsonToReturn = {
		'url': json['data']['url'],
		'name': json['data']['name'],
		'description': json['data']['description'],
		'profileImageURL': json['data']['profile_image_url'],
		'username': json['data']['username'],
		'followers': json['data']['public_metrics']['followers_count'],
		'following': json['data']['public_metrics']['following_count'],
		'tweet_count': json['data']['public_metrics']['tweet_count'],
	}

	if(json['data']['pinnedTweetID'] !== null && json['data']['pinnedTweetID'] !== undefined) {
		jsonToReturn['pinnedTweetID'] = json['data']['pinnedTweetID'];
	}

	return jsonToReturn;
}

function parseTimelineJSON(json) {
	return {
		'tweetID': json['data'][0]['id']
	}
}

async function parseSpecificTweetJSON(json) {
	return {
		'tweetText': json['data']['text'],
		'tweetRetweetCount': json['data']['public_metrics']['retweet_count'],
		'tweetReplyCount': json['data']['public_metrics']['reply_count'],
		'tweetLikeCount': json['data']['public_metrics']['like_count'],
		'tweetQuoteCount': json['data']['public_metrics']['quote_count'],
		'tweetCreatedAt': json['data']['created_at'],
		'tweetMediaType': json['includes']['media'][0]['type'],
		'tweetMediaViewCount': json['includes']['media'][0]['public_metrics']['view_count'],
	};
}

function determineIfUserIsInList(json, userID) {
	if("data" in json) {
		for(var userIndex = 0; userIndex < json['data'].length; userIndex++) {
			if(json['data'][userIndex].id === userID) {
				return true;
			}
		}
	}

	return false;
}