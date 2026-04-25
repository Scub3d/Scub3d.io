const { getExternalAPIData, getExternalAPICookie, uploadExternalFileToBucketUsingCookies, getExternalAPIResponseStatus, getExternalAPIDataWithCookies, getJSONParsedExternalAPIData, uploadExternalFileToBucket, deleteFirestoreDataForPath, generateCookieForHeader, parseCookieData, getExternalHTML, cropImage, downloadFileFromURL, uploadLocalFileToBucket, roundImage,cropImageButKeepAspectRatio } = require('../misc/common');
const { db, storage } = require('../misc/initFirebase');
const { defeatRecaptchaV3Enterprise } = require('../misc/anticaptcha');

const { v4: uuidv4 } = require('uuid');
const functions = require('firebase-functions');
const cors = require('cors')({origin: true});
const querystring = require('querystring');

const SERVER_SIDE_REFRESH_INTERVAL = 3600000;
const SERVER_SIDE_DATA_REFRESH_INTERVAL = SERVER_SIDE_REFRESH_INTERVAL - 1000;

const PROFILE_IMAGE_BUCKET_PATH = 'ar/images/linkedin/profileImage.jpg';
const CURRENT_COMPANY_IMAGE_BUCKET_PATH = 'ar/images/linkedin/companyImage.jpg';

const DEFAULT_LANGUAGE_CODE = 'en';
const DEFAULT_LANGUAGE_COUNTRY = 'US';

async function acquireLoginCookies(auth) {
	const homePageRequestOptions = { 
		method: 'GET', 
		uri: 'https://www.linkedin.com/hp'
	};

	const homePagePageData = await getExternalAPIDataWithCookies(homePageRequestOptions);
	const homePageCookies = parseCookieData(homePagePageData.cookies);
	const loginCsrfParam = homePageCookies.bcookie.split("&")[1].split('"')[0];

	const form = {
		"session_key": auth.email,
		"session_password": auth.password,
		"loginCsrfParam": loginCsrfParam,
	};

	const loginRequestOptions = { 
		method: 'POST', 
		uri: 'https://www.linkedin.com/uas/login-submit', 
		headers: { 
			'Cookie': 'bcookie=' + homePageCookies.bcookie + '; JSESSIONID=' + homePageCookies.JSESSIONID,
			'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:106.0) Gecko/20100101 Firefox/106.0', 'content-type': 'application/x-www-form-urlencoded' 
		}, 
		body: querystring.stringify(form)
	};

	const loginPageCookies = await getExternalAPICookie(loginRequestOptions);
	return parseCookieData(loginPageCookies); 
}

async function acquireGraphQLQueryId(loginCookies) {
	const feedHomepageRequestOptions = {
		method: 'GET',
		uri: 'https://www.linkedin.com/feed/?trk=homepage-basic_signin-form_submit',
		headers: {
			'Cookie': 'JSESSIONID=' + loginCookies.JSESSIONID + '; li_at=' + loginCookies.li_at
		}
	}

	const feedHomepageHTML = await getExternalHTML(feedHomepageRequestOptions);

	const vendorJavascriptURL = feedHomepageHTML.a.split('" data-fastboot-src="/assets/vendor.js"')[0].split('<script src="').slice(-1)[0]

	const vendorJavascript = await getExternalHTML(vendorJavascriptURL);

	return vendorJavascript.a.split('define("graphql-queries/queries/profile/profile-cards-by-initial-cards.graphql"')[1].split('e.default=i({kind:"query",id:"')[1].split('"')[0];
	// return 'voyagerIdentityDashProfileCards.' + vendorJavascript.a.split('voyagerIdentityDashProfileCards.')[1].split('"')[0]
}

