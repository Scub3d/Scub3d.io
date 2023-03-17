class MapboxWidget extends BaseWidget {
	dataDocumentID = 'mapbox';
	data;

	logoImageURL = this.staticAssetBaseURL + 'ar/img/mapbox/logo.svg';
	
	locationMapImageBucketPath = 'ar/images/mapbox/location_map.png';
	terrainRGBImageBucketPath = 'ar/images/mapbox/terrain_rgb.png';
	satelliteTerrainImageBucketPath ='ar/images/mapbox/satellite.png';

	satelliteTerrainMarkerModelBucketPath = this.staticAssetBaseURL + 'ar/models/mapbox/satelliteMarker.glb';

	constructor(db, storage) {
		super(db, storage);
		this.data = new MapboxData();
	}

	async generateAFrameHTML() {
		const locationMapImageURL = await this.storage.ref(this.locationMapImageBucketPath).getDownloadURL();
		const terrainRGBImageURL = await this.storage.ref(this.terrainRGBImageBucketPath).getDownloadURL();
		const satelliteTerrainImageURL = await this.storage.ref(this.satelliteTerrainImageBucketPath).getDownloadURL();

		$('<a-entity/>', {
			id: this.dataDocumentID + 'Widget',
			rotation: '-90 0 0',
			scale: '2 0.5 2',
		}).appendTo('#businessCardMarker');

		$('#' + this.dataDocumentID + 'Widget').attr('position', (this.xPositionModifier * 1) + ' 0 ' + (this.zPositionModifier * -2));

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
		$('#' + this.dataDocumentID + 'WidgetStaticMapImage').attr('material', 'shader: image-rounded-corners; multiplier: ' + 1.0 + '; aspectRatio: ' + (128.0 / 512.0));

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

		var texture = await this.buildTerrainTexture(satelliteTerrainImageURL);
		var [geometry, satelliteTerrainMarkerHeightOffset] = await this.buildElevationPlaneGeometry(terrainRGBImageURL);
		var material = this.buildTerrainMaterial(texture);
		var mesh = new THREE.Mesh(geometry, material);
		mesh.receiveShadow = true;
		mesh.castShadow = true;
		mesh.scale.multiplyScalar(4);

		$('#' + this.dataDocumentID + 'WidgetTerrain')[0].object3D.add(mesh);

		$('<a-entity/>', {
			id: this.dataDocumentID + 'WidgetSatelliteMarker',
			rotation: '90 0 0',
			scale: '0.025 0.025 0.1',
		}).appendTo('#' + this.dataDocumentID + 'WidgetTerrainMapHolder');

		$('#' + this.dataDocumentID + 'WidgetSatelliteMarker').attr('position', '0 0 ' + satelliteTerrainMarkerHeightOffset);
		$('#' + this.dataDocumentID + 'WidgetSatelliteMarker').attr('gltf-model', "url(" + this.satelliteTerrainMarkerModelBucketPath + ")");
		
		$('<a-entity/>', {
			id: this.dataDocumentID + 'WidgetSatelliteMarkerText',
			rotation: '90 0 0',
			scale: '1 1 1'
		}).appendTo('#' + this.dataDocumentID + 'WidgetTerrainMapHolder');
		
		$('#' + this.dataDocumentID + 'WidgetSatelliteMarkerText').attr('position', '0 0 0.2');
		$('#' + this.dataDocumentID + 'WidgetSatelliteMarkerText').attr('text', 'anchor: center; align: center; color: #d7d4cf; value: I\'m near\n' + this.data.placeNameShort);

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

	async buildTerrainTexture(satelliteTerrainImageURL) {
		var texture = new THREE.Texture()

		// Maybe can skip?
		const satelliteBlob = await makeRequest('GET', satelliteTerrainImageURL);
		const satelliteDataURL = await blobToDataURL(satelliteBlob);

		let img = new Image;

	    img.crossOrigin = "Anonymous";
	    img.onload = function () {
	 		texture.image = this
			texture.needsUpdate = true
	    }

		img.src = satelliteDataURL

		return texture
	}

	async buildElevationPlaneGeometry(terrainRGBImageURL) {
		var geometry = new THREE.PlaneBufferGeometry( 1, 0.25, 512-1, 128-1 );

		const terrainBlob = await makeRequest('GET', terrainRGBImageURL);
		const terrainDataURL = await blobToDataURL(terrainBlob);

		let img = new Image;

	    img.crossOrigin = "Anonymous";
		img.src = terrainDataURL;

		await img.decode();

 		var canvas = document.createElement('canvas')
		canvas.width = 512
		canvas.height = 128
		var context = canvas.getContext('2d')
		context.drawImage(img, 0, 0)
		var imageData = context.getImageData(0, 0, canvas.width, canvas.height)
		var elevationArray = imageData.data
		
		var positions = geometry.attributes.position.array

		var satelliteTerrainMarkerHeightOffset = 0;

		for(var y = 0; y < canvas.height; y++){
			for(var x = 0; x < canvas.width; x++){
				var offset2 = (y * canvas.width + x) * 4;
				var height = -10000 + (elevationArray[offset2 + 0] * 256 * 256 + elevationArray[offset2 + 1] * 256 + elevationArray[offset2 + 2]) * 0.1;

				height /= 10000;
				height /= 3;

				var offsetPosition = (y * canvas.width + x) * 3
				positions[offsetPosition + 2] = height;

				if(y === canvas.height / 2 && x === canvas.width / 2) {
					satelliteTerrainMarkerHeightOffset = height; // not setting value :(
				}
			}
		}

		geometry.attributes.position.needsUpdate = true;
		geometry.computeVertexNormals();

		return [geometry, satelliteTerrainMarkerHeightOffset]
	}

	buildTerrainMaterial(texture) {
		return new THREE.ShaderMaterial({
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
				float cornerRadius = 1.0 / 4.0;
				float aspectRatio = 128.0 / 512.0;
				
				if(vUV.x / aspectRatio <= cornerRadius && vUV.y <= cornerRadius) {
					if(sqrt(pow(cornerRadius - vUV.x / aspectRatio, 2.0) + pow(cornerRadius - vUV.y, 2.0)) <= cornerRadius) {
						gl_FragColor = vec4(texture2D(src, vec2(vUV.x, vUV.y)).xyz, opacity);
					} else {
						gl_FragColor = vec4(0, 0, 0, 0);
					}
				} else if(vUV.x / aspectRatio <= cornerRadius && vUV.y >= 1.0 - cornerRadius) {
					if(sqrt(pow(cornerRadius - vUV.x / aspectRatio, 2.0) + pow(1.0 - cornerRadius - vUV.y, 2.0)) <= cornerRadius) {
						gl_FragColor = vec4(texture2D(src, vec2(vUV.x, vUV.y)).xyz, opacity);
					} else {
						gl_FragColor = vec4(0, 0, 0, 0);
					}
				} else if(vUV.x >= 1.0 - cornerRadius * aspectRatio && vUV.y <= cornerRadius) {
					if(sqrt(pow(1.0 / aspectRatio - cornerRadius - vUV.x / aspectRatio, 2.0) + pow(cornerRadius - vUV.y, 2.0)) <= cornerRadius) {
						gl_FragColor = vec4(texture2D(src, vec2(vUV.x, vUV.y)).xyz, opacity);
					} else {
						gl_FragColor = vec4(0, 0, 0, 0);
					}
				} else if(vUV.x >= 1.0 - cornerRadius * aspectRatio && vUV.y >= 1.0 - cornerRadius) {
					if(sqrt(pow(1.0 / aspectRatio - cornerRadius - vUV.x / aspectRatio, 2.0) + pow(1.0 - cornerRadius - vUV.y, 2.0)) <= cornerRadius) {
						gl_FragColor = vec4(texture2D(src, vec2(vUV.x, vUV.y)).xyz, opacity);
					} else {
						gl_FragColor = vec4(0, 0, 0, 0);
					}
				} else  {
					gl_FragColor = vec4(texture2D(src, vec2(vUV.x, vUV.y)).xyz, opacity);
				}
			}
			`
		})
	}
}
