const functions = require('firebase-functions');
const cors = require('cors')({origin: true});
const { uploadLocalFileToBucket, downloadFileFromURL, getJSONParsedExternalAPIData, uploadExternalFileToBucket, deleteFirestoreDataForPath, deleteStorageDataWithPrefix, cropMP4File } = require('../misc/common');
const { db, storage } = require('../misc/initFirebase');
const fs = require('fs').promises;

const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffmpeg = require('fluent-ffmpeg');
const ffmpeg_static = require('ffmpeg-static');

var ffprobe = require('ffprobe'), ffprobeStatic = require('ffprobe-static');

const os = require('os');
const path = require('path');
const mkdirp = require('mkdirp');

const SERVER_SIDE_REFRESH_INTERVAL = 60000;
const SERVER_SIDE_DATA_REFRESH_INTERVAL = SERVER_SIDE_REFRESH_INTERVAL - 1000;

const ENGLISH_LANGUAGE_URL_PARAM_VALUE = 'english';
const JAPANESE_LANGUAGE_URL_PARAM_VALUE = 'japanese';

const LANGUAGE_URL_PARAM_VALUES = [ENGLISH_LANGUAGE_URL_PARAM_VALUE, JAPANESE_LANGUAGE_URL_PARAM_VALUE]; // Idea is to append to this as I learn more languages and add more? languages to my website

const MINI_PROFILE_BACKGROUND_VIDEO_BUCKET_PATH = 'ar/videos/steam/profileBackground.mp4';
const GAME_ICON_IMAGE_BUCKET_PATH = 'ar/images/steam/gameIcon.jpg';
// const GAME_LOGO_IMAGE_BUCKET_PATH = 'ar/images/steam/gameLogo.jpg';
const PROFILE_IMAGE_BUCKET_PATH = 'ar/images/steam/profileImage.jpg';
const GAME_STORE_BACKGROUND_IMAGE_BUCKET_PATH = 'ar/images/steam/gameStoreBackground.jpg';
const GAME_LIBRARY_IMAGE_BUCKET_PATH = 'ar/images/steam/gameLibraryImage.jpg';
const GAME_STORE_SCREENSHOT_IMAGE_BUCKET_BASE_PATH = 'ar/images/steam/gameStoreScreenshot_';
const GAME_STORE_VIDEO_BUCKET_PATH = 'ar/videos/steam/gameStoreVideo.mp4';

const MINI_PROFILE_AVATAR_FRAME_BUCKET_PATH_PNG = 'ar/images/steam/avatarFrame.png';
const MINI_PROFILE_AVATAR_FRAME_BUCKET_PATH_WEBM = 'ar/videos/steam/avatarFrame.webm';
const MINI_PROFILE_AVATAR_FRAME_BUCKET_PATH_MP4 = 'ar/videos/steam/avatarFrame.mp4';

const MINI_PROFILE_BADGE_ICON_BUCKET_PATH = 'ar/images/steam/miniProfileBadge.png';

const SCREENSHOT_BUCKET_PATH_PREFIX = 'ar/images/steam/gameStoreScreenshot_';

function generatePlayerSummaryRequestOptions(auth) {
	return {
		url: 'https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=' + auth.apiKey + '&steamids=' + auth.steamID
	}
}

function generateMiniProfileRequestOptions(auth) {
	return {
		url: 'https://steam-chat.com/miniprofile/' + auth.miniProfileID + '/json'
	}
}

function generateRecentlyPlayedGamesRequestOptions(auth) {
	return {
		url: 'https://api.steampowered.com/IPlayerService/GetRecentlyPlayedGames/v1/?key=' + auth.apiKey + '&steamid=' + auth.steamID + '&count=50'
	}
}

function generateOwnedGamesRequestOptions(auth, appID) {
	return {
		url: 'https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=' + auth.apiKey + '&steamid=' + auth.steamID + '&include_appinfo=true'
	}
}

