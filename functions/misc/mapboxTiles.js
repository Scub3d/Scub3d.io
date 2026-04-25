// Mapbox raster fetchers. The Static Images API accepts bboxes natively for
// rendered styles (satellite, outdoors, etc.) so a single HTTP fetch suffices.
// terrain-rgb is only exposed as z/x/y raster tiles, so we pick a zoom level
// that yields at least the requested pixel density, fetch every tile that
// overlaps the bbox, composite, then crop to the exact bbox footprint.

const { downloadFileFromURL, uploadLocalFileToBucket, uploadExternalFileToBucket } = require('./common');
const { lngToTileX, latToTileY } = require('./geo');

const sharp = require('sharp');
const os = require('os');
const path = require('path');

const TERRAIN_TILE_SIZE = 256;

// Pick the smallest zoom level whose tile pixels cover at least the widthPx
// the caller asked for across the bbox's longitude span. Bounded at [0, 15]
// (16 is mapbox's terrain-rgb ceiling; 15 gives good headroom).
function chooseZoomForBbox(bounds, widthPx) {
	for (let z = 0; z <= 15; z++) {
		const xSpan = Math.abs(lngToTileX(bounds.maxLng, z) - lngToTileX(bounds.minLng, z));
		if (xSpan * TERRAIN_TILE_SIZE >= widthPx) return z;
	}
	return 15;
}

// Upload a rendered mapbox style image (satellite, outdoors, etc.) cropped
// to `bounds`. Mapbox's `[bbox]` URL form handles the math for us.
async function uploadStyledMapByBbox(styleID, bounds, widthPx, heightPx, token, destinationPath) {
	const url = 'https://api.mapbox.com/styles/v1/mapbox/' + styleID + '/static/[' +
		bounds.minLng + ',' + bounds.minLat + ',' + bounds.maxLng + ',' + bounds.maxLat +
		']/' + widthPx + 'x' + heightPx + '@2x?access_token=' + token + '&attribution=false&logo=false';
	await uploadExternalFileToBucket(url, destinationPath, 'image/png');
}

// mapbox.satellite raster tiles at @2x are 512×512 JPEGs.
const SATELLITE_TILE_SIZE_AT2X = 512;

// Supersample factor for tile-based satellite fetches. Sharp's
// arbitrary-angle rotate uses bilinear interpolation, which softens every
// pixel; fetching at 2× the target density lets the final lanczos3
// downsample win back sharp edges. Bigger factors compound bandwidth and
// show diminishing returns past 2×.
const SATELLITE_SUPERSAMPLE = 2;

