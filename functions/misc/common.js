const { db, admin, storage } = require('./initFirebase');

const firebaseTools = require('firebase-tools');
const request = require('request').defaults({ encoding: null });;
const { getColorFromURL, getPaletteFromURL } = require('color-thief-node');
const rgbHex = require('rgb-hex');
const stream = require('stream');
const fs = require('fs');
const { exec } = require('child_process');
const os = require('os');
const path = require('path');
// const spawn = require('child-process-promise').spawn;
const mkdirp = require('mkdirp');

const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffmpeg = require('fluent-ffmpeg');
const ffmpeg_static = require('ffmpeg-static');
const sharp = require('sharp');
var ffprobe = require('ffprobe'), ffprobeStatic = require('ffprobe-static');

const BUCKET_NAME = 'dynamic.scub3d.io';

module.exports = {
	isEmptyObject: function(obj) {
		return !Object.keys(obj).length;
	},
	shuffle: function(array) { // not mine, got from stackoverflow to fix non-randomness issue, seems to work
		var i = array.length, j = 0, temp;

		while (i--) {
			j = Math.floor(Math.random() * (i+1));
			temp = array[i];
			array[i] = array[j];
			array[j] = temp;
		}

		return array;
	},
	getColorLuma: function(color) {
		var rgb = parseInt(color, 16);   // convert rrggbb to decimal
		var r = (rgb >> 16) & 0xff;  // extract red
		var g = (rgb >>  8) & 0xff;  // extract green
		var b = (rgb >>  0) & 0xff;  // extract blue

		return 0.2126 * r + 0.7152 * g + 0.0722 * b; // per ITU-R BT.709
	}
};

async function getExternalAPICookie(options) {
	return new Promise(function(resolve, reject) {
		request(options, function(error, response, body) {
			// console.log("\n\n ")
			// console.log(JSON.stringify(options));
			// console.log(response.statusCode)
			// console.log(JSON.stringify(response.headers));
			// console.log("\n\n")
			if(!error && response.statusCode === 200 || response.statusCode === 302 || response.statusCode === 303) {
				resolve(response.headers['set-cookie']);
			} else if(!error && (response.statusCode === 204 || response.statusCode === 400)) {
				resolve({});
			} else {
				reject(error);
			}
		});
	});
}

async function getExternalAPIData(options) {
	return new Promise(function(resolve, reject) {
		request(options, function(error, response, body) {
			// console.log("\n\n")
			// console.log(JSON.stringify(options));
			// console.log(response.statusCode)
			// console.log(JSON.stringify(response.headers));
			// console.log("\n\n")
			if(!error && (response.statusCode === 200 || response.statusCode === 201 || response.statusCode === 302)) {
				resolve(body);
			} else if(!error && (response.statusCode === 204 || response.statusCode === 400)) {
				resolve({});
			} else {
				reject(error);
			}
		});
	});
}

async function getExternalAPIDataWithCookies(options) {
	return new Promise(function(resolve, reject) {
		request(options, function(error, response, body) {
			// if(response === undefined) {
			// 	console.log("UNDEFINED RESPONSE")
			// } else {
			// 	console.log(JSON.stringify(response.headers));
			// }
			// console.log("\n\n ")
			// console.log(JSON.stringify(options));
			// console.log(response.statusCode)
			// console.log(JSON.stringify(response.headers))
			// // console.log("b: "+ body);
			// console.log("\n\n ")
			if(!error && (response.statusCode === 200 || response.statusCode === 201)) {
				resolve({ cookies: response.headers['set-cookie'], data: body });
			} else {
				console.log('_____________________________________________\n\nERROR ERROR ERROR ERROR ERROR\n\n')

				console.log("Error: " + error);

				console.log('\n\nERROR ERROR ERROR ERROR ERROR\n\n_____________________________________________')

				reject(error);
			}
		});
	});
}

async function getJSONParsedExternalAPIData(options) {
	return new Promise(function(resolve, reject) {
		request(options, function(error, response, body) {
			// console.log("\n\n")
			// console.log(JSON.stringify(options));
			// console.log(response.statusCode)
			// console.log(JSON.parse(body));
			// console.log(JSON.stringify(body));
			// console.log("\n\n")
			if(!error && (response.statusCode === 200 || response.statusCode === 201 || response.statusCode === 302)) {
				resolve(JSON.parse(body));
			} else if(!error && (response.statusCode === 204 || response.statusCode === 400 || response.statusCode === 401 || response.statusCode === 404)) {
				resolve({});
			} else {
				reject(error);
			}
		});
	});
}

