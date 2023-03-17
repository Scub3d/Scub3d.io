class HuluWidget extends BaseWidget {
	dataDocumentID = 'hulu';
	data;

	logoImageURL = this.staticAssetBaseURL + 'ar/img/hulu/logo.svg';
	
	showImageBucketPath ='ar/images/hulu/showImage.jpg';
	showFrameBucketPath = 'ar/images/hulu/showFrame.jpg';

	constructor(db, storage) {
		super(db, storage);
		this.data = new HuluData();
	}

	async generateAFrameHTML() {
		const showImageURL = await this.storage.ref(this.showImageBucketPath).getDownloadURL();
		const showFrameURL = await this.storage.ref(this.showFrameBucketPath).getDownloadURL();

		$('<a-entity/>', {
			id: this.dataDocumentID + 'Widget',
			rotation: '-90 0 0',
			scale: '2 0.5 2',
		}).appendTo('#businessCardMarker');

		$('#' + this.dataDocumentID + 'Widget').attr('position', (this.xPositionModifier * 1) + ' 0 ' + (this.zPositionModifier * -1));

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
			id: this.dataDocumentID + 'WidgetShowImage',
			rotation: '0 0 0',
			scale: '0.166015625 1 1',
			src: showImageURL
		}).appendTo('#' + this.dataDocumentID + 'Widget');

		$('#' + this.dataDocumentID + 'WidgetShowImage').attr('position', '-0.4169921875 0 0');
		$('#' + this.dataDocumentID + 'WidgetShowImage').attr('material', 'shader: left-sided-rounded-corners; multiplier: ' + 1.0 + ';aspectRatio: ' + (128.0 / 85.0));

		$('<a-entity/>', {
			id: this.dataDocumentID + 'WidgetBody',
			rotation: '0 0 0',
			scale: '0.833984375 1 1',
		}).appendTo('#' + this.dataDocumentID + 'Widget');

		$('#' + this.dataDocumentID + 'WidgetBody').attr('position', '0.0830078125 0 0');

		$('<a-image/>', {
			id: this.dataDocumentID + 'WidgetShowFrame',
			rotation: '0 0 0',
			scale: '1 1 1',
			src: showFrameURL,
			transparent: false
		}).appendTo('#' + this.dataDocumentID + 'WidgetBody');

		$('#' + this.dataDocumentID + 'WidgetShowFrame').attr('position', '0 0 0');
		$('#' + this.dataDocumentID + 'WidgetShowFrame').attr('material', 'shader: right-sided-rounded-corners; multiplier: ' + 1.0 + ';aspectRatio: ' + (128.0 / 427.0));

		if(this.data.isMovie) {
			generateAFrameTextEntity(this.dataDocumentID + 'WidgetMovieTitleText', '#' + this.dataDocumentID + 'WidgetBody', this.data.movieTitle, 30, '#1ce783', 0, 'Montserrat', 300, 35, false, '#FF000000', 16, 17, 315, 421, 128, 1, true);
		} else {
			generateAFrameTextEntity(this.dataDocumentID + 'WidgetSeriesTitleText', '#' + this.dataDocumentID + 'WidgetBody', this.data.seriesTitle, 28, '#1ce783', 0, 'Montserrat', 300, 32.4, false, '#FF000000', 16, 14, 315, 421, 128, 1, true);
			generateAFrameTextEntity(this.dataDocumentID + 'WidgetEpisodeTitleText', '#' + this.dataDocumentID + 'WidgetBody', this.data.episodeTitle, 20, '#1ce783', 0, 'Montserrat', 300, 24.7, false, '#00FF0000', 16, -12, 315, 421, 128, 1, true);
		}

		generateAFrameProgressBar(this.dataDocumentID, '#' + this.dataDocumentID + 'WidgetBody', this.data.progress * this.data.duration, this.data.duration, (28.0 / 255.0) + ' ' + (231.0 / 255.0) + ' ' + (131.0 / 255.0), true, false, 128.0, 427.0);

		$('<a-image/>', {
			id: this.dataDocumentID + 'WidgetLogo',
			rotation: '0 0 0',
			scale: '0.1140142517814727 0.375 1',
			src: 'https://static.scub3d.io/ar/img/hulu/logo.svg',
		}).appendTo('#' + this.dataDocumentID + 'WidgetBody');

		$('#' + this.dataDocumentID + 'WidgetLogo').attr('position', '0.3859857482185273 0 0.001');
	}
}