// Upload a mapbox satellite raster rotated to align the caller's trail-axis
// with the image's +x. Fetches tiles (not the 1280-capped Static Images API)
// from `v4/mapbox.satellite` at a zoom chosen to supersample the target
// density, rotates the stitched image by `oriented.bearingRadians` CCW, then
// center-crops + lanczos3-resizes the 4:1 trail rectangle out of the
// rotated canvas. Tile-fetch vs. static bbox gives us ~2× the pixel data at
// the cost of more HTTP requests — worth it for visibly sharper imagery
// after rotation.
async function uploadSatelliteTilesOrientedByBbox(oriented, outputWidthPx, outputHeightPx, token, destinationPath) {
	const theta = oriented.bearingRadians;
	const absC = Math.abs(Math.cos(theta));
	const absS = Math.abs(Math.sin(theta));
	const shortToLong = oriented.shortMeters / oriented.longMeters;

	// Target E-W pixel count for the enclosing bbox after stitching.
	// outputWidthPx·(|cosθ| + (short/long)·|sinθ|) is what we'd need for a
	// 1:1 (no-supersample) fetch; multiply by SATELLITE_SUPERSAMPLE to
	// oversample.
	const targetFetchWidth = outputWidthPx * (absC + shortToLong * absS) * SATELLITE_SUPERSAMPLE;

	const bounds = oriented.enclosingBbox;
	// Pick the smallest zoom whose @2x tile coverage meets targetFetchWidth.
	// Capped at 17 — satellite goes higher but 17 is more than enough for
	// even 1km trails at 2048 output.
	let zoom = 17;
	for (let z = 0; z <= 17; z++) {
		const xSpan = Math.abs(lngToTileX(bounds.maxLng, z) - lngToTileX(bounds.minLng, z));
		if (xSpan * SATELLITE_TILE_SIZE_AT2X >= targetFetchWidth) { zoom = z; break; }
	}

	const xMinFloat = lngToTileX(bounds.minLng, zoom);
	const xMaxFloat = lngToTileX(bounds.maxLng, zoom);
	const yMinFloat = latToTileY(bounds.maxLat, zoom);
	const yMaxFloat = latToTileY(bounds.minLat, zoom);

	const tileXStart = Math.floor(xMinFloat);
	const tileXEnd   = Math.ceil(xMaxFloat) - 1;
	const tileYStart = Math.floor(yMinFloat);
	const tileYEnd   = Math.ceil(yMaxFloat) - 1;

	const tileCols = tileXEnd - tileXStart + 1;
	const tileRows = tileYEnd - tileYStart + 1;

	const downloadJobs = [];
	for (let ty = tileYStart; ty <= tileYEnd; ty++) {
		for (let tx = tileXStart; tx <= tileXEnd; tx++) {
			const url = 'https://api.mapbox.com/v4/mapbox.satellite/' + zoom + '/' + tx + '/' + ty + '@2x.jpg90?access_token=' + token;
			downloadJobs.push(
				downloadFileFromURL({ method: 'GET', url: url }, 'mapboxSat_' + zoom + '_' + tx + '_' + ty + '_' + Date.now(), '.jpg')
					.then(localPath => ({ tx, ty, localPath }))
			);
		}
	}
	const tiles = await Promise.all(downloadJobs);

	const composites = tiles.map(({ tx, ty, localPath }) => ({
		input: localPath,
		left: (tx - tileXStart) * SATELLITE_TILE_SIZE_AT2X,
		top:  (ty - tileYStart) * SATELLITE_TILE_SIZE_AT2X,
	}));

	const stitchedBuffer = await sharp({
		create: {
			width:  tileCols * SATELLITE_TILE_SIZE_AT2X,
			height: tileRows * SATELLITE_TILE_SIZE_AT2X,
			channels: 3,
			background: { r: 0, g: 0, b: 0 },
		},
	}).composite(composites).jpeg({ quality: 95 }).toBuffer();

	// Crop to the exact enclosing bbox window (sub-tile precision). Same
	// extract-before-rotate ordering from buildTerrainRGBForBbox — sharp
	// would otherwise apply rotate early in the pipeline and blow up the
	// extract coords.
	const cropLeft   = Math.round((xMinFloat - tileXStart) * SATELLITE_TILE_SIZE_AT2X);
	const cropTop    = Math.round((yMinFloat - tileYStart) * SATELLITE_TILE_SIZE_AT2X);
	const cropWidth  = Math.round((xMaxFloat - xMinFloat) * SATELLITE_TILE_SIZE_AT2X);
	const cropHeight = Math.round((yMaxFloat - yMinFloat) * SATELLITE_TILE_SIZE_AT2X);

	const croppedBuffer = await sharp(stitchedBuffer)
		.extract({ left: cropLeft, top: cropTop, width: cropWidth, height: cropHeight })
		.jpeg({ quality: 95 })
		.toBuffer();

	// Sharp's positive angle is CW in image space. Our bearing is CCW in
	// world; image +y is south, so a world-CCW rotation of θ equals an
	// image-CW rotation of θ — pass +theta.
	const rotateDeg = theta * 180 / Math.PI;
	const rotatedBuffer = await sharp(croppedBuffer)
		.rotate(rotateDeg, { background: '#000000' })
		.jpeg({ quality: 95 })
		.toBuffer();
	const rotatedMeta = await sharp(rotatedBuffer).metadata();

	// Post-rotation trail-rect size in pixels. Density is preserved by the
	// rotation, so reuse the pre-rotation cropWidth to derive px/m.
	const ewMeters = oriented.longMeters * absC + oriented.shortMeters * absS;
	const pixelsPerMeter = cropWidth / ewMeters;
	const trailCropWidth  = Math.round(oriented.longMeters  * pixelsPerMeter);
	const trailCropHeight = Math.round(oriented.shortMeters * pixelsPerMeter);

	const extractLeft = Math.max(0, Math.floor((rotatedMeta.width  - trailCropWidth)  / 2));
	const extractTop  = Math.max(0, Math.floor((rotatedMeta.height - trailCropHeight) / 2));
	const safeWidth   = Math.min(trailCropWidth,  rotatedMeta.width  - extractLeft);
	const safeHeight  = Math.min(trailCropHeight, rotatedMeta.height - extractTop);

	const outputPath = path.join(os.tmpdir(), 'mapboxSat_oriented_' + Date.now() + '.png');
	await sharp(rotatedBuffer)
		.extract({ left: extractLeft, top: extractTop, width: safeWidth, height: safeHeight })
		.resize(outputWidthPx, outputHeightPx, { kernel: 'lanczos3' })
		.png()
		.toFile(outputPath);
	await uploadLocalFileToBucket(outputPath, destinationPath, 'image/png');
}