async function getJSONParsedExternalAPIDataFromFailedRequest(options) {
	return new Promise(function(resolve, reject) {
		request(options, function(error, response, body) {
			// console.log("\n\n")
			// console.log(JSON.stringify(options));
			// console.log(response.statusCode)
			// // console.log(JSON.parse(body));
			// console.log("\n\n")
			if(!error && (response.statusCode === 403)) {
				resolve(JSON.parse(body));
			} else if(!error && (response.statusCode === 204 || response.statusCode === 400 || response.statusCode === 401 || response.statusCode === 404)) {
				resolve({});
			} else {
				reject(error);
			}
		});
	});	
}

async function getExternalAPIResponseStatus(options) {
	return new Promise(function(resolve, reject) {
		request(options, function(error, response, body) {
			if(!error) {
				resolve(response.statusCode);
			} else {
				reject(error);
			}
		});
	});
}

async function getExternalFileData(url) {
	const options = {
		method: 'GET', 
		url: url
	};

	return new Promise(function(resolve, reject) {
		request(options, function(error, response, body) {
			if(!error && response.statusCode === 200) {
				resolve(Buffer.from(body).toString('base64'));
			} else {
				reject(error);
			}
		});
	});
}

// async function getExternalJS()

async function getExternalHTML(options) {
	return new Promise(function(resolve, reject) {
		request(options, function(error, response, body) {
			// console.log("\n\n")
			// console.log(JSON.stringify(options));
			// console.log(response.statusCode)
			// console.log(error);
			// console.log("\n\n")
			if(!error && response.statusCode === 200) {
				resolve({a: Buffer.from(body).toString(), c: JSON.stringify(body)});
			} else {
				reject(error);
			}
		});
	});
}

async function getExternalHTMLWithCookies(options) {
	return new Promise(function(resolve, reject) {
		request(options, function(error, response, body) {
			if(!error && response.statusCode === 200) {
				resolve({ cookies: response.headers['set-cookie'], html: Buffer.from(body).toString() });
			} else {
				reject(error);
			}
		});
	});
}

async function getExternalFileDataWithCookies(url, cookies) {
	const options = {
		method: 'GET', 
		url: url,
		headers: {
			'Cookie': cookies
		}
	};

	return new Promise(function(resolve, reject) {
		request(options, function(error, response, body) {
			if(!error && response.statusCode === 200) {
				resolve(Buffer.from(body).toString('base64'));
			} else {
				reject(error);
			}
		});
	});
}

async function downloadFileFromURL(options, localFilename, fileExtension) {
	const tmpDir = os.tmpdir();
	const tempLocalFile = path.join(tmpDir, localFilename + fileExtension);
	await mkdirp(tmpDir)

	return new Promise(function(resolve, reject) {
		request(options, function(error, response, body) {
			// console.log("Error: " + error);
			// console.log("Response: " + response.statusCode);
			if(!error && response.statusCode === 200) {
				fs.writeFile(tempLocalFile, body, function(err) {
					resolve(tempLocalFile);
				});
			} else {
				reject(error);
			}
		});
	});
}

async function uploadLocalFileToBucket(localPath, destinationPath, contentType) {
	await storage.bucket(BUCKET_NAME).upload(localPath, {destination: destinationPath});
}

async function setFileMetadata(filepath, metadata) {
	await storage.bucket(BUCKET_NAME).file(filepath).setMetadata(metadata);
}

async function uploadExternalFileToBucket(url, destinationPath, contentType) {
	const base64 = await getExternalFileData(url);
	const buffer = Buffer.from(base64, 'base64');

	try {
		await uploadFile(buffer, destinationPath, contentType);
	} catch(e) {
		console.trace(e);
	}
}

async function uploadExternalFileToBucketUsingCookies(url, cookies, destinationPath, contentType) {
	const base64 = await getExternalFileDataWithCookies(url, cookies);
	const buffer = Buffer.from(base64, 'base64');

	try {
		await uploadFile(buffer, destinationPath, contentType);
	} catch(e) {
		console.trace(e);
	}
}

