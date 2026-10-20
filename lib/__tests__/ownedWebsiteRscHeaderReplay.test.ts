import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { expect, it } from 'vitest';
const require = createRequire(import.meta.url);
const headers = require('next/dist/client/components/app-router-headers');
const hashing = require('next/dist/shared/lib/router/utils/cache-busting-search-param');
const setter = require('next/dist/client/components/router-reducer/set-cache-busting-search-param');
const defaults = require('next/dist/server/config-shared').defaultConfig;
const server = readFileSync(require.resolve('next/dist/server/base-server'), 'utf8');
const client = readFileSync(require.resolve('next/dist/client/components/router-reducer/fetch-server-response'), 'utf8');
const serverStart = server.indexOf('        if (!this.minimalMode && this.nextConfig.experimental.validateRSCRequestHeaders && isRSCRequest &&');
const serverEnd = server.indexOf('        // Compute the iSSG cache key.', serverStart);
const clientStart = client.indexOf('async function createFetch(');
const clientEnd = client.indexOf('function createFromNextReadableStream(', clientStart);
if ([serverStart, serverEnd, clientStart, clientEnd].some(value => value < 0)) throw Error('pinned_rsc_source_missing');
const serverCheck = vm.compileFunction(`return async function check(req,res) { const isRSCRequest = true; const is404Page = false; ${server.slice(serverStart, serverEnd)} };`, ['_cachebustingsearchparam', '_setcachebustingsearchparam', '_approuterheaders', '_requestmeta'])(hashing, setter, headers, { getRequestMeta: () => undefined });
async function exercise(mode: "all" | "none" | "next-url-only") {
 const synthetic = { [headers.RSC_HEADER]: '1', [headers.NEXT_ROUTER_STATE_TREE_HEADER]: encodeURIComponent(JSON.stringify(['', { children: ['product', {}] }])), [headers.NEXT_URL]: '/product' };
 let requests = 0, redirects = 0, decoded = 0, bareAndHashedReplay = false;
 const fakeFetch = async (input: URL, options: { headers: Record<string, string> }) => {
  requests++; const current = new URL(input); let redirected = false;
  const values = current.searchParams.getAll(headers.NEXT_RSC_UNION_QUERY);
  bareAndHashedReplay ||= values.length > 1 && values.includes('');
  const forwarded = mode === 'all' ? options.headers : { [headers.RSC_HEADER]: '1', ...(mode === 'next-url-only' ? { [headers.NEXT_URL]: options.headers[headers.NEXT_URL] } : {}) };
  // Model only browser automatic redirect following; the server's actual pinned
  // hash-validation branch above decides whether and where to redirect.
  for (let i = 0; i < 2; i++) {
   const result = { statusCode: 200, location: '', setHeader(name: string, value: string) { if (name !== 'location') throw Error('unexpected_header'); this.location = value; }, body(value: string) { if (value !== '') throw Error('unexpected_body'); return { send() {} }; } };
   await serverCheck.call({ minimalMode: false, nextConfig: { experimental: { validateRSCRequestHeaders: true } } }, { headers: forwarded, url: current.pathname + current.search }, result);
   if (result.statusCode === 307) { redirects++; redirected = true; const next = new URL(result.location, current); current.href = next.href; continue; }
   return { redirected, url: current.href, ok: true, status: 200, headers: new Map([['content-type', 'text/x-component']]), body: null };
  }
  throw Error('unexpected_auto_redirect_depth');
 };
 const createFetch = vm.compileFunction(`return ${client.slice(clientStart, clientEnd)};`, ['_deploymentid', '_setcachebustingsearchparam', '_fetch', 'processFetch', 'decodeFlightResponse', '_approuterheaders', 'process'])(
  { getDeploymentId: () => null }, setter, { fetch: fakeFetch }, async (response: unknown) => ({ response, cacheData: null }), () => { decoded++; throw Error('decoding_not_authorized'); }, headers,
  { env: { __NEXT_CLIENT_VALIDATE_RSC_REQUEST_HEADERS: true } },
 );
 const result = await createFetch(new URL('http://127.0.0.1:38001/docs/approval-workflow'), synthetic, null, false, undefined);
 return { requests, redirects, decoded, result, bareAndHashedReplay };
}
it('actual fully stripped routing headers produce a bare-hash redirect and one replay, preserved headers none', async () => {
 expect(require('next/package.json').version).toBe('16.3.8'); expect(defaults.experimental.validateRSCRequestHeaders).toBe(true);
 expect(readFileSync(require.resolve('next/dist/build/define-env'), 'utf8')).toContain("'process.env.__NEXT_CLIENT_VALIDATE_RSC_REQUEST_HEADERS': Boolean(config.experimental.validateRSCRequestHeaders)");
 const stripped = await exercise('none'); expect(stripped.requests).toBe(2); expect(stripped.redirects).toBe(1); expect(stripped.bareAndHashedReplay).toBe(true); expect(stripped.decoded).toBe(0);
 const preserved = await exercise('all'); expect(preserved.requests).toBe(1); expect(preserved.redirects).toBe(0); expect(preserved.decoded).toBe(0);
 expect(stripped.result.redirected).toBe(true); expect(preserved.result.redirected).toBe(false);
 expect(stripped.result.url).not.toContain('_rsc');
});

it('partial header preservation with a nonempty server hash triggers the actual bounded 20-replay loop', async () => {
 const partial = await exercise('next-url-only');
 expect(partial.requests).toBe(21); expect(partial.redirects).toBe(21); expect(partial.decoded).toBe(0);
 expect(partial.bareAndHashedReplay).toBe(false);
});
