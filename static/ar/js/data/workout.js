class WorkoutData extends Data {
	timestamp;

	// When present, a workout is currently in progress — widget shows the
	// active face. When null/absent, the widget shows the weekly/monthly
	// rollups on the inactive face.
	activeWorkout;                  // { type, startTime, deviceName, ingestedAt } | null

	// Latest completed workout (for the breadcrumb on the inactive face).
	latest;                         // { workoutId, type, startIso, durationSec, activeEnergyKcal, avgHR, ... } | null

	// Three timescale rollups, each with the same shape so the widget
	// renders them with one code path.
	daily;
	weekly;
	monthly;

	standHoursAvailable;            // if false, the inner ring represents workoutCount instead

	constructor(json) {
		super();
		if (!json) return;
		this.timestamp = json['timestamp'];
		this.activeWorkout = json['activeWorkout'] || null;
		this.latest = json['latest'] || null;
		this.daily = json['daily'] || null;
		this.weekly = json['weekly'] || null;
		this.monthly = json['monthly'] || null;
		this.standHoursAvailable = !!json['standHoursAvailable'];
	}

	fromJSON(json) {
		return new WorkoutData(json);
	}

	Equals(other) {
		if (!other) return false;
		// Cheap field-by-field check — all primitives or small objects.
		return this._sameActive(other) &&
			this._sameLatest(other) &&
			this._sameBucket('daily', other) &&
			this._sameBucket('weekly', other) &&
			this._sameBucket('monthly', other) &&
			this.standHoursAvailable === other.standHoursAvailable;
	}

	_sameActive(other) {
		const a = this.activeWorkout, b = other.activeWorkout;
		if (!a && !b) return true;
		if (!a || !b) return false;
		return a.type === b.type && a.startTime === b.startTime;
	}

	_sameLatest(other) {
		const a = this.latest, b = other.latest;
		if (!a && !b) return true;
		if (!a || !b) return false;
		return a.workoutId === b.workoutId;
	}

	_sameBucket(key, other) {
		const a = this[key], b = other[key];
		if (!a && !b) return true;
		if (!a || !b) return false;
		return a.activeEnergyKcal === b.activeEnergyKcal &&
			a.activeMinutes === b.activeMinutes &&
			a.standHours === b.standHours &&
			a.workoutCount === b.workoutCount;
	}

	isActive() {
		return !!this.activeWorkout;
	}

	activeWorkoutAgeSec() {
		if (!this.activeWorkout || !this.activeWorkout.startTime) return null;
		const t = new Date(this.activeWorkout.startTime).getTime();
		return Math.max(0, (Date.now() - t) / 1000);
	}

	// Normalized ring cluster for a timescale — slot structure matches
	// what RingCluster.setProgress() expects. Inner ring is stand hours
	// when HAE has reported them, otherwise falls back to workout count.
	ringCluster(timescale) {
		const b = this[timescale];
		if (!b) return null;
		const innerProgress = this.standHoursAvailable ? b.standHours : b.workoutCount;
		const innerGoal = this.standHoursAvailable ? b.goalStandHours : b.goalWorkoutCount;
		return {
			move:     { progress: b.activeEnergyKcal || 0, goal: b.goalActiveEnergyKcal || 1 },
			exercise: { progress: b.activeMinutes || 0,    goal: b.goalActiveMinutes || 1 },
			stand:    { progress: innerProgress || 0,       goal: innerGoal || 1 },
		};
	}
}
