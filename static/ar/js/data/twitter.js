class TwitterData extends Data {
	timestamp;
	username;
	followersCount;
	followingCount;
	tweetCount;
	profileImageURL;
	tweetID;
	tweetText;
	tweetReplyCount;
	tweetRetweetCount;
	tweetLikeCount;
	tweetCreatedAt;
	hasLikedOwnTweet;
	hasRetweetedOwnTweet;

	constructor(timestamp, username, followersCount, followingCount, tweetCount, profileImageURL, tweetID, tweetText, tweetReplyCount, tweetRetweetCount, tweetLikeCount, tweetCreatedAt, hasLikedOwnTweet, hasRetweetedOwnTweet) {
		super();
		this.timestamp = timestamp;
		this.username = username;
		this.followersCount = followersCount;
		this.followingCount = followingCount;
		this.tweetCount = tweetCount;
		this.profileImageURL = profileImageURL;
		this.tweetID = tweetID;
		this.tweetText = tweetText;
		this.tweetReplyCount = tweetReplyCount;
		this.tweetRetweetCount = tweetRetweetCount;
		this.tweetLikeCount = tweetLikeCount;
		this.tweetCreatedAt = tweetCreatedAt;
		this.hasLikedOwnTweet = hasLikedOwnTweet;
		this.hasRetweetedOwnTweet = hasRetweetedOwnTweet;
	}

	fromJSON(json) {
		return new TwitterData(json['timestamp'], json['username'], json['followers'], json['following'], json['tweet_count'], json['profileImageURL'], json['tweetID'], json['tweetText'], json['tweetReplyCount'], json['tweetRetweetCount'], json['tweetLikeCount'], json['tweetCreatedAt'], json['hasLikedOwnTweet'], json['hasRetweetedOwnTweet']);
	}

	Equals(other) {
		return this.username === other.username && this.followersCount === other.followersCount && this.followingCount === other.followingCount && this.tweetCount === other.tweetCount && this.profileImageURL === other.profileImageURL && this.tweetID === other.tweetID && this.tweetText === other.tweetText && this.tweetReplyCount === other.tweetReplyCount && this.tweetRetweetCount === other.tweetRetweetCount && this.tweetLikeCount === other.tweetLikeCount && this.tweetCreatedAt === other.tweetCreatedAt && this.hasLikedOwnTweet === other.hasLikedOwnTweet && this.hasRetweetedOwnTweet === other.hasRetweetedOwnTweet;
	}
}