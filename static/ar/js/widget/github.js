class GitHubWidget extends BaseWidget {
	dataDocumentID = 'github';
	updateIntervalMS = 60000; // 1 min — cap to keep fresh within typical session length
	data;

	constructor(db, storage) {
		super(db, storage);
		this.data = new GitHubData();
	}

	magicNumber = 408.0 / 5.5;

	logoImageURL = this.staticAssetBaseURL + 'ar/img/github/logo.svg';
	followersImageURL  = this.staticAssetBaseURL + 'ar/img/github/followers.svg';
	reposImageURL  = this.staticAssetBaseURL + 'ar/img/github/repos.svg';
	gistsImageURL  = this.staticAssetBaseURL + 'ar/img/github/gists.svg';
	starsImageURL  = this.staticAssetBaseURL + 'ar/img/github/stars.svg';

	profileImageBucketPath = 'ar/images/github/profileImage.png';

	// 7 days × last 26 weeks — confined to the left portion of the 4:1 face
	// so the alternating logo (at local X ≈ 0.406) isn't occluded. 26 weeks
	// is the most that fits at WORLD-square cell footprint given the
	// available X span on the left side. Grid X range: [-0.45, +0.33].
	HISTOGRAM_COLS = 26;
	HISTOGRAM_ROWS = 7;
	HISTOGRAM_GRID_X_MIN = -0.45;
	HISTOGRAM_GRID_X_MAX = 0.33;
	HISTOGRAM_CELL_FILL = 0.75; // fraction of cell pitch used by the bar footprint
	HISTOGRAM_BAR_MIN_Z = 0.005; // floor for 0-commit days so the grid shape always reads
	HISTOGRAM_BAR_MAX_Z = 0.04;  // max local-Z, becomes ~0.08 world-Y after widget's 2× depth scale
	// 5-level palette, user-specified. Buckets by quartile of non-zero counts
	// (GitHub's own heuristic) rather than using GraphQL's returned color.
	HISTOGRAM_PALETTE = ['#151b23', '#033a16', '#196c2e', '#2ea043', '#56d364'];

	async generateAFrameHTML() {
		const profileImageURL = await this.getCachedDownloadURL(this.profileImageBucketPath);

		$('<a-entity/>', {
			id: this.dataDocumentID + 'Widget',
			rotation: '-90 0 0',
			scale: '2 0.5 2'
		}).appendTo('#businessCardMarker');

		$('#' + this.dataDocumentID + 'Widget').attr('position', (this.xPositionModifier * -1) + ' 0 ' + (this.zPositionModifier * 2));

		$('<a-image/>', {
			id: this.dataDocumentID + 'WidgetBody',
			rotation: '0 0 0',
			scale: '1 1 1',
		}).appendTo('#' + this.dataDocumentID + 'Widget');

		$('#' + this.dataDocumentID + 'WidgetBody').attr('position', '0 0 0');
		$('#' + this.dataDocumentID + 'WidgetBody').attr('material', 'shader: color-rounded-corners; color: ' + (13.0 / 255.0) + ' ' + (17.0 / 255.0) + ' ' + (23.0 / 255.0) + '; multiplier: ' + 1.0 + '; aspectRatio: ' + (128.0 / 512.0));

		// Profile face — kept as-is from the previous revision. Username +
		// four stat rows (followers, repos, gists, stars).
		$('<a-entity/>', {
			id: this.dataDocumentID + 'WidgetProfileInfo',
			rotation: '0 0 0',
			scale: '1 1 1',
		}).appendTo('#' + this.dataDocumentID + 'WidgetBody');

		$('<a-plane/>', {
			id: this.dataDocumentID + 'WidgetProfileInfoColliderPlane',
			rotation: '0 0 0',
			scale: '1 1 1',
			material: "opacity: 0; depthWrite: false"
		}).appendTo('#' + this.dataDocumentID + 'WidgetProfileInfo');

		$('#' + this.dataDocumentID + 'WidgetProfileInfoColliderPlane').attr('position', '0 0 0.01');
		$('#' + this.dataDocumentID + 'WidgetProfileInfoColliderPlane').attr('check-events', 'url: https://github.com/' + this.data.username);

		generateAFrameTextEntity(this.dataDocumentID + 'WidgetProfileNameText', '#' + this.dataDocumentID + 'WidgetProfileInfo', this.data['username'], 26, '#c9d1d9', 8, 'Montserrat', 300, 31.6, true, '#FF000000', 8, 19.8, 408, 512, 128, 1, false);

		$('<a-image/>', {
			id: this.dataDocumentID + 'WidgetProfileFollowersImage',
			rotation: '0 0 0',
			scale: (16.0 / 512.0) + ' ' + (16.0 / 128.0) + ' 1',
			src: this.followersImageURL,
			material: 'shader: flat; alphaTest: 0.5; color: #8B949E'
		}).appendTo('#' + this.dataDocumentID + 'WidgetProfileInfo');

		$('#' + this.dataDocumentID + 'WidgetProfileFollowersImage').attr('position', (-1 * (((((1 - (28 / 512)) / 2) * 512) / 512.0) - ((this.magicNumber * 1) / 512))) + ' ' + (-1 * (22.0 / 128.0)) + ' 0.001');

		generateAFrameTextEntity(this.dataDocumentID + 'WidgetProfileFollowersCountText', '#' + this.dataDocumentID + 'WidgetProfileInfo', this.data['followerCount'].toString(), 14, '#8b949e', 10, 'Montserrat', 300, 16, false, '#FF000000', (this.magicNumber * 1) + 28, -16.45, 28, 512, 128, 1, false);

		$('<a-image/>', {
			id: this.dataDocumentID + 'WidgetProfileReposImage',
			rotation: '0 0 0',
			scale: (16.0 / 512.0) + ' ' + (16.0 / 128.0) + ' 1',
			src: this.reposImageURL,
			material: 'shader: flat; alphaTest: 0.5; color: #8B949E'
		}).appendTo('#' + this.dataDocumentID + 'WidgetProfileInfo');

		$('#' + this.dataDocumentID + 'WidgetProfileReposImage').attr('position', (-1 * (((((1 - (28 / 512)) / 2) * 512) / 512.0) - ((this.magicNumber * 2) / 512))) + ' ' + (-1 * (23.0 / 128.0)) + ' 0.001');

		generateAFrameTextEntity(this.dataDocumentID + 'WidgetProfileReposCountText', '#' + this.dataDocumentID + 'WidgetProfileInfo', this.data['reposCount'].toString(), 14, '#8b949e', 10, 'Montserrat', 300, 16, false, '#0FF00000', (this.magicNumber * 2) + 28, -16.45, 28, 512, 128, 1, false);

		$('<a-image/>', {
			id: this.dataDocumentID + 'WidgetProfileGistsImage',
			rotation: '0 0 0',
			scale: (16.0 / 512.0) + ' ' + (16.0 / 128.0) + ' 1',
			src: this.gistsImageURL,
			material: 'shader: flat; alphaTest: 0.5; color: #8B949E'
		}).appendTo('#' + this.dataDocumentID + 'WidgetProfileInfo');

		$('#' + this.dataDocumentID + 'WidgetProfileGistsImage').attr('position', (-1 * (((((1 - (28 / 512)) / 2) * 512) / 512.0) - ((this.magicNumber * 3) / 512))) + ' ' + (-1 * (22.0 / 128.0)) + ' 0.001');

		generateAFrameTextEntity(this.dataDocumentID + 'WidgetProfileGistsCountText', '#' + this.dataDocumentID + 'WidgetProfileInfo', this.data['gistsCount'].toString(), 14, '#8b949e', 10, 'Montserrat', 300, 16, false, '#00FF0000', (this.magicNumber * 3) + 28, -16.45, 28, 512, 128, 1, false);

		$('<a-image/>', {
			id: this.dataDocumentID + 'WidgetProfileStarsImage',
			rotation: '0 0 0',
			scale: (16.0 / 512.0) + ' ' + (16.0 / 128.0) + ' 1',
			src: this.starsImageURL,
			material: 'shader: flat; alphaTest: 0.5; color: #8B949E'
		}).appendTo('#' + this.dataDocumentID + 'WidgetProfileInfo');

		$('#' + this.dataDocumentID + 'WidgetProfileStarsImage').attr('position', (-1 * (((((1 - (28 / 512)) / 2) * 512) / 512.0) - ((this.magicNumber * 4) / 512))) + ' ' + (-1 * (22.0 / 128.0)) + ' 0.001');

		generateAFrameTextEntity(this.dataDocumentID + 'WidgetProfileStarsCountText', '#' + this.dataDocumentID + 'WidgetProfileInfo', this.data['starCount'].toString(), 14, '#8b949e', 10, 'Montserrat', 300, 16, false, '#000FF000', (this.magicNumber * 4) + 28, -16.45, 28, 512, 128, 1, false);

		// Contribution histogram face — 7×53 grid of 3D bars whose heights
		// scale with daily commit count and whose colors come from GitHub's
		// own GraphQL-returned `color` field (dark-mode palette).
		$('<a-entity/>', {
			id: this.dataDocumentID + 'WidgetContributionInfo',
			rotation: '0 0 0',
			scale: '1 1 1',
		}).appendTo('#' + this.dataDocumentID + 'WidgetBody');

		$('<a-plane/>', {
			id: this.dataDocumentID + 'WidgetContributionColliderPlane',
			rotation: '0 0 0',
			scale: '1 1 1',
			material: "opacity: 0; depthWrite: false"
		}).appendTo('#' + this.dataDocumentID + 'WidgetContributionInfo');

		$('#' + this.dataDocumentID + 'WidgetContributionColliderPlane').attr('position', '0 0 0.01');
		$('#' + this.dataDocumentID + 'WidgetContributionColliderPlane').attr('check-events', 'url: https://github.com/' + this.data.username);

		$('<a-entity/>', {
			id: this.dataDocumentID + 'WidgetContributionHistogram',
			rotation: '0 0 0',
			scale: '1 1 1',
		}).appendTo('#' + this.dataDocumentID + 'WidgetContributionInfo');

		// Small forward Z offset so bar bottoms sit slightly above the body
		// plane; otherwise the min-height (0.005) bars z-fight with the dark
		// background when viewed head-on.
		$('#' + this.dataDocumentID + 'WidgetContributionHistogram').attr('position', '0 0 0.001');

		this._buildContributionHistogram(this.data.contributionDays || []);

		generateAFrameAlternatingEntities([this.dataDocumentID + 'WidgetProfileInfo', this.dataDocumentID + 'WidgetContributionInfo'], this.dataDocumentID + 'WidgetBody');

		generateAFrameAlternatingLogo(this.dataDocumentID + 'WidgetLogo', '#' + this.dataDocumentID + 'WidgetBody', '0.40625 0 0.002', '0 0 0', '0.09375 0.375 1', this.logoImageURL, profileImageURL);
	}

	// One InstancedMesh of N boxes, per-instance transform + color. Much
	// cheaper than N a-box entities (7×53 = 371 mesh objects vs 1), and
	// lines up with the alltrails/mapbox pattern of building custom Three.js
	// geometry directly on a host entity's object3D.
	_buildContributionHistogram(contributionDays) {
		const hostEl = document.getElementById(this.dataDocumentID + 'WidgetContributionHistogram');
		if (!hostEl) return;

		this._disposeContributionHistogram();

		const cols = this.HISTOGRAM_COLS;
		const rows = this.HISTOGRAM_ROWS;

		// Cell pitch — X fits within the reserved left-side X range; Y is
		// derived so the cell's WORLD footprint is square. Widget entity has
		// scale (2, 0.5, 2) + a -90° X rotation, so local-X maps to world-X
		// at 2× and local-Y maps to world-Z at 0.5×. World-square therefore
		// means cellPitchY (local) = 4 × cellPitchX (local).
		const availableX = this.HISTOGRAM_GRID_X_MAX - this.HISTOGRAM_GRID_X_MIN;
		const cellPitchX = availableX / cols;
		const cellPitchY = cellPitchX * 4.0;
		const barW = cellPitchX * this.HISTOGRAM_CELL_FILL;
		const barH = cellPitchY * this.HISTOGRAM_CELL_FILL;

		// Center the 7-row grid vertically on the face.
		const gridHeight = cellPitchY * rows;
		const gridTopY = gridHeight / 2.0;

		// Keep only the most recent `cols` weeks so today lands on the right
		// edge of the grid. Pad with nulls on the front if GraphQL returned
		// fewer weeks than we're showing.
		const targetCount = cols * rows;
		const startIdx = Math.max(0, contributionDays.length - targetCount);
		const visible = contributionDays.slice(startIdx);
		const padded = new Array(Math.max(0, targetCount - visible.length)).fill(null).concat(visible);
		while (padded.length < targetCount) padded.push(null);

		// Quartile thresholds over the non-zero counts — mirrors GitHub's own
		// bucketing so heavy days pop without drowning moderate days.
		const nonZero = [];
		for (const d of padded) {
			if (d && typeof d.count === 'number' && d.count > 0) nonZero.push(d.count);
		}
		nonZero.sort((a, b) => a - b);
		const quantile = (frac) => {
			if (nonZero.length === 0) return 0;
			const idx = Math.min(nonZero.length - 1, Math.floor(nonZero.length * frac));
			return nonZero[idx];
		};
		const t1 = quantile(0.25);
		const t2 = quantile(0.50);
		const t3 = quantile(0.75);
		const maxCount = nonZero.length > 0 ? nonZero[nonZero.length - 1] : 0;

		const bucket = (count) => {
			if (count <= 0) return 0;
			if (count <= t1) return 1;
			if (count <= t2) return 2;
			if (count <= t3) return 3;
			return 4;
		};

		const geometry = new THREE.BoxGeometry(1, 1, 1);
		const material = new THREE.MeshBasicMaterial({ vertexColors: false });
		const mesh = new THREE.InstancedMesh(geometry, material, targetCount);

		const dummy = new THREE.Object3D();
		const color = new THREE.Color();

		for (let i = 0; i < targetCount; i++) {
			const col = Math.floor(i / rows);
			const row = i % rows;
			const day = padded[i];

			const cellCenterX = this.HISTOGRAM_GRID_X_MIN + (col + 0.5) * cellPitchX;
			// Row 0 = Sunday at the TOP → +Y in local frame.
			const cellCenterY = gridTopY - (row + 0.5) * cellPitchY;

			const count = day && typeof day.count === 'number' ? day.count : 0;
			let barZ;
			if (count <= 0) {
				barZ = this.HISTOGRAM_BAR_MIN_Z;
			} else {
				const t = maxCount > 0 ? count / maxCount : 0;
				barZ = this.HISTOGRAM_BAR_MIN_Z + t * (this.HISTOGRAM_BAR_MAX_Z - this.HISTOGRAM_BAR_MIN_Z);
			}

			dummy.position.set(cellCenterX, cellCenterY, barZ / 2.0);
			dummy.scale.set(barW, barH, barZ);
			dummy.rotation.set(0, 0, 0);
			dummy.updateMatrix();
			mesh.setMatrixAt(i, dummy.matrix);

			color.set(this.HISTOGRAM_PALETTE[bucket(count)]);
			mesh.setColorAt(i, color);
		}

		mesh.instanceMatrix.needsUpdate = true;
		if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

		hostEl.object3D.add(mesh);

		this._contributionMesh = mesh;
		this._contributionGeometry = geometry;
		this._contributionMaterial = material;

		this.cleanupFunctions.push(() => this._disposeContributionHistogram());
	}

	_disposeContributionHistogram() {
		if (this._contributionMesh) {
			if (this._contributionMesh.parent) this._contributionMesh.parent.remove(this._contributionMesh);
			if (typeof this._contributionMesh.dispose === 'function') this._contributionMesh.dispose();
			this._contributionMesh = null;
		}
		if (this._contributionGeometry) {
			this._contributionGeometry.dispose();
			this._contributionGeometry = null;
		}
		if (this._contributionMaterial) {
			this._contributionMaterial.dispose();
			this._contributionMaterial = null;
		}
	}

	async applyUpdate(oldData, newData) {
		// Username drives both collider URLs and profile-name layout — rebuild
		// rather than patch. Everything else updates in place.
		if(oldData.username !== newData.username) return false;

		const patchCount = (elementID, newValue, backgroundColor) => {
			updateAFrameEntityText(elementID, newValue.toString(), 14, '#8b949e', 10, 'Montserrat', 300, 16, false, 28, backgroundColor, false);
		};

		if(oldData.followerCount !== newData.followerCount) patchCount(this.dataDocumentID + 'WidgetProfileFollowersCountText', newData.followerCount, '#FF000000');
		if(oldData.reposCount !== newData.reposCount) patchCount(this.dataDocumentID + 'WidgetProfileReposCountText', newData.reposCount, '#0FF00000');
		if(oldData.gistsCount !== newData.gistsCount) patchCount(this.dataDocumentID + 'WidgetProfileGistsCountText', newData.gistsCount, '#00FF0000');
		if(oldData.starCount !== newData.starCount) patchCount(this.dataDocumentID + 'WidgetProfileStarsCountText', newData.starCount, '#000FF000');

		// Rebuild the histogram mesh if contributions changed. Cheap for 371
		// instances; saves the complexity of a per-instance patch.
		const oldLen = (oldData.contributionDays || []).length;
		const newLen = (newData.contributionDays || []).length;
		if (oldLen !== newLen || oldData.totalContributions !== newData.totalContributions) {
			this._buildContributionHistogram(newData.contributionDays || []);
		}

		return true;
	}
}
