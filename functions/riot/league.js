const { getExternalAPIData, getExternalAPICookie, uploadExternalFileToBucketUsingCookies, getExternalAPIResponseStatus, getExternalAPIDataWithCookies, getJSONParsedExternalAPIData, uploadExternalFileToBucket, deleteFirestoreDataForPath, generateCookieForHeader, parseCookieData, getExternalHTML, roundImage, cropImage, downloadFileFromURL, uploadLocalFileToBucket, setFileMetadata  } = require('../misc/common');
const { db, storage, admin } = require('../misc/initFirebase');

const { v4: uuidv4 } = require('uuid');
const functions = require('firebase-functions');
const cors = require('cors')({origin: true});

const { FieldValue } = require('firebase-admin/firestore');

const SERVER_SIDE_REFRESH_INTERVAL = 60000;
const SERVER_SIDE_DATA_REFRESH_INTERVAL = SERVER_SIDE_REFRESH_INTERVAL - 1000;

const PROFILE_IMAGE_BUCKET_PATH = 'ar/images/riot/league/profileImage.png'
const CHAMPION_SPLASH_IMAGE_BUCKET_PATH = 'ar/images/riot/league/championSplash.jpg';

const LANGUAGE = 'en_US'; // idk should integrate multiple languages later

function generateDataDragonVersionsRequestOptions() {
	return {
		method: 'GET',
		uri: 'https://ddragon.leagueoflegends.com/api/versions.json'
	}
}

function generateDataDragonChampionsRequestOptions(apiVersion, language) {
	return {
		method: 'GET',
		uri: 'http://ddragon.leagueoflegends.com/cdn/' + apiVersion + '/data/' + language + '/champion.json'
	}
}

function generateDataDragonSpecificChampionRequestOptions(apiVersion, language, championName) {
	return {
		method: 'GET',
		uri: 'http://ddragon.leagueoflegends.com/cdn/' + apiVersion + '/data/' + language + '/champion/' + championName + '.json'
	}
}

function generateSummonerInfoRequestOptions(auth) {
	return {
		method: 'GET',
		uri: 'https://' + auth.region + '.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/' + auth.puuid,
		headers: {
			'Accept-Language': 'en-US,en;q=0.9',
			'Accept-Charset': 'application/x-www-form-urlencoded; charset=UTF-8',
			'X-Riot-Token': auth.apiToken
		}
	}
}

function generateActiveGameRequestOptions(auth) {
	return {
		method: 'GET',
		uri: 'https://' + auth.region + '.api.riotgames.com/lol/spectator/v4/active-games/by-summoner/' + auth.encryptedSummonerID,
		headers: {
			'Accept-Language': 'en-US,en;q=0.9',
			'Accept-Charset': 'application/x-www-form-urlencoded; charset=UTF-8',
			'X-Riot-Token': auth.apiToken
		}
	}
}

function generateMapsRequestOptions() {
	return {
		method: 'GET',
		uri: 'https://static.developer.riotgames.com/docs/lol/maps.json'
	}
}

