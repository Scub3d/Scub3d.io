class LeagueData extends Data {
	timestamp;
	gameName;
	tagLine;
	summonerLevel;
	profileImageID;
	profileBackgroundChampionName;
	profileBackgroundSkinID;
	isInGame = false;
	gameID;
	gameStartTime;
	mapName;
	championName;

	constructor(timestamp, gameName, tagLine, summonerLevel, profileImageID, profileBackgroundChampionName, profileBackgroundSkinID, gameID, gameStartTime, mapName, championName) {
		super();

		this.timestamp = timestamp;
		this.gameName = gameName;
		this.tagLine = tagLine;
		this.summonerLevel = summonerLevel;
		this.profileImageID = profileImageID;
		this.profileBackgroundChampionName = profileBackgroundChampionName;
		this.profileBackgroundSkinID = profileBackgroundSkinID;
		this.gameID = gameID;
		this.gameStartTime = gameStartTime;
		this.mapName = mapName;
		this.championName = championName;

		if(this.gameID !== undefined && this.gameID !== null) {
			this.isInGame = true;
		}
	}

	get riotID() {
		if(!this.gameName) return '';
		return this.tagLine ? this.gameName + '#' + this.tagLine : this.gameName;
	}

	fromJSON(json) {
		return new LeagueData(json['timestamp'], json['gameName'], json['tagLine'], json['summonerLevel'], json['profileImageID'], json['profileBackgroundChampionName'], json['profileBackgroundSkinID'], json['gameID'], json['gameStartTime'], json['mapName'], json['championName']);
	}

	Equals(other) {
		return this.gameName === other.gameName && this.tagLine === other.tagLine && this.summonerLevel === other.summonerLevel && this.profileImageID === other.profileImageID && this.profileBackgroundChampionName === other.profileBackgroundChampionName && this.profileBackgroundSkinID === other.profileBackgroundSkinID && this.gameID === other.gameID;
	}
}