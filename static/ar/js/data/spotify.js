class SpotifyData extends Data {
	timestamp;
	userID;
	displayName;
	isPlaying;
	trackID;
	trackURL;
	trackName;
	trackArtist;
	trackProgressMS;
	trackDurationMS;
	barAnimationDelay;
	barAnimationDurations;
	deviceType;
	barHex;
	secondaryBarHex;
	previousTrackID;

	updateIntervalMS = 20000;

	constructor(timestamp, userID, displayName, isPlaying, trackID, trackURL, trackName, trackArtist, trackProgressMS, 
				trackDurationMS, barAnimationDelay, barAnimationDurations, deviceType, barHex, secondaryBarHex, previousTrackID) {
		super();

		this.timestamp = timestamp;

		this.userID = userID;
		this.displayName = displayName;
		this.isPlaying = isPlaying;

		this.trackID = trackID;
		this.trackURL = trackURL;
		this.trackName = trackName;
		this.trackArtist = trackArtist;
		this.trackProgressMS = trackProgressMS;
		this.trackDurationMS = trackDurationMS;

		this.barAnimationDelay = barAnimationDelay;
		this.barAnimationDurations = barAnimationDurations;

		this.deviceType = deviceType;

		this.barHex = barHex;
		this.secondaryBarHex = secondaryBarHex;
		
		this.previousTrackID = previousTrackID;
	}

	fromJSON(json) {
		return new SpotifyData(json['timestamp'], json['userID'], json['displayName'], json['isPlaying'], json['trackID'], json['trackURL'],
			json['trackName'], json['trackArtist'], json['trackProgressMS'], json['trackDurationMS'], json['barAnimationDelay'], 
			json['barAnimationDurations'], json['deviceType'], json['barHex'], json['secondaryBarHex'], json['previousTrackID']);
	}

	Equals(other) {
		return this.userID === other.userID && this.displayName === other.displayName && 
				this.isPlaying === other.isPlaying && this.trackID === other.trackID && this.deviceType === other.deviceType;
	}
}