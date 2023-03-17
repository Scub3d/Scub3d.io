const admin = require("firebase-admin");
const {Storage} = require("@google-cloud/storage");
const serviceAccount = require("../credentials.json");

admin.initializeApp({projectId: serviceAccount.project_id, credential: admin.credential.cert(serviceAccount), databaseUrl: "https://scub3d.firebaseio.com/"});
const storage = new Storage();
const db = admin.firestore();

module.exports = {admin, db, storage};