async function uploadFile(buffer, destinationPath, contentType) {
	const dataStream = new stream.PassThrough();
	dataStream.push(buffer);
	dataStream.push(null);

	const writeStream = storage.bucket(BUCKET_NAME).file(destinationPath).createWriteStream({
		gzip: true,
		resumable: false,
		metadata   : {
			'Cache-Control': 'public, max-age=3600'
		}
	})

	return new Promise((resolve, reject) => {
		dataStream.pipe(writeStream).on('error', (error) => { 
			reject(error);
		}).on('finish', () => { 
			resolve(true)
		})
	});
}

// async function uploadLocalFile(file, bucketPath) {
// 	return new Promise((resolve, reject) => {
// 		const { originalname, buffer } = file;
// 		const blob = bucket.file(originalname.replace(/ /g, "_"));
// 		const blobStream = blob.createWriteStream({
// 			resumable: false
// 		});

// 		blobStream.on('finish', () => {
// 			const publicUrl = format('https://storage.googleapis.com/static.scub3d.io/' + bucketPath);
// 			resolve(publicUrl);
// 		}).on('error', () => {
// 			reject(`Unable to upload file, something went wrong`)
// 		}).end(buffer)
// 	});
// }

async function getColorPaletteForImage(url) {
	colorPalette = await getPaletteFromURL(url);
	
	colors = []

	for(var colorIndex = 0; colorIndex < colorPalette.length; colorIndex++) {
		colors.push(rgbHex(colorPalette[colorIndex][0], colorPalette[colorIndex][1], colorPalette[colorIndex][2]));
	}

	return new Promise(function(resolve, reject) {
		resolve(colors);
	});
}

async function deleteFirestoreDataForPath(path) {
	const cred = admin.app().options.credential;
	
	if (!cred) {
		throw new Error('Admin credential was undefined');
	}

	const access_token = (await cred.getAccessToken()).access_token;

	await firebaseTools.firestore.delete(path, {
		project: "scub3d",
		recursive: true,
		yes: true,
		token: access_token
	});
}

async function deleteStorageDataWithPrefix(pathPrefix) {
	const [files] = await storage.bucket(BUCKET_NAME).getFiles({ prefix: pathPrefix });

	for(var fileIndex = 0; fileIndex < files.length; fileIndex++) {
		await files[fileIndex].delete();
	}
}

function parseCookieData(cookieData) {
	var cookies = {};

	cookieData.forEach(cookie => {
		const key = cookie.split("=")[0];
		const value = cookie.split(key + "=")[1].split(";")[0];
		cookies[key] = value;
	});

	return cookies;
}

function generateCookieForHeader(key, value) {
	return key + "=" + value;
}

async function convertToMP4(localPath) {
	// await spawn('ffmpeg', ['-i', localPath, '-f', 'mp4', localPath + '.mp4']); 		       
}

async function getFFProbeMetadata(localURL) {
	return new Promise((resolve, reject) => {
		ffprobe(localURL, { path: ffprobeStatic.path }, function (err, info) {
			if(err) {
				console.log("err: " + err);
				reject(undefined);
			}
			console.log("info: "+ info);
			resolve(info['streams'][0]);
		});
	});	
}

async function cropMP4File(localFilepath, localFilename, desiredOutputVideoWidth, desiredCroppedVideoHeight) {
	// console.log("lfp: " + localFilepath);
	// console.log("lfn: " + localFilename)
	const localDir = path.dirname(localFilepath);
	// console.log("ld: "+ localDir);

	const croppedLocalFilepath = localFilepath.replace(localFilename, 'cropped_' + localFilename.split('.')[0] + '.mp4');
	// console.log("CLF: " + croppedLocalFilepath);

	const metadata = await getFFProbeMetadata(localFilepath);

	const videoWidth = metadata['width'];
	const videoHeight = metadata['height'];
	const croppedVideoHeight = videoWidth * (desiredCroppedVideoHeight / desiredOutputVideoWidth);
	const yOffset = (videoHeight - croppedVideoHeight) / 2

	const filter = 'crop=' + videoWidth + ':' + croppedVideoHeight + ':0:' + yOffset;

	const TARGET_VIDEO_HEIGHT = 128;
	const outputVideoHeightRatio = TARGET_VIDEO_HEIGHT / croppedVideoHeight;

	let outputVideoWidth = Math.round(videoWidth * outputVideoHeightRatio);
	let outputVideoHeight = TARGET_VIDEO_HEIGHT;

	if(outputVideoHeightRatio > 1) {
		outputVideoWidth = videoWidth;
		outputVideoHeight = videoHeight;
	}

	let command = ffmpeg(localFilepath).setFfmpegPath(ffmpegPath).toFormat('mp4').noAudio().videoFilters(filter).output(croppedLocalFilepath).size(outputVideoWidth + 'x' + outputVideoHeight);

	await promisifyCommand(command);

	return croppedLocalFilepath;
}

