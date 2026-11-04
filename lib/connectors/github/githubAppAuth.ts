/**
 * GitHub App authentication.
 *
 * Mints the two-stage credential GitHub Apps require:
 *
 *   1. **App JWT** — signed with the App's private key (RS256). Valid for
 *      10 minutes. Identifies "this is App #N" to GitHub.
 *   2. **Installation access token** — POST to
 *      /app/installations/{id}/access_tokens with the App JWT. Returns a
 *      short-lived (1 hour) bearer token scoped to one installation.
 *
 * The installation token is what the rest of the platform actually uses
 * to read repos / workflows / branch protection on behalf of the
 * installed organisation.
 *
 * This module caches each installation-token scope in-memory until ~5 minutes
 * before its real expiry, so we don't pay the JWT-sign + HTTP round-trip on
 * every API call. The cache is bounded and expired entries are discarded on
 * writes. A token narrowed to selected repositories never shares a cache entry
 * with an installation-wide token.
 *
 * Hard rules:
 *  - Never returns the private key or the JWT. Only the installation
 *    token is exposed to other modules.
 *  - Never logs key material — error messages strip BEGIN/END PRIVATE
 *    KEY blocks.
 *  - Server-only. Imports `node:crypto`.
 */

import "server-only";

import { createGithubAppAuthCore } from "./githubAppAuthCore";
export type { InstallationTokenResult, InstallationTokenError, InstallationTokenOutcome, GithubReadPermissionProfile, GithubAppInstallationMetadata } from "./githubAppAuthCore";
import { getGithubConfig, resolveGithubAppPrivateKey } from "./githubConfig";
import {createGithubReleaseAuthCore} from "./githubReleaseAuthCore";
export type {ReleaseTokenPurpose,ReleaseInstallationEligibilityBinding,ReleaseInstallationEligibilityInput} from "./githubReleaseAuthCore";


const legacyAuth = createGithubAppAuthCore({getGithubConfig,resolveGithubAppPrivateKey,fetch:(...args)=>fetch(...args),now:()=>Date.now()});
export const {resolveGithubInstallationToken,readGithubAppInstallation,clearInstallationTokenCache,purgeInstallationTokenCache} = legacyAuth;
const legacyReleaseAuth=createGithubReleaseAuthCore({getGithubConfig,resolveGithubAppPrivateKey,now:()=>Date.now(),transportForRequest:input=>input.fetch});
export const {resolveReleaseInstallationToken,readReleaseInstallationEligibility,consumeReleaseInstallationEligibility}=legacyReleaseAuth;
