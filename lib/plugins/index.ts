/**
 * Plugin system — load all plugins and export registry.
 */

import "./aws";
import "./azure";
import "./gcp";
import "./deployment";
import "./analytics";
import "./domain-dns";
import "./monitoring";
import "./monitoring-builder";
import "./crm";
import "./hosting";
import "./storage";
import "./cicd";

export {
  registerPlugin,
  getPlugin,
  listPlugins,
  listPluginsForTrack,
} from "./registry";
export type { PluginDefinition, PluginContext, PluginExecuteResult, PluginPermission } from "./types";
