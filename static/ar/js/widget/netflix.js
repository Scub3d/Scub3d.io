class NetflixWidget extends BaseWidget {
	dataDocumentID = 'netflix';
	data;

	logoImageURL = this.staticAssetBaseURL + 'ar/img/netflix/logo.svg';
	
	profileImageBucketPath = 'ar/images/netflix/profileImage.png';
	showBoxArtImageBucketPath = 'ar/images/netflix/showBoxArt.jpg';
	showImageBucketPath ='ar/images/netflix/showImage.jpg';

	constructor(db, storage) {
		super(db, storage);
		this.data = new NetflixData();
	}

	async generateAFrameHTML() {
		const profileImageURL = await this.storage.ref(this.profileImageBucketPath).getDownloadURL();
		const showBoxArtImageURL = await this.storage.ref(this.showBoxArtImageBucketPath).getDownloadURL();
		const showImageURL = await this.storage.ref(this.showImageBucketPath).getDownloadURL();

		$('<a-entity/>', {
			id: this.dataDocumentID + 'Widget',
			rotation: '-90 0 0',
			scale: '2 0.5 2',
		}).appendTo('#businessCardMarker');

		$('#' + this.dataDocumentID + 'Widget').attr('position', (this.xPositionModifier * 1) + ' 0 ' + (this.zPositionModifier * 2));

		$('<a-plane/>', {
			id: this.dataDocumentID + 'WidgetColliderPlane',
			rotation: '0 0 0',
			scale: '1 1 1',
			class: 'clickable',
			material: "opacity: 0; depthWrite: false"
		}).appendTo('#' + this.dataDocumentID + 'Widget');

		$('#' + this.dataDocumentID + 'WidgetColliderPlane').attr('position', '0 0 0.01');
		$('#' + this.dataDocumentID + 'WidgetColliderPlane').attr('check-events', 'url: ' + this.data.showURL);

		$('<a-image/>', {
			id: this.dataDocumentID + 'WidgetShowBoxArt',
			rotation: '0 0 0',
			scale: '0.177734375 1 1',
			src: showBoxArtImageURL,
		}).appendTo('#' + this.dataDocumentID + 'Widget');

		$('#' + this.dataDocumentID + 'WidgetShowBoxArt').attr('position', '-0.4111328125 0 0');
		$('#' + this.dataDocumentID + 'WidgetShowBoxArt').attr('material', 'shader: left-sided-rounded-corners; multiplier: ' + 1.0 + '; aspectRatio: ' + (128.0 / 91.0));

		$('<a-entity/>', {
			id: this.dataDocumentID + 'WidgetBody',
			rotation: '0 0 0',
			scale: '0.822265625 1 1',
		}).appendTo('#' + this.dataDocumentID + 'Widget');

		$('#' + this.dataDocumentID + 'WidgetBody').attr('position', '0.0888671875 0 0');

		$('<a-image/>', {
			id: this.dataDocumentID + 'WidgetShowImage',
			rotation: '0 0 0',
			scale: '1 1 1',
			src: showImageURL
		}).appendTo('#' + this.dataDocumentID + 'WidgetBody');

		$('#' + this.dataDocumentID + 'WidgetShowImage').attr('position', '0 0 0');
		$('#' + this.dataDocumentID + 'WidgetShowImage').attr('material', 'shader: right-sided-rounded-corners; multiplier: ' + 1.0 + '; aspectRatio: ' + (128.0 / 421.0));

		if(this.data.isMovie) {
			generateAFrameTextEntity(this.dataDocumentID + 'WidgetMovieTitleText', '#' + this.dataDocumentID + 'WidgetBody', this.data.movieTitle, 30, '#F5F5F1', 0, 'Montserrat', 300, 35, false, '#FF000000', 16, 0, 315, 421, 128, 1, true);
		} else {
			generateAFrameTextEntity(this.dataDocumentID + 'WidgetSeriesTitleText', '#' + this.dataDocumentID + 'WidgetBody', this.data.seriesTitle, 28, '#F5F5F1', 0, 'Montserrat', 300, 32.4, false, '#FF000000', 16, 14, 315, 421, 128, 1, true);
			generateAFrameTextEntity(this.dataDocumentID + 'WidgetEpisodeTitleText', '#' + this.dataDocumentID + 'WidgetBody', this.data.episodeTitle, 20, '#F5F5F1', 0, 'Montserrat', 300, 24.7, false, '#00FF0000', 16, -12, 315, 421, 128, 1, true);
		}

		generateAFrameProgressBar(this.dataDocumentID, '#' + this.dataDocumentID + 'WidgetBody', this.data.progress, this.data.duration, (229.0 / 255.0) + ' ' + (9.0 / 255.0) + ' ' + (20.0 / 255.0), true, false, 128.0, 421.0);
		generateAFrameAlternatingLogo(this.dataDocumentID + 'WidgetLogo', '#' + this.dataDocumentID + 'WidgetBody', '0.3859857482185273 0 0.001', '0 0 0', '0.1140142517814727 0.375 1', this.logoImageURL, profileImageURL);
	}
}
