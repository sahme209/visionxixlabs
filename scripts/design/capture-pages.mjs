// Full-page design screenshots of public pages, for layout review only.
// Uses Chromium's DevTools protocol over Node's built-in WebSocket: no extra deps.
// Usage: node scripts/design/capture-pages.mjs <baseUrl> <outDir>
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";

const [base = "http://127.0.0.1:3000", out = "design-shots"] = process.argv.slice(2);
const ROUTES = ["/", "/product", "/integrations", "/security", "/docs", "/demo", "/download", "/plans", "/status", "/support", "/contact", "/axiom", "/docs/approval-workflow", "/docs/permissions-model", "/privacy", "/terms"];
const VIEWPORTS = [{ name: "desktop", width: 1440, height: 900, mobile: false }, { name: "mobile", width: 390, height: 844, mobile: true }];
const MAX_HEIGHT = 12000;
const TILE = 1800;
mkdirSync(out, { recursive: true });

const chrome = spawn(process.env.CHROMIUM ?? "chromium", ["--headless=new", "--no-sandbox", "--disable-gpu", "--hide-scrollbars", "--remote-debugging-port=9333", "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let target;
for (let i = 0; i < 50 && !target; i++) {
  try { target = (await (await fetch("http://127.0.0.1:9333/json")).json()).find((t) => t.type === "page"); } catch { await sleep(200); }
}
if (!target) throw new Error("chromium did not start");

const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r, { once: true }));
let seq = 0; const pending = new Map();
ws.addEventListener("message", (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
const send = (method, params = {}) => new Promise((resolve, reject) => { const id = ++seq; pending.set(id, (m) => (m.error ? reject(new Error(`${method}: ${m.error.message}`)) : resolve(m.result))); ws.send(JSON.stringify({ id, method, params })); });

await send("Page.enable");
await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
const summary = [];
for (const vp of VIEWPORTS) {
  await send("Emulation.setDeviceMetricsOverride", { width: vp.width, height: vp.height, deviceScaleFactor: 1, mobile: vp.mobile });
  for (const route of ROUTES) {
    const name = `${vp.name}${route === "/" ? "-home" : route.replaceAll("/", "-")}`;
    try {
      await send("Page.navigate", { url: base + route });
      await sleep(3500);
      const { cssContentSize } = await send("Page.getLayoutMetrics");
      const height = Math.min(MAX_HEIGHT, Math.ceil(cssContentSize.height));
      // Save readable sections of TILE px each (name-00.jpg, name-01.jpg, ...).
      for (let y = 0, i = 0; y < height; y += TILE, i++) {
        const { data } = await send("Page.captureScreenshot", { format: "jpeg", quality: 72, captureBeyondViewport: true, clip: { x: 0, y, width: vp.width, height: Math.min(TILE, height - y), scale: 1 } });
        writeFileSync(`${out}/${name}-${String(i).padStart(2, "0")}.jpg`, Buffer.from(data, "base64"));
      }
      summary.push({ name, height });
    } catch (e) { summary.push({ name, error: String(e.message).slice(0, 200) }); }
  }
}
writeFileSync(`${out}/summary.json`, JSON.stringify(summary, null, 2));
ws.close(); chrome.kill();
console.log(JSON.stringify(summary));
