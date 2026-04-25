class AllTrailsData extends Data {
	timestamp;

	// Profile
	username;
	reputation;
	reviews;
	completed;
	favorites;
	following;
	followers;
	tracks;
	maps;
	photos;
	lists;

	// Lifetime totals (metric) read directly from /members/{slug}/stats.
	lifetimeDistanceMeters;
	lifetimeElevationGainMeters;
	lifetimeMovingSeconds;

	// Trail identity
	mapID;
	trailID;
	trailName;
	trailRouteType;

	// Native (unpadded) bounds of the default trail — for display or sanity checks.
	trailLatitudeTopLeft;
	trailLatitudeBottomRight;
	trailLongitudeTopLeft;
	trailLongitudeBottomRight;

	// Trail-aligned 4:1 rectangle. Server rotates + crops the satellite to
	// this frame; widget mesh vertices map to world lat/lng via the bearing
	// rotation. Terrain RGB is axis-aligned and bounded by terrainMin/Max*.
	paddedCenterLat;
	paddedCenterLng;
	paddedBearingRadians;   // CCW from east; long axis direction in world
	paddedLongMeters;       // widget display long extent
	paddedShortMeters;      // widget display short extent
	terrainMinLat;          // axis-aligned bbox enclosing the rotated rect;
	terrainMaxLat;          // widget samples terrain RGB at each vertex's
	terrainMinLng;          // world lat/lng within this frame.
	terrainMaxLng;

	// Stats (activity-level).
	trailTotalTime;
	trailTotalDistance;
	trailElevationGain;
	trailElevationLoss;
	trailElevationMax;
	trailMovingTime;

	constructor(json) {
		super();
		if(!json) return;
		this.timestamp = json['timestamp'];
		this.username = json['username'];
		this.reputation = json['reputation'];
		this.reviews = json['reviews'];
		this.completed = json['completed'];
		this.favorites = json['favorites'];
		this.following = json['following'];
		this.followers = json['followers'];
		this.tracks = json['tracks'];
		this.maps = json['maps'];
		this.photos = json['photos'];
		this.lists = json['lists'];
		this.lifetimeDistanceMeters = json['lifetimeDistanceMeters'];
		this.lifetimeElevationGainMeters = json['lifetimeElevationGainMeters'];
		this.lifetimeMovingSeconds = json['lifetimeMovingSeconds'];
		this.mapID = json['mapID'];
		this.trailID = json['trailID'];
		this.trailName = json['trailName'];
		this.trailRouteType = json['trailRouteType'];
		this.trailLatitudeTopLeft = json['trailLatitudeTopLeft'];
		this.trailLatitudeBottomRight = json['trailLatitudeBottomRight'];
		this.trailLongitudeTopLeft = json['trailLongitudeTopLeft'];
		this.trailLongitudeBottomRight = json['trailLongitudeBottomRight'];
		this.paddedCenterLat = json['paddedCenterLat'];
		this.paddedCenterLng = json['paddedCenterLng'];
		this.paddedBearingRadians = json['paddedBearingRadians'];
		this.paddedLongMeters = json['paddedLongMeters'];
		this.paddedShortMeters = json['paddedShortMeters'];
		this.terrainMinLat = json['terrainMinLat'];
		this.terrainMaxLat = json['terrainMaxLat'];
		this.terrainMinLng = json['terrainMinLng'];
		this.terrainMaxLng = json['terrainMaxLng'];
		this.trailTotalTime = json['trailTotalTime'];
		this.trailTotalDistance = json['trailTotalDistance'];
		this.trailElevationGain = json['trailElevationGain'];
		this.trailElevationLoss = json['trailElevationLoss'];
		this.trailElevationMax = json['trailElevationMax'];
		this.trailMovingTime = json['trailMovingTime'];
	}

	fromJSON(json) {
		return new AllTrailsData(json);
	}

	Equals(other) {
		// Treat mapID as the cache key — when the user's latest activity
		// changes, every derived asset (satellite, terrain, polyline, photos,
		// stats) changes together. No point diffing field-by-field.
		return this.mapID === other.mapID &&
			this.username === other.username &&
			this.reputation === other.reputation &&
			this.reviews === other.reviews &&
			this.completed === other.completed &&
			this.favorites === other.favorites &&
			this.following === other.following &&
			this.followers === other.followers &&
			this.tracks === other.tracks &&
			this.maps === other.maps &&
			this.photos === other.photos &&
			this.lists === other.lists &&
			this.lifetimeDistanceMeters === other.lifetimeDistanceMeters &&
			this.lifetimeElevationGainMeters === other.lifetimeElevationGainMeters &&
			this.lifetimeMovingSeconds === other.lifetimeMovingSeconds;
	}

	orientedBounds() {
		return {
			midLat: this.paddedCenterLat,
			midLng: this.paddedCenterLng,
			bearingRadians: this.paddedBearingRadians,
			longMeters: this.paddedLongMeters,
			shortMeters: this.paddedShortMeters,
			terrain: {
				minLat: this.terrainMinLat, maxLat: this.terrainMaxLat,
				minLng: this.terrainMinLng, maxLng: this.terrainMaxLng
			}
		};
	}
}
