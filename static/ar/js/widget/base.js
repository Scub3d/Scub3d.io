'use strict';

class BaseWidget {
	dataDocumentID;
	data;
	emptyModel;
	updateIntervalMS = 30000;
	language;

	image;
	canvas;

	xPositionModifier = 1.05; //2.375
	zPositionModifier = 0.575;//1.375; //2.75

	staticAssetBaseURL = 'https://static.scub3d.io/';

	hasWidgetBeenCreatedForTheFirstTime;

	constructor(db, storage) {
		this.db = db;
		this.storage = storage;
	}

	registerForOnFinishedLoading() {
		widgetsToLoad.push(this.dataDocumentID);
	}

	async checkIfShouldUpdateWidget(newJSON) {
		const newdata = this.data.fromJSON(newJSON);

		if(!this.data.Equals(newdata)) {
			this.data = newdata;
			$("#" + this.dataDocumentID + 'WidgetEdgeMask').remove(); 
			$("#" + this.dataDocumentID + 'Widget').remove();
			await this.generateAFrameWidget();
		} else {
			return;
		}

		var raycasterEl = AFRAME.scenes[0].querySelector('[raycaster]');
		raycasterEl.components.raycaster.refreshObjects();
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
		window.setInterval(this.requestUpdatedJSON.bind(this), this.updateIntervalMS);
	}

	requestUpdatedJSON() {
		var xhttp = new XMLHttpRequest();
		xhttp.open("GET", 'https://us-central1-scub3d.cloudfunctions.net/' + this.dataDocumentID, true);
		xhttp.send(null);
	}

	makeRequest(method, url) {
		return new Promise(function (resolve, reject) {
			let xhr = new XMLHttpRequest();
			xhr.open(method, url);
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

	async blobToDataURL(blob) {
		return new Promise((fulfill, reject) => {
			let reader = new FileReader();
			reader.onerror = reject;
			reader.onload = (e) => fulfill(reader.result);
			reader.readAsDataURL(blob);
		})
	}
}