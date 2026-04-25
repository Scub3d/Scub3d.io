// Shared THREE.js plumbing for bbox-based terrain widgets (mapbox, alltrails).
// Builds from two raster inputs:
//   • a satellite/rendered-map PNG → a THREE.Texture for the material
//   • a mapbox terrain-rgb PNG → a displaced PlaneBufferGeometry
// No widget-specific logic lives here; each widget owns its own shader
// material so it can composite additional uniforms (polyline masks,
// location dots) on top of the base satellite sample.

async function buildTerrainTexture(satelliteImageURL) {
	const texture = new THREE.Texture();
	// Route through makeRequest → blobToDataURL so CORS doesn't trip us up
	// when the satellite is hosted on a different subdomain from the AR page.
	const satelliteBlob = await makeRequest('GET', satelliteImageURL);
	const satelliteDataURL = await blobToDataURL(satelliteBlob);

	const img = new Image();
	img.crossOrigin = 'Anonymous';
	img.onload = function () {
		texture.image = this;
		texture.needsUpdate = true;
	};
	img.src = satelliteDataURL;

	return texture;
}

// Decodes a mapbox terrain-rgb PNG into a displaced plane. The plane is 1
// mesh unit wide × (1/aspectRatio) mesh unit tall; caller scales it to the
// desired widget size.
//
// options.metersPerPlaneWidth — real-world meters across 1 mesh unit of X.
//   Mapbox widget (z9, centered): 156544 / cos(lat)
//   AllTrails widget (bbox): paddedLongMeters (stored server-side)
// options.heightExaggeration — vertical stretch applied AFTER meters→mesh
//   conversion. 2.0 gives visible relief without caricature.
// options.aspectRatio — width/height of the plane in mesh units; default 4:1.
// options.segmentsX / segmentsY — vertex grid; default matches 512×128 PNG.
// options.oriented — AllTrails-style trail-aligned sampling. When present
//   the plane is still 1×1/aspect but each vertex's world lat/lng is
//   computed via the bearing rotation (matches the server's satellite
//   rotation), and the terrain-RGB image is sampled per-vertex against
//   the axis-aligned `oriented.terrain` bbox. When absent, each pixel of
//   the terrain-RGB image maps 1:1 to a grid vertex (mapbox widget path).
//
// Returns { geometry, centerHeightMeshUnits, segmentsX, segmentsY,
// minHeightMeshUnits, maxHeightMeshUnits } — caller may use the center
// height to align auxiliary markers (e.g. the mapbox "you are here" pin),
// and segmentsX/Y + min/max heights to build a matching vertical skirt
// (see buildTerrainSkirtGeometry).
async function buildElevationPlaneGeometry(terrainRGBImageURL, options) {
	const opts = options || {};
	const aspectRatio = opts.aspectRatio != null ? opts.aspectRatio : 4.0;
	const segmentsX = opts.segmentsX != null ? opts.segmentsX : 511;
	const segmentsY = opts.segmentsY != null ? opts.segmentsY : 127;
	const heightExaggeration = opts.heightExaggeration != null ? opts.heightExaggeration : 2.0;
	const metersPerPlaneWidth = opts.metersPerPlaneWidth;
	const oriented = opts.oriented || null;
	if (metersPerPlaneWidth == null) {
		throw new Error('buildElevationPlaneGeometry: options.metersPerPlaneWidth is required');
	}

	const planeHeight = 1 / aspectRatio;
	const geometry = new THREE.PlaneBufferGeometry(1, planeHeight, segmentsX, segmentsY);

	const terrainBlob = await makeRequest('GET', terrainRGBImageURL);
	const terrainDataURL = await blobToDataURL(terrainBlob);

	const img = new Image();
	img.crossOrigin = 'Anonymous';
	img.src = terrainDataURL;
	await img.decode();

	// Size the sampling canvas. For the mapbox 1:1 path we use the grid
	// dims so each vertex reads one pixel. For oriented we decode the whole
	// image at its native size so per-vertex lat/lng lookups hit the best
	// available resolution — the image was fetched by the server at a size
	// matched to the diagonal extent, not to the mesh grid.
	const canvasWidth = oriented ? img.naturalWidth : segmentsX + 1;
	const canvasHeight = oriented ? img.naturalHeight : segmentsY + 1;
	const canvas = document.createElement('canvas');
	canvas.width = canvasWidth;
	canvas.height = canvasHeight;
	const context = canvas.getContext('2d');
	context.drawImage(img, 0, 0, canvasWidth, canvasHeight);
	const imageData = context.getImageData(0, 0, canvasWidth, canvasHeight);
	const elevationArray = imageData.data;

	function decodeHeightMetersAt(px, py) {
		const offset = (py * canvasWidth + px) * 4;
		return -10000 + (elevationArray[offset] * 65536 + elevationArray[offset + 1] * 256 + elevationArray[offset + 2]) * 0.1;
	}

	const positions = geometry.attributes.position.array;
	let centerHeightMeshUnits = 0;
	let minHeightMeshUnits = Infinity;
	let maxHeightMeshUnits = -Infinity;

	const gridW = segmentsX + 1;
	const gridH = segmentsY + 1;

	// Precompute oriented-sampling constants.
	let cosT, sinT, mPerLngMid;
	if (oriented) {
		cosT = Math.cos(oriented.bearingRadians);
		sinT = Math.sin(oriented.bearingRadians);
		mPerLngMid = metersPerDegLngAtLatitude(oriented.midLat);
	}

	for (let iy = 0; iy < gridH; iy++) {
		for (let ix = 0; ix < gridW; ix++) {
			let heightMeters;

			if (oriented) {
				// Plane vertex (ix, iy) → mesh-local coords. iy=0 is at y=+half
				// (north edge pre-rotation), iy=segmentsY at y=-half.
				const meshX = -0.5 + ix / segmentsX;
				const meshY = planeHeight * 0.5 - (iy / segmentsY) * planeHeight;
				// 1 mesh unit = longMeters; along = east-ish distance in the
				// trail frame, across = perpendicular.
				const along  = meshX * oriented.longMeters;
				const across = meshY * oriented.longMeters;
				// Rotate trail frame → world (east, north).
				const dxWorld =  along * cosT - across * sinT;
				const dyWorld =  along * sinT + across * cosT;
				const lat = oriented.midLat + dyWorld / METERS_PER_DEG_LAT;
				const lng = oriented.midLng + dxWorld / mPerLngMid;
				// Sample axis-aligned terrain RGB at that lat/lng. Nearest-
				// neighbor only — never bilinear on encoded elevation bytes.
				const terrain = oriented.terrain;
				const tu = (lng - terrain.minLng) / (terrain.maxLng - terrain.minLng);
				const tv = (terrain.maxLat - lat) / (terrain.maxLat - terrain.minLat);
				const px = Math.max(0, Math.min(canvasWidth - 1, Math.round(tu * (canvasWidth - 1))));
				const py = Math.max(0, Math.min(canvasHeight - 1, Math.round(tv * (canvasHeight - 1))));
				heightMeters = decodeHeightMetersAt(px, py);
			} else {
				heightMeters = decodeHeightMetersAt(ix, iy);
			}

			const heightMeshUnits = (heightMeters / metersPerPlaneWidth) * heightExaggeration;
			const vertexOffset = (iy * gridW + ix) * 3;
			positions[vertexOffset + 2] = heightMeshUnits;

			// Only track min/max on real terrain — (0,0,0) edge/transparent pixels
			// decode to heightMeters=-10000 (mapbox's sentinel), which would
			// yank min down to ~-0.5 mesh units and blow up any skirt geometry
			// that's anchored relative to it.
			if (heightMeters > -9000) {
				if (heightMeshUnits < minHeightMeshUnits) minHeightMeshUnits = heightMeshUnits;
				if (heightMeshUnits > maxHeightMeshUnits) maxHeightMeshUnits = heightMeshUnits;
			}

			if (iy === Math.floor(gridH / 2) && ix === Math.floor(gridW / 2)) {
				centerHeightMeshUnits = heightMeshUnits;
			}
		}
	}
	if (!isFinite(minHeightMeshUnits)) minHeightMeshUnits = 0;
	if (!isFinite(maxHeightMeshUnits)) maxHeightMeshUnits = 0;

	geometry.attributes.position.needsUpdate = true;
	geometry.computeVertexNormals();

	return { geometry, centerHeightMeshUnits, segmentsX, segmentsY, minHeightMeshUnits, maxHeightMeshUnits };
}

