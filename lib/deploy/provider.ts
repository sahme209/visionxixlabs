import { generateSiteFiles, generateSiteFilesFromPlan, type WebsiteBuilderPlan } from "../scaffoldGenerator";
import type { AIStarterPackage } from "@/lib/websiteStarter/engine";

import {runPlatformEffect} from '@/lib/governance/platform/effectExecution';
import {preparePlatformVercelDeployment,readPlatformDeploymentResponse} from './platformDeployment';

export type DeployProvider = "vercel" | "aws" | "azure" | "gcp";
export class UnsupportedDeploymentProviderError extends Error {
  readonly code = "deployment_provider_not_supported";
  constructor() {
    super("Deployment provider is not supported by the website preview service.");
    this.name = "UnsupportedDeploymentProviderError";
  }
}

function assertSupportedProvider(provider: unknown): asserts provider is "vercel" {
  if (provider !== "vercel") throw new UnsupportedDeploymentProviderError();
}

export type DeployResult = { url: string; deploymentId: string; state: string; target?: string };

export type DeployOptions = {
  projectName: string;
  target?: "production";
  credentials?: Record<string, string>;
  platformExecution?: object;
  effectId?: string;
};

/**
 * Deploy from website-builder plan (full HTML).
 */
export async function deploySiteFromPlan(
  provider: DeployProvider,
  plan: WebsiteBuilderPlan,
  options: DeployOptions
): Promise<DeployResult> {
  assertSupportedProvider(provider);
  const files = generateSiteFilesFromPlan(plan);
  if (files.length === 0) throw new Error("No HTML generated from plan");
  return deployToVercel(files, options);
}

/**
 * Provider abstraction for multi-cloud deploy.
 * deploySite(provider, pkg, options) — generates files and deploys to chosen provider.
 */
export async function deploySite(
  provider: DeployProvider,
  pkg: AIStarterPackage,
  options: DeployOptions
): Promise<DeployResult> {
  assertSupportedProvider(provider);
  const files = generateSiteFiles(pkg);

  return deployToVercel(files, options);
}

async function deployToVercel(
  files: { path: string; content: string }[],
  options: DeployOptions
): Promise<DeployResult> {
  if(!options.platformExecution||typeof options.platformExecution!=='object')throw Error('platform_governance_effect_unavailable');
  const teamId=process.env.VERCEL_TEAM_ID??'';
  const prepared=preparePlatformVercelDeployment(files,{projectName:options.projectName,teamId,target:options.target,effectId:options.effectId});
  const expectedEnvironment=prepared.effect.target.environment;
  const data=await runPlatformEffect(options.platformExecution,prepared.effect,async beforeSend=>{
    const token=process.env.VERCEL_TOKEN||options.credentials?.vercelToken;
    if(!token)throw Error('platform_deployment_credentials_unavailable');
    await beforeSend();
    if(process.env.VERCEL_TEAM_ID!==teamId||(process.env.VERCEL_TOKEN||options.credentials?.vercelToken)!==token)throw Error('platform_deployment_configuration_changed');
    const response=await fetch('https://api.vercel.com/v13/deployments',{
      method:'POST',redirect:'error',signal:AbortSignal.timeout(15000),
      headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json','x-vercel-team-id':teamId},body:prepared.body,
    });
    const raw=await readPlatformDeploymentResponse(response);
    if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('platform_deployment_result_unconfirmed');
    const result=raw as {url?:unknown;id?:unknown;readyState?:unknown;state?:unknown;target?:unknown;alias?:unknown};
    if(typeof result.id!=='string'||!/^dpl_[A-Za-z0-9]+$/.test(result.id)||(expectedEnvironment==='production'?result.target!=='production':result.target!==undefined&&result.target!==null&&result.target!=='preview'))throw Error('platform_deployment_result_unconfirmed');
    return {outcome:'confirmed',value:result};
  });
  const rawUrl = typeof data.url === "string" ? data.url : Array.isArray(data.alias) && typeof data.alias[0] === "string" ? data.alias[0] : "";
  let url = "";
  if (rawUrl) {
    try {
      const parsed = new URL(rawUrl.includes("://") ? rawUrl : `https://${rawUrl}`);
      if (parsed.protocol === "https:" && !parsed.username && !parsed.password) url = rawUrl.includes("://") ? rawUrl : `https://${rawUrl}`;
    } catch { /* an accepted request need not have a serving URL */ }
  }
  const reportedState = typeof data.readyState === "string" ? data.readyState : typeof data.state === "string" ? data.state : "UNKNOWN";
  return {
    url,
    deploymentId: typeof data.id === "string" ? data.id : "",
    state: reportedState.toUpperCase(),
    ...(typeof data.target === "string" ? { target: data.target } : {}),
  };
}

async function deployToAws(
  _files: { path: string; content: string }[],
  _options: DeployOptions
): Promise<DeployResult> {
  return { url: "https://visionxixlabs.com/contact", deploymentId: "aws-pending", state: "PENDING" };
}

async function deployToAzure(
  _files: { path: string; content: string }[],
  _options: DeployOptions
): Promise<DeployResult> {
  return {
    url: "https://visionxixlabs.com/contact",
    deploymentId: "azure-pending",
    state: "PENDING",
  };
}

async function deployToGcp(
  _files: { path: string; content: string }[],
  _options: DeployOptions
): Promise<DeployResult> {
  return {
    url: "https://visionxixlabs.com/contact",
    deploymentId: "gcp-pending",
    state: "PENDING",
  };
}
