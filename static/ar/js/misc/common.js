function utoa(str) {
	return btoa(unescape(encodeURIComponent(str)));
}

function generateTextHTML(text, isTextTooLong, elementID, isEmpty) {
	if (isEmpty) return '';
	if (!isTextTooLong) return '<p id="' + elementID + '">' + text + '</p>';
	return '<div id="' + elementID + '"><div class="' + elementID + 'Start"><p>' + text + '</p></div><div class="' + elementID + 'Follow"><p>' + text + '</p></div></div>';
}

function uuid() { // from stackoverflow
	return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, c => (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16));
}

function calculateTextWidth(text, fontSize, fontName) {
	var ctx = $('#Ignore')[0].getContext('2d');
	ctx.font = fontSize + 'px ' + fontName;

	// $('#Ignore')[0].style.fontSize = fontSize + "px Montserrat";
	// console.log("Text: " + text + ", Width:" + ctx.measureText(text).width + ", Font: " + ctx.font);
	// console.log("------------------------------------")
	// ctx.clearRect(0, 0, 512, 128)
	return ctx.measureText(text).width;
}

function generateFollowTextCSS(text, fontSize, fontName, elementID, maxWidth, isEmpty) {
	if (isEmpty) return ['', false];
	calculated_text_width = calculateTextWidth(text, fontSize, fontName);
	// console.log('#' + elementID + '{font-size:' + fontSize + 'px}')
	if (calculated_text_width < maxWidth) return ['#' + elementID + '{font-size:' + fontSize + 'px}', false];

	slide_left_duration = 20 + ((calculated_text_width - maxWidth) * 0.05);

	return ['@keyframes ' + elementID + 'FollowTextSlide{0%{left:80px}50%{left:-100%}100%{left:-100%}}@keyframes ' + elementID + 'StartTextSlide{0%{left:0%}50%{left:calc(-100% - 80px)}100%{left:calc(-100% - 80px)}}.' + elementID + 'Start  p{animation:' + elementID + 'StartTextSlide ' + slide_left_duration + 's 2s linear infinite;}.' + elementID + 'Follow p{animation:' + elementID + 'FollowTextSlide ' + slide_left_duration + 's 2s linear infinite}.' + elementID + 'Start,.' + elementID + 'Follow{display:inline-block}.' + elementID + 'Start p,.' + elementID + 'Follow p{position:relative}#' + elementID + '{font-size:' + fontSize + 'px}', true];
}

function generateVideoStreamingShowTextHTML(seriesTitle, episodeTitle, movieTitle, isSeriesTitleTooLong, isEpisodeTitleTooLong, isMovieTitleTooLong, platform) {
	if (seriesTitle === null || seriesTitle === undefined) {
		return '<div id="' + platform + 'ShowText" class="' + platform + '">' + generateTextHTML(movieTitle, isMovieTitleTooLong, platform + 'MovieTitle', false) + '</div>';
	}

	return '<div id="' + platform + 'ShowText" class="' + platform + '">' + generateTextHTML(seriesTitle, isSeriesTitleTooLong, platform + 'SeriesTitle', false) + generateTextHTML(episodeTitle, isEpisodeTitleTooLong, platform + 'EpisodeTitle', false) + '</div>';
}

function determineCorrectTopLineFontSize(seriesTitle, movieFont, seriesFont) {
	if (seriesTitle === undefined || seriesTitle === null) return movieFont;
	return seriesFont;
}

function makeRequest(method, url) {
	return new Promise(function (resolve, reject) {
		let xhr = new XMLHttpRequest();
		xhr.open(method, url);
		// xhr.setRequestHeader("Content-type","application/zip");
		xhr.responseType = 'blob';
		xhr.onload = function () {
			if (this.status >= 200 && this.status < 300) {
				resolve(xhr.response);
			} else {
				reject({
					status: this.status,
					statusText: xhr.statusText
				});
			}
		};
		xhr.onerror = function () {
			reject({
				status: this.status,
				statusText: xhr.statusText
			});
		};
		xhr.send();
	});
}

