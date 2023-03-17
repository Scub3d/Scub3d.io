const { getExternalAPIData, getExternalAPICookie, getExternalAPIDataWithCookies, getJSONParsedExternalAPIData, uploadExternalFileToBucket, deleteFirestoreDataForPath, getExternalHTML, generateCookieForHeader, parseCookieData, downloadFileFromURL, roundImage, uploadLocalFileToBucket } = require('../misc/common');
const { db, storage } = require('../misc/initFirebase');

const { v4: uuidv4 } = require('uuid');
const functions = require('firebase-functions');
const cors = require('cors')({origin: true});

const SERVER_SIDE_REFRESH_INTERVAL = 86400000
const SERVER_SIDE_DATA_REFRESH_INTERVAL = SERVER_SIDE_REFRESH_INTERVAL - 1000;

const USER_AGENT = 'Scub3d';

const PROFILE_IMAGE_BUCKET_PATH = 'ar/images/github/profileImage.png';

const BASE_URL = 'https://api.github.com';

function generateUserReposRequestOptions(auth) {
	return {
		method: 'GET',
		uri: BASE_URL + '/users/' + auth.username + '/repos',
		headers: {
			'User-Agent': USER_AGENT,
			'X-GitHub-Api-Version': '2022-11-28'
		},
		auth: {
			user: auth.username,
			password: auth.accessToken
		}
	}
}

function generateUserDetailsRequestOptions(auth) {
	return {
		method: 'GET',
		uri: BASE_URL + '/users/' + auth.username,
		headers: {
			'User-Agent': USER_AGENT,
			'X-GitHub-Api-Version': '2022-11-28'
		},
		auth: {
			user: auth.username,
			password: auth.accessToken
		}
	}
}

function generateRepoCommitsRequestOptions(auth, repoName) {
	return {
		method: 'GET',
		uri: BASE_URL + '/repos/' + auth.username + '/' + repoName + '/commits',
		headers: {
			'User-Agent': USER_AGENT,
			'X-GitHub-Api-Version': '2022-11-28'
		},
		auth: {
			user: auth.username,
			password: auth.accessToken
		}
	}
}

function generateCommitDetailsRequestOptions(auth, repoName, currentCommitSHA) {
	return {
		method: 'GET',
		uri: BASE_URL + '/repos/' + auth.username + '/' + repoName + '/commits/' + currentCommitSHA,
		headers: {
			'User-Agent': USER_AGENT,
			'X-GitHub-Api-Version': '2022-11-28'
		},
		auth: {
			user: auth.username,
			password: auth.accessToken
		}
	}
}

function generateRepoLanguagesRequestOptions(auth, repoName) {
	return {
		method: 'GET',
		uri: BASE_URL + '/repos/' + auth.username + '/' + repoName + '/languages',
		headers: {
			'User-Agent': USER_AGENT,
			'X-GitHub-Api-Version': '2022-11-28'
		},
		auth: {
			user: auth.username,
			password: auth.accessToken
		}
	}
}

function generateUserGistsRequestOptions(auth) {
	return {
		method: 'GET',
		uri: BASE_URL + '/users/' + auth.username + '/gists',
		headers: {
			'User-Agent': USER_AGENT,
			'X-GitHub-Api-Version': '2022-11-28'
		},
		auth: {
			user: auth.username,
			password: auth.accessToken
		}
	}
}

function generateGistsDetailsRequestOptions(auth, gistID) {
	return {
		method: 'GET',
		uri: BASE_URL + '/gists/' + gistID,
		headers: {
			'User-Agent': USER_AGENT,
			'X-GitHub-Api-Version': '2022-11-28'
		},
		auth: {
			user: auth.username,
			password: auth.accessToken
		}
	}
}

function generateGistHTMLRequestOptions(auth, gistID) {
	return {
		method: 'GET',
		uri: 'https://gist.github.com/' + auth.username + '/' + gistID,
		headers: {
			'User-Agent': USER_AGENT,
			'Accept': '*/*'
		}
	}
}


function generateCommitBranchRequestOptions(auth, repoName, commitSHA) {
	return {
		method: 'GET',
		uri: BASE_URL + '/repos/' + auth.username + '/' + repoName + '/commits/' + commitSHA + '/branches-where-head',
		headers: {
			'User-Agent': USER_AGENT,
			'X-GitHub-Api-Version': '2022-11-28'
		},
		auth: {
			user: auth.username,
			password: auth.accessToken
		}
	}
}

function generateRepoBranchesRequestOptions(auth, repoName) {
	return {
		method: 'GET',
		uri: BASE_URL + '/repos/' + auth.username + '/' + repoName + '/branches',
		headers: {
			'User-Agent': USER_AGENT,
			'X-GitHub-Api-Version': '2022-11-28'
		},
		auth: {
			user: auth.username,
			password: auth.accessToken
		}
	}
}

