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
import "./crm";

export {
  registerPlugin,
  getPlugin,
  listPlugins,
  listPluginsForTrack,
} from "./registry";
export type { PluginDefinition, PluginContext, PluginExecuteResult, PluginPermission } from "./types";
