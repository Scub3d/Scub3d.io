class DisneyplusWidget extends BaseWidget {
	dataDocumentID = 'disneyplus';
	data;

	logoImageURL = this.staticAssetBaseURL + 'ar/img/disneyplus/logo.svg';
	
	profileImageBucketPath = 'ar/images/disneyplus/profileImage.png';
	programImageBucketPath = 'ar/images/disneyplus/programImage.png';
	programTitleLayerImageBucketPath ='ar/images/disneyplus/programTitleLayerImage.png';

	constructor(db, storage) {
		super(db, storage);
		this.data = new DisneyplusData();
	}

	async generateAFrameHTML() {
		const profileImageURL = await this.storage.ref(this.profileImageBucketPath).getDownloadURL();
		const programImageURL = await this.storage.ref(this.programImageBucketPath).getDownloadURL();
		const programTitleLayerImageURL = await this.storage.ref(this.programTitleLayerImageBucketPath).getDownloadURL();

		$('<a-entity/>', {
			id: this.dataDocumentID + 'Widget',
			rotation: '-90 0 0',
			scale: '2 0.5 2',
		}).appendTo('#businessCardMarker');

		$('#' + this.dataDocumentID + 'Widget').attr('position', (this.xPositionModifier * 1) + ' 0 ' + (this.zPositionModifier * 1));

		$('<a-entity/>', {
			id: this.dataDocumentID + 'WidgetBody',
			rotation: '0 0 0',
			scale: '1 1 1',
		}).appendTo('#' + this.dataDocumentID + 'Widget');

		$('#' + this.dataDocumentID + 'WidgetBody').attr('position', '0 0 0');

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
			id: this.dataDocumentID + 'WidgetProgramImage',
			rotation: '0 0 0',
			scale: '1 1 1',
			src: programImageURL,
		}).appendTo('#' + this.dataDocumentID + 'Widget');

		$('#' + this.dataDocumentID + 'WidgetProgramImage').attr('position', '0 0 0');
		$('#' + this.dataDocumentID + 'WidgetProgramImage').attr('material', 'shader: image-rounded-corners; multiplier: ' + 1.0 + '; aspectRatio: ' + (128.0 / 512.0));

		$('<a-entity/>', {
			id: this.dataDocumentID + 'WidgetProgramTitleLayerHolder',
			rotation: '0 0 0',
			scale: '1 1 1',
		}).appendTo('#' + this.dataDocumentID + 'Widget');

		$('#' + this.dataDocumentID + 'WidgetProgramTitleLayerHolder').attr('position', '0 0 0');

		$('<a-image/>', {
			id: this.dataDocumentID + 'WidgetProgramTitleLayerImage',
			rotation: '0 0 0',
			scale: '1 1 1',
			src: programTitleLayerImageURL
		}).appendTo('#' + this.dataDocumentID + 'WidgetProgramTitleLayerHolder');

		$('#' + this.dataDocumentID + 'WidgetProgramTitleLayerImage').attr('position', '0 0 0');
		// $('#' + this.dataDocumentID + 'WidgetProgramTitleLayerImage').attr('material', 'shader: rounded-corners; percent: ' + 1.0 + ';aspectRatio: ' + (128.0 / 512.0));

		if(this.data.isMovie) {
			generateAFrameTextEntity(this.dataDocumentID + 'WidgetMovieTitleText', '#' + this.dataDocumentID + 'WidgetBody', this.data.movieTitle, 30, '#ffffff', 0, 'Montserrat', 300, 35, false, '#FF000000', 20, 0, 396, 512, 128, 1, true);
		} else {
			generateAFrameTextEntity(this.dataDocumentID + 'WidgetSeriesTitleText', '#' + this.dataDocumentID + 'WidgetBody', this.data.seriesTitle, 24, '#ffffff', 0, 'Montserrat', 300, 29.4667, false, '#FF000000', 20, 12, 396, 512, 128, 1, true);
			generateAFrameTextEntity(this.dataDocumentID + 'WidgetEpisodeTitleText', '#' + this.dataDocumentID + 'WidgetBody', this.data.episodeTitle, 14, '#ffffff', 0, 'Montserrat', 300, 16.9, false, '#00FF0000', 20, -12, 396, 512, 128, 1, true);
		}

		generateAFrameProgressBar(this.dataDocumentID, '#' + this.dataDocumentID + 'WidgetBody', this.data.progress, this.data.duration, (2.0 / 255.0) + ' ' + (204.0 / 255.0) + ' ' + (216.0 / 255.0), true, true, 128.0, 512.0);

		generateAFrameAlternatingEntities([this.dataDocumentID + 'WidgetBody', this.dataDocumentID + 'WidgetProgramTitleLayerHolder'], this.dataDocumentID + 'Widget');

		generateAFrameAlternatingLogo(this.dataDocumentID + 'WidgetLogo', '#' + this.dataDocumentID + 'Widget', '0.40625 0 0.002', '0 0 0', '0.09375 0.375 1', this.logoImageURL, profileImageURL);
	}
}