function generateRepoPullRequestsRequestOptions(auth, repoName) {
	return {
		method: 'GET',
		uri: BASE_URL + '/repos/' + auth.username + '/' + repoName + '/pulls',
		headers: {
			'User-Agent': USER_AGENT,
			'X-GitHub-Api-Version': '2022-11-28'
		},
		auth: {
			user: auth.username,
			password: auth.accessToken
		}
	}
}

function generateUserStarCountRequestOptions(auth) {
	return {
		method: 'GET',
		uri: BASE_URL + '/users/' + auth.username + '/starred',
		headers: {
			'User-Agent': USER_AGENT,
			'X-GitHub-Api-Version': '2022-11-28'
		},
		auth: {
			user: auth.username,
			password: auth.accessToken
		}
	}
}

function generateGistCommitsRequestOptions(auth, gistID) {
	return {
		method: 'GET',
		uri: BASE_URL + '/gists/' + gistID + '/commits',
		headers: {
			'User-Agent': USER_AGENT,
			'X-GitHub-Api-Version': '2022-11-28'
		},
		auth: {
			user: auth.username,
			password: auth.accessToken
		}
	}
}

function generateRepoDetailsRequestOptions(auth, repoName) {
	return {
		method: 'GET',
		uri: BASE_URL + '/repos/' + auth.username + '/' + repoName,
		headers: {
			'User-Agent': USER_AGENT,
			'X-GitHub-Api-Version': '2022-11-28'
		},
		auth: {
			user: auth.username,
			password: auth.accessToken
		}
	}
}


exports.github = functions.https.onRequest( async (req, res) => {	
	await cors(req, res, async () => {
		const authDocument = await db.collection('auth').doc('github').get();

		if(!authDocument.exists) {
			return res.send({'error': 'something went wrong, try again later'});
		}

		const auth = authDocument.data();

		const githubDocument = await db.collection('data').doc('github').get();

		// if(githubDocument.exists) {
		// 	if(Date.now() - githubDocument.data().timestamp <= SERVER_SIDE_DATA_REFRESH_INTERVAL) { 
		// 		return res.send(githubDocument.data());
		// 	} 
		// } 

		const userDetailsRequestOptions = generateUserDetailsRequestOptions(auth);
		const userDetailsData = await getJSONParsedExternalAPIData(userDetailsRequestOptions);
		const userDetailsJSON = await parseUserDetailsJSON(userDetailsData);
	
		const userReposRequestOptions = generateUserReposRequestOptions(auth);
		const userReposData = await getJSONParsedExternalAPIData(userReposRequestOptions);
		const userRepos = parseUserReposJSON(userReposData);

		var currentCommitJSON;
		var currentRepoJSON;

		for (repo of userRepos) {
			const repoCommitRequestOptions = generateRepoCommitsRequestOptions(auth, repo.repoName);
			const repoCommitData = await getJSONParsedExternalAPIData(repoCommitRequestOptions);

			if(currentCommitJSON === null || currentCommitJSON === undefined) {
				currentCommitJSON = repoCommitData;
				currentRepoJSON = repo;
			}

			if(repoCommitData[0]['commit']['author']['name'] === auth.username || repoCommitData[0]['commit']['author']['name'] === auth.alternateAuthorName) {
				if(Date.parse(currentCommitJSON[0]['commit']['author']['date']) < Date.parse(repoCommitData[0]['commit']['author']['date'])) {
					currentCommitJSON = repoCommitData;
					currentRepoJSON = repo;
				}
			}
		}

		
		const repoDetailsRequestOptions = generateRepoDetailsRequestOptions(auth, currentRepoJSON.repoName);
		const repoDetailsData = await getJSONParsedExternalAPIData(repoDetailsRequestOptions);
		const repoURL = repoDetailsData['html_url'];

		const commitDetailsRequestOptions = generateCommitDetailsRequestOptions(auth, currentRepoJSON.repoName, currentCommitJSON[0]['sha']);
		const commitDetailsData = await getJSONParsedExternalAPIData(commitDetailsRequestOptions);
		const parsedCommitJSON = parseCommitJSON(commitDetailsData);

		const commitBranchRequestOptions = generateCommitBranchRequestOptions(auth, currentRepoJSON.repoName, currentCommitJSON[0]['sha']);
		const commitBranchData = await getJSONParsedExternalAPIData(commitBranchRequestOptions);
		const commitBranch = commitBranchData[0]['name'];

		const repoLanguagesRequestOptions = generateRepoLanguagesRequestOptions(auth, currentRepoJSON.repoName);
		const repoLanguagesData = await getJSONParsedExternalAPIData(repoLanguagesRequestOptions);
		// console.log(JSON.stringify(repoLanguagesData));

		const repoBranchesRequestOptions = generateRepoBranchesRequestOptions(auth, currentRepoJSON.repoName);
		const repoBranchData = await getJSONParsedExternalAPIData(repoBranchesRequestOptions);
		const repoBranchCount = repoBranchData.length;

		const repoPullRequestsRequestOptions = generateRepoPullRequestsRequestOptions(auth, currentRepoJSON.repoName);
		const repoPullRequestsData = await getJSONParsedExternalAPIData(repoPullRequestsRequestOptions);
		const repoPullRequestsCount = repoPullRequestsData.length;

		const userGistsRequestOptions = generateUserGistsRequestOptions(auth);
		const userGistsData = await getJSONParsedExternalAPIData(userGistsRequestOptions);
		const gistID = parseUserGistsJSON(userGistsData);

		const gistDetailsRequestOptions = generateGistsDetailsRequestOptions(auth, gistID);
		const gistDetailsData = await getJSONParsedExternalAPIData(gistDetailsRequestOptions);
		const parsedGistDetailsJSON = parseGistDetailsJSON(gistDetailsData);

		const gistHTMLRequestOptions = generateGistHTMLRequestOptions(auth, parsedGistDetailsJSON['gistID']);
		const gistHTML = await getExternalHTML(gistHTMLRequestOptions);
		const gistStarCount = parseGistStarCountHTML(gistHTML.a);

		const userStarCountRequestOptions = generateUserStarCountRequestOptions(auth);
		const userStarCountData = await getJSONParsedExternalAPIData(userStarCountRequestOptions);
		const userStarCount = userStarCountData.length;

		const gistCommitsRequestOptions = generateGistCommitsRequestOptions(auth, gistID);
		const gistCommitsData = await getJSONParsedExternalAPIData(gistCommitsRequestOptions);
		const gistCommitSHA = gistCommitsData[0]['version'];

		const parsedJSON = Object.assign(userDetailsJSON, currentRepoJSON, parsedCommitJSON, { 'repoURL': repoURL }, { 'gistCommitSHA': gistCommitSHA }, { 'commitBranch': commitBranch }, parsedGistDetailsJSON, {'gistStarCount': gistStarCount}, { 'repoBranchCount': repoBranchCount }, { 'repoPullRequestsCount': repoPullRequestsCount }, { 'starCount': userStarCount });

		await db.collection('data').doc('github').set(parsedJSON);
		return res.send(parsedJSON);
	});
});

