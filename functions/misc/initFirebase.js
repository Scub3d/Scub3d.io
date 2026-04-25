const admin = require("firebase-admin");
const {Storage} = require("@google-cloud/storage");
const serviceAccount = require("../credentials.json");

// When running in the Firebase functions emulator with the storage emulator
// also enabled, route @google-cloud/storage through the emulator too.
// firebase-admin auto-detects via FIREBASE_STORAGE_EMULATOR_HOST, but the
// raw GCS SDK checks STORAGE_EMULATOR_HOST — forward the value so uploads
// land locally instead of prod when we're testing.
if(process.env.FIREBASE_STORAGE_EMULATOR_HOST && !process.env.STORAGE_EMULATOR_HOST) {
	process.env.STORAGE_EMULATOR_HOST = 'http://' + process.env.FIREBASE_STORAGE_EMULATOR_HOST;
	console.log('[emulator] Routing @google-cloud/storage to ' + process.env.STORAGE_EMULATOR_HOST);
}

admin.initializeApp({projectId: serviceAccount.project_id, credential: admin.credential.cert(serviceAccount), databaseUrl: "https://scub3d.firebaseio.com/"});
const storage = new Storage({projectId: serviceAccount.project_id, credentials: serviceAccount});
const db = admin.firestore();

module.exports = {admin, db, storage};
