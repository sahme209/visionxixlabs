#!/usr/bin/env node
// Software-render capture of the homepage governed-deployment 3D model.
// Drives an already-installed Chrome over the DevTools protocol (Node 22+ global WebSocket);
// no packages, no network beyond the local site. Visual check only: software GL frame
// times are NOT a performance measurement.
// Usage: node scripts/capture-3d-model.mjs <siteUrl> <outDir> [chromePath]
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const [siteUrl = "http://127.0.0.1:3000/", outDir = "3d-capture", chrome = "google-chrome"] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const summary = { siteUrl, shots: [], consoleErrors: [], exceptions: [], mode: null, notes: "Software GL (SwiftShader); visual check only, not performance." };

const browser = spawn(chrome, [
  "--headless=new", "--remote-debugging-port=9333", "--no-first-run", "--no-default-browser-check",
  `--user-data-dir=${mkdtempSync(join(tmpdir(), "axiom-3d-"))}`, "--window-size=1440,1000",
  "--enable-unsafe-swiftshader", "--use-angle=swiftshader", "--ignore-gpu-blocklist", "about:blank",
], { stdio: "ignore" });

let ws, id = 0;
const pending = new Map();
function send(method, params = {}) {
  const msgId = ++id;
  ws.send(JSON.stringify({ id: msgId, method, params }));
  return new Promise((resolve, reject) => {
    pending.set(msgId, { resolve, reject });
    setTimeout(() => { if (pending.delete(msgId)) reject(new Error(`timeout ${method}`)); }, 60000);
  });
}
const evaluate = async (expression) => (await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true })).result?.value;

async function shot(name) {
  const rect = await evaluate(`(()=>{const h=[...document.querySelectorAll('h2')].find(e=>/governed deployment moves/i.test(e.textContent));const s=h&&h.closest('section');if(!s)return null;const r=s.getBoundingClientRect();return {x:r.x+scrollX,y:r.y+scrollY,w:r.width,h:Math.min(r.height,1400)}})()`);
  if (!rect) throw new Error("model section not found");
  const { data } = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip: { x: rect.x, y: rect.y, width: rect.w, height: rect.h, scale: 1 } });
  writeFileSync(join(outDir, `${name}.png`), Buffer.from(data, "base64"));
  summary.shots.push(name);
}
const click = (label) => evaluate(`(()=>{const b=[...document.querySelectorAll('button')].find(e=>e.textContent.trim()===${JSON.stringify(label)});if(b)b.click();return !!b})()`);

try {
  let targets;
  for (let i = 0; i < 40 && !targets; i++) { try { targets = await (await fetch("http://127.0.0.1:9333/json")).json(); } catch { await sleep(500); } }
  const page = targets.find((t) => t.type === "page");
  ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener("open", r, { once: true }));
  ws.addEventListener("message", (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) { const p = pending.get(msg.id); pending.delete(msg.id); msg.error ? p.reject(new Error(msg.error.message)) : p.resolve(msg.result); }
    if (msg.method === "Runtime.consoleAPICalled" && msg.params.type === "error") summary.consoleErrors.push(String(msg.params.args?.[0]?.value ?? "").slice(0, 200));
    if (msg.method === "Runtime.exceptionThrown") summary.exceptions.push(String(msg.params.exceptionDetails?.exception?.description ?? msg.params.exceptionDetails?.text).slice(0, 300));
  });
  await send("Page.enable"); await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await send("Page.navigate", { url: siteUrl }); await sleep(6000);
  await evaluate(`localStorage.setItem('axiom:force-3d','1');true`);
  await send("Page.reload"); await sleep(6000);
  await evaluate(`(()=>{const h=[...document.querySelectorAll('h2')].find(e=>/governed deployment moves/i.test(e.textContent));h&&h.scrollIntoView({block:'start'});return !!h})()`);
  for (let i = 0; i < 90; i++) {
    summary.mode = await evaluate(`(()=>{const c=document.querySelector('section canvas[aria-hidden="true"]');return c? (c.classList.contains('block')?'3d':'2d'):'none'})()`);
    if (summary.mode === "3d") break;
    await sleep(1000);
  }
  await sleep(20000); await shot("01-approved-overview");
  await click("Failed scan"); await sleep(15000); await shot("02-failed-scan");
  await click("Rejected"); await sleep(4000); await click("04 Approval gate"); await sleep(15000); await shot("03-rejected-approval-gate");
  await click("Unknown outcome"); await sleep(4000); await click("06 Execute"); await sleep(15000); await shot("04-unknown-execute");
  await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await click("Approved release"); await sleep(15000); await shot("05-mobile-390");
} catch (error) {
  summary.error = String(error?.message ?? error);
} finally {
  writeFileSync(join(outDir, "summary.json"), JSON.stringify(summary, null, 2));
  try { ws?.close(); } catch {}
  browser.kill("SIGKILL");
}
console.log(JSON.stringify({ mode: summary.mode, shots: summary.shots.length, error: summary.error ?? null }));
