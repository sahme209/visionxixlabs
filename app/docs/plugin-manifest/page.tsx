import type { Metadata } from "next";
import { DocFooterNav, DocHeader, DocSection } from "@/components/docs/DocPrimitives";
import { EXAMPLE_PLUGIN_MANIFEST } from "@/lib/plugins/pluginManifest";
export const metadata: Metadata = { title: "Plugin manifest — V19 Documentation", description: "Describe a V19 plugin in one JSON manifest: its MCP server, tools, events and requested scopes.", alternates: { canonical: "/docs/plugin-manifest" } };
export default function PluginManifestGuide() {
 return <>
  <DocHeader kicker="Workspace · Plugins" title="Describe a plugin in one file." summary="A V19 plugin is a hosted MCP server plus a manifest that says what it offers and what it asks for. A valid manifest grants nothing on its own." />
  <DocSection id="fields" kicker="01" title="What the manifest contains">
   <p>The manifest is JSON with <code>kind</code> set to <code>v19.plugin</code> and <code>version</code> set to 1. It names the plugin (<code>id</code>, <code>name</code>, <code>pluginVersion</code> in semantic versioning), the publisher (name, website and a security contact) and up to three categories.</p>
   <p><code>transport</code> is the public https address of the plugin&apos;s MCP server (streamable HTTP). Local addresses and plain http are refused.</p>
   <p><code>tools</code> lists every tool the server offers, up to 50. Each tool says whether it only reads (<code>readOnly</code>). A tool that writes must describe its <code>effect</code>, which is shown to the person approving it.</p>
   <p><code>webhookEvents</code> lists V19 events the plugin wants, and <code>apiScopes</code> lists API key scopes it asks for. Only the scopes a workspace owner can grant to any key are allowed; wildcard and admin scopes are refused.</p>
  </DocSection>
  <DocSection id="check" kicker="02" title="Check a manifest">
   <p>In the cockpit, <strong>Apps &amp; skills → Build a plugin</strong> checks a pasted manifest and shows what a reviewer would see: the host, how many tools only read, each tool that writes with its effect, the scopes and the events. Checking runs in your browser and grants nothing.</p>
  </DocSection>
  <DocSection id="example" kicker="03" title="Example">
   <pre className="overflow-x-auto rounded-lg border border-white/10 bg-black/30 p-4 text-xs leading-5 text-zinc-200"><code>{JSON.stringify(EXAMPLE_PLUGIN_MANIFEST, null, 2)}</code></pre>
  </DocSection>
  <DocSection id="review" kicker="04" title="How plugins are trusted">
   <p>Every tool that writes goes through the agent gateway and needs a person&apos;s approval each time, and freezes, change windows and the agent firewall apply. Read-only tools are still limited to what the workspace enables. Publishing and enabling plugins for agents is being added in steps; until then, a manifest is for preparing and checking a plugin.</p>
  </DocSection>
  <DocFooterNav prev={{href:"/docs/mcp-tools",label:"MCP documentation tools"}} next={{href:"/docs/workspaces",label:"Workspaces"}} />
 </>;
}