async function parseIdentityDashProfile(auth, loginCookies) {
	const identityDashProfileRequestOptions = { 
		method: 'GET', 
		uri: 'https://www.linkedin.com/voyager/api/identity/dash/profiles?q=memberIdentity&memberIdentity=' + auth.username, 
		headers: { 
			'Cookie': 'JSESSIONID=' + loginCookies.JSESSIONID + '; li_at=' + loginCookies.li_at, 
			'csrf-token': loginCookies.JSESSIONID.replace('"', '').replace('"', ''),
		}
	}

	const identityDashProfilePageData = await getJSONParsedExternalAPIData(identityDashProfileRequestOptions);


	console.log(identityDashProfilePageData['elements'][0]['profilePicture']['displayImage']['com.linkedin.common.VectorImage']['rootUrl'] + identityDashProfilePageData['elements'][0]['profilePicture']['displayImage']['com.linkedin.common.VectorImage']['artifacts'][2]['fileIdentifyingUrlPathSegment'])

	console.log(identityDashProfilePageData['elements'][0]['backgroundPicture']['displayImage']['com.linkedin.common.VectorImage']['rootUrl'] + identityDashProfilePageData['elements'][0]['backgroundPicture']['displayImage']['com.linkedin.common.VectorImage']['artifacts'][1]['fileIdentifyingUrlPathSegment'])


	const profileUrn = identityDashProfilePageData['elements'][0]['entityUrn'].split('urn:li:fsd_profile:')[1];

	let headlines = {};
	let supportedLanguages = [];

	for(var supportedLocalesIndex = 0; supportedLocalesIndex < identityDashProfilePageData['elements'][0]['supportedLocales'].length; supportedLocalesIndex++) {
		supportedLanguages.push({'languageCode': identityDashProfilePageData['elements'][0]['supportedLocales'][supportedLocalesIndex]['language'], 'languageCountry': identityDashProfilePageData['elements'][0]['supportedLocales'][supportedLocalesIndex]['country']});

		const languageKey = identityDashProfilePageData['elements'][0]['supportedLocales'][supportedLocalesIndex]['language'] + '_' + identityDashProfilePageData['elements'][0]['supportedLocales'][supportedLocalesIndex]['country'];
		headlines[languageKey] = identityDashProfilePageData['elements'][0]['multiLocaleHeadline'][languageKey];
	}

	return {
		profileUrn: profileUrn,
		profileJSON: {
			publicIdentifier: identityDashProfilePageData['elements'][0]['publicIdentifier'],
			headline: headlines,
		},
		supportedLanguages: supportedLanguages
	};
}

