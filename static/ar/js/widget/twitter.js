class TwitterWidget extends BaseWidget {
	elementClass = 'twitter';
	dataDocumentID = 'twitter';
	data;

	repliesImageURL = this.staticAssetBaseURL + 'ar/img/twitter/reply.svg';
	retweetsImageURL = this.staticAssetBaseURL + 'ar/img/twitter/retweet.svg';
	likesImageURL = this.staticAssetBaseURL + 'ar/img/twitter/like.svg';
	logoImageURL = this.staticAssetBaseURL + 'ar/img/twitter/logo.svg';
	
	profileImageBucketPath = 'ar/images/twitter/profileImage.png';

	constructor(db, storage) {
		super(db, storage);
		this.data = new TwitterData();
	}

	async generateAFrameHTML() {
		const profileImageURL = await this.storage.ref(this.profileImageBucketPath).getDownloadURL();
	
		$('<a-entity/>', {
			id: this.elementClass + 'Widget',
			rotation: '-90 0 0',
			scale: '2 0.5 2', 
			class: 'clickable',
		}).appendTo('#businessCardMarker');

		$('#' + this.dataDocumentID + 'Widget').attr('check-events', 'https://twitter.com/' + this.data.username); // This is a temporary hack but doesn't actually matter because this widget isn't being displayed anymore
		$('#' + this.elementClass + 'Widget').attr('position', (this.xPositionModifier * -1) + ' 0 ' + (this.zPositionModifier * 2));

		$('<a-entity/>', {
			id: this.elementClass + 'WidgetBody',
			rotation: '0 0 0',
			scale: '1 1 1'
		}).appendTo('#' + this.elementClass + 'Widget');

		$('<a-image/>', {
			id: this.elementClass + 'WidgetBackground',
			rotation: '0 0 0',
			scale: '1 1 1',
			material: 'transparent: false; opacity: 0.0;depthTest:false;depthWrite:false'
		}).appendTo('#' + this.elementClass + 'WidgetBody');

		$('#' + this.elementClass + 'WidgetBackground').attr('position', '0 0 -.0075');
		$('#' + this.elementClass + 'WidgetBackground').attr('material', 'shader: color-rounded-corners; color: ' + (29.0 / 255.0) + ' ' + (155.0 / 255.0) + ' ' + (240.0 / 255.0)  + '; multiplier: ' + 1.0 + '; aspectRatio: ' + (128.0 / 512.0));

		$('<a-image/>', {
			id: this.elementClass + 'WidgetForeground',
			rotation: '0 0 0',
			scale: '0.95 0.925 0.925',
		}).appendTo('#' + this.elementClass + 'WidgetBody');

		$('#' + this.elementClass + 'WidgetForeground').attr('position', '0 0 .0075');
		$('#' + this.elementClass + 'WidgetForeground').attr('material', 'shader: color-rounded-corners; color: ' + (255.0 / 255.0) + ' ' + (255.0 / 255.0) + ' ' + (255.0 / 255.0) + '; multiplier: ' + 1.0 + '; aspectRatio: ' + (128.0 / 512.0));

		$('<a-entity/>', {
			id: this.elementClass + 'WidgetProfileInfo',
			rotation: '0 0 0',
			scale: '1 1 1',
		}).appendTo('#' + this.elementClass + 'WidgetBody');

		$('#' + this.elementClass + 'WidgetProfileInfo').attr('position', '0 0 .0075');

		generateAFrameTextEntity(this.elementClass + 'WidgetUsernameText', '#' + this.elementClass + 'WidgetProfileInfo', this.data.username, 26, '#0f1419', 0, 'Montserrat', 300, 32, true, '#FF000000', 24, 18, 392, 512, 128, 1, false);

		generateAFrameTextEntity(this.elementClass + 'WidgetTweetCount', '#' + this.elementClass + 'WidgetProfileInfo', this.data.tweetCount + ' tweets', 16, '#262626', 10, 'Montserrat', 300, 19, true, '#00FF0000', 24, -13, 130, 512, 128, 1, false);
		generateAFrameTextEntity(this.elementClass + 'WidgetFollowersCount', '#' + this.elementClass + 'WidgetProfileInfo', this.data.followersCount + ' followers', 16, '#262626', 10, 'Montserrat', 300, 19, true, '#0000FF00', 24 + 130, -13, 130, 512, 128, 1, false);
		generateAFrameTextEntity(this.elementClass + 'WidgetFollowingCount', '#' + this.elementClass + 'WidgetProfileInfo', this.data.followingCount + ' following', 16, '#262626', 10, 'Montserrat', 300, 19, true, '#0FF00000', 24 + 130 + 130, -13, 130, 512, 128, 1, false);

		$('<a-entity/>', {
			id: this.elementClass + 'WidgetTweetHolder',
			rotation: '0 0 0',
			scale: '1 1 1',
		}).appendTo('#' + this.elementClass + 'WidgetBody');

		$('#' + this.elementClass + 'WidgetTweetHolder').attr('position', '0 0 .0075');

		generateAFrameMultiLineTextEntity(this.elementClass + 'WidgetTweetText', '#' + this.elementClass + 'WidgetTweetHolder', this.data.tweetText, 15, '#0f1419', 'Montserrat', 300, '#FF000000', 28, 24, 388, 64, 512, 128);

		$('<a-image/>', {
			id: this.elementClass + 'WidgetTweetReplyImage',
			rotation: '0 0 0',
			scale: '0.03125 0.125 1',
			src: this.repliesImageURL,
			material: 'alphaTest: 0.5; color: #536471; shader:flat'
		}).appendTo('#' + this.elementClass + 'WidgetTweetHolder');

		$('#' + this.elementClass + 'WidgetTweetReplyImage').attr('position', (-(0.1171875 - (24 / 512) + (120 / 512) + (0.03125 / 2))) + ' -0.3 0.001');

		generateAFrameTextEntity(this.elementClass + 'WidgetTweetReplyCountText', '#' + this.elementClass + 'WidgetTweetHolder', this.data.tweetReplyCount.toString(), 12, '#0f1419', 0, 'Montserrat', 300, 14, false, '#00FF0000', 116, -38.4, 64, 512, 128, 1, false);

		$('<a-image/>', {
			id: this.elementClass + 'WidgetTweetRetweetImage',
			rotation: '0 0 0',
			scale: '0.03125 0.125 1',
			src: this.retweetsImageURL,
			material: 'shader:flat; alphaTest: 0.5; color: #' + (this.data.hasRetweetedOwnTweet ? '00ba7c' : '536471') + ';'
		}).appendTo('#' + this.elementClass + 'WidgetTweetHolder');

		$('#' + this.elementClass + 'WidgetTweetRetweetImage').attr('position', (-(0.1171875 - (24 / 512) + (0 / 512) + (0.03125 / 2))) + ' -0.3 0.001');

		generateAFrameTextEntity(this.elementClass + 'WidgetTweetRetweetCountText', '#' + this.elementClass + 'WidgetTweetHolder', this.data.tweetRetweetCount.toString(), 12, (this.data.hasRetweetedOwnTweet ? '#00ba7c' : '#0f1419'), 0, 'Montserrat', 300, 14, false, '#00FF0000', 236, -38.4, 64, 512, 128, 1, false);

		$('<a-image/>', {
			id: this.elementClass + 'WidgetTweetLikeImage',
			rotation: '0 0 0',
			scale: '0.03125 0.125 1',
			src: this.likesImageURL,
			material: 'shader:flat; alphaTest: 0.5; color: #' + (this.data.hasLikedOwnTweet ? 'f91880' : '536471') + ';'
		}).appendTo('#' + this.elementClass + 'WidgetTweetHolder');

		$('#' + this.elementClass + 'WidgetTweetLikeImage').attr('position', (-(0.1171875 - (24 / 512) - (120 / 512) + (0.03125 / 2))) + ' -0.3 0.001');

		generateAFrameTextEntity(this.elementClass + 'WidgetTweetLikeCountText', '#' + this.elementClass + 'WidgetTweetHolder', this.data.tweetLikeCount.toString(), 12, (this.data.hasLikedOwnTweet ? '#f91880' : '#0f1419'), 0, 'Montserrat', 300, 14, false, '#00FF0000', 356, -38.4, 64, 512, 128, 1, false);

		generateAFrameAlternatingEntities([this.elementClass + 'WidgetProfileInfo', this.elementClass + 'WidgetTweetHolder'], this.elementClass + 'WidgetForeground');

		generateAFrameAlternatingLogo(this.elementClass + 'WidgetLogo', '#' + this.elementClass + 'WidgetForeground', '0.40625 0 0.002', '0 0 0', '0.09375 0.375 1', this.logoImageURL, profileImageURL);
	}
}
