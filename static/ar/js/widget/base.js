'use strict';

// Module-level cache for Firebase Storage getDownloadURL results.
// URLs are stable for the object's lifetime (tokens don't auto-rotate), and
// repeated Firestore metadata roundtrips on every widget rebuild are the
// dominant per-frame cost when data updates frequently.
const downloadURLCache = new Map();

function isOnEmulatorHost() {
	return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
}

// Build an emulator download URL directly from a storage ref, bypassing the
// SDK's getDownloadURL() call. Necessary because Firebase JS 7.22.0 hardcodes
// firebasestorage.googleapis.com for the metadata lookup that getDownloadURL
// performs — so any object that exists in the emulator but not prod 404s
// before the post-hoc host rewrite can fire. The emulator accepts the same
// /v0/b/{bucket}/o/{path} shape and is permissive about tokens.
function buildEmulatorDownloadURL(ref) {
	return 'http://localhost:9199/v0/b/' + ref.bucket + '/o/' + encodeURIComponent(ref.fullPath) + '?alt=media';
}

class BaseWidget {
	dataDocumentID;
	data;
	updateIntervalMS = 30000;

	xPositionModifier = 1.05; //2.375
	zPositionModifier = 0.575;//1.375; //2.75

	// On localhost we want static assets to come from the local dev server
	// (tooling/serve_ar_test.py serves /static/ar/… from the project tree) so
	// brand-new files that haven't been pushed to the prod CDN yet — e.g. a
	// freshly added widget logo — actually load instead of 404ing against
	// static.scub3d.io. The server-side rewrite in serve_ar_test.py only
	// catches literal URLs in .js files; URLs built by runtime concatenation
	// (like this.staticAssetBaseURL + '…') bypass it, which is why the switch
	// has to live here.
	staticAssetBaseURL = isOnEmulatorHost() ? '/static/' : 'https://static.scub3d.io/';

	hasWidgetBeenCreatedForTheFirstTime;

	// Functions that own side-effects tied to the current widget DOM (rAF loops,
	// intervals, three.js resources). Subclasses push here in generateAFrameHTML;
	// runCleanup is invoked before every teardown to prevent leaks.
	cleanupFunctions = [];

	constructor(db, storage) {
		this.db = db;
		this.storage = storage;
	}

	registerForOnFinishedLoading() {
		widgetsToLoad.push(this.dataDocumentID);
	}

	// versionKey: pass a widget field that changes whenever the content at
	// bucketPath is re-uploaded (e.g. trackID for Spotify's cover, appID for
	// Steam's game art). Leave null/undefined for assets that never change
	// (profile images, logos). A changing versionKey forces a fresh
	// getDownloadURL call AND appends a query param so the browser treats
	// the image as a new resource instead of serving stale bytes.
	async getCachedDownloadURL(bucketPath, versionKey) {
		const cacheKey = versionKey != null ? bucketPath + '|' + versionKey : bucketPath;
		if (downloadURLCache.has(cacheKey)) {
			return downloadURLCache.get(cacheKey);
		}
		const ref = this.storage.ref(bucketPath);
		let url = isOnEmulatorHost() ? buildEmulatorDownloadURL(ref) : await ref.getDownloadURL();
		if (versionKey != null) {
			url += '&_v=' + encodeURIComponent(versionKey);
		}
		downloadURLCache.set(cacheKey, url);
		return url;
	}

	runCleanup() {
		this.cleanupFunctions.forEach(fn => {
			try { fn(); } catch(err) { console.warn('cleanup error for ' + this.dataDocumentID + ':', err); }
		});
		this.cleanupFunctions = [];
	}

	async checkIfShouldUpdateWidget(newJSON) {
		const newdata = this.data.fromJSON(newJSON);

		if(this.data.Equals(newdata)) return;

		const oldData = this.data;
		this.data = newdata;

		// Try a partial update first — no DOM teardown, keeps animations
		// and avoids re-fetching media. Falls back to full rebuild if the
		// widget doesn't know how to patch this diff.
		let handled = false;
		if(this.hasWidgetBeenCreatedForTheFirstTime) {
			try {
				handled = await this.applyUpdate(oldData, newdata);
			} catch(err) {
				console.warn('applyUpdate failed for ' + this.dataDocumentID + ', falling back to full rebuild:', err);
				handled = false;
			}
		}

		if(!handled) {
			this.runCleanup();
			$("#" + this.dataDocumentID + 'WidgetEdgeMask').remove();
			$("#" + this.dataDocumentID + 'Widget').remove();
			await this.generateAFrameWidget();
		}

		var raycasterEl = AFRAME.scenes[0].querySelector('[raycaster]');
		raycasterEl.components.raycaster.refreshObjects();
	}

	// Override in subclasses to handle field-level updates in place.
	// Return true if the update was fully applied; false (or throw) to
	// trigger a full widget rebuild.
	async applyUpdate(oldData, newData) {
		return false;
	}

	async setListener() {
		await this.db.collection('data').doc(this.dataDocumentID).onSnapshot(async doc => {
			return this.checkIfShouldUpdateWidget(doc.data());
		});
	}

	async getExtraData() {

	}

	async generateAFrameHTML() {

	}

	async generateAFrameWidget() {
		await this.generateAFrameHTML();

		if(!this.hasWidgetBeenCreatedForTheFirstTime) {
			widgetsToLoad = widgetsToLoad.filter(widget => widget !== this.dataDocumentID)
			checkIfShouldHideLoader();
			this.hasWidgetBeenCreatedForTheFirstTime = true;
		}
	}

	setupUpdates() {
		// Stagger the first fire by a random offset within the widget's own
		// interval so widgets with identical updateIntervalMS don't all poll
		// (and potentially rebuild) on the same tick.
		const initialDelay = Math.random() * this.updateIntervalMS;
		window.setTimeout(() => {
			this.requestUpdatedJSON();
			window.setInterval(this.requestUpdatedJSON.bind(this), this.updateIntervalMS);
		}, initialDelay);
	}

	requestUpdatedJSON() {
		var xhttp = new XMLHttpRequest();
		xhttp.open("GET", 'https://us-central1-scub3d.cloudfunctions.net/' + this.dataDocumentID, true);
		xhttp.send(null);
	}
}