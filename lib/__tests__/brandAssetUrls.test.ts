import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import manifest from '@/app/manifest';
import {AXIOM_FAVICON_URL,AXIOM_APP_ICON_URL,AXIOM_APPLE_ICON_URL} from '../brandAssets';
it.each([[AXIOM_FAVICON_URL,'public/favicon-32x32.png'],[AXIOM_APP_ICON_URL,'app/icon.png'],[AXIOM_APPLE_ICON_URL,'public/apple-icon.png']])('serves unchanged canonical icon bytes under a content-addressed filename: %s',(url,source)=>{
 expect(url).toMatch(/^\/axiom-(?:favicon|icon|apple-icon)-[a-f0-9]{12}\.png$/);
 const bytes=readFileSync('public'+url);expect(bytes.equals(readFileSync(source))).toBe(true);
 expect(url).toContain(createHash('sha256').update(bytes).digest('hex').slice(0,12));
});

it('advertises the real dimensions of each content-addressed manifest icon', () => {
  const icons = manifest().icons ?? [];
  expect(icons.map(icon => icon.sizes)).toEqual(['32x32', '192x192', '512x512']);
  for (const icon of icons) {
    const bytes = readFileSync('public' + icon.src);
    expect(icon.src).toContain(createHash('sha256').update(bytes).digest('hex').slice(0, 12));
    expect(bytes.subarray(12, 16).toString()).toBe('IHDR');
    expect(icon.sizes).toBe(`${bytes.readUInt32BE(16)}x${bytes.readUInt32BE(20)}`);
  }
});
