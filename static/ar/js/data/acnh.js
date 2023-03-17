class ACNHData extends Data {
	timestamp;
	passportName;
	islandName;
	dreamAddress;
	authorID;
	villagers;
	friends;

	constructor(timestamp, passportName, islandName, dreamAddress, authorID, villagers, friends) {
		super();

		this.timestamp = timestamp;
		this.passportName = passportName;
		this.islandName = islandName;
		this.dreamAddress = dreamAddress;
		this.authorID = authorID;
		this.villagers = villagers;
		this.friends = friends;
	}

	fromJSON(json, villagers, friends) {
		return new ACNHData(json['timestamp'], json['passportName'], json['islandName'], json['dreamAddress'], json['authorID'], villagers, friends);		

	}

	Equals(other) {
		return this.passportName === other.passportName && this.islandName === other.islandName && this.dreamAddress === other.dreamAddress && this.authorID === other.authorID && this.villagers === other.villagers && this.friends === other.friends;
	}
}