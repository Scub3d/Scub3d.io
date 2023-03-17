class ACNHWidget extends BaseWidget {
	dataDocumentID = 'acnh';
	data;

	CARD_WIDTH = 88;
	updateIntervalMS = 60000;

	logoImageURL = this.staticAssetBaseURL + 'ar/img/nintendo/acnh/logo.png';
	
	passportImageBucketPath = 'ar/images/nintendo/acnh/passportPicture.png';

	constructor(db, storage) {
		super(db, storage);
		this.data = new ACNHData();
	}

	async checkIfShouldUpdateWidget(newJSON) {
		const villagersData = await this.db.collection('data').doc('acnh').collection('villagers').get();
		const friendsData = await this.db.collection('data').doc('acnh').collection('friends').get();

		var villagers = [];
		var friends = [];

		villagersData.forEach(villagerData => {
			villagers.push(villagerData.data());
		})

		friendsData.forEach(friendData => {
			friends.push(friendData.data());
		})

		const newdata = this.data.fromJSON(newJSON, villagers, friends);

		if(!this.data.Equals(newdata)) {
			this.data = newdata;
			await this.generateWidget();
		} else {
			return;
		}
	}

	async generateAFrameHTML() {
		const passportImageURL = await this.storage.ref(this.passportImageBucketPath).getDownloadURL();

		$('<a-entity/>', {
			id: this.dataDocumentID + 'Widget',
			rotation: '-90 0 0',
			scale: '2 0.5 2'
		}).appendTo('#businessCardMarker');

		$('#' + this.dataDocumentID + 'Widget').attr('position', (this.xPositionModifier * -1) + ' 0 ' + (this.zPositionModifier * 1));

		$('<a-entity/>', {
			id: this.dataDocumentID + 'WidgetBody',
			rotation: '0 0 0',
			scale: '0.75 1 1',
		}).appendTo('#' + this.dataDocumentID + 'Widget');

		$('#' + this.dataDocumentID + 'WidgetBody').attr('position', '0.125 0 0.001');

		$('<a-image/>', {
			id: this.dataDocumentID + 'WidgetPassportPicture',
			rotation: '0 0 0',
			scale: '0.25 1 1',
			src: passportImageURL
		}).appendTo('#' + this.dataDocumentID + 'Widget');

		$('#' + this.dataDocumentID + 'WidgetPassportPicture').attr('position', '-0.375 0 0');
		$('#' + this.dataDocumentID + 'WidgetPassportPicture').attr('material', 'shader: left-sided-rounded-corners; multiplier: ' + 1.0 + ';aspectRatio: ' + (128.0 / 128.0) + ';transparent: false');

		$('<a-image/>', {
			id: this.dataDocumentID + 'WidgetBackground',
			rotation: '0 0 0',
			scale: '1 1 1',
			transparent: false,
		}).appendTo('#' + this.dataDocumentID + 'WidgetBody');

		$('#' + this.dataDocumentID + 'WidgetBackground').attr('material', 'shader: right-sided-color-rounded-corners; color: 0.90980 0.90196 0.89019; multiplier: ' + 1.0 + '; aspectRatio: ' + (128.0 / 384.0));

		$('<a-entity/>', {
			id: this.dataDocumentID + 'WidgetProfileInfo',
			rotation: '0 0 0',
			scale: '1 1 1',
		}).appendTo('#' + this.dataDocumentID + 'WidgetBackground');

		$('<a-entity/>', {
			id: this.dataDocumentID + 'WidgetVillagersInfo',
			rotation: '0 0 0',
			scale: '1 1 1',
		}).appendTo('#' + this.dataDocumentID + 'WidgetBackground');

		$('<a-entity/>', {
			id: this.dataDocumentID + 'WidgetIslandInfo',
			rotation: '0 0 0',
			scale: '1 1 1',
		}).appendTo('#' + this.dataDocumentID + 'WidgetBackground');

		$('<a-entity/>', {
			id: this.dataDocumentID + 'WidgetFriendsInfo',
			rotation: '0 0 0',
			scale: '1 1 1',
		}).appendTo('#' + this.dataDocumentID + 'WidgetBackground');

		generateAFrameTextEntity(this.dataDocumentID + 'WidgetPassportNameText', '#' + this.dataDocumentID + 'WidgetProfileInfo', this.data['passportName'], 24, '#4D3906', 0, 'Montserrat', 300, 30, true, '#FF000000', 22, 14, 272, 386, 128, 1, false);
		generateAFrameTextEntity(this.dataDocumentID + 'WidgetAuthorIDText', '#' + this.dataDocumentID + 'WidgetProfileInfo', this.data['authorID'], 24, '#F36F7D', 0, 'Montserrat', 300, 30, true, '#00FF0000', 16, -22, 272, 386, 128, 1, false);

		let villagerNames = [];
		for (const villager of this.data.villagers) {
			villagerNames.push(villager.name);
		}

		await this.generateACNHCardsSVGString(this.dataDocumentID + 'WidgetVillagersImage', this.dataDocumentID + 'WidgetVillagersInfo', villagerNames, villagerNames, 'villagers');

		generateAFrameTextEntity(this.dataDocumentID + 'WidgetIslandNameText', '#' + this.dataDocumentID + 'WidgetIslandInfo', this.data['islandName'], 24, '#4D3906', 0, 'Montserrat', 300, 30, true, '#FF000000', 16, 22, 272, 386, 128, 1, false);
		generateAFrameTextEntity(this.dataDocumentID + 'WidgetDreamAddressText', '#' + this.dataDocumentID + 'WidgetIslandInfo', this.data['dreamAddress'], 24, '#A364D6', 0, 'Montserrat', 300, 30, true, '#00FF0000', 16, -22, 272, 386, 128, 1, false);
	
		let friendNames = [];
		let friendIDs = [];
		for (const friend of this.data.friends) {
			friendNames.push(friend.name);
			friendIDs.push(friend.userID);
		}

		await this.generateACNHCardsSVGString(this.dataDocumentID + 'WidgetFriendsImage', this.dataDocumentID + 'WidgetFriendsInfo', friendIDs, friendNames, 'friends');

		generateAFrameAlternatingEntities([this.dataDocumentID + 'WidgetProfileInfo', this.dataDocumentID + 'WidgetVillagersInfo', this.dataDocumentID + 'WidgetIslandInfo', this.dataDocumentID + 'WidgetFriendsInfo'], this.dataDocumentID + 'WidgetBody');

		$('<a-image/>', {
			id: this.dataDocumentID + 'WidgetLogo',
			rotation: '0 0 0',
			scale: '0.125 0.375 1',
			crossorigin: 'anonymous',
			src: this.logoImageURL,
			material: 'shader: flat; npot: true',
			side: 'double',
			transparent: 'true',
			depthTest: true,
			'anti-tear': ''
		}).appendTo('#' + this.dataDocumentID + 'WidgetBody');	

		$('#' + this.dataDocumentID + 'WidgetLogo').attr('position', '0.375 0 0.0001');
	}

	async generateACNHCardsSVGString(elementID, parentID, imageIDList, textList, group) {
		const svgSizeMultiplier = 4.0;
		const followTextSpacingOffset = 0.0;
		var ratio = 1.0;
		var multiplier = 1.0;

		let cardsHTML = '';

		for(var index = 0; index < imageIDList.length; index++) {
			var imageURL = await this.storage.ref('ar/images/nintendo/acnh/' + group + '/' + imageIDList[index] + '.png').getDownloadURL();
			const imageBlob = await makeRequest('GET', imageURL);
			let imageDataURL = await blobToDataURL(imageBlob);

			cardsHTML += '<div class="card" style="padding-right: ' + (8 * svgSizeMultiplier) + 'px;padding-left: ' + (0 * svgSizeMultiplier) + 'px;margin-top: ' + (16 * svgSizeMultiplier) + 'px"><img class="cardImage" style="border-radius:' + (36 * svgSizeMultiplier) + 'px" src="' + imageDataURL + '" width="' + (72 * svgSizeMultiplier) + '" height="' + (72 * svgSizeMultiplier) + '"/><p class="cardText" style="width: 100%; text-align: center; font-size: ' + (14 * svgSizeMultiplier) + 'px;color: #000;margin-top: ' + (4 * svgSizeMultiplier) + 'px;font-family: \'Montserrat\';font-weight: 300">' + textList[index] + '</p></div>';//this.generateACNHCardSVGString(textList[index], imageDataURL);
		}

		let width = 80.0 * imageIDList.length;
		const height = 128.0;

		if(width > 272.0) {//imageIDList.length > 3) {
			cardsHTML += '<div class="emptyCard" style="width: ' + (followTextSpacingOffset * svgSizeMultiplier) + 'px;"></div>' + cardsHTML;
			width *= 2;
		} else {
			width = 272.0;
			cardsHTML += '<div id="fillVoid" style="width=' + ((272.0 - width) * svgSizeMultiplier) + '"></div>'
		}

		var svgString = '<svg fill="none" width="' + (width * svgSizeMultiplier) + '" height="' + (height * svgSizeMultiplier) + '" viewBox="0 0 ' + (width * svgSizeMultiplier) + ' ' + (height * svgSizeMultiplier) + '" xmlns="http://www.w3.org/2000/svg" data-reactroot=""><foreignObject width="' +  (width * svgSizeMultiplier) + '" height="' + (height * svgSizeMultiplier) + '"><div xmlns="http://www.w3.org/1999/xhtml"><div id="container" style="display: flex; flex: 1; flex-direction: row;position: absolute;width: ' + (width * svgSizeMultiplier) + 'px;height:' + (height * svgSizeMultiplier) + 'px;z-index: -1">' + cardsHTML + '</div></div></foreignObject></svg>';

		const imageDataURL = 'data:image/svg+xml;base64,' + Base64.encode(svgString);

		if(width > 272.0) {
			ratio = 272.0 / width;
			multiplier = width * 2 / 512.0;
		}

		const calculatedXScale = (multiplier * (272.0 / 384.0));
		const calculatedXPosition = (-(((1 - (272.0 / 384.0)) / 2) - (16.0 / 384)) + ((multiplier - 1) * (272.0 / 384.0)) / 2);
		const calculatedStopLimit = (((width - followTextSpacingOffset) / 2 + followTextSpacingOffset) / width);

		let desiredCanvasWidth = width * svgSizeMultiplier;
		let desiredCanvasHeight = height * svgSizeMultiplier;

		let img = new Image;

		img.crossOrigin = "Anonymous";
		img.onload = function () {
			let temporaryCanvas = document.createElement("CANVAS"); 
			let temporaryContext = temporaryCanvas.getContext('2d');

			temporaryCanvas.width = desiredCanvasWidth;
			temporaryCanvas.height = desiredCanvasHeight;

			temporaryContext.drawImage(this, 0, 0);

			const canvasDataURL = temporaryCanvas.toDataURL();

			temporaryContext.clearRect(0, 0, desiredCanvasWidth, desiredCanvasHeight);

			$('<a-image/>', {
				id: elementID,
				rotation: '0 0 0',
				crossorigin: 'anonymous',
			}).appendTo("#" + parentID);	

			$('#' + elementID).attr('src', canvasDataURL);
			$('#' + elementID).attr('scale', calculatedXScale + ' 1 1');
			$('#' + elementID).attr('position', calculatedXPosition + ' 0 0.0001');
			$('#' + elementID).attr('material', 'shader: crop-text; npot: true; depthTest: false; transparent: true;');

			if(width > 272.0) {
				$('#' + elementID).attr('slide-text', 'percent: ' + ratio + '; xOffset: 0; stopLimit: ' + calculatedStopLimit);
			}
		}

		img.src = imageDataURL;
	}
}