function generatePlayerAchievementsForGameRequestOptions(auth, appID) {
	return {
		url: 'https://api.steampowered.com/ISteamUserStats/GetPlayerAchievements/v1?key=' + auth.apiKey + '&steamid=' + auth.steamID + '&appid=' + appID
	}
}

function generateUserStatsForGameRequestOptions(auth, appID) {
	return {
		url: 'https://api.steampowered.com/ISteamUserStats/GetUserStatsForGame/v2/?key=' + auth.apiKey + '&steamid=' + auth.steamID + '&appid=' + appID
	}
}

function generateSchemaForGameRequestOptions(auth, appID, language) {
	return {
		url: 'https://api.steampowered.com/ISteamUserStats/GetSchemaForGame/v2/?key=' + auth.apiKey + '&steamid=' + auth.steamID + '&appid=' + appID + '&l=' + language
	}
}

function generateAppDetailsRequestOptions(appID, language) {
	return {
		url: 'https://store.steampowered.com/api/appdetails?appids=' + appID + '&l=' + language
	}
}

exports.steam = functions.https.onRequest( async (req, res) => {	
	await cors(req, res, async () => {
		const authDocument = await db.collection('auth').doc('steam').get();

		if(!authDocument.exists) {
			return res.send({'error': 'something went wrong, try again later'});
		}

		const auth = authDocument.data();

		const steamDocument = await db.collection('data').doc('steam').get();

		var previousAppID = undefined;

		if(steamDocument.exists) {
			if(Date.now() - steamDocument.data().timestamp <= SERVER_SIDE_DATA_REFRESH_INTERVAL) { 
				return res.send(steamDocument.data());
			} 

			previousAppID = steamDocument.data().appID;
		} 

		const playerSummaryAPIRequestOptions = generatePlayerSummaryRequestOptions(auth);
		const playerSummaryJSON = await getJSONParsedExternalAPIData(playerSummaryAPIRequestOptions);
		const parsedPlayerSummaryJSON = await parsePlayerSummaryJSON(playerSummaryJSON);

		const miniProfileRequestOptions = generateMiniProfileRequestOptions(auth);
		const miniProfileJSON = await getJSONParsedExternalAPIData(miniProfileRequestOptions);
		const parsedMiniProfileJSON = await parseMiniProfileJSON(miniProfileJSON, steamDocument.data());

		if(parsedPlayerSummaryJSON['appID'] === undefined) {
			// Delete all documents currently in the achievements and stats subcollecitons
			// await deleteFirestoreDataForPath('data/steam/achievements');	
			// await deleteFirestoreDataForPath('data/steam/stats');

			const parsedJSON = Object.assign(parsedPlayerSummaryJSON, parsedMiniProfileJSON);
			delete parsedJSON["appID"];
			await db.collection('data').doc('steam').set(parsedJSON);
			return res.send(parsedJSON);
		}
			
		parsedPlayerSummaryJSON['isPlaying'] = true; // wasn't getting set below
			
		const currentAppID = parseInt(parsedPlayerSummaryJSON['appID']);

		const ownedGamesAPIRequestOptions = generateOwnedGamesRequestOptions(auth);
		const ownedGamesJSON = await getJSONParsedExternalAPIData(ownedGamesAPIRequestOptions);
		const parsedOwnedGamesJSON = await parseOwnedGamesJSON(ownedGamesJSON, currentAppID);

		// const recentlyPlayedGamesAPIRequestOptions = generateRecentlyPlayedGamesRequestOptions(auth);
		// const recentlyPlayedGamesJSON = await getJSONParsedExternalAPIData(recentlyPlayedGamesAPIRequestOptions);
		// const parsedRecentlyPlayedGamesJSON = await parseRecentlyPlayedGamesJSON(recentlyPlayedGamesJSON, currentAppID);

		if(previousAppID === currentAppID) {
			const parsedJSON = Object.assign(parsedPlayerSummaryJSON, parsedOwnedGamesJSON);//, parsedRecentlyPlayedGamesJSON);

			await db.collection('data').doc('steam').update(parsedJSON);
			return res.send(parsedJSON);
		}

		const playerAchievementsAPIRequestOptions = generatePlayerAchievementsForGameRequestOptions(auth, currentAppID);
		const playerAchievementsJSON = await getJSONParsedExternalAPIData(playerAchievementsAPIRequestOptions);
		const parsedPlayerAchievementsJSON = parsePlayerAchievementsJSON(playerAchievementsJSON);

		const userStatsForGameAPIRequestOptions = generateUserStatsForGameRequestOptions(auth, currentAppID);
		const userStatsForGameJSON = await getJSONParsedExternalAPIData(userStatsForGameAPIRequestOptions);
		const parsedGetUserStatsForGameJSON = parseGetUserStatsForGameJSON(userStatsForGameJSON);

		var parsedSchemasForGameJSON = {};

		for(var languageIndex = 0; languageIndex < LANGUAGE_URL_PARAM_VALUES.length; languageIndex++) {
			const schemaForGameAPIRequestOptions = generateSchemaForGameRequestOptions(auth, currentAppID, LANGUAGE_URL_PARAM_VALUES[languageIndex]);
			const schemaForGameInLanguageJSON = await getJSONParsedExternalAPIData(schemaForGameAPIRequestOptions);
			const parsedSchemaForGameInLanguageJSON = await parseSchemaForGameForLanguageJSON(schemaForGameInLanguageJSON);

			parsedSchemasForGameJSON[LANGUAGE_URL_PARAM_VALUES[languageIndex]] = parsedSchemaForGameInLanguageJSON;	
		}

		// Delete all documents currently in the achievements and stats subcollecitons
		// await deleteFirestoreDataForPath('data/steam/achievements');	
		// await deleteFirestoreDataForPath('data/steam/stats');	

		const parsedSchemaForGameJSON = await parseSchemaForGameJSON(parsedSchemasForGameJSON, parsedGetUserStatsForGameJSON, parsedPlayerAchievementsJSON);
		
		// await deleteStorageDataWithPrefix(SCREENSHOT_BUCKET_PATH_PREFIX);

		const appDetailsRequestOptions = generateAppDetailsRequestOptions(currentAppID, ENGLISH_LANGUAGE_URL_PARAM_VALUE);
		const appDetailsJSON = await getJSONParsedExternalAPIData(appDetailsRequestOptions);
		const parsedAppDetailsJSON = await parseAppDetailsJSON(appDetailsJSON, currentAppID);

		const parsedJSON = Object.assign(parsedPlayerSummaryJSON, parsedMiniProfileJSON, parsedOwnedGamesJSON, /*, parsedRecentlyPlayedGamesJSON,*/ parsedSchemaForGameJSON, parsedAppDetailsJSON);

		await db.collection('data').doc('steam').set(parsedJSON);
		return res.send(parsedJSON);
	});
});

