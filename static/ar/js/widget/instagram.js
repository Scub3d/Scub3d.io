class InstagramWidget extends BaseWidget {
	dataDocumentID = 'instagram';
	data;

	logoImageURL = this.staticAssetBaseURL + 'ar/img/instagram/logo.svg';
	outlineImageURL = this.staticAssetBaseURL + 'ar/img/instagram/outline.svg';

	profileImageBucketPath = 'ar/images/instagram/profileImage.png';
	galleryImageBaseBucketPath = 'ar/images/instagram/gallery_image_';

	constructor(db, storage) {
		super(db, storage);
		this.data = new InstagramData();
	}

	async generateAFrameHTML() {
		const profileImageURL = await this.storage.ref(this.profileImageBucketPath).getDownloadURL();
		
		$('<a-entity/>', {
			id: this.dataDocumentID + 'Widget',
			rotation: '-90 0 0',
			scale: '2 0.5 2',
		}).appendTo('#businessCardMarker');

		$('#' + this.dataDocumentID + 'Widget').attr('position', (this.xPositionModifier * -1) + ' 0 ' + (this.zPositionModifier * 2));

		$('<a-plane/>', {
			id: this.dataDocumentID + 'WidgetColliderPlane',
			rotation: '0 0 0',
			scale: '1 1 1',
			class: 'clickable',
			material: "opacity: 0; depthWrite: false"
		}).appendTo('#' + this.dataDocumentID + 'Widget');

		$('#' + this.dataDocumentID + 'WidgetColliderPlane').attr('position', '0 0 0.01');
		$('#' + this.dataDocumentID + 'WidgetColliderPlane').attr('check-events', 'url: https://instagram.com/' + this.data.username);

		$('<a-entity/>', {
			id: this.dataDocumentID + 'WidgetBody',
			rotation: '0 0 0',
			scale: '1 1 1',
		}).appendTo('#' + this.dataDocumentID + 'Widget');

		$('#' + this.dataDocumentID + 'WidgetBody').attr('position', '0 0 0');

		$('<a-image/>', {
			id: this.dataDocumentID + 'WidgetProfileInfo',
			rotation: '0 0 0',
			scale: '1 1 1',
			src: this.outlineImageURL,
			material: 'depthTest: false; depthWrite: false; transparent: true'
		}).appendTo('#' + this.dataDocumentID + 'Widget');

		generateAFrameTextEntity(this.dataDocumentID + 'WidgetUsername', '#' + this.dataDocumentID + 'WidgetProfileInfo', this.data['username'], 28, '#262626', 0, 'Montserrat', 300, 32, true, '#FF000000', 24, 18, 392, 512, 128, 1, false);

		generateAFrameTextEntity(this.dataDocumentID + 'WidgetMediaCount', '#' + this.dataDocumentID + 'WidgetProfileInfo', this.data['mediaCount'] + ' posts', 16, '#262626', 10, 'Montserrat', 300, 19, true, '#00FF0000', 24, -13, 130, 512, 128, 1, false);
		generateAFrameTextEntity(this.dataDocumentID + 'WidgetFollowersCount', '#' + this.dataDocumentID + 'WidgetProfileInfo', this.data['followersCount'] + ' followers', 16, '#262626', 10, 'Montserrat', 300, 19, true, '#0000FF00', 24 + 130, -13, 130, 512, 128, 1, false);
		generateAFrameTextEntity(this.dataDocumentID + 'WidgetFollowingCount', '#' + this.dataDocumentID + 'WidgetProfileInfo', this.data['followingCount'] + ' following', 16, '#262626', 10, 'Montserrat', 300, 19, true, '#0FF00000', 24 + 130 + 130, -13, 130, 512, 128, 1, false);

		$('<a-entity/>', {
			id: this.dataDocumentID + 'WidgetImageGallery',
			rotation: '0 0 0',
			scale: '1 1 1'
		}).appendTo('#' + this.dataDocumentID + 'WidgetBody');

		$('<a-image/>', {
			id: this.dataDocumentID + 'WidgetGalleryImage_0',
			rotation: '0 0 0',
			scale: '0.25 1 1',
			crossorigin: 'anonymous',
			npot: true,
			side: 'double',
		}).appendTo('#' + this.dataDocumentID + 'WidgetImageGallery');

		$('#' + this.dataDocumentID + 'WidgetGalleryImage_0').attr('position', '-0.375 0 0');
		$('#' + this.dataDocumentID + 'WidgetGalleryImage_0').attr('material', 'shader: left-sided-rounded-corners; multiplier: ' + 1.0 + ';aspectRatio: ' + (128.0 / 128.0) + ';transparent: false');

		$('<a-image/>', {
			id: this.dataDocumentID + 'WidgetGalleryImage_1',
			rotation: '0 0 0',
			scale: '0.25 1 1',
			crossorigin: 'anonymous',
			npot: true,
			side: 'double',
		}).appendTo('#' + this.dataDocumentID + 'WidgetImageGallery');

		$('#' + this.dataDocumentID + 'WidgetGalleryImage_1').attr('position', '-0.125 0 0');

		$('<a-image/>', {
			id: this.dataDocumentID + 'WidgetGalleryImage_2',
			rotation: '0 0 0',
			scale: '0.25 1 1',
			crossorigin: 'anonymous',
			npot: true,
			side: 'double',
		}).appendTo('#' + this.dataDocumentID + 'WidgetImageGallery');

		$('#' + this.dataDocumentID + 'WidgetGalleryImage_2').attr('position', '0.125 0 0');

		$('<a-image/>', {
			id: this.dataDocumentID + 'WidgetGalleryImage_3',
			rotation: '0 0 0',
			scale: '0.25 1 1',
			crossorigin: 'anonymous',
			npot: true,
			side: 'double',
		}).appendTo('#' + this.dataDocumentID + 'WidgetImageGallery');
		
		$('#' + this.dataDocumentID + 'WidgetGalleryImage_3').attr('position', '0.375 0 0');
		$('#' + this.dataDocumentID + 'WidgetGalleryImage_3').attr('material', 'shader: right-sided-rounded-corners; multiplier: ' + 1.0 + ';aspectRatio: ' + (128.0 / 128.0) + ';transparent: false');

		var galleryImageURLs = [];
		let galleryImagesHTML = '';

		var galleryImageDict = [];
		var aImageDict = {};
		var aImageList = [];

		for(var aImageIndex = 0; aImageIndex < 4; aImageIndex++) {
			aImageDict[aImageIndex] = [];
		}

		// Take the first 16 images
		for(var imageIndex = 0; imageIndex < 16; imageIndex++) {
			const galleryImageURL = await await this.storage.ref(this.galleryImageBaseBucketPath + imageIndex + '.jpg').getDownloadURL();

			galleryImageURLs.push(galleryImageURL);
			galleryImageDict[imageIndex] = { 'remaining': 4, 'list': [] };
		}

		// Take the first 16 images
		for(var galleryImageIndex = 0; galleryImageIndex < 16; galleryImageIndex++) {
			while(true) {
				if(galleryImageDict[galleryImageIndex]['remaining'] === 0) break;

				var randomNumber = Math.floor(Math.random() * 4);

				if(galleryImageDict[galleryImageIndex]['list'].includes(randomNumber)) continue;
				if(aImageDict[randomNumber].includes(galleryImageIndex) || aImageDict[randomNumber].length === 4) continue

				galleryImageDict[galleryImageIndex]['list'].push(randomNumber);
				galleryImageDict[galleryImageIndex]['remaining']--;

				aImageDict[randomNumber].push(galleryImageIndex);
				break;
			}
		}

		for(var imageIndex = 0; imageIndex < 4; imageIndex++) {
			var images = [];
			for(var galleryImageIndex = 0; galleryImageIndex < aImageDict[imageIndex].length; galleryImageIndex++) {
				images.push(galleryImageURLs[aImageDict[imageIndex][galleryImageIndex]]);

				if(galleryImageIndex === 0) {
					$('#' + this.dataDocumentID + 'WidgetGalleryImage_' + imageIndex).attr('src', galleryImageURLs[aImageDict[imageIndex][galleryImageIndex]]);
				}
			}

			// images = images.slice(0, -1);
			$('#' + this.dataDocumentID + 'WidgetGalleryImage_' + imageIndex).attr('instagram-image-switcher', 'images: ' + images);
		}

		$('#' + this.dataDocumentID + 'WidgetBody').attr('instagram-alternate-entities', 'entityIDs: #' + this.dataDocumentID + 'WidgetProfileInfo, #' + this.dataDocumentID + 'WidgetImageGallery');

		generateAFrameAlternatingLogo(this.dataDocumentID + 'WidgetLogo', '#' + this.dataDocumentID + 'WidgetBody', '0.40625 0 0.002', '0 0 0', '0.09375 0.375 1', this.logoImageURL, profileImageURL);
	}
}