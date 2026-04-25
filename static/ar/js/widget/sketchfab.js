class SketchfabWidget extends BaseWidget {
	dataDocumentID = 'sketchfab';
	updateIntervalMS = 60000; // 1 min — cap to keep fresh within typical session length
	data;

	logoImageURL = this.staticAssetBaseURL + 'ar/img/sketchfab/logo.svg';
	trianglesImageURL = this.staticAssetBaseURL + 'ar/img/sketchfab/triangles.svg';
	verticesImageURL = this.staticAssetBaseURL + 'ar/img/sketchfab/vertices.svg';
	downloadsImageURL = this.staticAssetBaseURL + 'ar/img/sketchfab/downloads.svg';
	viewsImageURL = this.staticAssetBaseURL + 'ar/img/sketchfab/views.svg';
	likesImageURL = this.staticAssetBaseURL + 'ar/img/sketchfab/likes.svg';

	profileImageBucketPath = 'ar/images/sketchfab/profileImage.png';
	modelPreviewImageBucketPath = 'ar/images/sketchfab/modelPreviewImage.jpeg';

	modelBucketPath = 'ar/models/sketchfab/model.zip';

	constructor(db, storage) {
		super(db, storage);
		this.data = new SketchfabData();
	}

	async generateSketchfab3DModelDataURL(modelDownloadURL) {
		const response = await makeRequest('GET', modelDownloadURL);
		const reader = await new zip.ZipReader(new zip.BlobReader(response));
		const entries = await reader.getEntries({ filenameEncoding: 'utf-8' });

		var fileURLs = {};
		var sceneJSON;

		for (var entryIndex = 0; entryIndex < entries.length; entryIndex++) {
			fileURLs[entries[entryIndex]['filename']] = await this.convertEntryDataToURL(entries[entryIndex]);
			if (entries[entryIndex]['filename'] === 'scene.gltf') sceneJSON = await entries[entryIndex].getData(new zip.BlobWriter('text/plain'));
		}

		var temp = await sceneJSON.text();
		sceneJSON = JSON.parse(temp);

		if (sceneJSON.hasOwnProperty('buffers')) {
			for (var bufferIndex = 0; bufferIndex < sceneJSON.buffers.length; bufferIndex++) {
				sceneJSON.buffers[bufferIndex].uri = fileURLs[sceneJSON.buffers[bufferIndex].uri];
			}
		}

		if (sceneJSON.hasOwnProperty('images')) {
			for (var imageIndex = 0; imageIndex < sceneJSON.images.length; imageIndex++) {
				sceneJSON.images[imageIndex].uri = fileURLs[sceneJSON.images[imageIndex].uri];
			}
		}

		var sceneFileContent = JSON.stringify(sceneJSON, null, 2);
		var modelBlob = new Blob([sceneFileContent], { type: 'text/plain' });
		await reader.close();

		return window.URL.createObjectURL(modelBlob);
	}

	async convertEntryDataToURL(entry) {
		const entryData = await entry.getData(new zip.BlobWriter('text/plain'));
		return window.URL.createObjectURL(entryData);
	}

	async generateAFrameHTML() {
		const profileImageURL = await this.getCachedDownloadURL(this.profileImageBucketPath);
		const modelPreviewImageURL = await this.getCachedDownloadURL(this.modelPreviewImageBucketPath, this.data.modelID);

		$('<a-entity/>', {
			id: this.dataDocumentID + 'Widget',
			rotation: '-90 0 0',
			scale: '2 0.5 2',
		}).appendTo('#businessCardMarker');

		$('#' + this.dataDocumentID + 'Widget').attr('position', (this.xPositionModifier * 1) + ' 0 ' + (this.zPositionModifier * -2));

		$('<a-entity/>', {
			id: this.dataDocumentID + 'WidgetBody',
			rotation: '0 0 0',
			scale: '0.75 1 1',
		}).appendTo('#' + this.dataDocumentID + 'Widget');

		$('#' + this.dataDocumentID + 'WidgetBody').attr('position', '0.125 0 0');

		$('<a-image/>', {
			id: this.dataDocumentID + 'WidgetModelPreviewImage',
			rotation: '0 0 0',
			scale: '0.25 1 1',
			src: modelPreviewImageURL,
		}).appendTo('#' + this.dataDocumentID + 'Widget');

		$('#' + this.dataDocumentID + 'WidgetModelPreviewImage').attr('position', '-0.375 0 0');
		$('#' + this.dataDocumentID + 'WidgetModelPreviewImage').attr('material', 'shader: left-sided-rounded-corners; multiplier: ' + 1.0 + '; aspectRatio: ' + (128.0 / 128.0));

		$('<a-plane/>', {
			id: this.dataDocumentID + 'WidgetModelPreviewColliderPlane',
			rotation: '0 0 0',
			scale: '1 1 1',
			class: 'clickable',
			material: "opacity: 0; depthWrite: false"
		}).appendTo('#' + this.dataDocumentID + 'WidgetModelPreviewImage');

		$('#' + this.dataDocumentID + 'WidgetModelPreviewColliderPlane').attr('position', '0 0 0.01');
		$('#' + this.dataDocumentID + 'WidgetModelPreviewColliderPlane').attr('check-events', 'url: ' + this.data.modelURL);

		$('<a-entity/>', {
			id: this.dataDocumentID + 'WidgetModelPreviewHolder',
			rotation: '90 0 0',
			scale: '.25 .0625 .25',
		}).appendTo('#' + this.dataDocumentID + 'WidgetModelPreviewImage');

		$('#' + this.dataDocumentID + 'WidgetModelPreviewHolder').attr('position', '0 0 .15');

		$('<a-entity/>', {
			id: this.dataDocumentID + 'WidgetModelPreview',
			rotation: '0 0 0',
			scale: '1 1 1',
			animation: "property: rotation; from: 0 0 0; to: 0 360 0; loop: true; dur: 20000; easing: linear;"
		}).appendTo('#' + this.dataDocumentID + 'WidgetModelPreviewHolder');

		$('<a-image/>', {
			id: this.dataDocumentID + 'WidgetBackground',
			rotation: '0 0 0',
			scale: '1 1 1',
		}).appendTo('#' + this.dataDocumentID + 'WidgetBody');

		$('#' + this.dataDocumentID + 'WidgetBackground').attr('material', 'shader: right-sided-color-rounded-corners; color: 0.9098 0.90196 0.89019; multiplier: ' + 1.0 + '; aspectRatio: ' + (128.0 / 384.0));

		$('<a-entity/>', {
			id: this.dataDocumentID + 'WidgetProfileInfo',
			rotation: '0 0 0',
			scale: '1 1 1',
		}).appendTo('#' + this.dataDocumentID + 'WidgetBackground');

		$('<a-plane/>', {
			id: this.dataDocumentID + 'WidgetProfileInfoColliderPlane',
			rotation: '0 0 0',
			scale: '1 1 1',
			// class: 'clickable',
			material: "opacity: 0; depthWrite: false;"
		}).appendTo('#' + this.dataDocumentID + 'WidgetProfileInfo');

		$('#' + this.dataDocumentID + 'WidgetProfileInfoColliderPlane').attr('position', '0 0 0.01');
		$('#' + this.dataDocumentID + 'WidgetProfileInfoColliderPlane').attr('check-events', 'url: https://sketchfab.com/' + this.data.username);

		$('<a-entity/>', {
			id: this.dataDocumentID + 'WidgetModelInfo',
			rotation: '0 0 0',
			scale: '1 1 1',
		}).appendTo('#' + this.dataDocumentID + 'WidgetBackground');

		$('<a-plane/>', {
			id: this.dataDocumentID + 'WidgetModelInfoColliderPlane',
			rotation: '0 0 0',
			scale: '1 1 1',
			// class: 'clickable',
			material: "opacity: 0; depthWrite: false;"
		}).appendTo('#' + this.dataDocumentID + 'WidgetModelInfo');

		$('#' + this.dataDocumentID + 'WidgetModelInfoColliderPlane').attr('position', '0 0 0.01');
		$('#' + this.dataDocumentID + 'WidgetModelInfoColliderPlane').attr('check-events', 'url: ' + this.data.modelURL);

		// Profile Info
		generateAFrameTextEntity(this.dataDocumentID + 'WidgetProfileNameText', '#' + this.dataDocumentID + 'WidgetProfileInfo', this.data['username'], 26, '#1caad9', 8, 'Montserrat', 300, 31.6, true, '#FF000000', 8, 19.8, 288, 386, 128, 1, false);
		generateAFrameTextEntity(this.dataDocumentID + 'WidgetProfileModelCountText', '#' + this.dataDocumentID + 'WidgetProfileInfo', this.data['modelsCount'] + ' models', 13, '#888888', 10, 'Montserrat', 300, 16.0333, true, '#00FF0000', 8, -13.01665, 96, 386, 128, 1, false);
		generateAFrameTextEntity(this.dataDocumentID + 'WidgetProfileFollowerCountText', '#' + this.dataDocumentID + 'WidgetProfileInfo', this.data['followerCount'] + ' followers', 13, '#888888', 10, 'Montserrat', 300, 16.0333, true, '#0000FF00', 8 + 96, -13.01665, 96, 386, 128, 1, false);
		generateAFrameTextEntity(this.dataDocumentID + 'WidgetProfileFollowingCountText', '#' + this.dataDocumentID + 'WidgetProfileInfo', this.data['followingCount'] + ' following', 13, '#888888', 10, 'Montserrat', 300, 16.0333, true, '#0FF00000', 8 + 96 + 96, -13.01665, 96, 386, 128, 1, false);

		// Model Info
		generateAFrameTextEntity(this.dataDocumentID + 'WidgetModelNameText', '#' + this.dataDocumentID + 'WidgetModelInfo', this.data['modelName'], 22, '#1caad9', 16, 'Montserrat', 300, 24, true, '#F00F0000', 8, 16.9, 288, 386, 128, 1, false);

		$('<a-image/>', {
			id: this.dataDocumentID + 'WidgetModelFaceImage',
			rotation: '0 0 0',
			scale: '0.03645833 0.109375 1',
			src: this.trianglesImageURL,
			material: 'alphaTest: 0.5'
		}).appendTo('#' + this.dataDocumentID + 'WidgetModelInfo');

		$('#' + this.dataDocumentID + 'WidgetModelFaceImage').attr('position', (-1 * (0.481770833333 - (19 / 384))) + ' -0.1640625 0.001');

		generateAFrameTextEntity(this.dataDocumentID + 'WidgetProfileModelFaceCountText', '#' + this.dataDocumentID + 'WidgetModelInfo', this.data['modelFaceCount'].toString(), 14, '#888888', 10, 'Montserrat', 300, 16.9, false, '#FF000000', 8 + 11 + 14 + 8, -16.45, 28, 386, 128, 1, false);

		$('<a-image/>', {
			id: this.dataDocumentID + 'WidgetModelVertexImage',
			rotation: '0 0 0',
			scale: '0.03645833 0.109375 1',
			src: this.verticesImageURL,
			material: 'alphaTest: 0.5'
		}).appendTo('#' + this.dataDocumentID + 'WidgetModelInfo');

		$('#' + this.dataDocumentID + 'WidgetModelVertexImage').attr('position', (-1 * (0.481770833333 - (75 / 384))) + ' -0.1640625 0.001');

		generateAFrameTextEntity(this.dataDocumentID + 'WidgetProfileModelVertexCountText', '#' + this.dataDocumentID + 'WidgetModelInfo', this.data['modelVertexCount'].toString(), 14, '#888888', 10, 'Montserrat', 300, 16.9, false, '#0FF00000', 8 + 11 + 14 + 4 + 26 + 12 + 14 + 8, -16.45, 28, 386, 128, 1, false);

		$('<a-image/>', {
			id: this.dataDocumentID + 'WidgetModelDownloadImage',
			rotation: '0 0 0',
			scale: '0.03645833 0.109375 1',
			src: this.downloadsImageURL,
			material: 'alphaTest: 0.5'
		}).appendTo('#' + this.dataDocumentID + 'WidgetModelInfo');

		$('#' + this.dataDocumentID + 'WidgetModelDownloadImage').attr('position', (-1 * (0.481770833333 - (131 / 384))) + ' -0.1640625 0.001');

		generateAFrameTextEntity(this.dataDocumentID + 'WidgetProfileModelDownloadCountText', '#' + this.dataDocumentID + 'WidgetModelInfo', this.data['modelDownloadCount'].toString(), 14, '#888888', 10, 'Montserrat', 300, 16.9, false, '#00FF0000', 8 + 11 + 14 + 4 + 26 + 12 + 14 + 4 + 26 + 12 + 14 + 8, -16.45, 28, 386, 128, 1, false);

		$('<a-image/>', {
			id: this.dataDocumentID + 'WidgetModelViewsImage',
			rotation: '0 0 0',
			scale: '0.03645833 0.109375 1',
			src: this.viewsImageURL,
			material: 'alphaTest: 0.5'
		}).appendTo('#' + this.dataDocumentID + 'WidgetModelInfo');

		$('#' + this.dataDocumentID + 'WidgetModelViewsImage').attr('position', (-1 * (0.481770833333 - (187 / 384))) + ' -0.1640625 0.001');

		generateAFrameTextEntity(this.dataDocumentID + 'WidgetProfileModelViewCountText', '#' + this.dataDocumentID + 'WidgetModelInfo', this.data['modelViewCount'].toString(), 14, '#888888', 10, 'Montserrat', 300, 16.9, false, '#000FF000', 8 + 11 + 14 + 4 + 26 + 12 + 14 + 4 + 26 + 12 + 14 + 4 + 26 + 12 + 14 + 8, -16.45, 28, 386, 128, 1, false);

		$('<a-image/>', {
			id: this.dataDocumentID + 'WidgetModelLikesImage',
			rotation: '0 0 0',
			scale: '0.03645833 0.109375 1',
			src: this.likesImageURL,
			material: 'alphaTest: 0.5'
		}).appendTo('#' + this.dataDocumentID + 'WidgetModelInfo');

		$('#' + this.dataDocumentID + 'WidgetModelLikesImage').attr('position', (-1 * (0.481770833333 - (243 / 384))) + ' -0.1640625 0.001');

		generateAFrameTextEntity(this.dataDocumentID + 'WidgetProfileModelLikeCountText', '#' + this.dataDocumentID + 'WidgetModelInfo', this.data['modelLikeCount'].toString(), 14, '#888888', 10, 'Montserrat', 300, 16.9, false, '#0000FF00', 8 + 11 + 14 + 4 + 26 + 12 + 14 + 4 + 26 + 12 + 14 + 4 + 26 + 12 + 14 + 4 + 26 + 12 + 14 + 8, -16.45, 28, 386, 128, 1, false);

		generateAFrameAlternatingEntities([this.dataDocumentID + 'WidgetModelInfo', this.dataDocumentID + 'WidgetProfileInfo'], this.dataDocumentID + 'WidgetBackground');

		generateAFrameAlternatingLogo(this.dataDocumentID + 'WidgetLogo', '#' + this.dataDocumentID + 'WidgetBackground', '0.375 0 0.0001', '0 0 0', '0.125 0.375 1', this.logoImageURL, profileImageURL);

		// Load the GLB model asynchronously. Widget is already visible via the
		// preview image; the rotating 3D model swaps in whenever the zip unpack
		// finishes. Don't await — the main loader shouldn't block on it.
		this.getCachedDownloadURL(this.modelBucketPath, this.data.modelID).then(modelDownloadURL => {
			return this.generateSketchfab3DModelDataURL(modelDownloadURL);
		}).then(generatedModelURL => {
			$('#' + this.dataDocumentID + 'WidgetModelPreview').attr('gltf-model', 'url(' + generatedModelURL + ')');
		}).catch(err => {
			console.warn('sketchfab GLB load failed:', err);
		});
	}

	async applyUpdate(oldData, newData) {
		// Different model = new GLB + new preview image = full rebuild.
		if (oldData.modelID !== newData.modelID) return false;
		// Username change rewires the profile collider URL; easier to rebuild than patch two places.
		if (oldData.username !== newData.username) return false;

		const bodyID = '#' + this.dataDocumentID + 'WidgetProfileInfo';
		const modelBodyID = '#' + this.dataDocumentID + 'WidgetModelInfo';

		if (oldData.modelURL !== newData.modelURL) {
			const collider = document.getElementById(this.dataDocumentID + 'WidgetModelInfoColliderPlane');
			if (collider) collider.setAttribute('check-events', 'url: ' + newData.modelURL);
			const previewCollider = document.getElementById(this.dataDocumentID + 'WidgetModelPreviewColliderPlane');
			if (previewCollider) previewCollider.setAttribute('check-events', 'url: ' + newData.modelURL);
		}

		if (oldData.modelName !== newData.modelName) {
			$('#' + this.dataDocumentID + 'WidgetModelNameText').remove();
			generateAFrameTextEntity(this.dataDocumentID + 'WidgetModelNameText', modelBodyID, newData.modelName, 22, '#1caad9', 16, 'Montserrat', 300, 24, true, '#F00F0000', 8, 16.9, 288, 386, 128, 1, false);
		}

		if (oldData.modelsCount !== newData.modelsCount) {
			updateAFrameEntityText(this.dataDocumentID + 'WidgetProfileModelCountText', newData.modelsCount + ' models', 13, '#888888', 10, 'Montserrat', 300, 16.0333, true, 96, '#00FF0000', false);
		}
		if (oldData.followerCount !== newData.followerCount) {
			updateAFrameEntityText(this.dataDocumentID + 'WidgetProfileFollowerCountText', newData.followerCount + ' followers', 13, '#888888', 10, 'Montserrat', 300, 16.0333, true, 96, '#0000FF00', false);
		}
		if (oldData.followingCount !== newData.followingCount) {
			updateAFrameEntityText(this.dataDocumentID + 'WidgetProfileFollowingCountText', newData.followingCount + ' following', 13, '#888888', 10, 'Montserrat', 300, 16.0333, true, 96, '#0FF00000', false);
		}
		if (oldData.modelFaceCount !== newData.modelFaceCount) {
			updateAFrameEntityText(this.dataDocumentID + 'WidgetProfileModelFaceCountText', newData.modelFaceCount.toString(), 14, '#888888', 10, 'Montserrat', 300, 16.9, false, 28, '#FF000000', false);
		}
		if (oldData.modelVertexCount !== newData.modelVertexCount) {
			updateAFrameEntityText(this.dataDocumentID + 'WidgetProfileModelVertexCountText', newData.modelVertexCount.toString(), 14, '#888888', 10, 'Montserrat', 300, 16.9, false, 28, '#0FF00000', false);
		}
		if (oldData.modelDownloadCount !== newData.modelDownloadCount) {
			updateAFrameEntityText(this.dataDocumentID + 'WidgetProfileModelDownloadCountText', newData.modelDownloadCount.toString(), 14, '#888888', 10, 'Montserrat', 300, 16.9, false, 28, '#00FF0000', false);
		}
		if (oldData.modelViewCount !== newData.modelViewCount) {
			updateAFrameEntityText(this.dataDocumentID + 'WidgetProfileModelViewCountText', newData.modelViewCount.toString(), 14, '#888888', 10, 'Montserrat', 300, 16.9, false, 28, '#000FF000', false);
		}
		if (oldData.modelLikeCount !== newData.modelLikeCount) {
			updateAFrameEntityText(this.dataDocumentID + 'WidgetProfileModelLikeCountText', newData.modelLikeCount.toString(), 14, '#888888', 10, 'Montserrat', 300, 16.9, false, 28, '#0000FF00', false);
		}

		return true;
	}
}