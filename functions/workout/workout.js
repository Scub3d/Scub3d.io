// Read-side endpoint for the AR workout widget. Returns the single
// `data/workout` doc (maintained by the ingest endpoints). The widget
// primarily reads via Firestore's onSnapshot listener in BaseWidget; this
// HTTP endpoint exists so the widget's periodic `requestUpdatedJSON`
// poll has something to hit (and so external clients / debugging can
// inspect widget state without Firestore creds).

const { db } = require('../misc/initFirebase');
const functions = require('firebase-functions');
const cors = require('cors')({ origin: true });

exports.workout = functions.https.onRequest(async (req, res) => {
	await cors(req, res, async () => {
		const snap = await db.doc('data/workout').get();
		return res.send(snap.exists ? snap.data() : { empty: true, timestamp: Date.now() });
	});
});