async function parseGraphQLProfileData(loginCookies, graphQLQueryId, profileUrn, supportedLanguages) {
	var hasUploadedCompanyLogo = false;
	var hasUploadedEducationLogo = false;
	var hasSetJobDate = false;
	var hasSetEducationDate = false;

	let graphQLProfileJSON = {
		jobLocation: {},
		jobDescription: {},
		jobTitle: {},
		jobSubtitle: {}
	};

	for(var supportedLanguagesIndex = 0; supportedLanguagesIndex < supportedLanguages.length; supportedLanguagesIndex++) {
		const languageKey = supportedLanguages[supportedLanguagesIndex]['languageCode'] + '_' + supportedLanguages[supportedLanguagesIndex]['languageCountry'];


		var graphQLURLVariables = '(profileUrn:urn:li:fsd_profile:' + profileUrn + ',locale:(language:' + supportedLanguages[supportedLanguagesIndex]['languageCode'] + ',country:' + supportedLanguages[supportedLanguagesIndex]['languageCountry'] + '))';

		if(languageKey === DEFAULT_LANGUAGE_CODE + '_' + DEFAULT_LANGUAGE_COUNTRY) {
			graphQLURLVariables = '(profileUrn:urn:li:fsd_profile:' + profileUrn + ')';
		}

		const graphQLProfileRequestOptions = { 
			method: 'GET', 
			uri: 'https://www.linkedin.com/voyager/api/graphql?includeWebMetadata=true&variables=' + graphQLURLVariables + '&queryId=' + graphQLQueryId, 
			headers: { 
				'Cookie': 'JSESSIONID=' + loginCookies.JSESSIONID + '; li_at=' + loginCookies.li_at, 
				'csrf-token': loginCookies.JSESSIONID.replace('"', '').replace('"', ''),
			}
		}

		const graphQLProfileData = await getJSONParsedExternalAPIData(graphQLProfileRequestOptions);

		for(var componentIndex = 0; componentIndex < graphQLProfileData['included'].length; componentIndex++) {
			if(graphQLProfileData['included'][componentIndex]['entityUrn'].includes('EXPERIENCE') && !graphQLProfileData['included'][componentIndex]['entityUrn']['VOLUNTEERING']) {
				var entityComponentJSON = graphQLProfileData['included'][componentIndex]['topComponents'][1]['components']['fixedListComponent']['components'][0]['entityComponent'];

				if(!hasUploadedCompanyLogo) {
					const companyUrn = entityComponentJSON['image']['attributes']['detailData']['*companyLogo'];

					for(var includedIndex = 0; includedIndex < graphQLProfileData['included'].length; includedIndex++) {
						if(graphQLProfileData['included'][includedIndex]['entityUrn'] === companyUrn) {
							const companyLogoURL = graphQLProfileData['included'][includedIndex]['logoResolutionResult']['vectorImage']['rootUrl'] + graphQLProfileData['included'][includedIndex]['logoResolutionResult']['vectorImage']['artifacts'][0]['fileIdentifyingUrlPathSegment'];


							hasUploadedCompanyLogo = true;
						}
					}
				}

				graphQLProfileJSON['jobLocation'][languageKey] = entityComponentJSON['metadata']['text'];

				if(!hasSetJobDate) {
					graphQLProfileJSON['jobDate'] = entityComponentJSON['caption']['text'];
				}

				graphQLProfileJSON['jobDescription'][languageKey] = entityComponentJSON['subComponents']['components'][0]['components']['fixedListComponent']['components'][0]['components']['textComponent']['text']['text'];
				graphQLProfileJSON['jobTitle'][languageKey] = entityComponentJSON['title']['text'];
				graphQLProfileJSON['jobSubtitle'][languageKey] = entityComponentJSON['subtitle']['text'];
			}

			if(graphQLProfileData['included'][componentIndex]['entityUrn'].includes['EDUCATION']) {
				if(!hasUploadedEducationLogo) {
					var entityComponentJSON = graphQLProfileData['included'][componentIndex]['topComponents'][1]['components']['fixedListComponent']['components'][0]['components']['entityComponent'];
					const educationUrn = entityComponentJSON['image']['attributes']['detailData']['*companyLogo'];

					for(var includedIndex = 0; includedIndex < graphQLProfileData['included'].length; includedIndex++) {
						if(graphQLProfileData['included'][includedIndex]['entityUrn'] === educationUrn) {
							const schoolLogoURL = graphQLProfileData['included'][includedIndex]['logoResolutionResult']['vectorImage']['rootUrl'] + graphQLProfileData['included'][includedIndex]['logoResolutionResult']['vectorImage']['artifacts'][0]['fileIdentifyingUrlPathSegment'];


							hasUploadedEducationLogo = true;
						}
					}
				}

				if(!hasSetEducationDate) {
					graphQLProfileJSON['educationDate'] = entityComponentJSON['caption']['text'];
				}

				graphQLProfileJSON['educationDescription'][languageKey] = entityComponentJSON['subComponents']['components'][0]['components']['insightComponent']['text']['text']['text'];
				graphQLProfileJSON['educationTitle'][languageKey] = entityComponentJSON['title']['text'];
				graphQLProfileJSON['educationSubtitle'][languageKey] = entityComponentJSON['subtitle']['text'];				
			}
		}
	}

	return graphQLProfileJSON;
}