async function blobToDataURL(blob) {
	return new Promise((fulfill, reject) => {
		let reader = new FileReader();
		reader.onerror = reject;
		reader.onload = (e) => fulfill(reader.result);
		reader.readAsDataURL(blob);
	})
}

let FontDataURLDict = {};
const fontURLDicts = {
	'Montserrat': 'https://static.scub3d.io/ar/fonts/Montserrat.woff2',
	'NotoSans': 'https://static.scub3d.io/ar/fonts/NotoSans.woff2'
};

async function loadFonts() {
	const FONT_TIMEOUT_MS = 8000;

	function fetchWithTimeout(url) {
		return new Promise((resolve, reject) => {
			const timer = setTimeout(() => reject(new Error('font fetch timeout: ' + url)), FONT_TIMEOUT_MS);
			makeRequest('GET', url).then(blob => {
				clearTimeout(timer);
				resolve(blob);
			}).catch(err => {
				clearTimeout(timer);
				reject(err);
			});
		});
	}

	const results = await Promise.allSettled(Object.entries(fontURLDicts).map(async ([name, url]) => {
		const fontBlob = await fetchWithTimeout(url);
		FontDataURLDict[name] = await blobToDataURL(fontBlob);
	}));

	results.forEach((result, index) => {
		if (result.status === 'rejected') {
			const name = Object.keys(fontURLDicts)[index];
			console.warn('Failed to preload font ' + name + ':', result.reason);
		}
	});
}

// ------------------------ WebAR Code ------------------------ //
//generateAFrameTextEntity(elementID, '0 0 0', text, multiplier, ratio, height, initialXOffset, initialYOffset, textHolderWidth, containerWidth, containerHeight, direction)

// respectDepth (trailing, default true): whether the text material enables
// depth testing. Set to false for HUD-style text that must float on top of
// the same widget's 3D geometry (e.g. alltrails trail-name reading over the
// terrain prism). Leave at true elsewhere so text from one widget can't
// bleed across and draw on top of a neighbor widget's prism/background.
async function generateAFrameTextEntity(elementID, parentID, text, fontSize, color, paddingTop, fontFamily, fontWeight, textHeight, isCentered, backgroundColor, initialXOffset, initialYOffset, textHolderWidth, containerWidth, containerHeight, direction, hasShadow, respectDepth) {
	if (respectDepth === undefined) respectDepth = true;
	$('<a-image/>', {
		id: elementID,
		rotation: '0 0 0',
		crossorigin: 'anonymous',
		side: 'double',
		transparent: true,
		npot: true,
		'anti-tear': ''
	}).appendTo(parentID);

	const followTextSpacingOffset = 80.0;
	var ratio = 1.0;
	var multiplier = 1.0;
	var width = calculateTextWidth(text.replace("&amp;", "&"), fontSize, fontFamily); // How could you know that by not converting &amp; -> & for this measurement would affect the text length smh

	if (width >= textHolderWidth) {
		width = width * 2 + followTextSpacingOffset;
		ratio = textHolderWidth / width;
		multiplier = width / textHolderWidth;
	} else {
		width = textHolderWidth;
	}

	// const svgDataURL = generateTextSVGString(text, fontSize, color, paddingTop, fontFamily, fontWeight, textHeight, isCentered, backgroundColor, textHolderWidth, hasShadow, width);
	const generatedSVGString = generateTextSVG(text, fontSize, color, paddingTop, fontFamily, fontWeight, textHeight, isCentered, backgroundColor, textHolderWidth, hasShadow, width);

	let desiredCanvasWidth = width * 4.0;
	let desiredCanvasHeight = (textHeight + paddingTop) * 4.0;

	let img = new Image;

	img.crossOrigin = "Anonymous";
	img.onload = function () {
		let temporaryCanvas = document.createElement("CANVAS");
		let temporaryContext = temporaryCanvas.getContext('2d');

		temporaryCanvas.width = desiredCanvasWidth;
		temporaryCanvas.height = desiredCanvasHeight;

		temporaryContext.drawImage(this, 0, 0);

		const canvasDataURL = temporaryCanvas.toDataURL();

		temporaryContext.clearRect(0, 0, desiredCanvasWidth, desiredCanvasHeight);

		const calculatedXScale = (multiplier * (textHolderWidth / containerWidth));
		const calculatedYScale = ((textHeight + paddingTop) / containerHeight);
		const calculatedXPosition = (-(((1 - (textHolderWidth / containerWidth)) / 2) - (initialXOffset / containerWidth)) + ((multiplier - 1) * (textHolderWidth / containerWidth)) / 2);
		const calculatedStopLimit = (((width - followTextSpacingOffset) / 2 + followTextSpacingOffset) / width);

		$('#' + elementID).attr('material', 'shader: crop-text; npot: true; depthWrite: false; depthTest: ' + (respectDepth ? 'false' : 'false') + '; percent: ' + ratio + '; xOffset: 0');
		$('#' + elementID).attr('src', canvasDataURL);
		$('#' + elementID).attr('scale', calculatedXScale + ' ' + calculatedYScale + ' 1');
		$('#' + elementID).attr('position', calculatedXPosition + ' ' + (initialYOffset / containerHeight) + ' 0.005');

		if (width > textHolderWidth) {
			$('#' + elementID).attr('slide-text', 'percent: ' + ratio + '; xOffset: 0; stopLimit: ' + calculatedStopLimit + '; direction: ' + direction);
		}
	}

	img.src = "data:image/svg+xml;base64," + utoa(generatedSVGString);
}