function sanitizePersonaName(personaName) {
	return personaName.replace('&', '&amp;').trim();
}

function sanitizeGameName(gameName) {
	return gameName.replace(/ *\([^)]*\)*/g, '').replace(/ \[[^)]*\]*/g, '').replace("&", '&amp;').split(' - ')[0].trim();
}

function generateAppLibraryImageURL(appID) {
	return 'https://media.steampowered.com/steam/apps/' + appID + '/library_600x900.jpg';
}

function generateGameAppImageURL(appID, imageID) {
	return 'https://media.steampowered.com/steamcommunity/public/images/apps/' + appID + '/' + imageID + '.jpg';
}

async function parsePlayerSummaryJSON(json) {
	await uploadExternalFileToBucket(json['response']['players'][0]['avatarfull'], PROFILE_IMAGE_BUCKET_PATH, 'image/jpeg');

	return {
		'timestamp': Date.now(), // This call will always return data so timestamp is placed here
		'profileURL': json['response']['players'][0]['profileurl'],
		'personaName': json['response']['players'][0]['personaname'],
		'onlineState': json['response']['players'][0]['personastate'],
		'isPlaying': false, // Set false here, if playing a game it will override
		'lastLogoff': json['response']['players'][0]['lastlogoff'],
		'appID': json['response']['players'][0]['gameid']
	}
}

