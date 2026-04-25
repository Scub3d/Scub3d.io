class LeagueWidget extends BaseWidget {
	dataDocumentID = 'league';
	data;

	isChampionNameTooLong = false;

	timeElapsedInterval;

	logoImageURL = this.staticAssetBaseURL + 'ar/img/riot/league/logo.svg';

	profileImageBucketPath = 'ar/images/riot/league/profileImage.png';
	profileBackgroundImageBucketPath = 'ar/images/riot/league/profileBackground.jpg';
	championSplashImageBucketPath = 'ar/images/riot/league/championSplash.jpg';

	constructor(db, storage) {
		super(db, storage);
		this.data = new LeagueData();
	}

	updateLeagueTimeElapsed(gameStartTimestamp) {
		const currentTimestamp = Date.now();
		const totalSeconds = (currentTimestamp - gameStartTimestamp) / 1000
		const timeElapsedText = this.parseTimeElapsed(totalSeconds);

		updateAFrameEntityText(this.dataDocumentID + 'WidgetTimeElapsedText', 'Time Elapsed: ' + timeElapsedText, 16, '#fffabd', 0, 'Montserrat', 300, 24.7, false, 396, '#00FF0000', true);
	}

	parseTimeElapsed(timeElapsed) {
		var hours = Math.floor(timeElapsed / 3600)
		var minutes = Math.floor((timeElapsed % 3600) / 60)
		var seconds = Math.floor((timeElapsed % 3600) % 60)

		hours = hours < 10 ? '0' + hours : hours;
		minutes = minutes < 10 ? '0' + minutes : minutes;
		seconds = seconds < 10 ? '0' + seconds : seconds;

		return (hours == '00' ? '' : hours + ':') + (minutes == '00' && hours == '00' ? '' : minutes + ':') + seconds;
	}

	async generateAFrameHTML() {
		const profileImageURL = await this.getCachedDownloadURL(this.profileImageBucketPath, this.data.profileImageID);
		const profileBackgroundImageURL = await this.getCachedDownloadURL(this.profileBackgroundImageBucketPath, this.data.profileBackgroundChampionName + '_' + this.data.profileBackgroundSkinID);
		const championSplashImageURL = await this.getCachedDownloadURL(this.championSplashImageBucketPath, this.data.championName);

		$('<a-entity/>', {
			id: this.dataDocumentID + 'Widget',
			rotation: '-90 0 0',
			scale: '2 0.5 2',
		}).appendTo('#businessCardMarker');

		$('#' + this.dataDocumentID + 'Widget').attr('position', (this.xPositionModifier * -1) + ' 0 ' + (this.zPositionModifier * -1));

		$('<a-plane/>', {
			id: this.dataDocumentID + 'WidgetColliderPlane',
			rotation: '0 0 0',
			scale: '1 1 1',
			class: 'clickable',
			material: "opacity: 0; depthWrite: false"
		}).appendTo('#' + this.dataDocumentID + 'Widget');

		$('#' + this.dataDocumentID + 'WidgetColliderPlane').attr('position', '0 0 0.01');
		$('#' + this.dataDocumentID + 'WidgetColliderPlane').attr('check-events', 'url: https://op.gg/summoners/na/' + encodeURIComponent(this.data.gameName || '') + '-' + encodeURIComponent(this.data.tagLine || 'NA1'));

		$('<a-entity/>', {
			id: this.dataDocumentID + 'WidgetBody',
			rotation: '0 0 0',
			scale: '1 1 1',
		}).appendTo('#' + this.dataDocumentID + 'Widget');

		$('#' + this.dataDocumentID + 'WidgetBody').attr('position', '0 0 0');

		if (!this.data.isInGame) {
			await generateVerticallySlidingImage(this.dataDocumentID + 'WidgetProfileBackgroundImage', '#' + this.dataDocumentID + 'WidgetBody', profileBackgroundImageURL, 1215.0, 717.0);

			generateAFrameTextEntity(this.dataDocumentID + 'WidgetSummonerNameText', '#' + this.dataDocumentID + 'WidgetBody', this.data.riotID, 32, '#fffabd', 0, 'Montserrat', 300, 35, false, '#FF000000', 32, 14, 396, 512, 128, 1, true);
			generateAFrameTextEntity(this.dataDocumentID + 'WidgetSummonerLevelText', '#' + this.dataDocumentID + 'WidgetBody', 'Level ' + this.data.summonerLevel.toString(), 16, '#fffabd', 0, 'Montserrat', 300, 18, false, '#00FF0000', 32, -12, 396, 512, 128, 1, true);

			if (this.timeElapsedInterval !== null) {
				clearInterval(this.timeElapsedInterval);
			}
		} else {
			await generateVerticallySlidingImage(this.dataDocumentID + 'WidgetChamptionSplashImage', '#' + this.dataDocumentID + 'WidgetBody', championSplashImageURL, 1215.0, 717.0);

			generateAFrameTextEntity(this.dataDocumentID + 'WidgetChampionNameText', '#' + this.dataDocumentID + 'WidgetBody', this.data.championName, 26, '#fffabd', 0, 'Montserrat', 300, 30, false, '#FF000000', 16, 17, 396, 512, 128, 1, true);
			generateAFrameTextEntity(this.dataDocumentID + 'WidgetMapNameText', '#' + this.dataDocumentID + 'WidgetBody', this.data.mapName, 16, '#fffabd', 0, 'Montserrat', 300, 32.4, false, '#FF000000', 16, -16, 396, 512, 128, 1, true);
			generateAFrameTextEntity(this.dataDocumentID + 'WidgetTimeElapsedText', '#' + this.dataDocumentID + 'WidgetBody', 'Time Elapsed: 00:00', 16, '#fffabd', 0, 'Montserrat', 300, 24.7, false, '#00FF0000', 16, -32, 396, 512, 128, 1, true);

			clearInterval(this.timeElapsedInterval);
			this.timeElapsedInterval = setInterval(() => {
				this.updateLeagueTimeElapsed(this.data.gameStartTime);
			}, 1000);
		}

		generateAFrameAlternatingLogo(this.dataDocumentID + 'WidgetLogo', '#' + this.dataDocumentID + 'WidgetBody', '0.40625 0 0.001', '0 0 0', '0.09375 0.375 1', this.logoImageURL, profileImageURL);
	}

	async applyUpdate(oldData, newData) {
		const oldInGame = oldData.gameID !== undefined && oldData.gameID !== null;
		const newInGame = newData.gameID !== undefined && newData.gameID !== null;

		// Profile ↔ in-game transition swaps the entire layout.
		if(oldInGame !== newInGame) return false;

		// Image identity changes — images use these as version keys.
		if(oldData.profileImageID !== newData.profileImageID) return false;
		if(oldData.profileBackgroundChampionName !== newData.profileBackgroundChampionName) return false;
		if(oldData.profileBackgroundSkinID !== newData.profileBackgroundSkinID) return false;
		// Riot ID (name text + collider URL) rebuild together.
		if(oldData.gameName !== newData.gameName) return false;
		if(oldData.tagLine !== newData.tagLine) return false;

		if(newInGame) {
			// championName drives the splash image via version key — full rebuild if changed.
			if(oldData.championName !== newData.championName) return false;
			// mapName is the only text that can legitimately change mid-game (unusual).
			if(oldData.mapName !== newData.mapName) {
				updateAFrameEntityText(this.dataDocumentID + 'WidgetMapNameText', newData.mapName, 16, '#fffabd', 0, 'Montserrat', 300, 32.4, false, 396, '#FF000000', true);
			}
			// gameStartTime isn't in Equals but the 1s interval reads this.data.gameStartTime
			// each tick, so it picks up the new value automatically.
		} else {
			if(oldData.summonerLevel !== newData.summonerLevel) {
				updateAFrameEntityText(this.dataDocumentID + 'WidgetSummonerLevelText', 'Level ' + newData.summonerLevel.toString(), 16, '#fffabd', 0, 'Montserrat', 300, 18, false, 396, '#00FF0000', true);
			}
		}

		return true;
	}
}