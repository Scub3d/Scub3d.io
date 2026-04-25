class MapboxWidget extends BaseWidget {
	dataDocumentID = 'mapbox';
	updateIntervalMS = 60000; // 1 min — cap to keep fresh within typical session length
	data;

	logoImageURL = this.staticAssetBaseURL + 'ar/img/mapbox/logo.svg';

	locationMapImageBucketPath = 'ar/images/mapbox/location_map.png';
	terrainRGBImageBucketPath = 'ar/images/mapbox/terrain_rgb.png';
	satelliteTerrainImageBucketPath = 'ar/images/mapbox/satellite.png';

	satelliteTerrainMarkerModelBucketPath = this.staticAssetBaseURL + 'ar/models/mapbox/satelliteMarker.glb';

	constructor(db, storage) {
		super(db, storage);
		this.data = new MapboxData();
	}

	async generateAFrameHTML() {
		const locationMapImageURL = await this.getCachedDownloadURL(this.locationMapImageBucketPath, this.data.featureID);
		const terrainRGBImageURL = await this.getCachedDownloadURL(this.terrainRGBImageBucketPath, this.data.featureID);
		const satelliteTerrainImageURL = await this.getCachedDownloadURL(this.satelliteTerrainImageBucketPath, this.data.featureID);

		$('<a-entity/>', {
			id: this.dataDocumentID + 'Widget',
			rotation: '-90 0 0',
			scale: '2 0.5 2',
		}).appendTo('#businessCardMarker');

		$('#' + this.dataDocumentID + 'Widget').attr('position', (this.xPositionModifier * -1) + ' 0 ' + (this.zPositionModifier * 3));

		$('<a-entity/>', {
			id: this.dataDocumentID + 'WidgetStaticMapHolder',
			rotation: '0 0 0',
			scale: '1 1 1'
		}).appendTo('#' + this.dataDocumentID + 'Widget');

		$('<a-image/>', {
			id: this.dataDocumentID + 'WidgetStaticMapImage',
			rotation: '0 0 0',
			scale: '1 1 1',
			src: locationMapImageURL
		}).appendTo('#' + this.dataDocumentID + 'WidgetStaticMapHolder');

		$('#' + this.dataDocumentID + 'WidgetStaticMapImage').attr('position', '0 0 0');
		$('#' + this.dataDocumentID + 'WidgetStaticMapImage').attr('material', 'shader: image-with-location; multiplier: ' + 1.0 + '; aspectRatio: ' + (128.0 / 512.0));

		$('<a-entity/>', {
			id: this.dataDocumentID + 'WidgetTerrainMapHolder',
			rotation: '0 0 0',
			scale: '1 1 1',
		}).appendTo('#' + this.dataDocumentID + 'Widget');

		$('#' + this.dataDocumentID + 'WidgetTerrainMapHolder').attr('position', '0 0 0');

		$('<a-entity/>', {
			id: this.dataDocumentID + 'WidgetTerrain',
			rotation: '0 0 0',
			scale: '0.25 1 0.25',
		}).appendTo('#' + this.dataDocumentID + 'WidgetTerrainMapHolder');

		$('#' + this.dataDocumentID + 'WidgetTerrain').attr('position', '0 0 0');

		// Mapbox widget renders 2 z9 tiles' worth of geography (~156.5km at the
		// equator); cos(lat) corrects for real latitude. See terrain.js for the
		// shared decoder.
		const metersPerPlaneWidth = 156544 / Math.cos(this.data.roughLatitude * Math.PI / 180);

		var texture = await buildTerrainTexture(satelliteTerrainImageURL);
		// Mapbox sweeps ~230km of geography on a widget that's ~0.25 mesh
		// units tall, so relief reads as a gentle ripple rather than real
		// mountains at this scale. exag=5 gives visible topography without
		// caricature (alltrails' ~20km bbox with exag=1 is the reference).
		var { geometry, segmentsX, segmentsY, minHeightMeshUnits } = await buildElevationPlaneGeometry(terrainRGBImageURL, {
			metersPerPlaneWidth: metersPerPlaneWidth,
			heightExaggeration: 5.0,
		});
		var material = this.buildTerrainMaterial(texture);
		var mesh = new THREE.Mesh(geometry, material);
		mesh.receiveShadow = true;
		mesh.castShadow = true;
		mesh.scale.multiplyScalar(4);

		$('#' + this.dataDocumentID + 'WidgetTerrain')[0].object3D.add(mesh);

		// Same prism treatment as alltrails — four vertical walls + flat
		// bottom drop from the terrain edge down to baseZ so the map reads
		// as a solid block rather than a floating sheet. Shallower than
		// alltrails because mapbox's terrain is naturally flatter and we
		// don't want the sides to overwhelm the relief.
		const skirtBaseZ = minHeightMeshUnits - 0.02;

		// Lift the terrain+skirt group so the prism's base plane sits at the
		// widget's local z=0. See the alltrails widget for the scale-math
		// reasoning — net Z multiplier from geometry to this entity's parent
		// is 1, so position offset = -skirtBaseZ lands the base exactly at 0.
		$('#' + this.dataDocumentID + 'WidgetTerrain').attr('position', '0 0 ' + (-skirtBaseZ));

		const skirtGeometry = buildTerrainSkirtGeometry(geometry, segmentsX, segmentsY, skirtBaseZ);
		const skirtMaterial = new THREE.MeshBasicMaterial({
			color: 0x3a4a3e,
			// Same winding-gotcha as alltrails — see widget/alltrails.js skirt
			// setup for the explanation.
			side: THREE.BackSide,
			transparent: false,
			depthTest: true,
			depthWrite: true,
			polygonOffset: true,
			polygonOffsetFactor: 1,
			polygonOffsetUnits: 1,
		});
		const skirtMesh = new THREE.Mesh(skirtGeometry, skirtMaterial);
		skirtMesh.scale.multiplyScalar(4);
		$('#' + this.dataDocumentID + 'WidgetTerrain')[0].object3D.add(skirtMesh);

		this.cleanupFunctions.push(() => {
			if (mesh.parent) mesh.parent.remove(mesh);
			geometry.dispose();
			if (skirtMesh.parent) skirtMesh.parent.remove(skirtMesh);
			skirtGeometry.dispose();
			skirtMaterial.dispose();
		});

		$('<a-image/>', {
			id: this.dataDocumentID + 'WidgetLogo',
			rotation: '0 0 0',
			scale: '0.09375 0.375 1',
			src: this.logoImageURL,
			material: 'alphaTest: 0.5'
		}).appendTo('#' + this.dataDocumentID + 'WidgetStaticMapHolder');

		$('#' + this.dataDocumentID + 'WidgetLogo').attr('position', '0.40625 0 0.002');

		generateAFrameAlternatingEntities([this.dataDocumentID + 'WidgetTerrainMapHolder', this.dataDocumentID + 'WidgetStaticMapHolder'], this.dataDocumentID + 'Widget');
	}

	buildTerrainMaterial(texture) {
		const material = new THREE.ShaderMaterial({
			// Explicit depth + non-transparency so the terrain writes to the
			// depth buffer and the prism's far walls are correctly occluded.
			// Same reasoning as the alltrails widget's terrain shader.
			side: THREE.FrontSide,
			transparent: false,
			depthTest: true,
			depthWrite: true,
			uniforms: {
				src: { type: 'map', is: 'uniform', value: texture },
				opacity: { type: 'number', is: 'uniform', value: 1.0 }
			},

			vertexShader:
				`varying vec2 vUV;
			void main(void) {
			  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
			  vUV = uv;
			}`,

			fragmentShader:
				`
			uniform sampler2D src;
			uniform float opacity;
			varying vec2 vUV;

			void main() {
				gl_FragColor = vec4(texture2D(src, vUV).xyz, opacity);
			}
			`
		});

		this.cleanupFunctions.push(() => {
			material.dispose();
			if (material.uniforms.src && material.uniforms.src.value) {
				material.uniforms.src.value.dispose();
			}
		});

		return material;
	}
}