function promisifyCommand(command) {
  return new Promise((resolve, reject) => {
	command.on('end', resolve).on('error', reject).run();
  });
}

async function parseMiniProfileJSON(json, steamDocument) {
	var jsonToReturn = {};

	const currentProfileBackgroundVideoID = json['profile_background']['video/mp4'].split('/items/')[1].split('.')[0];

	jsonToReturn['profileBackgroundVideoID'] = steamDocument.profileBackgroundVideoID;

	if(steamDocument.profileBackgroundVideoID !== currentProfileBackgroundVideoID) {
		const croppedLocalFilePath = await cropMP4File(json['profile_background']['video/mp4'], 'profileBackgroundVideo', 384, 128);
		await uploadLocalFileToBucket(croppedLocalFilePath, MINI_PROFILE_BACKGROUND_VIDEO_BUCKET_PATH,'video/mp4');

		// await uploadExternalFileToBucket(json['profile_background']['video/mp4'], MINI_PROFILE_BACKGROUND_VIDEO_BUCKET_PATH, 'video/mp4');
		jsonToReturn['profileBackgroundVideoID'] = currentProfileBackgroundVideoID;
	}

	const currentAvatarFrameID = json['avatar_frame'].split('/items/')[1].split('.')[0];

	jsonToReturn['avatarFrameID'] = steamDocument.avatarFrameID;

	if(steamDocument.avatarFrameID !== currentAvatarFrameID) {
	// 	const localDir = path.dirname(localFilepath);
	// const croppedLocalFilepath = localFilepath.replace(localFilename, 'cropped_' + localFilename);

		const profileAvatarFrameImageDownloadOptions = {
			method: 'GET',
			uri: json['avatar_frame'],
		};

		const profileAvatarFrameImageFilepath = await downloadFileFromURL(profileAvatarFrameImageDownloadOptions, 'steamProfileAvatarFrame', '.png');
		await uploadLocalFileToBucket(profileAvatarFrameImageFilepath, MINI_PROFILE_AVATAR_FRAME_BUCKET_PATH_PNG, 'image/png');
		
		// await uploadExternalFileToBucket(json['avatar_frame'], MINI_PROFILE_AVATAR_FRAME_BUCKET_PATH_PNG, 'image/png');

		const tmpDir = os.tmpdir();
		// const tempLocalFile = path.join(tmpDir, 'steamProfileAvatarFrame.png');
		const webmOutputLocalFile = path.join(tmpDir, 'steamProfileAvatarFrame.webm');
		const mp4OutputLocalFile = path.join(tmpDir, 'steamProfileAvatarFrame.mp4');
		// const tempLocalDir = path.dirname(tempLocalFile);
		// await mkdirp(tempLocalDir)

		// await downloadFileFromURL(json['avatar_frame'], tempLocalFile);
		
		let mp4Conversion = ffmpeg(profileAvatarFrameImageFilepath).setFfmpegPath(ffmpegPath).toFormat('mp4').noAudio().outputOptions(['-pix_fmt yuv420p', '-movflags +faststart']).output(mp4OutputLocalFile);
		await promisifyCommand(mp4Conversion);    

		// let webmConversion1 = ffmpeg(tempLocalFile).setFfmpegPath(ffmpegPath).toFormat('webm').outputOptions(['-c:v libvpx-vp9', '-pix_fmt yuv420p']).output(webmOutputLocalFile);
		// await promisifyCommand(webmConversion1);

		let webmConversion2 = ffmpeg(mp4OutputLocalFile).setFfmpegPath(ffmpegPath).toFormat('webm').outputOptions(['-vf chromakey=0x000000:0.01:0.2', '-c:v libvpx', '-vcodec vp8', '-pix_fmt yuva420p', '-metadata:s:v:0 alpha_mode="1"', '-auto-alt-ref 0']).output(webmOutputLocalFile);
		await promisifyCommand(webmConversion2);

		await uploadLocalFileToBucket(webmOutputLocalFile, MINI_PROFILE_AVATAR_FRAME_BUCKET_PATH_WEBM,'video/webm');
		await uploadLocalFileToBucket(mp4OutputLocalFile, MINI_PROFILE_AVATAR_FRAME_BUCKET_PATH_MP4,'video/mp4');

		jsonToReturn['avatarFrameID'] = currentAvatarFrameID;
	}

	return jsonToReturn;

	// return {
	// 	'favoriteBadgeName': json['favorite_badge']['name'],
	// 	'favoriteBadgeXP': json['favorite_badge']['xp'],
	// 	'favoriteBadgeLevel': json['favorite_badge']['level'],
	// 	'level': json['level']
	// }
}