exports.linkedin = functions.https.onRequest( async (req, res) => {	
	await cors(req, res, async () => {
		const authDocument = await db.collection('auth').doc('linkedin').get();

		if(!authDocument.exists) {
			return res.send({'error': 'something went wrong, try again later'});
		}

		const auth = authDocument.data();

		const linkedinDocument = await db.collection('data').doc('linkedin').get();

		if(linkedinDocument.exists) {
			if(Date.now() - linkedinDocument.data().timestamp <= SERVER_SIDE_DATA_REFRESH_INTERVAL) { 
				return res.send(linkedinDocument.data());
			} 
		}
		
		const loginCookies = await acquireLoginCookies(auth);
		const graphQLQueryId = await acquireGraphQLQueryId(loginCookies);

		const { profileUrn, profileJSON, supportedLanguages } = await parseIdentityDashProfile(auth, loginCookies);
		console.log("profileUrn: " + profileUrn);
		console.log("profileJSON: " + JSON.stringify(profileJSON));
		console.log("supportedLanguages: " + JSON.stringify(supportedLanguages));
		console.log("graphQLQueryId: " + graphQLQueryId);


		const graphQLProfileJSON = await parseGraphQLProfileData(loginCookies, graphQLQueryId, profileUrn, supportedLanguages);
		console.log("graphQLProfileJSON: " + JSON.stringify(graphQLProfileJSON));


		// const identityDashProfileRequestOptions = { 
		// 	method: 'GET', 
		// 	uri: 'https://www.linkedin.com/voyager/api/identity/dash/profiles?q=memberIdentity&memberIdentity=' + auth.username, 
		// 	headers: { 
		// 		'Cookie': 'JSESSIONID=' + loginCookies.JSESSIONID + '; li_at=' + loginCookies.li_at, 
		// 		'csrf-token': loginCookies.JSESSIONID.replace('"', '').replace('"', ''),
		// 	}
		// }

		// const identityDashProfilePageData = await getJSONParsedExternalAPIData(identityDashProfileRequestOptions);

		// // console.log("______________________________________________\n\n")
		// // console.log(JSON.stringify(identityDashProfilePageData));

		// const graphQLVariables = '(vieweeId:' + identityDashProfilePageData['elements'][0]['entityUrn'].split('urn:li:fsd_profile:')[1] + ')';


		// console.log(identityDashProfilePageData['elements'][0]['publicIdentifier'])
		// console.log(identityDashProfilePageData['elements'][0]['firstName'])
		// console.log(identityDashProfilePageData['elements'][0]['lastName'])
		// console.log(identityDashProfilePageData['elements'][0]['multiLocaleSummary']['en_US'])
		// console.log(identityDashProfilePageData['elements'][0]['multiLocaleHeadline']['en_US'])

		// console.log(identityDashProfilePageData['elements'][0]['headline'])
		// console.log(identityDashProfilePageData['elements'][0]['summary'])

		// console.log(identityDashProfilePageData['elements'][0]['profilePicture']['displayImage']['com.linkedin.common.VectorImage']['rootUrl'] + identityDashProfilePageData['elements'][0]['profilePicture']['displayImage']['com.linkedin.common.VectorImage']['artifacts'][2]['fileIdentifyingUrlPathSegment'])

		// console.log(identityDashProfilePageData['elements'][0]['supportedLocales'])

		// console.log(identityDashProfilePageData['elements'][0]['backgroundPicture']['displayImage']['com.linkedin.common.VectorImage']['rootUrl'] + identityDashProfilePageData['elements'][0]['backgroundPicture']['displayImage']['com.linkedin.common.VectorImage']['artifacts'][1]['fileIdentifyingUrlPathSegment'])

		// console.log('(profileUrn:' + identityDashProfilePageData['elements'][0]['entityUrn'] + ',sectionType:experience)')

		// console.log("\n\n______________________________________________")

		// const connectionsSummaryRequestOptions = { 
		// 	method: 'GET', 
		// 	uri: 'https://www.linkedin.com/voyager/api/relationships/connectionsSummary', 
		// 	headers: { 
		// 		'Cookie': 'JSESSIONID=' + loginCookies.JSESSIONID + '; li_at=' + loginCookies.li_at, 
		// 		'csrf-token': loginCookies.JSESSIONID.replace('"', '').replace('"', '') 
		// 	}
		// }

		// const connectionsSummaryJSON = await getJSONParsedExternalAPIData(connectionsSummaryRequestOptions);

		// const numberOfConnections = connectionsSummaryJSON['data']['numConnections'];


		// const parsedJSON = Object.assign(homeHubJSON, contentStateJSON);
		// await db.collection('data').doc('linkedin').set(parsedJSON);
		// return res.send(parsedJSON);

		return res.send(":)");
	});
});