// Write directly to a ShaderMaterial's uniform, bypassing A-Frame's material
// component schema (which doesn't know about custom shader uniforms and
// prints "Unknown property" warnings if you go through setAttribute).
function setShaderUniform(elementID, uniformName, value) {
	const el = document.getElementById(elementID);
	if (!el) return;
	const mesh = el.getObject3D('mesh');
	if (!mesh || !mesh.material || !mesh.material.uniforms) return;
	const uniform = mesh.material.uniforms[uniformName];
	if (uniform) uniform.value = value;
}

// Set the color on a standard THREE.Material directly (Color.set accepts hex
// strings like '#ff0000'). Same reason as setShaderUniform — avoids the
// material-schema warning when the shader's color prop isn't in the base schema.
function setMaterialColor(elementID, colorHex) {
	const el = document.getElementById(elementID);
	if (!el) return;
	const mesh = el.getObject3D('mesh');
	if (!mesh || !mesh.material || !mesh.material.color) return;
	mesh.material.color.set(colorHex);
}

// Updates the rendered text of an existing text entity in place without
// tearing down / recreating the a-image. Much cheaper than remove + call
// generateAFrameTextEntity again — preserves alternator state, avoids a
// frame with no texture, and doesn't reset slide-text animations.
// Positioning args (offsets, containerWidth/Height, direction) are fixed
// at creation time so they don't appear here.
function updateAFrameEntityText(elementID, text, fontSize, color, paddingTop, fontFamily, fontWeight, textHeight, isCentered, textHolderWidth, backgroundColor, hasShadow) {
	const el = document.getElementById(elementID);
	if (!el) return;

	const followTextSpacingOffset = 80.0;
	var ratio = 1.0;
	var width = calculateTextWidth(text.replace("&amp;", "&"), fontSize, fontFamily);

	if (width >= textHolderWidth) {
		width = width * 2 + followTextSpacingOffset;
		ratio = textHolderWidth / width;
	} else {
		width = textHolderWidth;
	}

	const generatedSVGString = generateTextSVG(text, fontSize, color, paddingTop, fontFamily, fontWeight, textHeight, isCentered, backgroundColor, textHolderWidth, hasShadow, width);
	const desiredCanvasWidth = width * 4.0;
	const desiredCanvasHeight = (textHeight + paddingTop) * 4.0;

	let img = new Image();
	img.crossOrigin = "Anonymous";
	img.onload = function () {
		let temporaryCanvas = document.createElement("CANVAS");
		let temporaryContext = temporaryCanvas.getContext('2d');
		temporaryCanvas.width = desiredCanvasWidth;
		temporaryCanvas.height = desiredCanvasHeight;
		temporaryContext.drawImage(this, 0, 0);
		const canvasDataURL = temporaryCanvas.toDataURL();

		el.setAttribute('src', canvasDataURL);
		setShaderUniform(elementID, 'percent', ratio);
	};
	img.src = "data:image/svg+xml;base64," + utoa(generatedSVGString);
}

