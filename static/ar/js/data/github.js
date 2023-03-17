class GitHubData extends Data {
	timestamp;
	username;

	followerCount;
	followingCount;
	reposCount;
	gistsCount;
	starCount;

	repoName;
	repoDescription;
	repoURL;
	repoWatcherCount;
	repoStarCount;
	repoForkCount;
	repoOpenIssueCount;
	repoBranchCount;
	repoPullRequestsCount;
	repoCreatedDate;
	repoUpdatedDate;

	commitSHA;
	commitSummary;
	commitFilesChanged;
	commitFileAdditions;
	commitFileDeletions;
	commitBranch;
	commitDate;

	gistID;
	gistName;
	gistDescription;
	gistURL;
	gistCommitSHA;
	gistFileCount;
	gistCommentCount;
	gistStarCount;
	gistForkCount;
	gistRevisionCount;
	gistCreatedDate;
	gistUpdatedDate;

	constructor(timestamp, username, followerCount, followingCount, reposCount, gistsCount, starCount, repoName, repoDescription, 
				repoURL, repoWatcherCount, repoStarCount, repoForkCount, repoOpenIssueCount, repoBranchCount, repoPullRequestsCount, 
				repoCreatedDate, repoUpdatedDate, commitSHA, commitSummary, commitFilesChanged, commitFileAdditions, commitFileDeletions, 
				commitBranch, commitDate, gistID, gistName, gistDescription, gistURL, gistCommitSHA, gistFileCount, gistCommentCount, 
				gistStarCount, gistForkCount, gistRevisionCount, gistCreatedDate, gistUpdatedDate) {
		super();

		this.timestamp = timestamp;
		this.username = username;
		this.followerCount = followerCount;
		this.followingCount = followingCount;
		this.reposCount = reposCount;
		this.gistsCount = gistsCount;
		this.starCount = starCount;

		this.repoName = repoName;
		this.repoDescription = repoDescription;
		this.repoURL = repoURL;
		this.repoWatcherCount = repoWatcherCount;
		this.repoStarCount = repoStarCount;
		this.repoForkCount = repoForkCount;
		this.repoOpenIssueCount = repoOpenIssueCount;
		this.repoBranchCount = repoBranchCount;
		this.repoPullRequestsCount = repoPullRequestsCount;
		this.repoCreatedDate = repoCreatedDate;
		this.repoUpdatedDate = repoUpdatedDate;

		this.commitSHA = commitSHA;
		this.commitSummary = commitSummary;
		this.commitFilesChanged = commitFilesChanged;
		this.commitFileAdditions = commitFileAdditions;
		this.commitFileDeletions = commitFileDeletions;
		this.commitBranch = commitBranch;
		this.commitDate = commitDate;

		this.gistID = gistID;
		this.gistName = gistName;
		this.gistDescription = gistDescription;
		this.gistURL = gistURL;
		this.gistCommitSHA = gistCommitSHA;
		this.gistFileCount = gistFileCount;
		this.gistCommentCount = gistCommentCount;
		this.gistStarCount = gistStarCount;
		this.gistForkCount = gistForkCount;
		this.gistRevisionCount = gistRevisionCount;
		this.gistCreatedDate = gistCreatedDate;
		this.gistUpdatedDate = gistUpdatedDate;
	}

	fromJSON(json) {
		return new GitHubData(json['timestamp'], json['username'], json['followerCount'], json['followingCount'], 
			json['repoCount'], json['gistCount'], json['starCount'], json['repoName'], json['repoDescription'], json['repoURL'],
			json['repoWatcherCount'], json['repoStarCount'], json['repoForkCount'], json['repoOpenIssueCount'], json['repoBranchCount'], json['repoPullRequestsCount'],
			json['repoCreatedDate'], json['repoUpdatedDate'], json['commitSHA'], json['commitSummary'], json['commitFilesChanged'], 
			json['commitFileAdditions'], json['commitFileDeletions'], json['commitBranch'], json['commitDate'], 
			json['gistID'], json['gistName'], json['gistDescription'], json['gistURL'], json['gistCommitSHA'], json['gistFileCount'], json['gistCommentCount'], 
			json['gistStarCount'], json['gistForkCount'], json['gistRevisionCount'], json['gistCreatedDate'], json['gistUpdatedDate']);
	}

	Equals(other) {
		return this.username === other.username && this.followerCount === other.followerCount && 
				this.followingCount === other.followingCount && this.reposCount === other.reposCount && 
				this.gistsCount === other.gistsCount && this.starCount === other.starCount && 
				this.repoName === other.repoName && this.repoDescription === other.repoDescription && this.repoURL === other.repoURL &&
				this.repoWatcherCount === other.repoWatcherCount && this.repoStarCount === other.repoStarCount && 
				this.repoForkCount === other.repoForkCount && this.repoOpenIssueCount === other.repoOpenIssueCount && 
				this.repoBranchCount === other.repoBranchCount && this.repoPullRequestsCount === other.repoPullRequestsCount
				this.repoCreatedDate === other.repoCreatedDate && this.repoUpdatedDate === other.repoUpdatedDate && 
				this.commitSHA === other.commitSHA && this.commitSummary === other.commitSummary && 
				this.commitFilesChanged === other.commitFilesChanged && this.commitFileAdditions === other.commitFileAdditions && 
				this.commitFileDeletions === other.commitFileDeletions && this.commitBranch === other.commitBranch && 
				this.commitDate === other.commitDate && this.gistID === other.gistID && this.gistName === other.gistName && 
				this.gistDescription === other.gistDescription && this.gistURL === other.gistURL && this.gistCommitSHA === other.gistCommitSHA && 
				this.gistFileCount === other.gistFileCount && this.gistCommentCount === other.gistCommentCount && this.gistStarCount === other.gistStarCount && 
				this.gistForkCount === other.gistForkCount && this.gistRevisionCount === other.gistRevisionCount && 
				this.gistCreatedDate === other.gistCreatedDate && this.gistUpdatedDate === other.gistUpdatedDate;
	}
}