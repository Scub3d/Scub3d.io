class SpotifyWidget extends BaseWidget {
	dataDocumentID = 'spotify';
	data;

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
		if (!this.data.isPlaying) return '';
		return this.data.deviceType in this.SPOTIFY_DEVICES_IMAGE_URL_MAPPING ? this.SPOTIFY_DEVICES_IMAGE_URL_MAPPING[this.data.deviceType] : this.SPOTIFY_DEVICES_IMAGE_URL_MAPPING['Other'];
	}

	async generateAFrameHTML() {
		const profileImageURL = await this.getCachedDownloadURL(this.profileImageBucketPath);
		const trackCoverImageURL = await this.getCachedDownloadURL(this.trackCoverImageBucketPath, this.data.trackID);
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

		if (this.data.isPlaying) {
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

			this.generateAFrameSoundBarsHTML();

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

			await generateAFrameTextEntity(this.dataDocumentID + 'WidgetDisplayNameText', '#' + this.dataDocumentID + 'WidgetProfileInfo', this.data.displayName, 32, '#00d95f', 0, 'Montserrat', 300, 38.8667, true, '#000FF000', 16, 0, 272, 384, 128, 1);

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
		for (var i = 0; i < 100; i++) {
			this.generateAFrameSoundBarHTML(i);
		}
	}

	generateAFrameSoundBarHTML(index) {
		const BAR_WIDTH = 0.01;
		const xPos = -0.5 + (BAR_WIDTH / 2) + (index * BAR_WIDTH);

		// Wider ratios between neighbours keep bars out of phase instead of
		// drifting together. Random max height + random starting phase
		// breaks the "wall of bars" visual.
		const duration = Math.floor(750 + Math.random() * 1450);    // 550–2000 ms (raised floor so the fastest bars don't jitter)
		const delay = Math.floor(Math.random() * 2000);             // 0–2000 ms
		const maxScale = 0.2 + Math.random() * 0.8;                 // 0.2–1.0 peak height
		const startsUp = Math.random() < 0.5;

		// Keep the top edge pinned at y=0.5 regardless of current scale:
		// position.y = 0.5 - scale.y / 2.
		const scaleFromY = startsUp ? maxScale : 0;
		const scaleToY = startsUp ? 0 : maxScale;
		const posFromY = 0.5 - scaleFromY / 2;
		const posToY = 0.5 - scaleToY / 2;

		const easing = Math.random() < 0.5 ? 'easeInOutQuad' : 'easeOutQuad';

		$('<a-image/>', {
			id: this.dataDocumentID + 'SoundBar_' + index,
			rotation: '0 0 0',
			scale: BAR_WIDTH + ' ' + scaleFromY + ' 0.03',
			material: 'shader:flat; side: double; color: #' + this.data.barHex + '; transparent: true; opacity:1',
			animation__scale: 'loop: true; property: scale; from: ' + BAR_WIDTH + ' ' + scaleFromY + ' 0.03; to: ' + BAR_WIDTH + ' ' + scaleToY + ' 0.03; dur: ' + duration + '; delay: ' + delay + '; easing: ' + easing + '; dir: alternate',
			animation__position: 'loop: true; property: position; from: ' + xPos + ' ' + posFromY + ' 0; to: ' + xPos + ' ' + posToY + ' 0; dur: ' + duration + '; delay: ' + delay + '; easing: ' + easing + '; dir: alternate',
			animation__color: 'loop: true; property: color; type: color; from: #' + this.data.secondaryBarHex + '; to: #' + this.data.barHex + '; dur: ' + duration + '; delay: ' + delay + '; easing: linear; dir: alternate'
		}).appendTo('#' + this.dataDocumentID + 'WidgetSoundBars');

		$('#' + this.dataDocumentID + 'SoundBar_' + index).attr('position', xPos + ' ' + posFromY + ' 0');
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

	async applyUpdate(oldData, newData) {
		// Full rebuild for layout changes (playing flip) or identity changes
		// (different user / device) — those reshape the widget.
		if (oldData.isPlaying !== newData.isPlaying) return false;
		if (oldData.userID !== newData.userID) return false;
		if (oldData.displayName !== newData.displayName) return false;
		if (oldData.deviceType !== newData.deviceType) return false;

		if (!newData.isPlaying) {
			// Profile layout has no dynamic fields that Equals() would catch beyond
			// the bail-outs above. Nothing to patch — declare handled.
			return true;
		}

		// Playing + track changed: patch cover, texts, collider target, progress,
		// and in-place recolor the soundbars. Keep all 100 bar entities + their
		// animations running to avoid the big rebuild hitch.
		const trackCoverImageURL = await this.getCachedDownloadURL(this.trackCoverImageBucketPath, newData.trackID);

		const coverEl = document.getElementById(this.dataDocumentID + 'WidgetTrackCover');
		if (coverEl) coverEl.setAttribute('src', trackCoverImageURL);

		const colliderEl = document.getElementById(this.dataDocumentID + 'WidgetTrackInfoColliderPlane');
		if (colliderEl) colliderEl.setAttribute('check-events', 'url: ' + newData.trackURL);

		const trackInfoID = '#' + this.dataDocumentID + 'WidgetTrackInfo';
		$('#' + this.dataDocumentID + 'WidgetArtistText').remove();
		$('#' + this.dataDocumentID + 'WidgetTrackText').remove();
		await generateAFrameTextEntity(this.dataDocumentID + 'WidgetArtistText', trackInfoID, this.sanitizeArtist(), 14, '#bababa', 16, 'Montserrat', 300, 17, false, '#FF000000', 16, 19.2, 272, 384, 128, 1, false);
		await generateAFrameTextEntity(this.dataDocumentID + 'WidgetTrackText', trackInfoID, this.sanitizeTrack(), 22, '#00d95f', 14, 'Montserrat', 300, 26.667, false, '#00FF0000', 16, -19.2, 272, 384, 128, 1, false);

		if (newData.trackDurationMS > 0) {
			// Reseed the animator with the new track's baseline. The component's
			// update() hook restamps creationTime, so the bar restarts from the
			// new progress instead of the animator continuing to overwrite our
			// uniform with the old track's accumulated position.
			const progressEl = document.getElementById(this.dataDocumentID + 'WidgetProgressBar');
			if (progressEl) {
				progressEl.setAttribute('progress-bar-animator', {
					startProgressMS: newData.trackProgressMS,
					durationMS: newData.trackDurationMS
				});
			}
		}

		if (oldData.barHex !== newData.barHex || oldData.secondaryBarHex !== newData.secondaryBarHex) {
			const fromColor = '#' + newData.secondaryBarHex;
			const toColor = '#' + newData.barHex;
			for (let i = 0; i < 100; i++) {
				const barID = this.dataDocumentID + 'SoundBar_' + i;
				const barEl = document.getElementById(barID);
				if (!barEl) continue;
				barEl.setAttribute('animation__color', 'from', fromColor);
				barEl.setAttribute('animation__color', 'to', toColor);
				setMaterialColor(barID, toColor);
			}
		}

		return true;
	}

}