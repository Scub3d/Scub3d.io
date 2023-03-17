class GitHubWidget extends BaseWidget {
	dataDocumentID = 'github';
	data;

	constructor(db, storage) {
		super(db, storage);
		this.data = new GitHubData();
	}

	magicNumber = 408.0 / 5.5;
	magicNumber2 = 408.0 / 6.5;
	magicNumber2_correction = (this.magicNumber2 / 2.0);

	magicNumber3 = 408.0 / 5;
	magicNumber3_correction = (this.magicNumber3 / 2.0) + 8;

	logoImageURL = this.staticAssetBaseURL + 'ar/img/github/logo.svg';
	followersImageURL  = this.staticAssetBaseURL + 'ar/img/github/followers.svg';
	reposImageURL  = this.staticAssetBaseURL + 'ar/img/github/repos.svg';
	gistsImageURL  = this.staticAssetBaseURL + 'ar/img/github/gists.svg';
	starsImageURL  = this.staticAssetBaseURL + 'ar/img/github/stars.svg';
	branchesImageURL  = this.staticAssetBaseURL + 'ar/img/github/branches.svg';
	issuesImageURL  = this.staticAssetBaseURL + 'ar/img/github/issues.svg';
	pullrequestsImageURL  = this.staticAssetBaseURL + 'ar/img/github/pullrequests.svg';
	watchersImageURL  = this.staticAssetBaseURL + 'ar/img/github/watchers.svg';
	forksImageURL  = this.staticAssetBaseURL + 'ar/img/github/forks.svg';
	commentsImageURL  = this.staticAssetBaseURL + 'ar/img/github/comments.svg';
	revisionsImageURL  = this.staticAssetBaseURL + 'ar/img/github/revisions.svg';

	profileImageBucketPath = 'ar/images/github/profileImage.png';

	async generateAFrameHTML() {
		const profileImageURL = await this.storage.ref(this.profileImageBucketPath).getDownloadURL();

		$('<a-entity/>', {
			id: this.dataDocumentID + 'Widget',
			rotation: '-90 0 0',
			scale: '2 0.5 2'
		}).appendTo('#businessCardMarker');

		$('#' + this.dataDocumentID + 'Widget').attr('position', (this.xPositionModifier * -1) + ' 0 ' + (this.zPositionModifier * 1));

		$('<a-image/>', {
			id: this.dataDocumentID + 'WidgetBody',
			rotation: '0 0 0',
			scale: '1 1 1',
		}).appendTo('#' + this.dataDocumentID + 'Widget');

		$('#' + this.dataDocumentID + 'WidgetBody').attr('position', '0 0 0');
		$('#' + this.dataDocumentID + 'WidgetBody').attr('material', 'shader: color-rounded-corners; color: ' + (13.0 / 255.0) + ' ' + (17.0 / 255.0) + ' ' + (23.0 / 255.0) + '; multiplier: ' + 1.0 + '; aspectRatio: ' + (128.0 / 512.0));

		$('<a-entity/>', {
			id: this.dataDocumentID + 'WidgetProfileInfo',
			rotation: '0 0 0',
			scale: '1 1 1',
		}).appendTo('#' + this.dataDocumentID + 'WidgetBody');

		$('<a-plane/>', {
			id: this.dataDocumentID + 'WidgetProfileInfoColliderPlane',
			rotation: '0 0 0',
			scale: '1 1 1',
			// class: 'clickable',
			material: "opacity: 0; depthWrite: false"
		}).appendTo('#' + this.dataDocumentID + 'WidgetProfileInfo');

		$('#' + this.dataDocumentID + 'WidgetProfileInfoColliderPlane').attr('position', '0 0 0.01');
		$('#' + this.dataDocumentID + 'WidgetProfileInfoColliderPlane').attr('check-events', 'url: https://github.com/' + this.data.username);

		$('<a-entity/>', {
			id: this.dataDocumentID + 'WidgetRepoInfo',
			rotation: '0 0 0',
			scale: '1 1 1',
		}).appendTo('#' + this.dataDocumentID + 'WidgetBody');

		$('<a-plane/>', {
			id: this.dataDocumentID + 'WidgetRepoInfoColliderPlane',
			rotation: '0 0 0',
			scale: '1 1 1',
			// class: 'clickable',
			material: "opacity: 0; depthWrite: false"
		}).appendTo('#' + this.dataDocumentID + 'WidgetRepoInfo');

		$('#' + this.dataDocumentID + 'WidgetRepoInfoColliderPlane').attr('position', '0 0 0.01');
		$('#' + this.dataDocumentID + 'WidgetRepoInfoColliderPlane').attr('check-events', 'url: ' + this.data.repoURL);

		$('<a-entity/>', {
			id: this.dataDocumentID + 'WidgetGistInfo',
			rotation: '0 0 0',
			scale: '1 1 1',
		}).appendTo('#' + this.dataDocumentID + 'WidgetBody');
		
		$('<a-plane/>', {
			id: this.dataDocumentID + 'WidgetGistInfoColliderPlane',
			rotation: '0 0 0',
			scale: '1 1 1',
			// class: 'clickable',
			material: "opacity: 0; depthWrite: false"
		}).appendTo('#' + this.dataDocumentID + 'WidgetGistInfo');

		$('#' + this.dataDocumentID + 'WidgetGistInfoColliderPlane').attr('position', '0 0 0.01');
		$('#' + this.dataDocumentID + 'WidgetGistInfoColliderPlane').attr('check-events', 'url: ' + this.data.gistURL);

		// Profile Info
		generateAFrameTextEntity(this.dataDocumentID + 'WidgetProfileNameText', '#' + this.dataDocumentID + 'WidgetProfileInfo', this.data['username'], 26, '#c9d1d9', 8, 'Montserrat', 300, 31.6, true, '#FF000000', 8, 19.8, 408, 512, 128, 1, false);

		$('<a-image/>', {
			id: this.dataDocumentID + 'WidgetProfileFollowersImage',
			rotation: '0 0 0',
			scale: (16.0 / 512.0) + ' ' + (16.0 / 128.0) + ' 1',
			src: this.followersImageURL,
			material: 'alphaTest: 0.5; color: #8B949E'
		}).appendTo('#' + this.dataDocumentID + 'WidgetProfileInfo');

		$('#' + this.dataDocumentID + 'WidgetProfileFollowersImage').attr('position', (-1 * (((((1 - (28 / 512)) / 2) * 512) / 512.0) - ((this.magicNumber * 1) / 512))) + ' ' + (-1 * (22.0 / 128.0)) + ' 0.001');

		generateAFrameTextEntity(this.dataDocumentID + 'WidgetProfileFollowersCountText', '#' + this.dataDocumentID + 'WidgetProfileInfo', this.data['followerCount'].toString(), 14, '#8b949e', 10, 'Montserrat', 300, 16, false, '#FF000000', (this.magicNumber * 1) + 28, -16.45, 28, 512, 128, 1, false);

		$('<a-image/>', {
			id: this.dataDocumentID + 'WidgetProfileReposImage',
			rotation: '0 0 0',
			scale: (16.0 / 512.0) + ' ' + (16.0 / 128.0) + ' 1',
			src: this.reposImageURL,
			material: 'alphaTest: 0.5; color: #8B949E'
		}).appendTo('#' + this.dataDocumentID + 'WidgetProfileInfo');

		$('#' + this.dataDocumentID + 'WidgetProfileReposImage').attr('position', (-1 * (((((1 - (28 / 512)) / 2) * 512) / 512.0) - ((this.magicNumber * 2) / 512))) + ' ' + (-1 * (23.0 / 128.0)) + ' 0.001');

		generateAFrameTextEntity(this.dataDocumentID + 'WidgetProfileReposCountText', '#' + this.dataDocumentID + 'WidgetProfileInfo', this.data['reposCount'].toString(), 14, '#8b949e', 10, 'Montserrat', 300, 16, false, '#0FF00000', (this.magicNumber * 2) + 28, -16.45, 28, 512, 128, 1, false);

		$('<a-image/>', {
			id: this.dataDocumentID + 'WidgetProfileGistsImage',
			rotation: '0 0 0',
			scale: (16.0 / 512.0) + ' ' + (16.0 / 128.0) + ' 1',
			src: this.gistsImageURL,
			material: 'alphaTest: 0.5; color: #8B949E'
		}).appendTo('#' + this.dataDocumentID + 'WidgetProfileInfo');

		$('#' + this.dataDocumentID + 'WidgetProfileGistsImage').attr('position', (-1 * (((((1 - (28 / 512)) / 2) * 512) / 512.0) - ((this.magicNumber * 3) / 512))) + ' ' + (-1 * (22.0 / 128.0)) + ' 0.001');

		generateAFrameTextEntity(this.dataDocumentID + 'WidgetProfileGistsCountText', '#' + this.dataDocumentID + 'WidgetProfileInfo', this.data['gistsCount'].toString(), 14, '#8b949e', 10, 'Montserrat', 300, 16, false, '#00FF0000', (this.magicNumber * 3) + 28, -16.45, 28, 512, 128, 1, false);

		$('<a-image/>', {
			id: this.dataDocumentID + 'WidgetProfileStarsImage',
			rotation: '0 0 0',
			scale: (16.0 / 512.0) + ' ' + (16.0 / 128.0) + ' 1',
			src: this.starsImageURL,
			material: 'alphaTest: 0.5; color: #8B949E'
		}).appendTo('#' + this.dataDocumentID + 'WidgetProfileInfo');

		$('#' + this.dataDocumentID + 'WidgetProfileStarsImage').attr('position', (-1 * (((((1 - (28 / 512)) / 2) * 512) / 512.0) - ((this.magicNumber * 4) / 512))) + ' ' + (-1 * (22.0 / 128.0)) + ' 0.001');

		generateAFrameTextEntity(this.dataDocumentID + 'WidgetProfileStarsCountText', '#' + this.dataDocumentID + 'WidgetProfileInfo', this.data['starCount'].toString(), 14, '#8b949e', 10, 'Montserrat', 300, 16, false, '#000FF000', (this.magicNumber * 4) + 28, -16.45, 28, 512, 128, 1, false);

		// Repo Info
		$('<a-image/>', {
			id: this.dataDocumentID + 'WidgetRepoRepoImage',
			rotation: '0 0 0',
			scale: (16.0 / 512.0) + ' ' + (16.0 / 128.0) + ' 1',
			src: this.reposImageURL,
			material: 'alphaTest: 0.5; color: #8B949E'
		}).appendTo('#' + this.dataDocumentID + 'WidgetRepoInfo');
		$('#' + this.dataDocumentID + 'WidgetRepoRepoImage').attr('position', (-1 * (((((1 - (28 / 512)) / 2) * 512) / 512.0) - (((this.magicNumber2 * 1) - this.magicNumber2_correction) / 512))) + ' ' + (14.464 / 128.0) + ' 0.001');

		generateAFrameTextEntity(this.dataDocumentID + 'WidgetRepoNameText', '#' + this.dataDocumentID + 'WidgetRepoInfo', this.data['repoName'], 20, '#c9d1d9', 8, 'Montserrat', 300, 24, false, '#FFFF0000', (this.magicNumber2 * 1) + 28 - this.magicNumber2_correction, 19.8, 220, 512, 128, 1, false);

		$('<a-image/>', {
			id: this.dataDocumentID + 'WidgetRepoCommitImage',
			rotation: '0 0 0',
			scale: (16.0 / 512.0) + ' ' + (16.0 / 128.0) + ' 1',
			src: this.revisionsImageURL,
			material: 'alphaTest: 0.5; color: #8B949E'
		}).appendTo('#' + this.dataDocumentID + 'WidgetRepoInfo');

		$('#' + this.dataDocumentID + 'WidgetRepoCommitImage').attr('position', (-1 * (((((1 - (28 / 512)) / 2) * 512) / 512.0) - (((this.magicNumber2 * 5) - this.magicNumber2_correction) / 512))) + ' ' + (14.464  / 128.0) + ' 0.001');
		
		generateAFrameTextEntity(this.dataDocumentID + 'WidgetRepoCommitText', '#' + this.dataDocumentID + 'WidgetRepoInfo', this.data['commitSHA'].slice(0, 7), 20, '#c9d1d9', 8, 'Montserrat', 300, 24, false, '#FF000000', (this.magicNumber2 * 5) + 28 - this.magicNumber2_correction, 19.8, 90, 512, 128, 1, false);

		$('<a-image/>', {
			id: this.dataDocumentID + 'WidgetRepoBranchesImage',
			rotation: '0 0 0',
			scale: (16.0 / 512.0) + ' ' + (16.0 / 128.0) + ' 1',
			src: this.branchesImageURL,
			material: 'alphaTest: 0.5; color: #8B949E'
		}).appendTo('#' + this.dataDocumentID + 'WidgetRepoInfo');

		$('#' + this.dataDocumentID + 'WidgetRepoBranchesImage').attr('position', (-1 * (((((1 - (28 / 512)) / 2) * 512) / 512.0) - (((this.magicNumber2 * 1) - this.magicNumber2_correction) / 512))) + ' ' + (-1 * (22.0 / 128.0)) + ' 0.001');
		generateAFrameTextEntity(this.dataDocumentID + 'WidgetRepoBranchesCountText', '#' + this.dataDocumentID + 'WidgetRepoInfo', this.data['repoBranchCount'].toString(), 14, '#8b949e', 10, 'Montserrat', 300, 16, false, '#FF000000', (this.magicNumber2 * 1) + 28 - this.magicNumber2_correction, -16.45, 28, 512, 128, 1, false);

		$('<a-image/>', {
			id: this.dataDocumentID + 'WidgetRepoIssuesImage',
			rotation: '0 0 0',
			scale: (16.0 / 512.0) + ' ' + (16.0 / 128.0) + ' 1',
			src: this.issuesImageURL,
			material: 'alphaTest: 0.5; color: #8B949E'
		}).appendTo('#' + this.dataDocumentID + 'WidgetRepoInfo');

		$('#' + this.dataDocumentID + 'WidgetRepoIssuesImage').attr('position', (-1 * (((((1 - (28 / 512)) / 2) * 512) / 512.0) - (((this.magicNumber2 * 2) - this.magicNumber2_correction) / 512))) + ' ' + (-1 * (22.0 / 128.0)) + ' 0.001');
		generateAFrameTextEntity(this.dataDocumentID + 'WidgetRepoIssuesCountText', '#' + this.dataDocumentID + 'WidgetRepoInfo', this.data['repoOpenIssueCount'].toString(), 14, '#8b949e', 10, 'Montserrat', 300, 16, false, '#FF000000', (this.magicNumber2 * 2) + 28 - this.magicNumber2_correction, -16.45, 28, 512, 128, 1, false);

		$('<a-image/>', {
			id: this.dataDocumentID + 'WidgetRepoPullRequestsImage',
			rotation: '0 0 0',
			scale: (16.0 / 512.0) + ' ' + (16.0 / 128.0) + ' 1',
			src: this.pullrequestsImageURL,
			material: 'alphaTest: 0.5; color: #8B949E'
		}).appendTo('#' + this.dataDocumentID + 'WidgetRepoInfo');

		$('#' + this.dataDocumentID + 'WidgetRepoPullRequestsImage').attr('position', (-1 * (((((1 - (28 / 512)) / 2) * 512) / 512.0) - (((this.magicNumber2 * 3) - this.magicNumber2_correction) / 512))) + ' ' + (-1 * (22.0 / 128.0)) + ' 0.001');
		generateAFrameTextEntity(this.dataDocumentID + 'WidgetRepoPullRequestsCountText', '#' + this.dataDocumentID + 'WidgetRepoInfo', this.data['repoPullRequestsCount'].toString(), 14, '#8b949e', 10, 'Montserrat', 300, 16, false, '#FF000000', (this.magicNumber2 * 3) + 28 - this.magicNumber2_correction, -16.45, 28, 512, 128, 1, false);

		$('<a-image/>', {
			id: this.dataDocumentID + 'WidgetRepoWatchersImage',
			rotation: '0 0 0',
			scale: (16.0 / 512.0) + ' ' + (16.0 / 128.0) + ' 1',
			src: this.watchersImageURL,
			material: 'alphaTest: 0.5; color: #8B949E'
		}).appendTo('#' + this.dataDocumentID + 'WidgetRepoInfo');

		$('#' + this.dataDocumentID + 'WidgetRepoWatchersImage').attr('position', (-1 * (((((1 - (28 / 512)) / 2) * 512) / 512.0) - (((this.magicNumber2 * 4) - this.magicNumber2_correction) / 512))) + ' ' + (-1 * (22.0 / 128.0)) + ' 0.001');
		generateAFrameTextEntity(this.dataDocumentID + 'WidgetRepoWatchersCountText', '#' + this.dataDocumentID + 'WidgetRepoInfo', this.data['repoWatcherCount'].toString(), 14, '#8b949e', 10, 'Montserrat', 300, 16, false, '#FF000000', (this.magicNumber2 * 4) + 28 - this.magicNumber2_correction, -16.45, 28, 512, 128, 1, false);

		$('<a-image/>', {
			id: this.dataDocumentID + 'WidgetRepoForksImage',
			rotation: '0 0 0',
			scale: (16.0 / 512.0) + ' ' + (16.0 / 128.0) + ' 1',
			src: this.forksImageURL,
			material: 'alphaTest: 0.5; color: #8B949E'
		}).appendTo('#' + this.dataDocumentID + 'WidgetRepoInfo');

		$('#' + this.dataDocumentID + 'WidgetRepoForksImage').attr('position', (-1 * (((((1 - (28 / 512)) / 2) * 512) / 512.0) - (((this.magicNumber2 * 5) - this.magicNumber2_correction) / 512))) + ' ' + (-1 * (22.0 / 128.0)) + ' 0.001');
		generateAFrameTextEntity(this.dataDocumentID + 'WidgetRepoForksCountText', '#' + this.dataDocumentID + 'WidgetRepoInfo', this.data['repoForkCount'].toString(), 14, '#8b949e', 10, 'Montserrat', 300, 16, false, '#FF000000', (this.magicNumber2 * 5) + 28 - this.magicNumber2_correction, -16.45, 28, 512, 128, 1, false);

		$('<a-image/>', {
			id: this.dataDocumentID + 'WidgetRepoStarsImage',
			rotation: '0 0 0',
			scale: (16.0 / 512.0) + ' ' + (16.0 / 128.0) + ' 1',
			src: this.starsImageURL,
			material: 'alphaTest: 0.5; color: #8B949E'
		}).appendTo('#' + this.dataDocumentID + 'WidgetRepoInfo');

		$('#' + this.dataDocumentID + 'WidgetRepoStarsImage').attr('position', (-1 * (((((1 - (28 / 512)) / 2) * 512) / 512.0) - (((this.magicNumber2 * 6) - this.magicNumber2_correction) / 512))) + ' ' + (-1 * (22.0 / 128.0)) + ' 0.001');
		generateAFrameTextEntity(this.dataDocumentID + 'WidgetRepoStarsCountText', '#' + this.dataDocumentID + 'WidgetRepoInfo', this.data['repoStarCount'].toString(), 14, '#8b949e', 10, 'Montserrat', 300, 16, false, '#FF000000', (this.magicNumber2 * 6) + 28 - this.magicNumber2_correction, -16.45, 28, 512, 128, 1, false);

		// Gist Info

		$('<a-image/>', {
			id: this.dataDocumentID + 'WidgetGistGistImage',
			rotation: '0 0 0',
			scale: (16.0 / 512.0) + ' ' + (16.0 / 128.0) + ' 1',
			src: this.gistsImageURL,
			material: 'alphaTest: 0.5; color: #8B949E'
		}).appendTo('#' + this.dataDocumentID + 'WidgetGistInfo');
		$('#' + this.dataDocumentID + 'WidgetGistGistImage').attr('position', (-1 * (((((1 - (28 / 512)) / 2) * 512) / 512.0) - (((this.magicNumber3 * 1) - this.magicNumber3_correction) / 512))) + ' ' + (14.464 / 128.0) + ' 0.001');
		generateAFrameTextEntity(this.dataDocumentID + 'WidgetGistNameText', '#' + this.dataDocumentID + 'WidgetGistInfo', this.data['gistName'], 20, '#c9d1d9', 8, 'Montserrat', 300, 24, false, '#FF000000', (this.magicNumber3 * 1) + 28 - this.magicNumber3_correction, 19.8, 220, 512, 128, 1, false);

		$('<a-image/>', {
			id: this.dataDocumentID + 'WidgetGistCommitImage',
			rotation: '0 0 0',
			scale: (16.0 / 512.0) + ' ' + (16.0 / 128.0) + ' 1',
			src: this.revisionsImageURL,
			material: 'alphaTest: 0.5; color: #8B949E'
		}).appendTo('#' + this.dataDocumentID + 'WidgetGistInfo');
		$('#' + this.dataDocumentID + 'WidgetGistCommitImage').attr('position', (-1 * (((((1 - (28 / 512)) / 2) * 512) / 512.0) - (((this.magicNumber3 * 4) - this.magicNumber3_correction) / 512))) + ' ' + (14.464  / 128.0) + ' 0.001');
		generateAFrameTextEntity(this.dataDocumentID + 'WidgetGistCommitText', '#' + this.dataDocumentID + 'WidgetGistInfo', this.data['gistCommitSHA'].slice(0, 7), 20, '#c9d1d9', 8, 'Montserrat', 300, 24, false, '#FF000000', (this.magicNumber3 * 4) + 28 - this.magicNumber3_correction, 19.8, 90, 512, 128, 1, false);

		$('<a-image/>', {
			id: this.dataDocumentID + 'WidgetGistFilesImage',
			rotation: '0 0 0',
			scale: (16.0 / 512.0) + ' ' + (16.0 / 128.0) + ' 1',
			src: this.gistsImageURL,
			material: 'alphaTest: 0.5; color: #8B949E'
		}).appendTo('#' + this.dataDocumentID + 'WidgetGistInfo');

		$('#' + this.dataDocumentID + 'WidgetGistFilesImage').attr('position', (-1 * (((((1 - (28 / 512)) / 2) * 512) / 512.0) - (((this.magicNumber3 * 1) - this.magicNumber3_correction) / 512))) + ' ' + (-1 * (22.0 / 128.0)) + ' 0.001');
		generateAFrameTextEntity(this.dataDocumentID + 'WidgetGistsFileCountText', '#' + this.dataDocumentID + 'WidgetGistInfo', this.data['gistFileCount'].toString(), 14, '#8b949e', 10, 'Montserrat', 300, 16, false, '#FF000000', (this.magicNumber3 * 1) + 28 - this.magicNumber3_correction, -16.45, 28, 512, 128, 1, false);

		$('<a-image/>', {
			id: this.dataDocumentID + 'WidgetGistCommentsImage',
			rotation: '0 0 0',
			scale: (16.0 / 512.0) + ' ' + (16.0 / 128.0) + ' 1',
			src: this.commentsImageURL,
			material: 'alphaTest: 0.5; color: #8B949E'
		}).appendTo('#' + this.dataDocumentID + 'WidgetGistInfo');

		$('#' + this.dataDocumentID + 'WidgetGistCommentsImage').attr('position', (-1 * (((((1 - (28 / 512)) / 2) * 512) / 512.0) - (((this.magicNumber3 * 2) - this.magicNumber3_correction) / 512))) + ' ' + (-1 * (22.0 / 128.0)) + ' 0.001');
		generateAFrameTextEntity(this.dataDocumentID + 'WidgetGistsCommentCountText', '#' + this.dataDocumentID + 'WidgetGistInfo', this.data['gistCommentCount'].toString(), 14, '#8b949e', 10, 'Montserrat', 300, 16, false, '#FF000000', (this.magicNumber3 * 2) + 28 - this.magicNumber3_correction, -16.45, 28, 512, 128, 1, false);

		$('<a-image/>', {
			id: this.dataDocumentID + 'WidgetGistForksImage',
			rotation: '0 0 0',
			scale: (16.0 / 512.0) + ' ' + (16.0 / 128.0) + ' 1',
			src: this.forksImageURL,
			material: 'alphaTest: 0.5; color: #8B949E'
		}).appendTo('#' + this.dataDocumentID + 'WidgetGistInfo');

		$('#' + this.dataDocumentID + 'WidgetGistForksImage').attr('position', (-1 * (((((1 - (28 / 512)) / 2) * 512) / 512.0) - (((this.magicNumber3 * 3) - this.magicNumber3_correction) / 512))) + ' ' + (-1 * (22.0 / 128.0)) + ' 0.001');
		generateAFrameTextEntity(this.dataDocumentID + 'WidgetGistsForkCountText', '#' + this.dataDocumentID + 'WidgetGistInfo', this.data['gistForkCount'].toString(), 14, '#8b949e', 10, 'Montserrat', 300, 16, false, '#FF000000', (this.magicNumber3 * 3) + 28 - this.magicNumber3_correction, -16.45, 28, 512, 128, 1, false);

		$('<a-image/>', {
			id: this.dataDocumentID + 'WidgetGistRevisionsImage',
			rotation: '0 0 0',
			scale: (16.0 / 512.0) + ' ' + (16.0 / 128.0) + ' 1',
			src: this.revisionsImageURL,
			material: 'alphaTest: 0.5; color: #8B949E'
		}).appendTo('#' + this.dataDocumentID + 'WidgetGistInfo');

		$('#' + this.dataDocumentID + 'WidgetGistRevisionsImage').attr('position', (-1 * (((((1 - (28 / 512)) / 2) * 512) / 512.0) - (((this.magicNumber3 * 4) - this.magicNumber3_correction) / 512))) + ' ' + (-1 * (22.0 / 128.0)) + ' 0.001');
		generateAFrameTextEntity(this.dataDocumentID + 'WidgetGistsRevisionCountText', '#' + this.dataDocumentID + 'WidgetGistInfo', this.data['gistRevisionCount'].toString(), 14, '#8b949e', 10, 'Montserrat', 300, 16, false, '#FF000000', (this.magicNumber3 * 4) + 28 - this.magicNumber3_correction, -16.45, 28, 512, 128, 1, false);

		$('<a-image/>', {
			id: this.dataDocumentID + 'WidgetGistStarsImage',
			rotation: '0 0 0',
			scale: (16.0 / 512.0) + ' ' + (16.0 / 128.0) + ' 1',
			src: this.starsImageURL,
			material: 'alphaTest: 0.5; color: #8B949E'
		}).appendTo('#' + this.dataDocumentID + 'WidgetGistInfo');

		$('#' + this.dataDocumentID + 'WidgetGistStarsImage').attr('position', (-1 * (((((1 - (28 / 512)) / 2) * 512) / 512.0) - (((this.magicNumber3 * 5) - this.magicNumber3_correction) / 512))) + ' ' + (-1 * (22.0 / 128.0)) + ' 0.001');
		generateAFrameTextEntity(this.dataDocumentID + 'WidgetGistsStarCountText', '#' + this.dataDocumentID + 'WidgetGistInfo', this.data['gistStarCount'].toString(), 14, '#8b949e', 10, 'Montserrat', 300, 16, false, '#FF000000', (this.magicNumber3 * 5) + 28 - this.magicNumber3_correction, -16.45, 28, 512, 128, 1, false);

		generateAFrameAlternatingEntities([this.dataDocumentID + 'WidgetProfileInfo', this.dataDocumentID + 'WidgetRepoInfo', this.dataDocumentID + 'WidgetGistInfo'], this.dataDocumentID + 'WidgetBody');

		generateAFrameAlternatingLogo(this.dataDocumentID + 'WidgetLogo', '#' + this.dataDocumentID + 'WidgetBody', '0.40625 0 0.002', '0 0 0', '0.09375 0.375 1', this.logoImageURL, profileImageURL);
	}
}