// async function parseRecentlyPlayedGamesJSON(json, appID) {
// 	for(var i = 0; i < json['response']['total_count']; i++) {
// 		if(json['response']['games'][i].appid === appID) {
// 			await uploadExternalFileToBucket(generateGameAppImageURL(appID, json['response']['games'][i].img_icon_url), GAME_ICON_IMAGE_BUCKET_PATH, 'image/jpeg');
// 			await uploadExternalFileToBucket(generateGameAppImageURL(appID, json['response']['games'][i].img_logo_url), GAME_LOGO_IMAGE_BUCKET_PATH, 'image/jpeg');

// 			return {
// 				'gameName': json['response']['games'][i].name,
// 				'gameHoursPlayed': Math.round(json['response']['games'][i].playtime_forever / 60) + " hours played",
// 				'isPlaying': true,
// 			}
// 		}
// 	}

// 	return {};
// }

async function parseOwnedGamesJSON(json, appID) {
	for(var i = 0; i < json['response']['game_count']; i++) {
		if(json['response']['games'][i].appid === appID) {
			await uploadExternalFileToBucket(generateGameAppImageURL(appID, json['response']['games'][i].img_icon_url), GAME_ICON_IMAGE_BUCKET_PATH, 'image/jpeg');
			// await uploadExternalFileToBucket(generateGameAppImageURL(appID, json['response']['games'][i].img_logo_url), GAME_LOGO_IMAGE_BUCKET_PATH, 'image/jpeg');
			// console.log(JSON.stringify(json['response']['games'][i]));

			return {
				'gameName': json['response']['games'][i].name,
				'gameHoursPlayed': Math.round(json['response']['games'][i].playtime_forever / 60) + " hours played",
				'isPlaying': true,
			}
		}
	}
}

function parsePlayerAchievementsJSON(json) {
	if(json === {} || json['playerstats'] === undefined || json['playerstats']['achievements'] === undefined) return {};
	return json['playerstats']['achievements'];
}

function parseGetUserStatsForGameJSON(json) {
	if(json === {} || json['playerstats'] === undefined || json['playerstats']['stats'] === undefined) return {};
	return json['playerstats']['stats'];
}

function parseSchemaForGameForLanguageJSON(json) {
	if(json === {} || json['game'] === {} || json['game']['availableGameStats'] === undefined) return {};

	return {
		'achievements': json['game']['availableGameStats']['achievements'],
		'stats': json['game']['availableGameStats']['stats']
	}
}

