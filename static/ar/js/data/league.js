class LeagueData extends Data {
	timestamp;
	summonerName;
	summonerLevel;
	profileImageID;
	profileBackgroundChampionName;
	profileBackgroundSkinID;
	isInGame = false;
	gameID;
	gameStartTime;
	mapName;
	championName;

	constructor(timestamp, summonerName, summonerLevel, profileImageID, profileBackgroundChampionName, profileBackgroundSkinID, gameID, gameStartTime, mapName, championName) {
		super();
		
		this.timestamp = timestamp;
		this.summonerName = summonerName;
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

	fromJSON(json) {
		return new LeagueData(json['timestamp'], json['summonerName'], json['summonerLevel'], json['profileImageID'], json['profileBackgroundChampionName'], json['profileBackgroundSkinID'], json['gameID'], json['gameStartTime'], json['mapName'], json['championName']);
	}

	Equals(other) {
		return this.summonerName === other.summonerName && this.summonerLevel === other.summonerLevel && this.profileImageID === other.profileImageID && this.profileBackgroundChampionName === other.profileBackgroundChampionName && this.profileBackgroundSkinID === other.profileBackgroundSkinID && this.gameID === other.gameID;
	}
}