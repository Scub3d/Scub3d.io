class InstagramData extends Data {
	timestamp;
	username;
	followersCount;
	followingCount;
	mediaCount;
	initialMediaID;

	constructor(timestamp, username, followersCount, followingCount, mediaCount, initialMediaID) {
		super();

		this.timestamp = timestamp;
		this.username = username;
		this.followersCount = followersCount;
		this.followingCount = followingCount;
		this.mediaCount = mediaCount;
		this.initialMediaID = initialMediaID;
	}

	fromJSON(json) {
		return new InstagramData(json['timestamp'], json['username'], json['followers_count'], json['follows_count'], json['media_count'], json['initialMediaID']);
	}

	Equals(other) {
		return this.username === other.username && this.followersCount === other.followersCount && this.followingCount === other.followingCount && this.mediaCount === other.mediaCount && this.initialMediaID === other.initialMediaID;
	}
}