async function cropImageButKeepAspectRatio(localFilepath, localFilename, desiredWidth, desiredHeight) {
	const localDir = path.dirname(localFilepath);
	const croppedLocalFilepath = localFilepath.replace(localFilename, 'croppedWithAspectRatio_' + localFilename);

	const metadata = await sharp(localFilepath).metadata();

	const desiredRatio = desiredWidth / desiredHeight;

	const imageWidth = metadata['width'];
	const imageHeight = metadata['height'];

	const croppedImageWidth = imageHeight * (desiredWidth / desiredHeight);
	const xOffset = (imageWidth - croppedImageWidth) / 2;

	const croppedImageHeight = imageWidth * (desiredHeight / desiredWidth);
	const yOffset = (imageHeight - croppedImageHeight) / 2;

	const filter = 'crop=' + (croppedImageWidth > croppedImageHeight ? imageWidth : croppedImageWidth) + ':' + (croppedImageHeight > croppedImageWidth ? imageHeight : croppedImageHeight) + ':' + (xOffset < 0 ? 0 : xOffset) + ':' + (yOffset < 0 ? 0 : yOffset);
	console.log("filter: " + filter)
	let command = ffmpeg(localFilepath).setFfmpegPath(ffmpegPath).videoFilters(filter).output(croppedLocalFilepath).size(desiredWidth + 'x' + desiredHeight);

	await promisifyCommand(command);

	return croppedLocalFilepath;
}

async function cropImage(localFilepath, localFilename, desiredWidth, desiredHeight) {
	const localDir = path.dirname(localFilepath);
	const croppedLocalFilepath = localFilepath.replace(localFilename, 'cropped_' + localFilename);
	// const croppedLocalFilepath = localFilepath.split(localFilename)[0] + 'rounded_' + localFilename;

	const metadata = await sharp(localFilepath).metadata();

	const imageWidth = metadata['width'];
	const imageHeight = metadata['height'];

	const xOffset = (imageWidth - desiredWidth) / 2;

	const yOffset = (imageHeight - desiredHeight) / 2;

	const filter = 'crop=' + desiredWidth + ':' + desiredHeight + ':' + xOffset + ':' + yOffset;

	let command = ffmpeg(localFilepath).setFfmpegPath(ffmpegPath).videoFilters(filter).output(croppedLocalFilepath).size(desiredWidth + 'x' + desiredHeight);

	await promisifyCommand(command);

	return croppedLocalFilepath;
}

// has to be a .png?
async function roundImage(localFilepath, localFilename, targetWidth, targetHeight) {
	const localDir = path.dirname(localFilepath);

	const roundedLocalFilepath = localFilepath.split(localFilename)[0] + 'rounded_' + localFilename.split('.')[0] + '.png';

	const metadata = await sharp(localFilepath).metadata();

	const imageWidth = metadata['width'];
	const imageHeight = metadata['height'];

	let width, height, radius;

	if(imageWidth > targetWidth && imageHeight > targetHeight) {
		width = targetWidth;
		height = targetHeight;
	} else {
		width = imageWidth;
		height = imageHeight;
	}

	radius = width / 2;

	const circleShape = Buffer.from('<svg><circle cx="' + radius + '" cy="' + radius + '" r="' + radius + '" /></svg>');

	await sharp(localFilepath).resize(targetWidth, targetHeight).composite([{
		input: circleShape,
		blend: 'dest-in'
	}]).toFile(roundedLocalFilepath); //.png()?

	return roundedLocalFilepath;
}