// Fetch all terrain-rgb tiles overlapping `bounds` at the picked zoom, stitch
// them into one image, then crop to the exact bbox pixel window. Returns the
// local file path; caller is responsible for uploading + cleaning up.
// Resampling uses nearest-neighbor so we don't smudge the encoded elevation
// bytes — interpolating RGB on terrain-rgb gives garbage.
async function buildTerrainRGBForBbox(bounds, widthPx, heightPx, token) {
	const zoom = chooseZoomForBbox(bounds, widthPx);

	const xMinFloat = lngToTileX(bounds.minLng, zoom);
	const xMaxFloat = lngToTileX(bounds.maxLng, zoom);
	const yMinFloat = latToTileY(bounds.maxLat, zoom); // note: lat→y is inverted
	const yMaxFloat = latToTileY(bounds.minLat, zoom);

	const tileXStart = Math.floor(xMinFloat);
	const tileXEnd = Math.ceil(xMaxFloat) - 1;
	const tileYStart = Math.floor(yMinFloat);
	const tileYEnd = Math.ceil(yMaxFloat) - 1;

	const tileCols = tileXEnd - tileXStart + 1;
	const tileRows = tileYEnd - tileYStart + 1;

	const downloadJobs = [];
	for (let ty = tileYStart; ty <= tileYEnd; ty++) {
		for (let tx = tileXStart; tx <= tileXEnd; tx++) {
			const url = 'https://api.mapbox.com/v4/mapbox.terrain-rgb/' + zoom + '/' + tx + '/' + ty + '.pngraw?access_token=' + token;
			downloadJobs.push(
				downloadFileFromURL({ method: 'GET', url: url }, 'mapboxTerrainRGB_' + zoom + '_' + tx + '_' + ty, '.png')
					.then(localPath => ({ tx, ty, localPath }))
			);
		}
	}
	const tiles = await Promise.all(downloadJobs);

	const composites = tiles.map(({ tx, ty, localPath }) => ({
		input: localPath,
		left: (tx - tileXStart) * TERRAIN_TILE_SIZE,
		top: (ty - tileYStart) * TERRAIN_TILE_SIZE,
	}));

	const stitchedBuffer = await sharp({
		create: {
			width: tileCols * TERRAIN_TILE_SIZE,
			height: tileRows * TERRAIN_TILE_SIZE,
			channels: 3,
			background: { r: 0, g: 0, b: 0 },
		},
	}).composite(composites).png().toBuffer();

	// Crop to the exact bbox window, then resample to the requested output
	// dimensions with nearest-neighbor to preserve elevation encoding.
	const cropLeft = Math.round((xMinFloat - tileXStart) * TERRAIN_TILE_SIZE);
	const cropTop = Math.round((yMinFloat - tileYStart) * TERRAIN_TILE_SIZE);
	const cropWidth = Math.round((xMaxFloat - xMinFloat) * TERRAIN_TILE_SIZE);
	const cropHeight = Math.round((yMaxFloat - yMinFloat) * TERRAIN_TILE_SIZE);

	const outputPath = path.join(os.tmpdir(), 'mapboxTerrainRGB_bbox_' + Date.now() + '.png');
	await sharp(stitchedBuffer)
		.extract({ left: cropLeft, top: cropTop, width: cropWidth, height: cropHeight })
		.resize(widthPx, heightPx, { kernel: 'nearest' })
		.png()
		.toFile(outputPath);

	return outputPath;
}

async function uploadTerrainRGBForBbox(bounds, widthPx, heightPx, token, destinationPath) {
	const localPath = await buildTerrainRGBForBbox(bounds, widthPx, heightPx, token);
	await uploadLocalFileToBucket(localPath, destinationPath, 'image/png');
}

module.exports = {
	TERRAIN_TILE_SIZE,
	chooseZoomForBbox,
	uploadStyledMapByBbox,
	uploadSatelliteTilesOrientedByBbox,
	buildTerrainRGBForBbox,
	uploadTerrainRGBForBbox
};
