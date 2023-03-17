class SpotifyWidget extends BaseWidget {
	dataDocumentID = 'spotify';
	data;

	isArtistTextTooLong;
	isTrackTextTooLong;

	SPOTIFY_DEVICES_IMAGE_URL_MAPPING = {
		"Computer": 'https://static.scub3d.io/ar/img/spotify/computer.svg',
		"Tablet": 'https://static.scub3d.io/ar/img/spotify/tablet.svg',
		"Car": 'https://static.scub3d.io/ar/img/spotify/car.svg',
		"Offline": 'https://static.scub3d.io/ar/img/spotify/offline.svg',
		"Other": 'https://static.scub3d.io/ar/img/spotify/other.svg',
		"TV": 'https://static.scub3d.io/ar/img/spotify/tv.svg',
		"CastAudio": 'https://static.scub3d.io/ar/img/spotify/speaker.svg',
		"CastVideo": 'https://static.scub3d.io/ar/img/spotify/tv.svg',
		"Smartphone": 'https://static.scub3d.io/ar/img/spotify/smartphone.svg',
		"Watch": 'https://static.scub3d.io/ar/img/spotify/watch.svg',
	};

	logoImageURL = this.staticAssetBaseURL + 'ar/img/spotify/logo.svg';

	profileImageBucketPath = 'ar/images/spotify/profileImage.jpg';
	trackCoverImageBucketPath = 'ar/images/spotify/trackCover.jpg';

	constructor(db, storage) {
		super(db, storage);
		this.data = new SpotifyData();
	}

	determineSpotifyDeviceImageURL() {
		if(!this.data.isPlaying) return '';
		return this.data.deviceType in this.SPOTIFY_DEVICES_IMAGE_URL_MAPPING ? this.SPOTIFY_DEVICES_IMAGE_URL_MAPPING[this.data.deviceType] : this.SPOTIFY_DEVICES_IMAGE_URL_MAPPING['Other'];
	}

	async generateAFrameHTML() {
		const profileImageURL = await this.storage.ref(this.profileImageBucketPath).getDownloadURL();
		const trackCoverImageURL = await this.storage.ref(this.trackCoverImageBucketPath).getDownloadURL();
		const deviceImageURL = this.determineSpotifyDeviceImageURL();

		$('<a-entity/>', {
			id: this.dataDocumentID + 'WidgetEdgeMask',
			rotation: '0 0 0',
			scale: '0.5 0.5 0.5',
			'obj-model': 'obj:#mask-obj; mtl: #mask-mtl',
			mask: ''
		}).appendTo('#businessCardMarker');

		$('#' + this.dataDocumentID + 'WidgetEdgeMask').attr('position', (this.xPositionModifier * -1) + ' 0 ' + (this.zPositionModifier * 0));

		$('<a-entity/>', {
			id: this.dataDocumentID + 'Widget',
			rotation: '-90 0 0',
			scale: '2 0.5 2',
		}).appendTo('#businessCardMarker');

		$('#' + this.dataDocumentID + 'Widget').attr('position', (this.xPositionModifier * -1) + ' 0 ' + (this.zPositionModifier * 0));

		$('<a-entity/>', {
			id: this.dataDocumentID + 'WidgetBody',
			rotation: '0 0 0',
			scale: '0.75 1 1',
		}).appendTo('#' + this.dataDocumentID + 'Widget');

		$('#' + this.dataDocumentID + 'WidgetBody').attr('position', '0.125 0 0');

		$('<a-image/>', {
			id: this.dataDocumentID + 'WidgetBackground',
			rotation: '0 0 0',
			scale: '1 1 1',
		}).appendTo('#' + this.dataDocumentID + 'WidgetBody');

		$('#' + this.dataDocumentID + 'WidgetBackground').attr('material', 'shader: right-sided-color-rounded-corners; color: 0.11764 0.11764 0.11764; multiplier: ' + 1.0 + '; aspectRatio: ' + (128.0 / 384.0));

		if(this.data.isPlaying) {
			$('<a-entity/>', {
				id: this.dataDocumentID + 'WidgetTrackInfo',
				rotation: '0 0 0',
				scale: '1 1 1',
			}).appendTo('#' + this.dataDocumentID + 'WidgetBackground');

			$('<a-plane/>', {
				id: this.dataDocumentID + 'WidgetTrackInfoColliderPlane',
				rotation: '0 0 0',
				scale: '1 1 1',
				class: 'clickable',
				material: "opacity: 0; depthWrite: false"
			}).appendTo('#' + this.dataDocumentID + 'Widget');

			$('#' + this.dataDocumentID + 'WidgetTrackInfoColliderPlane').attr('position', '0 0 0.01');
			$('#' + this.dataDocumentID + 'WidgetTrackInfoColliderPlane').attr('check-events', 'url: ' + this.data.trackURL);

			$('<a-image/>', {
				id: this.dataDocumentID + 'WidgetTrackCover',
				rotation: '0 0 0',
				scale: '0.25 1 1',
				src: trackCoverImageURL
			}).appendTo('#' + this.dataDocumentID + 'Widget');

			$('#' + this.dataDocumentID + 'WidgetTrackCover').attr('position', '-0.375 0 0');
			$('#' + this.dataDocumentID + 'WidgetTrackCover').attr('material', 'shader: left-sided-rounded-corners; multiplier: ' + 1.0 + ';aspectRatio: ' + (128.0 / 128.0));

			$('<a-entity/>', {
				id: this.dataDocumentID + 'WidgetSoundBars',
				position: '0 0.4 0.001',
				rotation: '0 0 0',
				scale: '1 0.2 1',
			}).appendTo('#' + this.dataDocumentID + 'WidgetTrackInfo');

			$('#' + this.dataDocumentID + 'WidgetSoundBars').attr('position', '0 0.4 0.001');

			// $('<a-entity/>', {
			// 	id: this.dataDocumentID + 'WidgetHorizontalSoundBars',
			// 	scale: '0.95 0.04 1',
			// 	rotation: '0 0 90',
			// }).appendTo('#' + this.dataDocumentID + 'WidgetBackground');

			// $('#' + this.dataDocumentID + 'WidgetHorizontalSoundBars').attr('position', '-0.48 0.025 0.001');

			this.generateAFrameSoundBarsHTML();
			// this.generateHorizontalAFrameSoundBarsHTML();

			await generateAFrameTextEntity(this.dataDocumentID + 'WidgetArtistText', '#' + this.dataDocumentID + 'WidgetTrackInfo', this.sanitizeArtist(), 14, '#bababa', 16, 'Montserrat', 300, 17, false, '#FF000000', 16, 19.2, 272, 384, 128, 1, false);
			await generateAFrameTextEntity(this.dataDocumentID + 'WidgetTrackText', '#' + this.dataDocumentID + 'WidgetTrackInfo', this.sanitizeTrack(), 22, '#00d95f', 14, 'Montserrat', 300, 26.667, false, '#00FF0000', 16, -19.2, 272, 384, 128, 1, false);

			generateAFrameProgressBar(this.dataDocumentID, '#' + this.dataDocumentID + 'WidgetBody', this.data.trackProgressMS, this.data.trackDurationMS, (0.0 / 255.0) + ' ' + (217.0 / 255.0) + ' ' + (95.0 / 255.0), false, false, 128.0, 384.0);

			generateAFrameAlternatingLogo(this.dataDocumentID + '-widget-logo', '#' + this.dataDocumentID + 'WidgetTrackInfo', '0.375 0 0.0001', '0 0 0', '0.125 0.375 1', this.logoImageURL, deviceImageURL);
		} else {
			$('<a-entity/>', {
				id: this.dataDocumentID + 'WidgetProfileInfo',
				rotation: '0 0 0',
				scale: '1 1 1',
			}).appendTo('#' + this.dataDocumentID + 'WidgetBackground');

			$('<a-plane/>', {
				id: this.dataDocumentID + 'WidgetProfileInfoColliderPlane',
				rotation: '0 0 0',
				scale: '1 1 1',
				class: 'clickable',
				material: "opacity: 0; depthWrite: false"
			}).appendTo('#' + this.dataDocumentID + 'Widget');

			$('#' + this.dataDocumentID + 'WidgetProfileInfoColliderPlane').attr('position', '0 0 0.01');
			$('#' + this.dataDocumentID + 'WidgetProfileInfoColliderPlane').attr('check-events', 'url: https://open.spotify.com/user/' + this.data.userID);

			$('<a-image/>', {
				id: this.dataDocumentID + 'WidgetAvatarImage',
				rotation: '0 0 0',
				scale: '0.25 1 1',
				src: profileImageURL
			}).appendTo('#' + this.dataDocumentID + 'Widget');

			$('#' + this.dataDocumentID + 'WidgetAvatarImage').attr('position', '-0.375 0 0.001');
			$('#' + this.dataDocumentID + 'WidgetAvatarImage').attr('material', 'shader: left-sided-rounded-corners; multiplier: ' + 1.0 + ';aspectRatio: ' + (128.0 / 128.0));

			await generateAFrameTextEntity(this.dataDocumentID + 'WidgetDisplayNameText', '#' + this.dataDocumentID + 'WidgetProfileInfo', this.data.displayName, 32, '#00d95f', 0, 'Montserrat', FontDataURLDict['Montserrat'], 300, 38.8667, true, '#000FF000', 16, 0, 272, 384, 128, 1);

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
			}).appendTo('#' + this.dataDocumentID + 'WidgetProfileInfo');	

			$('#' + this.dataDocumentID + 'WidgetLogo').attr('position', '0.375 0 0.0001');
		}	
	}

	generateAFrameSoundBarsHTML() {
		for(var i = 0; i < 100; i++) {
			this.generateAFrameSoundBarHTML(i);
		}
	}

	generateAFrameSoundBarHTML(index) {
		var duration = Math.floor(Math.random() * (1050 - 800 + 1) + 800); // lmao what even is this
		var delay = Math.floor(Math.random() * 1500);
		var BAR_WIDTH = 0.01;

		$('<a-image/>', {
			id: this.dataDocumentID + 'SoundBar_' + index,
			rotation: '0 0 0',
			scale: BAR_WIDTH.toString() + ' 0 0.03',
			material: 'shader:flat; side: double; color: #' + this.data.barHex + '; transparent: true; opacity:1',
			animation__scale: 'loop: true; property: scale; from: ' + BAR_WIDTH.toString() + ' 0 0.03; to: ' + BAR_WIDTH.toString() + ' 1 0.03; dur: ' + duration.toString() + '; delay: ' + delay.toString() + '; easing: linear; dir: alternate',
			animation__position: 'loop: true; property: position; from: ' + (-0.5 + (BAR_WIDTH / 2) + (index * BAR_WIDTH)).toString() + ' 0.5 0; to: ' + (-0.5 + (BAR_WIDTH / 2) + (index * BAR_WIDTH)).toString() + ' 0 0; dur: ' + duration.toString() + '; delay: ' + delay.toString() + '; easing: linear; dir: alternate',
			animation__color: 'loop: true; property: color; type: color; from: #' + this.data.secondaryBarHex + '; to: #' + this.data.barHex + '; dur: ' + duration.toString() + '; delay: ' + delay.toString() + '; easing: linear; dir: alternate'
			// animation__opacity: 'loop: true; isRawProperty: true; property: components.material.material.opacity; from: 0.75; to: 1; dur: ' + duration.toString() + '; delay: ' + delay.toString() + '; easing: linear; dir: alternate'
		}).appendTo('#' + this.dataDocumentID + 'WidgetSoundBars');

		$('#' + this.dataDocumentID + 'SoundBar_' + index).attr('position', (-0.5 + (BAR_WIDTH / 2) + (index * BAR_WIDTH)).toString() + ' 0.5 0');
	}

	generateHorizontalAFrameSoundBarsHTML() {
		for(var i = 0; i < 50; i++) {
			this.generateHorizontalAFrameSoundBarHTML(i);
		}
	}

	generateHorizontalAFrameSoundBarHTML(index) {
		var duration = Math.floor(Math.random() * (1050 - 800 + 1) + 800); // lmao what even is this
		var delay = Math.floor(Math.random() * 1500);
		var BAR_WIDTH = 0.02;

		$('<a-image/>', {
			id: this.dataDocumentID + 'SoundBar_' + index,
			rotation: '0 0 0',
			scale: BAR_WIDTH.toString() + ' 0 1',
			material: 'shader:flat; side: double; color: #' + this.data.barHex + '; transparent: true; opacity:1',
			animation__scale: 'loop: true; property: scale; from: ' + BAR_WIDTH.toString() + ' 0 1; to: ' + BAR_WIDTH.toString() + ' 1 1; dur: ' + duration.toString() + '; delay: ' + delay.toString() + '; easing: linear; dir: alternate',
			animation__position: 'loop: true; property: position; from: ' + (-0.5 + (BAR_WIDTH / 2) + (index * BAR_WIDTH)).toString() + ' 0.5 0; to: ' + (-0.5 + (BAR_WIDTH / 2) + (index * BAR_WIDTH)).toString() + ' 0 0; dur: ' + duration.toString() + '; delay: ' + delay.toString() + '; easing: linear; dir: alternate',
			animation__color: 'loop: true; property: color; type: color; from: #' + this.data.secondaryBarHex + '; to: #' + this.data.barHex + '; dur: ' + duration.toString() + '; delay: ' + delay.toString() + '; easing: linear; dir: alternate'
			// animation__opacity: 'loop: true; isRawProperty: true; property: components.material.material.opacity; from: 0.75; to: 1; dur: ' + duration.toString() + '; delay: ' + delay.toString() + '; easing: linear; dir: alternate'
		}).appendTo('#' + this.dataDocumentID + 'WidgetHorizontalSoundBars');

		$('#' + this.dataDocumentID + 'SoundBar_' + index).attr('position', (-0.5 + (BAR_WIDTH / 2) + (index * BAR_WIDTH)).toString() + ' 0.5 0');
	}

	sanitizeTrack() {
		return this.data.trackName.replace(/ *\([^)]*\)*/g, "").replace(/ *\[[^)]*\] */g, "").replace("&", "&amp;").split(" - ")[0].trim();
	}

	sanitizeArtist() {
		return this.data.trackArtist.replace("&", "&amp;").trim();
	}

	lerp(s, e, p) {
		return (s + (e - s) * p);
	}

}