async function resizeImage(localFilepath, localFilename, targetWidth, targetHeight) {
	const localDir = path.dirname(localFilepath);
	const resizedLocalFilepath = localFilepath.replace(localFilename, 'resized_' + localFilename);

	const metadata = await sharp(localFilepath).metadata();

	const imageWidth = metadata['width'];
	const imageHeight = metadata['height'];

	let width, height;

	if(imageWidth >= targetWidth && imageHeight >= targetHeight) {
		width = targetWidth;
		height = targetHeight;
	} else {
		width = imageWidth;
		height = imageHeight;
	}

	await sharp(localFilepath).resize(targetWidth, targetHeight).toFile(resizedLocalFilepath);
	return resizedLocalFilepath;
}

async function resizeImageV2(localFilepath, localFilename, targetWidth, targetHeight) {
	const localDir = path.dirname(localFilepath);
	const resizedLocalFilepath = localFilepath.replace(localFilename, 'resizedV2_' + localFilename);

	const metadata = await sharp(localFilepath).metadata();

	const imageWidth = metadata['width'];
	const imageHeight = metadata['height'];

	let width, height;

	if(imageWidth >= targetWidth && imageHeight >= targetHeight) {
		width = targetWidth;
		height = targetHeight;
	} else {
		width = imageWidth;
		height = imageHeight;
	}

	await sharp(localFilepath).resize(targetWidth, targetHeight, {fit: 'cover', position: 'center'}).toFile(resizedLocalFilepath);
	return resizedLocalFilepath;
}

// For mapbox only
async function roundImageCorners(localFilepath, localFilename) {
	const localDir = path.dirname(localFilepath);

	const roundedCornerLocalFilepath = localFilepath.split(localFilename)[0] + 'rounded_corners_' + localFilename.split('.')[0] + '.png';
	const roundedRectangle = Buffer.from('<svg><rect width="512" height="128" rx="32" /></svg>');

	await sharp(localFilepath).resize(512, 128, {fit: 'cover', position: 'center'}).composite([{
		input: roundedRectangle,
		blend: 'dest-in'
	}]).toFile(roundedCornerLocalFilepath);

	return roundedCornerLocalFilepath;
}

async function promisifyCommand(command) {
	return new Promise((resolve, reject) => {
		command.on('end', resolve).on('error', reject).run();
	});
}

async function getFFProbeMetadata(localURL) {
	return new Promise((resolve, reject) => {
		ffprobe(localURL, { path: ffprobeStatic.path }, function (err, info) {
			if(err) reject(undefined);
			resolve(info['streams'][0]);
		});
	});	
}

module.exports.getExternalAPICookie = getExternalAPICookie;
module.exports.getExternalAPIData = getExternalAPIData;
module.exports.getExternalAPIDataWithCookies = getExternalAPIDataWithCookies;
module.exports.getJSONParsedExternalAPIData = getJSONParsedExternalAPIData;
module.exports.getExternalFileData = getExternalFileData;
module.exports.uploadLocalFileToBucket = uploadLocalFileToBucket;
module.exports.uploadExternalFileToBucket = uploadExternalFileToBucket;
module.exports.uploadFile = uploadFile;
module.exports.getColorPaletteForImage = getColorPaletteForImage;
module.exports.deleteFirestoreDataForPath = deleteFirestoreDataForPath;
module.exports.deleteStorageDataWithPrefix = deleteStorageDataWithPrefix;
module.exports.downloadFileFromURL = downloadFileFromURL;
module.exports.parseCookieData = parseCookieData;
module.exports.generateCookieForHeader = generateCookieForHeader;
module.exports.getExternalAPIResponseStatus = getExternalAPIResponseStatus;
module.exports.uploadExternalFileToBucketUsingCookies = uploadExternalFileToBucketUsingCookies;
module.exports.getExternalFileDataWithCookies = getExternalFileDataWithCookies;
module.exports.getExternalHTML = getExternalHTML;
module.exports.convertToMP4 = convertToMP4;
module.exports.cropMP4File = cropMP4File;
module.exports.cropImage = cropImage;
module.exports.cropImageButKeepAspectRatio = cropImageButKeepAspectRatio;
module.exports.roundImage = roundImage;
module.exports.getJSONParsedExternalAPIDataFromFailedRequest = getJSONParsedExternalAPIDataFromFailedRequest;
module.exports.getExternalHTMLWithCookies = getExternalHTMLWithCookies;
module.exports.setFileMetadata = setFileMetadata;
module.exports.resizeImageV2 = resizeImageV2;
module.exports.roundImageCorners = roundImageCorners;