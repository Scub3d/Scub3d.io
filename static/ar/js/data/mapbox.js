class MapboxData extends Data {
	timestamp;
	roughLatitude;
	roughLongitude;
	featureID;
	placeNameShort;
	placeNameLong;
	
	constructor(timestamp, roughLatitude, roughLongitude, featureID, placeNameShort, placeNameLong) {
		super();

		this.timestamp = timestamp;
		this.roughLatitude = roughLatitude;
		this.roughLongitude = roughLongitude;
		this.featureID = featureID;
		this.placeNameShort = placeNameShort;
		this.placeNameLong = placeNameLong;
	}

	fromJSON(json) {
		return new MapboxData(json['timestamp'], json['roughLatitude'], json['roughLongitude'], json['featureID'], json['placeNameShort'], json['placeNameLong']);
	}

	Equals(other) {
		return this.roughLatitude === other.roughLatitude && this.roughLongitude === other.roughLongitude && this.featureID === other.featureID && this.placeNameShort === other.placeNameShort && this.placeNameLong === other.placeNameLong;
	}
}