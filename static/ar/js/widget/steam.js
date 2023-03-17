class SteamWidget extends BaseWidget {
	dataDocumentID = 'steam';
	data;

	logoImageURL = this.staticAssetBaseURL + 'ar/img/steam/logo.svg';
	
	profileImageBucketPath = 'ar/images/steam/profileImage.jpg';
	profileBackgroundVideoBucketPath = 'ar/videos/steam/profileBackground.mp4'
	profileAvatarFrameVideoBucketPath ='ar/videos/steam/avatarFrame.mp4';

	gameLibraryImageBucketPath = 'ar/images/steam/gameLibraryImage.jpg';
	gameStoreVideoBucketPath = 'ar/videos/steam/gameStoreVideo.mp4';

	OnlineState = Object.freeze({ 0: "Offline", 1: "Online", 2: "Busy", 3: "Away", 4: "Snooze", 5: "Looking to trade", 6: "Looking to play" })

	constructor(db, storage) {
		super(db, storage);
		this.data = new SteamData();
	}

	async generateAFrameHTML() {
		const profileImageURL = await this.storage.ref(this.profileImageBucketPath).getDownloadURL();
		const profileBackgroundVideoURL = await this.storage.ref(this.profileBackgroundVideoBucketPath).getDownloadURL();
		const profileAvatarFrameVideoURL = await this.storage.ref(this.profileAvatarFrameVideoBucketPath).getDownloadURL();
		const gameLibraryImageURL = await this.storage.ref(this.gameLibraryImageBucketPath).getDownloadURL();
		const gameStoreVideoURL = await this.storage.ref(this.gameStoreVideoBucketPath).getDownloadURL();

		$('<a-entity/>', {
			id: this.dataDocumentID + 'Widget',
			rotation: '-90 0 0',
			scale: '2 0.5 2',
		}).appendTo('#businessCardMarker');

		$('#' + this.dataDocumentID + 'Widget').attr('position', (this.xPositionModifier * 1) + ' 0 ' + (this.zPositionModifier * 0));

		if(this.data['isPlaying']) {
			$('<a-entity/>', {
				id: this.dataDocumentID + 'WidgetBody',
				rotation: '0 0 0',
				scale: '0.833984375 1 1',
			}).appendTo('#businessCardMarker');

			$('#' + this.dataDocumentID + 'WidgetBody').attr('position', '0.0830078125 0 0.001');

			$('<a-plane/>', {
				id: this.dataDocumentID + 'WidgetGameInfoColliderPlane',
				rotation: '0 0 0',
				scale: '1 1 1',
				class: 'clickable',
				material: "opacity: 0; depthWrite: false"
			}).appendTo('#' + this.dataDocumentID + 'WidgetBody');

			$('#' + this.dataDocumentID + 'WidgetGameInfoColliderPlane').attr('position', '0 0 0.01');
			$('#' + this.dataDocumentID + 'WidgetGameInfoColliderPlane').attr('check-events', 'url: ' + 'url: https://store.steampowered.com/app/' + this.data.appID);

			$('<a-image/>', {
				id: this.dataDocumentID + 'WidgetGameLibraryImage',
				rotation: '0 0 0',
				scale: '0.166015625 1 1',
				src: gameLibraryImageURL,
			}).appendTo('#' + this.dataDocumentID + 'Widget');

			$('#' + this.dataDocumentID + 'WidgetGameLibraryImage').attr('position', '-0.4169921875 0 0.001');
			$('#' + this.dataDocumentID + 'WidgetGameLibraryImage').attr('material', 'shader: left-sided-rounded-corners; percent: ' + 1.0 + ';aspectRatio: ' + (128.0 / 85.0));

			$('<a-video/>', {
				id: this.dataDocumentID + 'WidgetGameStoreVideo',
				rotation: '0 0 0',
				scale: '1 1 1',
				src: gameStoreVideoURL,
				muted: '',
				autoplay: '',
				loop: true
			}).appendTo('#' + this.dataDocumentID + 'WidgetBody');

			$('#' + this.dataDocumentID + 'WidgetGameStoreVideo').attr('position', '0 0 0.001');
			$('#' + this.dataDocumentID + 'WidgetGameStoreVideo').attr('material', 'shader: right-sided-rounded-corners; percent: ' + 1.0 + ';aspectRatio: ' + (128.0 / 427.0));

			generateAFrameTextEntity(this.dataDocumentID + 'WidgetGameNameText', '#' + this.dataDocumentID + 'WidgetBody', this.data['gameName'], 22, '#90ba3c', 0, 'Montserrat', 300, 28, false, '#FF000000', 16, 14, 272, 386, 128, 1, true);
			generateAFrameTextEntity(this.dataDocumentID + 'WidgetGameHoursPlayedText', '#' + this.dataDocumentID + 'WidgetBody', this.data['gameHoursPlayed'], 14, '#90ba3c', 4, 'Montserrat', 300, 18, false, '#00FF0000', 16, -11, 272, 386, 128, 1, true);
			generateAFrameTextEntity(this.dataDocumentID + 'WidgetGameAchievementsText', '#' + this.dataDocumentID + 'WidgetBody', this.data['gameAchievements'], 14, '#90ba3c', 4, 'Montserrat', 300, 18, false, '#00FF0000', 16, -11, 272, 386, 128, 1, true);
			generateAFrameAlternatingEntities([this.dataDocumentID + 'WidgetGameHoursPlayedText', this.dataDocumentID + 'WidgetGameAchievementsText'], this.dataDocumentID + 'WidgetBody');

			$('<a-image/>', {
				id: this.dataDocumentID + 'WidgetLogo',
				rotation: '0 0 0',
				scale: '0.125 0.375 1',
				crossorigin: 'anonymous',
				src: this.logoImageURL,
				material: 'shader: flat; npot: true',
				side: 'double',
				transparent: 'true',
				npot: 'true',
				depthTest: true,
				'anti-tear': ''
			}).appendTo('#' + this.dataDocumentID + 'WidgetBody');	

			$('#' + this.dataDocumentID + 'WidgetLogo').attr('position', '0.375 0 0.0001');
		} else {
			$('<a-entity/>', {
				id: this.dataDocumentID + 'WidgetBody',
				rotation: '0 0 0',
				scale: '0.75 1 1',
			}).appendTo('#' + this.dataDocumentID + 'Widget');

			$('#' + this.dataDocumentID + 'WidgetBody').attr('position', '0.125 0 0');

			// $('<a-plane/>', {
			// 	id: this.dataDocumentID + 'WidgetProfileInfoColliderPlane',
			// 	rotation: '0 0 0',
			// 	scale: '1 1 1',
			// 	class: 'clickable',
			// 	material: "depthRead: false; depthWrite: false; visible: false; transparent: true"
			// }).appendTo('#' + this.dataDocumentID + 'Widget');

			// $('#' + this.dataDocumentID + 'WidgetProfileInfoColliderPlane').attr('position', '0 0 0.01');
			// $('#' + this.dataDocumentID + 'WidgetProfileInfoColliderPlane').attr('check-events', 'url: ' + this.data.profileURL);

			$('<a-image/>', {
				id: this.dataDocumentID + 'WidgetProfileImage',
				rotation: '0 0 0',
				scale: '0.25 1 1',
				src: profileImageURL,
			}).appendTo('#' + this.dataDocumentID + 'Widget');

			$('#' + this.dataDocumentID + 'WidgetProfileImage').attr('position', '-0.375 0 0.001');

			$('#steamProfileAvatarFrameVideoTest').attr('src', profileAvatarFrameVideoURL);

			$('<a-video/>', {
				id: this.dataDocumentID + 'WidgetProfileFrameVideo',
				rotation: '0 0 0',
				scale: '0.3 1.2 1.2',
				src: profileAvatarFrameVideoURL,
				muted: '',
				autoplay: '',
				loop: true,
			}).appendTo('#' + this.dataDocumentID + 'Widget');

			$('#' + this.dataDocumentID + 'WidgetProfileFrameVideo').attr('position', '-0.375 0 0.002');
			$('#' + this.dataDocumentID + 'WidgetProfileFrameVideo').attr('material', 'shader: chromakey; src: #steamProfileAvatarFrameVideoTest; color: 0 0 0; depthWrite: false; depthTest: false; transparent: true');

			$('<a-video/>', {
				id: this.dataDocumentID + 'WidgetProfileBackgroundVideo',
				position: '0 0 0.001',
				rotation: '0 0 0',
				scale: '1 1 1',
				src: profileBackgroundVideoURL,
				muted: '',
				autoplay: '',
				loop: true,
				material: 'transparent: false;'
			}).appendTo('#' + this.dataDocumentID + 'WidgetBody');

			$('#' + this.dataDocumentID + 'WidgetProfileBackgroundVideo').attr('material', 'shader: right-sided-rounded-corners; transparent: false; percent: ' + 1.0 + ';aspectRatio: ' + (128.0 / 386.0));
			$('#' + this.dataDocumentID + 'WidgetProfileBackgroundVideo').attr('position', '0 0 0.001');

			generateAFrameTextEntity(this.dataDocumentID + 'WidgetPersonaNameText', '#' + this.dataDocumentID + 'WidgetBody', this.data['personaName'], 32, '#57cbde', 0, 'Montserrat', 300, 33, false, '#000FF000', 16, 15.36, 272, 384, 128, 1);
			generateAFrameTextEntity(this.dataDocumentID + 'WidgetOnlineStateText', '#' + this.dataDocumentID + 'WidgetBody', this.OnlineState[this.data['onlineState']], 16, '#bababa', 0, 'Montserrat', 300, 38.8667, false, '#0FF00000', 18, -21.76, 272, 384, 128, 1);

			$('<a-image/>', {
				id: this.dataDocumentID + 'WidgetLogo',
				rotation: '0 0 0',
				scale: '0.125 0.375 1',
				crossorigin: 'anonymous',
				src: this.logoImageURL,
				material: 'shader: flat; npot: true',
				side: 'double',
				transparent: 'true',
				npot: 'true',
				depthTest: true,
				'anti-tear': ''
			}).appendTo('#' + this.dataDocumentID + 'WidgetBody');	

			$('#' + this.dataDocumentID + 'WidgetLogo').attr('position', '0.375 0 0.0001');
		}

		$('#scene').removeClass('not-ready');
	}
}