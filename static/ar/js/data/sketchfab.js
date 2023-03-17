class SketchfabData extends Data {
	timestamp;

	username;
	modelsCount;
	followerCount;
	followingCount;

	modelID;
	modelName;
	modelURL;
	modelVertexCount;
	modelFaceCount;
	modelDownloadCount;
	modelViewCount;
	modelLikeCount;

	previousModelID;

	constructor(timestamp, username, modelsCount, followerCount, followingCount, modelID, modelName, modelURL, modelVertexCount, 
				modelFaceCount, modelDownloadCount, modelViewCount, modelLikeCount, previousModelID) {
		super();

		this.timestamp = timestamp;

		this.username = username;
		this.modelsCount = modelsCount;
		this.followerCount = followerCount;
		this.followingCount = followingCount;

		this.modelID = modelID;
		this.modelName = modelName;
		this.modelURL = modelURL;
		this.modelVertexCount = modelVertexCount;
		this.modelFaceCount = modelFaceCount;
		this.modelDownloadCount = modelDownloadCount;
		this.modelViewCount = modelViewCount;
		this.modelLikeCount = modelLikeCount;

		this.previousModelID = previousModelID;
	}

	fromJSON(json) {
		return new SketchfabData(json['timestamp'], json['username'], json['modelsCount'], json['followerCount'], json['followingCount'], 
			json['modelID'], json['modelName'], json['modelURL'], json['modelVertexCount'], json['modelFaceCount'], json['modelDownloadCount'], 
			json['modelViewCount'], json['modelLikeCount'], json['previousModelID']);
	}

	Equals(other) {
		return this.username === other.username && this.modelsCount === other.modelsCount && this.followerCount === other.followerCount && 
				this.followingCount === other.followingCount && this.modelID === other.modelID && this.modelName === other.modelName && 
				this.modelURL === other.modelURL && this.modelVertexCount === other.modelVertexCount && this.modelFaceCount === other.modelFaceCount && 
				this.modelDownloadCount === other.modelDownloadCount && this.modelViewCount === other.modelViewCount && this.modelLikeCount === other.modelLikeCount;
	}
}