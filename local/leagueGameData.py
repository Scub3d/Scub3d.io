import firebase_admin, requests, json, urllib3, subprocess, re, shutil, os
from firebase_admin import credentials, firestore, storage
from requests.auth import HTTPBasicAuth
from PIL import Image

requests.packages.urllib3.disable_warnings()
cred = credentials.Certificate("credentials.json")

firebase_admin.initialize_app(cred, {
	'projectId': 'scub3d',
	'storageBucket': 'dynamic.scub3d.io'
})

db = firestore.client()
bucket = storage.bucket()

def main():
	leagueDoc = db.collection('data').document('league').get()
	leagueData = leagueDoc.to_dict()

	if(not leagueDoc.exists):
		print("Couldn't find firestore document for league...")
		return

	summonerProfileJSON = getSummonerProfileJSON()

	if summonerProfileJSON != None:
		profileBackgroundChampionID = int(str(summonerProfileJSON['backgroundSkinId'])[:3])
		profileBackgroundSkinID = int(str(summonerProfileJSON['backgroundSkinId'])[3:])
	
		versions = generateDataDragonVersionsRequestOptions()
		champions = generateDataDragonChampionsRequestOptions(versions[0])

		profileBackgroundChampionName = findChampionIDNameFromID(champions, profileBackgroundChampionID)

		if(leagueData == None or 'profileBackgroundChampionName' not in leagueData.keys() or 'profileBackgroundSkinID' not in leagueData.keys()):
			uploadImageURLToBucket('http://ddragon.leagueoflegends.com/cdn/img/champion/splash/' + profileBackgroundChampionName + '_' + str(profileBackgroundSkinID) + '.jpg', 'ar/images/riot/league/profileBackground.jpg')
			db.collection('data').document('league').update({'profileBackgroundChampionName': profileBackgroundChampionName, 'profileBackgroundSkinID': profileBackgroundSkinID})

		if leagueData['profileBackgroundChampionName'] != profileBackgroundChampionName or leagueData['profileBackgroundSkinID'] != profileBackgroundSkinID:
			uploadImageURLToBucket('http://ddragon.leagueoflegends.com/cdn/img/champion/splash/' + profileBackgroundChampionName + '_' + str(profileBackgroundSkinID) + '.jpg', 'ar/images/riot/league/profileBackground.jpg')
			db.collection('data').document('league').update({'profileBackgroundChampionName': profileBackgroundChampionName, 'profileBackgroundSkinID': profileBackgroundSkinID})

	liveGameData = getLiveGameJSON()

	if(liveGameData == None):
		db.collection('data').document('league').update({ 'skinID': firestore.DELETE_FIELD })
	else:
		parsedLiveGameJSON = parseLiveGameJSON(liveGameData, leagueData['summonerName'])

		db.collection('data').document('league').update(parsedLiveGameJSON)

	return 0

def generateDataDragonVersionsRequestOptions():
	r = requests.get('https://ddragon.leagueoflegends.com/api/versions.json')
	return json.loads(r.text)

def generateDataDragonChampionsRequestOptions(apiVersion):
	r = requests.get('http://ddragon.leagueoflegends.com/cdn/' + apiVersion + '/data/en_US/champion.json')
	return json.loads(r.text)

def findChampionIDNameFromID(json, championID):
	for champion in json['data']:
		if int(json['data'][champion]['key']) == championID:
			return json['data'][champion]['id']
	return None

def getSummonerProfileJSON():
	leagueProcessData = subprocess.getoutput("wmic PROCESS WHERE name='LeagueClientUx.exe' GET commandline")

	if(leagueProcessData.split() == ['No', 'Instance(s)', 'Available.']):
		print("League not running")
		return None
	else:
		port = re.search('--app-port=([0-9]*)', leagueProcessData).group().split('=')[1]
		authKey = re.search('--remoting-auth-token=([\w]*)', leagueProcessData).group().split('=')[1]

		headers = {
			'Content-Type': 'application/json',
			'Accept': 'application/json'
		}

		r = requests.get('https://127.0.0.1:' + port + '/lol-summoner/v1/current-summoner/summoner-profile', headers=headers, auth=HTTPBasicAuth('riot', authKey), verify=False)
		if(r.status_code != 200):
			print("Error getting summoner profile data. Status code: " + str(r.status_code))
			return None

		return json.loads(r.text)

def getLiveGameJSON(): 
	try:
		r = requests.get("https://127.0.0.1:2999/liveclientdata/allgamedata", verify=False)
		return json.loads(r.text)
	except requests.exceptions.ConnectionError as e:
		print("Not in a game of League")

	return None
 
def parseLiveGameJSON(json, summonerName):
	# print(json)
	if json['gameData']['gameMode'] == 'TFT':
		return { 'skinID': firestore.DELETE_FIELD }

	playerStats = {}

	for player in json['allPlayers']:
		if player['summonerName'] == summonerName:
			playerStats = player

	if(playerStats == {}):
		print("This should not happen")
		# return None

	return { 'skinID': playerStats['skinID'] }

def uploadImageURLToBucket(url, bucketPath):
	filename = url.split("/")[-1]

	r = requests.get(url, stream=True)

	if r.status_code == 200:
		r.raw.decode_content = True

		with open(filename, 'wb') as f:
			shutil.copyfileobj(r.raw, f)

		blob = bucket.blob(bucketPath)

		with open(filename, 'rb') as tmpFile:
			blob.upload_from_file(tmpFile, content_type='image/jpeg')

		os.remove(filename)

	else:
		print('Couldn\'t find image at url: ' + url)

if __name__ == "__main__":
	main()