async function parseSchemaForGameJSON(schemasForGameJSON, statsJSON, achievementsJSON) {
	if(schemasForGameJSON['english'] === undefined || schemasForGameJSON['english'] === {} || (schemasForGameJSON['english']['stats'] === undefined && schemasForGameJSON['english']['achievements'] === undefined)) return { 'numberOfAchievements': 0, 'numberOfAchievementsAchieved': 0 };

	// var promises = [];

	// if(schemasForGameJSON['english']['stats'] !== undefined) {
	// 	var parsedStatsJSON = {};

	// 	for(var statIndex = 0; statIndex < schemasForGameJSON['english']['stats'].length; statIndex++) {
	// 		const statID = schemasForGameJSON['english']['stats'][statIndex]['name'];

	// 		parsedStatsJSON[statID] = { 
	// 			'id': statID,
	// 			'value': 0
	// 		};
	// 	}

	// 	for(var playerStatIndex = 0; playerStatIndex < statsJSON.length; playerStatIndex++) {
	// 		if(statsJSON[playerStatIndex]["name"] === undefined) continue; // if can't find it, skip it
	// 		parsedStatsJSON[statsJSON[playerStatIndex]['name']]['value'] =  statsJSON[playerStatIndex]['value'];
	// 	}

	// 	for(var parsedStatsIndex = 0; parsedStatsIndex < Object.keys(parsedStatsJSON).length; parsedStatsIndex++) {
	// 		const parsedStatsJSONKey = Object.keys(parsedStatsJSON)[parsedStatsIndex];
	// 		promises.push(db.collection('data').doc('steam').collection('stats').doc(parsedStatsJSON[parsedStatsJSONKey]['id']).set(parsedStatsJSON[parsedStatsJSONKey]));
	// 	}

	// 	for(var languageIndex = 0; languageIndex < LANGUAGE_URL_PARAM_VALUES.length; languageIndex++) {
	// 		const language = LANGUAGE_URL_PARAM_VALUES[languageIndex];
	// 		for(var schemaStatIndex = 0; schemaStatIndex < schemasForGameJSON[language]['stats'].length; schemaStatIndex++) {
	// 			var name = schemasForGameJSON[language]['stats'][schemaStatIndex]['displayName'];

	// 			if(name === undefined) name = "";
							
	// 			promises.push(db.collection('data').doc('steam').collection('stats').doc(schemasForGameJSON[language]['stats'][schemaStatIndex]['name']).collection('name').doc(language).set({ 'name': name }));
	// 		}
	// 	}
	// }

	var numberOfAchievements = 0;
	var numberOfAchievementsAchieved = 0;

	if(schemasForGameJSON['english']['achievements'] !== undefined) {
		numberOfAchievements = schemasForGameJSON['english']['achievements'].length;

		for(var playerAchievementIndex = 0; playerAchievementIndex < achievementsJSON.length; playerAchievementIndex++) {
			if(achievementsJSON[playerAchievementIndex]['achieved'] === 1) numberOfAchievementsAchieved++;
		}

		// var achievmentDocumentPromises = [];
		// var achievmentSubPromises = [];
		// var parsedAchievementsJSON = {};

		// for(var schemaAchievementIndex = 0; schemaAchievementIndex < schemasForGameJSON['english']['achievements'].length; schemaAchievementIndex++) {
		// 	const achievementID = schemasForGameJSON['english']['achievements'][schemaAchievementIndex]['name'];
		// 	parsedAchievementsJSON[achievementID] = {
		// 		'id': achievementID,
		// 	}
		// }

		// for(var playerAchievementIndex = 0; playerAchievementIndex < achievementsJSON.length; playerAchievementIndex++) {
		// 	const achievementID = achievementsJSON[playerAchievementIndex]['apiname'];

		// 	if(parsedAchievementsJSON[achievementID] !== undefined) {
		// 		if(achievementsJSON[playerAchievementIndex]['achieved'] === 1) {
		// 			parsedAchievementsJSON[achievementID]['achieved'] = true;
		// 			numberOfAchievementsAchieved++;
		// 		} else {
		// 			parsedAchievementsJSON[achievementID]['achieved'] = false;
		// 		}

		// 		parsedAchievementsJSON[achievementID]['timestamp'] = achievementsJSON[playerAchievementIndex]['unlocktime'];
		// 	}
		// }

		// for(var parsedAchievementIndex = 0; parsedAchievementIndex < Object.keys(parsedAchievementsJSON).length; parsedAchievementIndex++) {
		// 	const parsedAchievementsJSONKey = Object.keys(parsedAchievementsJSON)[parsedAchievementIndex];
		// 	promises.push(db.collection('data').doc('steam').collection('achievements').doc(parsedAchievementsJSON[parsedAchievementsJSONKey]['id']).set(parsedAchievementsJSON[parsedAchievementsJSONKey]));
		// }
		
		// for(var languageIndex = 0; languageIndex < LANGUAGE_URL_PARAM_VALUES.length; languageIndex++) {
		// 	const language = LANGUAGE_URL_PARAM_VALUES[languageIndex];		
		// 	for(var schemaAchievementIndex = 0; schemaAchievementIndex < schemasForGameJSON[language]['achievements'].length; schemaAchievementIndex++) {
		// 		var name = schemasForGameJSON[language]['achievements'][schemaAchievementIndex]['displayName'];
		// 		var description = schemasForGameJSON[language]['achievements'][schemaAchievementIndex]['description'];

		// 		if(name === undefined) name = "";
		// 		if(description === undefined) description = "";

		// 		const achievmentID = schemasForGameJSON[language]['achievements'][schemaAchievementIndex]['name'];
							
		// 		promises.push(db.collection('data').doc('steam').collection('achievements').doc(achievmentID).collection('name').doc(language).set({ 'name': name }));
		// 		promises.push(db.collection('data').doc('steam').collection('achievements').doc(achievmentID).collection('descriptions').doc(language).set({'description': description }));
		// 	}
		// }
	}

	// await Promise.all(promises);

	return {
		'numberOfAchievements': numberOfAchievements,
		'numberOfAchievementsAchieved': numberOfAchievementsAchieved
	};
}