// Build a closed rectangular prism whose top is a terrain-displaced plane.
// Takes the already-displaced top geometry and generates the four vertical
// side walls + a flat bottom face so the whole thing reads as a solid block.
// Returns a non-indexed BufferGeometry suitable for a MeshBasicMaterial with
// FrontSide culling — every emitted triangle is CCW from outside the prism
// so depth works correctly (no DoubleSide hack).
//
// options.includeCap — when false, emit only the four wall strips and skip
// the flat cap at baseZ. Used by the alltrails "openRim" variant where
// baseZ sits ABOVE the terrain and we want the canyon visible from overhead
// rather than covered by a plateau.
function buildTerrainSkirtGeometry(topGeometry, segmentsX, segmentsY, baseZ, options) {
	const opts = options || {};
	const includeCap = opts.includeCap !== false;
	const topPositions = topGeometry.attributes.position.array;
	const stride = segmentsX + 1;
	const verts = [];

	function topVertex(ix, iy) {
		const i = (iy * stride + ix) * 3;
		return [topPositions[i], topPositions[i + 1], topPositions[i + 2]];
	}

	// Emit a CCW quad a→b→c→d (viewed from outside). Two triangles: (a,b,c) + (a,c,d).
	function pushCCWQuad(a, b, c, d) {
		verts.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
		verts.push(a[0], a[1], a[2], c[0], c[1], c[2], d[0], d[1], d[2]);
	}

	// Plane geometry: iy=0 row is at y=+half (outward normal +Y), iy=segmentsY
	// at y=-half (outward -Y), ix=0 at x=-half (outward -X), ix=segmentsX at
	// x=+half (outward +X). Vertex winding order is edge-specific so each wall
	// has its front face pointing outward regardless of which axis it runs on.

	// +Y wall (iy=0): walk along +X; outward normal +Y; viewer at +Y looking -Y
	// sees +X to the left. CCW-from-outside order: a(top-right) → b(top-left) →
	// bBase(bot-left) → aBase(bot-right). Since a is at smaller ix (smaller x,
	// i.e. to the right of viewer), and we want CCW, swap a/b.
	for (let ix = 0; ix < segmentsX; ix++) {
		const a = topVertex(ix, 0), b = topVertex(ix + 1, 0);
		pushCCWQuad(b, a, [a[0], a[1], baseZ], [b[0], b[1], baseZ]);
	}

	// -Y wall (iy=segmentsY): outward normal -Y; viewer at -Y looking +Y sees
	// +X to the right. CCW-from-outside: a(top-left) → b(top-right) →
	// bBase(bot-right) → aBase(bot-left) — keep a/b order.
	for (let ix = 0; ix < segmentsX; ix++) {
		const a = topVertex(ix, segmentsY), b = topVertex(ix + 1, segmentsY);
		pushCCWQuad(a, b, [b[0], b[1], baseZ], [a[0], a[1], baseZ]);
	}

	// -X wall (ix=0): outward normal -X; viewer at -X looking +X sees +Y up
	// and +Y-to-the-left convention differs. Stepping iy=0 → segmentsY (y
	// decreasing). a at top (y high), b at bottom (y low). CCW-from-outside:
	// a → b → bBase → aBase keeps front outward.
	for (let iy = 0; iy < segmentsY; iy++) {
		const a = topVertex(0, iy), b = topVertex(0, iy + 1);
		pushCCWQuad(a, b, [b[0], b[1], baseZ], [a[0], a[1], baseZ]);
	}

	// +X wall (ix=segmentsX): outward normal +X; mirror of the -X wall, so
	// swap a/b for CCW-from-outside.
	for (let iy = 0; iy < segmentsY; iy++) {
		const a = topVertex(segmentsX, iy), b = topVertex(segmentsX, iy + 1);
		pushCCWQuad(b, a, [a[0], a[1], baseZ], [b[0], b[1], baseZ]);
	}

	// Bottom face at z=baseZ. Outward normal -Z (downward). Viewer from below
	// looking up sees +Y at the top and +X to the left. CCW-from-below order:
	// start at (xMin, yMax), go (xMax, yMax), (xMax, yMin), (xMin, yMin).
	if (includeCap) {
		const tl = topVertex(0, 0);                    // (xMin, yMax)
		const tr = topVertex(segmentsX, 0);            // (xMax, yMax)
		const br = topVertex(segmentsX, segmentsY);    // (xMax, yMin)
		const bl = topVertex(0, segmentsY);            // (xMin, yMin)
		pushCCWQuad(
			[tl[0], tl[1], baseZ],
			[bl[0], bl[1], baseZ],
			[br[0], br[1], baseZ],
			[tr[0], tr[1], baseZ]
		);
	}

	const geometry = new THREE.BufferGeometry();
	geometry.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
	return geometry;
}

