class SteamData extends Data {
	timestamp;
	personaName;
	profileURL;
	onlineState;
	isPlaying;
	appID;
	gameName;
	gameHoursPlayed;

	constructor(timestamp, personaName, profileURL, onlineState, isPlaying, appID, gameName, gameHoursPlayed, gameNumberOfAchievements, gameNumberOfAchievementsAchieved) {
		super();
		
		this.timestamp = timestamp;
		this.personaName = personaName;
		this.profileURL = profileURL;
		this.onlineState = onlineState;
		this.isPlaying = isPlaying;
		this.appID = appID;
		this.gameName = gameName;
		this.gameHoursPlayed = gameHoursPlayed;
		this.gameAchievements = gameNumberOfAchievementsAchieved + ' / ' + gameNumberOfAchievements + ' Achievements';
	}

	fromJSON(json) {
		return new SteamData(json['timestamp'], json['personaName'], json['profileURL'], json['onlineState'], json['isPlaying'], json['appID'], json['gameName'], json['gameHoursPlayed'], json['numberOfAchievements'], json['numberOfAchievementsAchieved']);
	}

	Equals(other) {
		return this.personaName === other.personaName && this.profileURL === other.profileURL && this.onlineState === other.onlineState && this.isPlaying === other.isPlaying && this.appID === other.appID && this.gameName === other.gameName && this.gameHoursPlayed === other.gameHoursPlayed && this.gameAchievements === other.gameAchievementss;
	}
}