exports.league = functions.https.onRequest( async (req, res) => {	
	await cors(req, res, async () => {

		const authDocument = await db.collection('auth').doc('riot').get();

		if(!authDocument.exists) {
			return res.send({'error': 'something went wrong, try again later'});
		}

		const auth = authDocument.data();

		const leagueDocument = await db.collection('data').doc('league').get();
		const leagueData = leagueDocument.data();

		if(leagueDocument.exists) {
			if(Date.now() - leagueData.timestamp <= SERVER_SIDE_DATA_REFRESH_INTERVAL) {
				return res.send(leagueData);
			} 
		} 

		const dataDragonVersionsRequestOptions = generateDataDragonVersionsRequestOptions();
		const dataDragonVersionsData = await getJSONParsedExternalAPIData(dataDragonVersionsRequestOptions);
		const currentDataDragonVersion = dataDragonVersionsData[0];

		const summonerInfoRequestOptions = generateSummonerInfoRequestOptions(auth);
		const summonerInfoData = await getJSONParsedExternalAPIData(summonerInfoRequestOptions);
		const summonerInfoJSON = parseSummonerInfoJSON(summonerInfoData);

		auth['encryptedSummonerID'] = summonerInfoJSON['encryptedSummonerID'];

		delete summonerInfoJSON['encryptedSummonerID'];

		if(!leagueDocument.exists || leagueDocument['profileImageID'] !== summonerInfoJSON['profileImageID']) {

			const profileImageDownloadOptions = {
				method: 'GET',
				uri: 'http://ddragon.leagueoflegends.com/cdn/' + currentDataDragonVersion + '/img/profileicon/' + summonerInfoJSON['profileImageID'] + '.png',
			};

			const profileImageLocalFilepath = await downloadFileFromURL(profileImageDownloadOptions, 'leagueOfLegendsProfileImage', '.png');
			const roundedProfileImage = await roundImage(profileImageLocalFilepath, 'leagueOfLegendsProfileImage', 128, 128);
			await uploadLocalFileToBucket(roundedProfileImage, PROFILE_IMAGE_BUCKET_PATH, 'image/png');
		}

		if(!('skinID' in leagueData)) {
			summonerInfoJSON['gameID'] = FieldValue.delete();
			await db.collection('data').doc('league').update(summonerInfoJSON);
			delete summonerInfoJSON['gameID'];
			return res.send(summonerInfoJSON);
		}

		const activeGamesRequestOptions = generateActiveGameRequestOptions(auth);
		const activeGameData = await getJSONParsedExternalAPIData(activeGamesRequestOptions);

		if(activeGameData === {}) {
			summonerInfoJSON['gameID'] = FieldValue.delete();
			await db.collection('data').doc('league').update(summonerInfoJSON);
			delete summonerInfoJSON['gameID'];
			return res.send(summonerInfoJSON);
		}

		const activeGameJSON = parseActiveGameJSON(activeGameData, auth);

		if('gameID' in leagueData) {
			if(activeGameJSON['gameID'] === leagueData['gameID']) {
				return res.send(leagueData);
			}
		}

		const mapsRequestOptions = generateMapsRequestOptions();
		const maps = await getJSONParsedExternalAPIData(mapsRequestOptions);

		for(var mapIndex = 0; mapIndex < maps.length; mapIndex++) {
			if(maps[mapIndex]['mapId'] === activeGameJSON['mapID']) {
				activeGameJSON['mapName'] = maps[mapIndex]['mapName'];
				delete activeGameJSON['mapID'];
			}
		}

		const dataDragonChampionsRequestOptions = generateDataDragonChampionsRequestOptions(currentDataDragonVersion, LANGUAGE);
		const dataDragonChampionsData = await getJSONParsedExternalAPIData(dataDragonChampionsRequestOptions);
		const championIDName = getDataDragonChampionNameFromID(dataDragonChampionsData, activeGameJSON['championID']);
		
		const dataDragonSpecificChampionRequestOptions = generateDataDragonSpecificChampionRequestOptions(currentDataDragonVersion, LANGUAGE, championIDName);
		const dataDragonSpecificChampionData = await getJSONParsedExternalAPIData(dataDragonSpecificChampionRequestOptions);
		const [championName, isSkinAChroma] = parseDataDragonSpecificChampionJSON(dataDragonSpecificChampionData, championIDName, leagueData['skinID']);

		if(isSkinAChroma)
			leagueData['skinID'] = 0;

		const championSplashImageDownloadOptions = {
			method: 'GET',
			uri: 'http://ddragon.leagueoflegends.com/cdn/img/champion/splash/' + championIDName + '_' + leagueData['skinID'] + '.jpg',
		};

		const championSplashImageLocalFilepath = await downloadFileFromURL(championSplashImageDownloadOptions, 'leagueOfLegendsChampionSplashImage', '.jpg');
		await uploadLocalFileToBucket(championSplashImageLocalFilepath, CHAMPION_SPLASH_IMAGE_BUCKET_PATH, 'image/jpg');

		// await uploadExternalFileToBucket('http://ddragon.leagueoflegends.com/cdn/img/champion/splash/' + championIDName + '_' + leagueData['skinID'] + '.jpg', CHAMPION_SPLASH_IMAGE_BUCKET_PATH, 'image/jpg');

		delete activeGameJSON['championID'];
		activeGameJSON['championName'] = championName;
		activeGameJSON['skinID'] = leagueData['skinID']

		const parsedJSON = Object.assign(summonerInfoJSON, activeGameJSON);

		await db.collection('data').doc('league').update(parsedJSON);
		return res.send(parsedJSON);
	});
});

function parseSummonerInfoJSON(json) {
	return {
		timestamp: Date.now(),
		encryptedSummonerID: json['id'],
		summonerName: json['name'],
		summonerLevel: json['summonerLevel'],
		profileImageID: json['profileIconId']
	}
}

function parseActiveGameJSON(json, auth) {
	var participantJSON = {};

	for(var participantIndex = 0; participantIndex < json['participants'].length; participantIndex++) {
		if(json['participants'][participantIndex]['summonerId'] === auth.encryptedSummonerID) {
			participantJSON = json['participants'][participantIndex];
		}
	}

	return {
		gameID: json['gameId'],
		mapID: json['mapId'],
		gameStartTime: json['gameStartTime'],
		championID: participantJSON['championId'],
	}
}

function getDataDragonChampionNameFromID(json, championID) {
	for (const [championIDName, championData] of Object.entries(json['data'])) {
		if(parseInt(championData['key']) === championID) {
			return championIDName;
		}
	}

	console.log("This should not happen :(");
}

function parseDataDragonSpecificChampionJSON(json, championIDName, skinID) {
	if(skinID === 0) return [json['data'][championIDName]['name'], false];

	for(var skinIndex = 0; skinIndex < json['data'][championIDName]['skins'].length; skinIndex++) {
		var skinJSON = json['data'][championIDName]['skins'][skinIndex];
		if(skinJSON['num'] === skinID) return [skinJSON['name'], false];
	}

	return [json['data'][championIDName]['name'], true];
}