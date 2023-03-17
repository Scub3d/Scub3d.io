const anticaptcha = require("@antiadmin/anticaptchaofficial");
const { db, storage } = require('../misc/initFirebase');

module.exports = {
	defeatRecaptchaV3Enterprise: async function(domain, sitekey) {
		const authDocument = await db.collection('auth').doc('anticaptcha').get();

		if(!authDocument.exists) {
			return res.send({'error': 'something went wrong, try again later'});
		}

		const auth = authDocument.data();

		anticaptcha.setAPIKey(auth.apiKey);

		return await anticaptcha.solveRecaptchaV3Enterprise(domain, sitekey, 0.7, '').then(gresponse => {
			return gresponse;
		}).catch(error => console.log('Error. Unable to defeat captcha. Message: ' + error));
	},
	defeatRecaptchaV3: async function(domain, sitekey) {
		const authDocument = await db.collection('auth').doc('anticaptcha').get();

		if(!authDocument.exists) {
			return res.send({'error': 'something went wrong, try again later'});
		}

		const auth = authDocument.data();

		anticaptcha.setAPIKey(auth.apiKey);

		return await anticaptcha.solveRecaptchaV3(domain, sitekey, 0.7, '').then(gresponse => {
			console.log('------------------------------\n\n');

			console.log(gresponse);

			console.log('\n\n------------------------------');
			return gresponse;
		}).catch(error => console.log('Error. Unable to defeat captcha. Message: ' + error));
	}
}