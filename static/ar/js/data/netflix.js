class NetflixData extends Data {
	timestamp;

	isMovie;

	showURL;

	movieTitle;
	seriesTitle;
	episodeTitle;

	progress;
	duration;

	constructor(timestamp, showURL, movieTitle, seriesTitle, episodeTitle, progress, duration) {
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
	}

	determineIfMovie(movieTitle) {
		if(movieTitle === null || movieTitle === undefined) return false;
		return true;
	}

	fromJSON(json) {
		return new NetflixData(json['timestamp'], json['showURL'], json['movieTitle'], json['seriesTitle'], json['episodeTitle'], json['progress'], json['duration']);
	}

	Equals(other) {
		return this.isMovie === other.isMovie && this.showURL === other.showURL && this.timestamp === other.timestamp && 
				this.movieTitle === other.movieTitle && this.seriesTitle === other.seriesTitle && 
				this.episodeTitle === other.episodeTitle && this.progress === other.progress && this.duration === other.duration;
	}
}