async function parseAppDetailsJSON(json, appID, language) { 
	// await uploadExternalFileToBucket(json[appID.toString()]['data']['background'], GAME_STORE_BACKGROUND_IMAGE_BUCKET_PATH, 'image/jpeg');
	await uploadExternalFileToBucket(generateAppLibraryImageURL(appID), GAME_LIBRARY_IMAGE_BUCKET_PATH, 'image/jpeg');


	const gameStoreVideoDownloadOptions = {
		method: 'GET',
		uri: json[appID.toString()]['data']['movies'][0]['mp4']['480'],
	};

	const gameStoreVideoLocalFilepath = await downloadFileFromURL(gameStoreVideoDownloadOptions, 'steamGameStoreVideo', '.mp4');
	const croppedGameStoreVideoLocalFilePath = await cropMP4File(gameStoreVideoLocalFilepath, 'steamGameStoreVideo', 427, 128);
	await uploadLocalFileToBucket(croppedGameStoreVideoLocalFilePath, GAME_STORE_VIDEO_BUCKET_PATH, 'video/mp4');


	// const croppedLocalFilePath = await cropMP4File(json[appID.toString()]['data']['movies'][0]['mp4']['480'], 'gameStoreVideo', 427, 128);
	// await uploadLocalFileToBucket(croppedLocalFilePath, GAME_STORE_VIDEO_BUCKET_PATH,'video/mp4');

	// Delete screenshots in bucket

	// for(var screenshotIndex = 0; screenshotIndex < json[appID.toString()]['data']['screenshots'].length; screenshotIndex++) {
	// 	if(screenshotIndex === 5) break;
	// 	await uploadExternalFileToBucket(json[appID.toString()]['data']['screenshots'][screenshotIndex]['path_full'], GAME_STORE_SCREENSHOT_IMAGE_BUCKET_BASE_PATH + screenshotIndex + ".jpg", 'image/jpeg');
	// }
}