async function parseUserDetailsJSON(json) {
	const profileImageDownloadOptions = {
		method: 'GET',
		uri: json['avatar_url']
	};

	const profileImageLocalFilepath = await downloadFileFromURL(profileImageDownloadOptions, 'githubProfileImage', '.jpg');
	const roundedProfileImage = await roundImage(profileImageLocalFilepath, 'githubProfileImage', 256, 256);
	await uploadLocalFileToBucket(roundedProfileImage, PROFILE_IMAGE_BUCKET_PATH, 'image/png');

	return {
		repoCount: json['public_repos'],
		gistCount: json['public_gists'],
		followerCount: json['followers'],
		followingCount: json['following'],
		username: json['login'],
		timestamp: Date.now()
	};
}

function parseUserReposJSON(json) {
	var repos = [];

	for (repo of json) {
		repos.push({
			repoName: repo['name'],
			repoDescription: repo['description'],
			repoWatcherCount: repo['watchers'],
			repoStarCount: repo['stargazers_count'],
			repoForkCount: repo['forks'],
			repoOpenIssueCount: repo['open_issues'],
			repoCreatedDate: repo['created_at'],
			repoUpdatedDate: repo['updated_at']
		});
	}

	return repos;
}

function parseCommitJSON(json) {
	// const commitSummary = 

	return {
		commitSHA: json['sha'],//.substring(0,7),
		commitSummary: json['commit']['message'].split('\n\n')[0],
		// commitDescription: json['commit']['message'].split('\n\n')[1],
		commitFilesChanged: json['stats']['total'],
		commitFileAdditions: json['stats']['additions'],
		commitFileDeletions: json['stats']['deletions'],
		commitDate: json['commit']['author']['date']
	}
}

function parseUserGistsJSON(json) {
	return json[0]['id'];
}

function parseGistDetailsJSON(json) {
	return {
		gistID: json['id'],
		gistURL: json['html_url'],
		gistName: Object.keys(json['files'])[0],
		gistDescription: json['description'],
		gistFileCount: Object.keys(json['files']).length,
		gistCommentCount: json['comments'],
		gistForkCount: json['forks'].length,
		gistRevisionCount: json['history'].length,
		gistCreatedDate: json['created_at'],
		gistUpdatedDate: json['updated_at']
	}
}

function parseGistStarCountHTML(html) {
	return parseInt(html.split('social-count')[1].split('>')[1].split('<')[0].trim())
}




//https://skyline.github.com/scub3d/2021