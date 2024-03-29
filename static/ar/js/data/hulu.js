class HuluData extends Data {
	timestamp;

	isMovie;

	showURL;

	movieTitle;
	seriesTitle;
	episodeTitle;

	progress;
	duration;

	eab;

	constructor(timestamp, showURL, movieTitle, seriesTitle, episodeTitle, progress, duration, eab) {
		super();
		this.isMovie = false;

		this.showURL = showURL;

		if(this.determineIfMovie(movieTitle)) {
			this.isMovie = true;
			this.movieTitle = movieTitle;
		} else {
			this.seriesTitle = seriesTitle;
			this.episodeTitle = episodeTitle;
		}

		this.timestamp = timestamp;
		this.progress = progress;
		this.duration = duration;
		this.eab = eab;
	}

	determineIfMovie(movieTitle) {
		if(movieTitle === null || movieTitle === undefined) return false;
		return true;
	}

	fromJSON(json) {
		return new HuluData(json['timestamp'], json['showURL'], json['movieTitle'], json['seriesTitle'], json['episodeTitle'], json['progress'], json['duration'], json['eab']);
	}

	Equals(other) {
		return this.isMovie === other.isMovie && this.showURL === other.showURL && this.movieTitle === other.movieTitle && 
				this.seriesTitle === other.seriesTitle && this.episodeTitle === other.episodeTitle && this.eab === other.eab;
	}
}