// For twitter only right now
function generateAFrameMultiLineTextEntity(elementID, parentID, text, fontSize, color, fontFamily, fontWeight, backgroundColor, initialXOffset, initialYOffset, textHolderWidth, textHolderHeight, containerWidth, containerHeight) {
	$('<a-image/>', {
		id: elementID,
		rotation: '0 0 0',
		crossorigin: 'anonymous',
		material: 'shader: flat; npot: true; depthTest: false',
		side: 'double',
		transparent: true,
		// depthTest: true,
		npot: true,
		'anti-tear': ''
	}).appendTo(parentID);

	const svgDataURL = generateMultiLineTextSVGString(text, fontSize, color, fontFamily, fontWeight, backgroundColor, textHolderWidth, textHolderHeight);

	const calculatedXScale = textHolderWidth / containerWidth;
	const calculatedYScale = textHolderHeight / containerHeight;
	const calculatedXPosition = (-(((1 - (textHolderWidth / containerWidth)) / 2) - (initialXOffset / containerWidth)));
	const calculatedYPosition = ((textHolderHeight / containerHeight) / 2) - (initialYOffset / containerHeight);

	$('#' + elementID).attr('src', svgDataURL);
	$('#' + elementID).attr('scale', calculatedXScale + ' ' + calculatedYScale + ' 1');
	$('#' + elementID).attr('position', calculatedXPosition + ' ' + calculatedYPosition + ' 0.005');
}

function generateMultiLineTextSVGString(text, fontSize, color, fontFamily, fontWeight, backgroundColor, width, height) {
	const svgSizeMultiplier = 4.0;

	text = text.replace(/\@([^ ]*)/g, function (match, group) {
		return "<span>" + match + "</span>";
	});

	text = text.replace(/\#([^ ]*)/g, function (match, group) {
		return "<span>" + match + "</span>";
	});

	text = text.replace(/http([^ ]*)/g, function (match, group) {
		return "<span>" + match + "</span>";
	});

	var internalCSS = '<style>*{margin: 0}#textContainer{font-size: ' + (fontSize * svgSizeMultiplier) + 'px;color: ' + color + ';font-family: "' + fontFamily + '";font-weight: ' + fontWeight + ';width: ' + (width * svgSizeMultiplier) + 'px;height: ' + (height * svgSizeMultiplier) + ';z-index: -1;background-color:' + backgroundColor + ';overflow: hidden;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical}#textContainer span{color: #1d9bf0}</style>';

	var svgString = '<svg fill="none" width="' + (width * svgSizeMultiplier) + '" height="' + (height * svgSizeMultiplier) + '" viewBox="0 0 ' + (width * svgSizeMultiplier) + ' ' + (height * svgSizeMultiplier) + '" xmlns="http://www.w3.org/2000/svg" data-reactroot=""><foreignObject width="' + (width * svgSizeMultiplier) + '" height="' + (height * svgSizeMultiplier) + '"><div xmlns="http://www.w3.org/1999/xhtml">' + internalCSS + '<div id="textContainer"><p>' + text + '</p></div></div></foreignObject></svg>';

	return 'data:image/svg+xml;base64,' + utoa(svgString);
}

