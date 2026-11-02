import {isAgentGithubBranchReference} from "./agentGithubBranchReview";
/** Stored review evidence only; never a permission or a promise to freeze refs. */
export function githubPullRequestReviewFromArgs(args:Record<string,unknown>):{kind:"github_pull_request";head:string;base:string;headSha:string;baseSha:string}|null {
 const value=args._review;if(!value||typeof value!=="object"||Array.isArray(value))return null;
 const review=value as Record<string,unknown>;
 if(review.kind!=="github_pull_request"||review.head!==args.head||review.base!==args.base||!isAgentGithubBranchReference(review.head)||!isAgentGithubBranchReference(review.base)||review.head===review.base||typeof review.headSha!=="string"||typeof review.baseSha!=="string"||!/^[a-f0-9]{40}$/.test(review.headSha)||!/^[a-f0-9]{40}$/.test(review.baseSha))return null;
 return{kind:"github_pull_request",head:review.head,base:review.base,headSha:review.headSha,baseSha:review.baseSha};
}