// GLSL snippet: rounded-corner alpha clip for a plane sized `1 × (1/aspect)`.
// Returns `true` when the fragment should be clipped (gl_FragColor = transparent).
// Shared so every terrain-like widget composites corners consistently.
const TERRAIN_ROUNDED_CORNER_GLSL = `
bool isClippedByCorner(vec2 uv, float cornerRadius, float aspectRatio) {
	if (uv.x / aspectRatio <= cornerRadius && uv.y <= cornerRadius) {
		return sqrt(pow(cornerRadius - uv.x / aspectRatio, 2.0) + pow(cornerRadius - uv.y, 2.0)) > cornerRadius;
	} else if (uv.x / aspectRatio <= cornerRadius && uv.y >= 1.0 - cornerRadius) {
		return sqrt(pow(cornerRadius - uv.x / aspectRatio, 2.0) + pow(1.0 - cornerRadius - uv.y, 2.0)) > cornerRadius;
	} else if (uv.x >= 1.0 - cornerRadius * aspectRatio && uv.y <= cornerRadius) {
		return sqrt(pow(1.0 / aspectRatio - cornerRadius - uv.x / aspectRatio, 2.0) + pow(cornerRadius - uv.y, 2.0)) > cornerRadius;
	} else if (uv.x >= 1.0 - cornerRadius * aspectRatio && uv.y >= 1.0 - cornerRadius) {
		return sqrt(pow(1.0 / aspectRatio - cornerRadius - uv.x / aspectRatio, 2.0) + pow(1.0 - cornerRadius - uv.y, 2.0)) > cornerRadius;
	}
	return false;
}
`;
