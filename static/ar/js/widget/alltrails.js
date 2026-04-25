class AllTrailsWidget extends BaseWidget {
	dataDocumentID = 'alltrails';
	updateIntervalMS = 3600000; // 1hr — trail doesn't change often
	data;

	satelliteBucketPath = 'ar/images/alltrails/satellite.png';
	terrainRGBBucketPath = 'ar/images/alltrails/terrain_rgb.png';
	polylineBucketPath = 'ar/data/alltrails/polyline.txt';
	profileImageBucketPath = 'ar/images/alltrails/profileImage.jpg';
	trailImageBucketPath = 'ar/images/alltrails/trailImage.jpg';

	logoImageURL = this.staticAssetBaseURL + 'ar/img/alltrails/logo.svg';

	// Canvas resolution for the polyline mask. 4× the satellite texture
	// (512×128) so sharp strokes don't get blurred when the fragment shader
	// samples them at oblique angles — mipmaps are disabled on the texture
	// (see generateTrailFace) so we rely on raw canvas density for crispness.
	polylineCanvasWidth = 2048;
	polylineCanvasHeight = 512;

	// AllTrails trail-path green — matches the stroke color they use on their
	// own map canvas. Outer halo is a darker green for legibility against
	// bright snowfields or light forest.
	polylineColorInner = 'rgba(78, 194, 94, 0.98)';
	polylineColorOuter = 'rgba(16, 48, 24, 0.85)';

	// Mesh-unit thickness of the flat base below the lowest terrain point.
	// Intentionally thin + constant: just enough to give the prism a visible
	// bottom edge without competing with the terrain's own relief for
	// visual weight.
	skirtDepth = 0.01;

	constructor(db, storage) {
		super(db, storage);
		this.data = new AllTrailsData();
	}

	async generateAFrameHTML() {
		// All trail-face assets are versioned by mapID so widget cache busts
		// correctly whenever the latest activity changes.
		const satelliteURL = await this.getCachedDownloadURL(this.satelliteBucketPath, this.data.mapID);
		const terrainURL = await this.getCachedDownloadURL(this.terrainRGBBucketPath, this.data.mapID);
		const polylineURL = await this.getCachedDownloadURL(this.polylineBucketPath, this.data.mapID);
		const profileImageURL = await this.getCachedDownloadURL(this.profileImageBucketPath);

		$('<a-entity/>', {
			id: this.dataDocumentID + 'Widget',
			rotation: '-90 0 0',
			scale: '2 0.5 2',
		}).appendTo('#businessCardMarker');

		$('#' + this.dataDocumentID + 'Widget').attr('position', (this.xPositionModifier * -1) + ' 0 ' + (this.zPositionModifier * -2));

		// Body wrapper between Widget and the two faces — mirrors the
		// paradigm used by the other widgets (github/spotify/disneyplus/…),
		// so the alternating faces live under a named container rather than
		// being direct children of Widget.
		$('<a-entity/>', {
			id: this.dataDocumentID + 'WidgetBody',
			rotation: '0 0 0',
			scale: '1 1 1',
		}).appendTo('#' + this.dataDocumentID + 'Widget');

		$('#' + this.dataDocumentID + 'WidgetBody').attr('position', '0 0 0');

		await this.generateTrailFace(satelliteURL, terrainURL, polylineURL);
		this.generateProfileFace(profileImageURL);

		generateAFrameAlternatingEntities(
			[this.dataDocumentID + 'WidgetTrailFace', this.dataDocumentID + 'WidgetProfileFace'],
			this.dataDocumentID + 'WidgetBody'
		);
	}

	async generateTrailFace(satelliteURL, terrainURL, polylineURL) {
		$('<a-entity/>', {
			id: this.dataDocumentID + 'WidgetTrailFace',
			rotation: '0 0 0',
			scale: '1 1 1',
		}).appendTo('#' + this.dataDocumentID + 'WidgetBody');

		$('#' + this.dataDocumentID + 'WidgetTrailFace').attr('position', '0 0 0');

		// Three.js mesh holder — the displaced terrain gets attached to this
		// entity's object3D so A-Frame can manage its lifecycle alongside the
		// rest of the widget DOM.
		$('<a-entity/>', {
			id: this.dataDocumentID + 'WidgetTerrain',
			rotation: '0 0 0',
			scale: '0.25 1 0.25',
		}).appendTo('#' + this.dataDocumentID + 'WidgetTrailFace');

		$('#' + this.dataDocumentID + 'WidgetTerrain').attr('position', '0 0 0');

		const oriented = this.data.orientedBounds();

		// Bake the polyline onto a CanvasTexture so the terrain shader can
		// sample it as a second texture and composite it onto the satellite.
		// Line width scales with bbox diagonal so thru-hikes don't vanish.
		const polylineCanvas = await this.buildPolylineMaskCanvas(polylineURL, oriented);
		const polylineTexture = new THREE.CanvasTexture(polylineCanvas);
		// Disable mipmaps + pin to LinearFilter so sharp anti-aliased strokes
		// stay crisp. Default LinearMipMapLinearFilter blends across mip
		// levels, which smears a 6-8px line into a fuzzy ribbon. Anisotropy
		// keeps edges from breaking at oblique AR viewing angles.
		polylineTexture.generateMipmaps = false;
		polylineTexture.minFilter = THREE.LinearFilter;
		polylineTexture.magFilter = THREE.LinearFilter;
		const sceneEl = document.querySelector('a-scene');
		const maxAnisotropy = sceneEl && sceneEl.renderer ? sceneEl.renderer.capabilities.getMaxAnisotropy() : 1;
		if (maxAnisotropy > 1) polylineTexture.anisotropy = maxAnisotropy;
		polylineTexture.needsUpdate = true;

		const satelliteTexture = await buildTerrainTexture(satelliteURL);
		// Same crisp-sampling treatment for the satellite — at the bumped
		// output resolution we'd rather pixel-perfect sample than blend.
		satelliteTexture.generateMipmaps = false;
		satelliteTexture.minFilter = THREE.LinearFilter;
		satelliteTexture.magFilter = THREE.LinearFilter;
		if (maxAnisotropy > 1) satelliteTexture.anisotropy = maxAnisotropy;
		// Scale exaggeration with bbox width so apparent relief stays consistent
		// across trails. Without this, a 5km loop is ~40× "zoomed in" vs. the
		// mapbox widget (~200km across) and relief explodes. Floored at 0.3 so
		// short trails in flat terrain still show visible relief; capped at the
		// mapbox baseline of 2.0 so thru-hikes don't exceed it.
		const heightExaggeration = 1.0;
		const { geometry, segmentsX, segmentsY, minHeightMeshUnits, maxHeightMeshUnits } = await buildElevationPlaneGeometry(terrainURL, {
			metersPerPlaneWidth: oriented.longMeters,
			heightExaggeration,
			oriented,
		});
		const material = this.buildTerrainMaterial(satelliteTexture, polylineTexture);

		const mesh = new THREE.Mesh(geometry, material);
		mesh.receiveShadow = true;
		mesh.castShadow = true;
		mesh.scale.multiplyScalar(4);

		$('#' + this.dataDocumentID + 'WidgetTerrain')[0].object3D.add(mesh);

		// Thin constant base below the lowest terrain point; the prism's
		// bottom cap lands flush with the widget's local z=0 (card surface
		// after the widget's -90° X rotation).
		const skirtBaseZ = minHeightMeshUnits - this.skirtDepth;
		const terrainPositionZ = -skirtBaseZ;

		// Lift the whole terrain+skirt group so the visually-lowest face
		// of the prism lands at the widget's local z=0 (which, after the
		// -90° widget rotation, is world ground level). WidgetTerrain's
		// z-scale is 0.25 and the meshes scale by 4, so the net Z
		// multiplier from geometry to this entity's parent frame is 1.
		$('#' + this.dataDocumentID + 'WidgetTerrain').attr('position', '0 0 ' + terrainPositionZ);

		const skirtGeometry = buildTerrainSkirtGeometry(geometry, segmentsX, segmentsY, skirtBaseZ, { includeCap: true });
		const skirtMaterial = new THREE.MeshBasicMaterial({
			color: 0x3a4a3e,
			// Skirt geometry winds every face CW-from-outside (my bad), so
			// the "front" normals point INWARD. BackSide flips culling so we
			// see the outside of the prism.
			side: THREE.BackSide,
			transparent: false,
			depthTest: true,
			depthWrite: true,
			// Bias the skirt away from the camera slightly. The skirt's top
			// row shares vertex positions with the terrain's outer edge row,
			// so without an offset the two z-fight along the perimeter and
			// the darker skirt wins often enough that it visually covers the
			// terrain's rim.
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

		// Trail name — small, top-left of the face. Keep text minimal per
		// design directive: the 3D terrain is the hero. Strip anything after
		// " via " so "Foo Trail via Long Route Name" shortens to "Foo Trail".
		// Trailing `false` opts out of depth testing so the label reads over
		// tall terrain peaks on its OWN widget — the intentional HUD behavior.
		const shortTrailName = this.shortenTrailName(this.data.trailName);
		if (shortTrailName) {
			generateAFrameTextEntity(
				this.dataDocumentID + 'WidgetTrailNameText',
				'#' + this.dataDocumentID + 'WidgetTrailFace',
				shortTrailName,
				18, '#ffffff', 0, 'Montserrat', 500, 22, false, '#00000000',
				16, 42, 360, 512, 128, 1, true, false
			);
		}

		// Distance + elevation — a single compact line at the bottom-left. Hide
		// both if either is missing so we don't render half a stat. Same HUD
		// opt-out as the trail name so stats stay readable over peaks.
		const statsLine = this.formatStatsLine();
		if (statsLine) {
			generateAFrameTextEntity(
				this.dataDocumentID + 'WidgetTrailStatsText',
				'#' + this.dataDocumentID + 'WidgetTrailFace',
				statsLine,
				14, '#e8e8e8', 0, 'Montserrat', 300, 18, false, '#00000000',
				16, -44, 360, 512, 128, 1, true, false
			);
		}
	}

	generateProfileFace(profileImageURL) {
		$('<a-entity/>', {
			id: this.dataDocumentID + 'WidgetProfileFace',
			rotation: '0 0 0',
			scale: '1 1 1',
		}).appendTo('#' + this.dataDocumentID + 'WidgetBody');

		$('#' + this.dataDocumentID + 'WidgetProfileFace').attr('position', '0 0 0.001');

		// Solid rounded-corner backing (#e6eae6) covering the right 3/4 of
		// the face only — its left edge butts flush against the profile
		// photo's right edge (which uses left-sided-rounded-corners). Shader
		// rounds the right corners to match the widget's outer edge. Same
		// pattern as spotify's background. aspectRatio=128/384 because the
		// net world plane is 3:1.
		$('<a-plane/>', {
			id: this.dataDocumentID + 'WidgetProfileBackground',
			rotation: '0 0 0',
			scale: '0.75 1 1',
		}).appendTo('#' + this.dataDocumentID + 'WidgetProfileFace');

		$('#' + this.dataDocumentID + 'WidgetProfileBackground').attr('position', '0.125 0 0');
		$('#' + this.dataDocumentID + 'WidgetProfileBackground').attr('material', 'shader: right-sided-color-rounded-corners; color: ' + (230.0 / 255.0) + ' ' + (234.0 / 255.0) + ' ' + (230.0 / 255.0) + '; multiplier: 1.0; aspectRatio: ' + (128.0 / 384.0));

		// Profile photo occupies the left quarter. Only the left corners are
		// rounded so the right edge butts cleanly against the stats column.
		$('<a-image/>', {
			id: this.dataDocumentID + 'WidgetProfileImage',
			rotation: '0 0 0',
			scale: '0.25 1 1',
			src: profileImageURL,
		}).appendTo('#' + this.dataDocumentID + 'WidgetProfileFace');

		$('#' + this.dataDocumentID + 'WidgetProfileImage').attr('position', '-0.375 0 0.001');
		$('#' + this.dataDocumentID + 'WidgetProfileImage').attr('material', 'shader: left-sided-rounded-corners; multiplier: 1.0; aspectRatio: 1.0; opacity: 1.0');

		// Body overlays the background at the same extent — holds the text
		// entities so their canvases map to the colored card region.
		$('<a-entity/>', {
			id: this.dataDocumentID + 'WidgetProfileBody',
			rotation: '0 0 0',
			scale: '0.75 1 1',
		}).appendTo('#' + this.dataDocumentID + 'WidgetProfileFace');

		$('#' + this.dataDocumentID + 'WidgetProfileBody').attr('position', '0.125 0 0.001');

		// Four stat lines as one vertically-centered block. Line centers
		// sit at y = ±39, ±13 — spacing of 26 px between adjacent lines
		// matches the ~25 px margin above the top line and below the
		// bottom line, so the chunk reads as visually centered in the
		// 128-tall card. Font bumped to 18 px with a bit of padding
		// between lines (line box 22 px → ~4 px of gap at a 26 px pitch).
		// No inner alternation — the outer `alternate-entities` on
		// WidgetBody recursively sweeps every descendant of ProfileFace
		// and forces opacity=1/visible=true on each reveal, which would
		// clobber any nested alternation.
		const hikesLine = this.formatHikesLine();
		const distanceLine = this.formatTotalDistanceLine();
		const elevationLine = this.formatTotalElevationLine();
		const movingTimeLine = this.formatMovingTimeLine();

		if (hikesLine) {
			generateAFrameTextEntity(
				this.dataDocumentID + 'WidgetProfileHikesText',
				'#' + this.dataDocumentID + 'WidgetProfileBody',
				hikesLine,
				18, '#161f13', 0, 'Montserrat', 300, 22, false, '#00000000',
				16, 39, 272, 384, 128, 1, true
			);
		}
		if (distanceLine) {
			generateAFrameTextEntity(
				this.dataDocumentID + 'WidgetProfileDistanceText',
				'#' + this.dataDocumentID + 'WidgetProfileBody',
				distanceLine,
				18, '#161f13', 0, 'Montserrat', 300, 22, false, '#00000000',
				16, 13, 272, 384, 128, 1, true
			);
		}
		if (elevationLine) {
			generateAFrameTextEntity(
				this.dataDocumentID + 'WidgetProfileElevationText',
				'#' + this.dataDocumentID + 'WidgetProfileBody',
				elevationLine,
				18, '#161f13', 0, 'Montserrat', 300, 22, false, '#00000000',
				16, -13, 272, 384, 128, 1, true
			);
		}
		if (movingTimeLine) {
			generateAFrameTextEntity(
				this.dataDocumentID + 'WidgetProfileMovingTimeText',
				'#' + this.dataDocumentID + 'WidgetProfileBody',
				movingTimeLine,
				18, '#161f13', 0, 'Montserrat', 300, 22, false, '#00000000',
				16, -39, 272, 384, 128, 1, true
			);
		}

		// AllTrails wordmark glyph on the far right — matches the mapbox /
		// github / etc. paradigm where the service logo anchors the profile
		// face. Parented under the profile background so it participates in
		// the background's scaled local frame: background has scale 0.75 in
		// x, so the logo's x-scale and x-position are pre-divided by 0.75
		// to preserve its on-widget appearance.
		$('<a-image/>', {
			id: this.dataDocumentID + 'WidgetLogo',
			rotation: '0 0 0',
			scale: '0.125 0.375 1',
			src: this.logoImageURL,
			material: 'alphaTest: 0.5'
		}).appendTo('#' + this.dataDocumentID + 'WidgetProfileBackground');

		$('#' + this.dataDocumentID + 'WidgetLogo').attr('position', '0.375 0 0.0001');
	}

	async buildPolylineMaskCanvas(polylineURL, oriented) {
		const polylineBlob = await makeRequest('GET', polylineURL);
		const encoded = await polylineBlob.text();
		const points = decodePolyline(encoded);

		const canvas = document.createElement('canvas');
		canvas.width = this.polylineCanvasWidth;
		canvas.height = this.polylineCanvasHeight;
		const ctx = canvas.getContext('2d');

		// Transparent background — the shader only composites where alpha > 0.
		ctx.clearRect(0, 0, canvas.width, canvas.height);

		// Stroke width scales INVERSELY with the oriented rect's long extent
		// (our zoom proxy — bigger rect = more zoomed out = the line should
		// read as a thinner trace). Each doubling of longMeters drops ~2.8px
		// off the stroke. Widths are in canvas pixels (2048 wide); visible
		// size on the widget face is ~1/4 since the canvas is 4x-oversampled
		// vs the 512-wide satellite. Halo extra scales with the stroke so a
		// hairline trail still gets a readable dark outline without the halo
		// overwhelming the line.
		const baseStroke = Math.max(4, Math.min(15, 15 - 2.8 * Math.log2(Math.max(1, oriented.longMeters / 1000))));
		const haloExtra = Math.max(3, baseStroke * 0.4);

		// Outer dark halo — drawn first so the inner stroke overpaints its center.
		ctx.strokeStyle = this.polylineColorOuter;
		ctx.lineWidth = baseStroke + haloExtra;
		ctx.lineCap = 'round';
		ctx.lineJoin = 'round';
		this.tracePath(ctx, points, oriented, canvas.width, canvas.height);

		// Inner brand-red stroke.
		ctx.strokeStyle = this.polylineColorInner;
		ctx.lineWidth = baseStroke;
		this.tracePath(ctx, points, oriented, canvas.width, canvas.height);

		return canvas;
	}

	tracePath(ctx, points, oriented, canvasWidth, canvasHeight) {
		ctx.beginPath();
		let started = false;
		for (const p of points) {
			const uv = projectLatLngToOrientedUV(p, oriented);
			if (!uv) { started = false; continue; } // gap: start a new subpath on re-entry
			const px = uv.u * canvasWidth;
			// flipY=true on CanvasTexture maps canvas (0,0)=top-left to UV (0,0)
			// =bottom-left, so v=0 (top of oriented rect) corresponds to canvas
			// pixel_y=0 (top of canvas).
			const py = uv.v * canvasHeight;
			if (!started) {
				ctx.moveTo(px, py);
				started = true;
			} else {
				ctx.lineTo(px, py);
			}
		}
		ctx.stroke();
	}

	buildTerrainMaterial(satelliteTexture, polylineTexture) {
		const material = new THREE.ShaderMaterial({
			// FrontSide + explicit non-transparency so the terrain writes to
			// the depth buffer and everything behind it (including the prism's
			// far-side walls) gets correctly occluded. A previous DoubleSide
			// pass made the interior-facing face render the same satellite
			// texture, which looked like "the inside of the prism".
			side: THREE.FrontSide,
			transparent: false,
			depthTest: true,
			depthWrite: true,
			uniforms: {
				src: { type: 'map', is: 'uniform', value: satelliteTexture },
				track: { type: 'map', is: 'uniform', value: polylineTexture },
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
			uniform sampler2D track;
			uniform float opacity;
			varying vec2 vUV;

			void main() {
				vec3 baseColor = texture2D(src, vUV).xyz;
				vec4 trackSample = texture2D(track, vUV);
				vec3 color = mix(baseColor, trackSample.rgb, trackSample.a);
				gl_FragColor = vec4(color, opacity);
			}
			`
		});

		this.cleanupFunctions.push(() => {
			material.dispose();
			if (material.uniforms.src && material.uniforms.src.value) material.uniforms.src.value.dispose();
			if (material.uniforms.track && material.uniforms.track.value) material.uniforms.track.value.dispose();
		});

		return material;
	}

	formatStatsLine() {
		const parts = [];
		if (this.data.trailTotalDistance != null) {
			const km = this.data.trailTotalDistance / 1000;
			parts.push(km.toFixed(1) + ' km');
		}
		if (this.data.trailElevationGain != null) {
			parts.push(Math.round(this.data.trailElevationGain) + ' m gain');
		}
		return parts.join('  •  ');
	}

	formatHikesLine() {
		if (this.data.completed == null) return null;
		return 'Hikes: ' + this.data.completed.toLocaleString('en-US');
	}

	formatTotalDistanceLine() {
		if (this.data.lifetimeDistanceMeters == null) return null;
		const km = Math.round(this.data.lifetimeDistanceMeters / 1000);
		return 'Total Distance: ' + km.toLocaleString('en-US') + ' km';
	}

	formatTotalElevationLine() {
		if (this.data.lifetimeElevationGainMeters == null) return null;
		const m = Math.round(this.data.lifetimeElevationGainMeters);
		return 'Total Elevation: ' + m.toLocaleString('en-US') + ' m';
	}

	formatMovingTimeLine() {
		if (this.data.lifetimeMovingSeconds == null) return null;
		const hours = Math.round(this.data.lifetimeMovingSeconds / 3600);
		return 'Moving Time: ' + hours.toLocaleString('en-US') + ' h';
	}

	// "Foo Trail via Long Route Name" → "Foo Trail". AllTrails canonical trail
	// names are often suffixed with " via <route>" which inflates the visual
	// length without adding hero-face value. Case-insensitive, whitespace-safe.
	shortenTrailName(name) {
		if (!name) return name;
		const match = name.match(/^(.*?)\s+via\s+/i);
		return match ? match[1].trim() : name;
	}

}