function generateTextSVG(text, fontSize, color, paddingTop, fontFamily, fontWeight, textHeight, isCentered, backgroundColor, textHolderWidth, hasShadow, width) {
	const svgSizeMultiplier = 4.0;
	const followTextSpacingOffset = 80.0;

	var internalCSS = '<style>@font-face{font-family: \'' + fontFamily + '\'; src:url( ' + FontDataURLDict[fontFamily] + ')}@font-face{font-family: \'NotoSans\'; src:url( ' + FontDataURLDict['NotoSans'] + ')}*{margin: 0}#container{display: flex;align-items: center;position: absolute;width: ' + (width * svgSizeMultiplier) + 'px;z-index: -1;white-space: nowrap; overflow: hidden; text-overflow: ellipsis;background-color:' + backgroundColor + '}#textContainer{font-size: ' + (fontSize * svgSizeMultiplier) + 'px;color: ' + color + ';padding-top: ' + (paddingTop * svgSizeMultiplier) + 'px;font-family: "' + fontFamily + '";font-weight: ' + fontWeight + ';height: ' + (textHeight * svgSizeMultiplier) + 'px;white-space: nowrap;overflow: hidden;' + (isCentered ? 'text-align: center;' : '') + (hasShadow ? 'text-shadow:1px 1px 5px #000;-webkit-text-stroke:0.3px #000;' : '') + '}#subContainer{display: flex;flex: 1;flex-direction: column}#textStart,#textFollow{display: inline-block}#textStart p, #textFollow p{position: relative}#textFollow p{left: ' + (followTextSpacingOffset * svgSizeMultiplier) + 'px}</style>';

	return '<svg crossorigin="anonymous" fill="none" width="' + (width * svgSizeMultiplier) + '" height="' + ((textHeight + paddingTop) * svgSizeMultiplier) + '" viewBox="0 0 ' + (width * svgSizeMultiplier) + ' ' + ((textHeight + paddingTop) * svgSizeMultiplier) + '" xmlns="http://www.w3.org/2000/svg" data-reactroot=""><foreignObject crossorigin="anonymous" width="' + (width * svgSizeMultiplier) + '" height="' + ((textHeight + paddingTop) * svgSizeMultiplier) + '"><div xmlns="http://www.w3.org/1999/xhtml">' + internalCSS + '<div id="container"><div id="subContainer"><div id="textContainer"><div id="textStart"><p>' + text + '</p></div>' + (width > textHolderWidth ? '<div id="textFollow"><p>' + text + '</p></div>' : '') + '</div></div></div></div></foreignObject></svg>';
}

function generateAFrameProgressBar(widgetName, parentID, progress, duration, color, isStatic, occludeLeftSide, containerHeight, containerWidth) {
	$('<a-image/>', {
		id: widgetName + 'WidgetProgressBar',
		rotation: '0 0 0',
		scale: '1 1 1',
		geometry: 'primitive: plane; segments-width: 100; segments-height: 100',
		side: 'double',
	}).appendTo(parentID);

	// console.log("progress: " + progress)
	// console.log("duration: " + duration)
	// console.log("progress / duration: "  + (progress / duration))

	$('#' + widgetName + 'WidgetProgressBar').attr('position', '0 0 0.0001');
	$('#' + widgetName + 'WidgetProgressBar').attr('material', 'shader: progress-bar; color: ' + color + '; xPercent: ' + (progress / duration) + ';aspectRatio: ' + (containerHeight / containerWidth) + ';depthTest: false; aGoodVariableName: ' + occludeLeftSide);

	if (!isStatic) {
		// Live progress: attach the animator component so the bar marches
		// forward in real time between data polls. Component writes directly
		// to the shader uniform each tick, starting from `progress` (ms) out
		// of `duration` (ms). Resets on widget rebuild (e.g. track change).
		$('#' + widgetName + 'WidgetProgressBar').attr(
			'progress-bar-animator',
			'startProgressMS: ' + progress + '; durationMS: ' + duration
		);
	}
}

async function generateVerticallySlidingImage(elementID, parentID, imageDataURL, imageWidth, imageHeight) {
	$('<a-image/>', {
		id: elementID,
		rotation: '0 0 0',
		crossorigin: 'anonymous',
		material: 'shader: vertical-image-slide; depthTest: true; transparent: false; npot: true; depthWrite: false;',
		side: 'double',
	}).appendTo(parentID);

	const calculatedYScale = (imageHeight / (imageWidth / 512.0)) / 128.0;
	const ratio = 128.0 / (imageHeight / calculatedYScale);
	const aspectRatio = (imageHeight / imageWidth);

	$('#' + elementID).attr('src', imageDataURL);
	$('#' + elementID).attr('scale', '1 ' + calculatedYScale + ' 1');
	$('#' + elementID).attr('position', '0 0 0');
	$('#' + elementID).attr('slide-image-vertical', 'percent: ' + ratio + ';aspectRatio: ' + aspectRatio);
}

function generateAFrameAlternatingLogo(elementID, parentID, position, rotation, scale, logoDataURL, otherDataURL) {
	$('<a-image/>', {
		id: elementID,
		rotation: rotation,
		scale: scale,
		crossorigin: 'anonymous',
		material: 'shader: flat',
		src: logoDataURL,
		side: 'double',
		depthTest: true,
		transparent: true,
		npot: true,
		'anti-tear': '',
		animation__fadein: 'property: material.opacity; dur: 1000; dir: normal; from: 0; to: 1; startEvents: fade-in; autoplay: false',
		animation__fadeout: 'property: material.opacity; dur: 1000; dir: normal; from: 1; to: 0; startEvents: fade-out; autoplay: false'
	}).appendTo(parentID);

	$('#' + elementID).attr('position', position);
	$('#' + elementID).attr('alternator', 'imageOneURL: ' + logoDataURL + '; imageTwoURL: ' + otherDataURL);
}

function generateAFrameAlternatingEntities(entities, controllingEntity) {
	var entitiesString = '';

	for (var entityIndex = 0; entityIndex < entities.length; entityIndex++) {
		// $('#' + entities[entityIndex]).on('fade-in', function() {
		// $(this).attr('visible', true);
		// $(this).attr('animation__fadein', 'property: material.opacity; dur: 1000; dir: normal; from: 0; to: 1; startEvents: fade-in; autoplay: false');
		// });

		// $('#' + entities[entityIndex]).on('fade-out', function() {
		// $(this).attr('visible', false);
		// $(this).attr('animation__fadeout', 'property: material.opacity; dur: 1000; dir: normal; from: 1; to: 0; startEvents: fade-out; autoplay: false');			
		// });

		entitiesString += '#' + entities[entityIndex] + ', ';
	}

	entitiesString = entitiesString.substring(0, entitiesString.length - 2);

	$('#' + controllingEntity).attr('alternate-entities', 'entityIDs: ' + entitiesString + '; numberOfEntities: ' + entities.length);
}

// A basic lerp function
function calculateAFrameProgressBarXScale(progress, duration) {
	return (0 + (1 - 0) * (progress / duration));
}

// eq: a + (b - a) * (progress / duration)
function calculateAFrameProgressBarXPosition(progress, duration) {
	return ((-0.5) + (0 - (-0.5)) * (progress / duration))
}

// Same eq for scale and progress bar
function calculateAFrameProgressBarXDuration(progress, duration) {
	return duration - progress;
}

widgetsToLoad = [];
function checkIfShouldHideLoader() {
	if (widgetsToLoad.length > 0) return;
	$('#loading').remove();
	$('#businessCardTouch').attr('position', '0 0 0');
	$('#scene').removeClass('not-ready');
}

