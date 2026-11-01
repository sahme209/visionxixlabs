/** Private source-review inventory. No source execution or coverage issuance. */
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync,renameSync,realpathSync,lstatSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {inventoryMutationSource} from './lib/governance-mutation-inventory.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const roots=['app','lib','components','desktop/src','desktop/src-tauri','middleware.ts','instrumentation.ts'];
const listed=execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z','--',...roots],{cwd:root,encoding:'utf8'}).split('\0').filter(Boolean);
const eligible=file=>!/(?:^|\/)(?:__tests__|test|fixtures)(?:\/|$)/.test(file)&&!/(?:\.(?:test|spec)\.[cm]?[jt]sx?$|Tests\.swift$)/.test(file);
const files=[...new Set(listed)].filter(file=>eligible(file)&&/\.[cm]?[jt]sx?$/.test(file)).sort();
const sources=[],candidates=[];
function sourceBytes(file){const target=path.join(root,file),resolved=realpathSync(target);if(!resolved.startsWith(root+path.sep)||!lstatSync(target).isFile())throw Error('Inventory requires ordinary source files inside the checkout');return readFileSync(target)}
for(const file of files){const parsed=inventoryMutationSource(file,sourceBytes(file).toString('utf8'));sources.push(parsed.source);candidates.push(...parsed.candidates)}
const nativeFiles=[...new Set(listed)].filter(file=>eligible(file)&&/\.(rs|swift)$/.test(file)).sort().map(file=>({file,sha256:createHash('sha256').update(sourceBytes(file)).digest('hex'),status:'manual_language_review_required'}));
const changes=execFileSync('git',['diff','--name-only','-z','HEAD','--',...roots],{cwd:root,encoding:'utf8'}).split('\0').filter(Boolean);
const untracked=execFileSync('git',['ls-files','--others','--exclude-standard','-z','--',...roots],{cwd:root,encoding:'utf8'}).split('\0').filter(Boolean);
const group=key=>Object.fromEntries([...new Set(candidates.map(x=>x[key]))].sort().map(value=>[value,candidates.filter(x=>x[key]===value).length]));
const metadata={format:1,sourceCommit:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),scope:roots,dirtySourceFiles:[...new Set([...changes,...untracked])].filter(file=>eligible(file)&&/\.(?:[cm]?[jt]sx?|rs|swift)$/.test(file)).sort(),counts:{typescriptJavascriptFiles:sources.length,filesWithParseErrors:sources.filter(x=>x.parseErrorCount>0).length,nativeFilesRequiringManualReview:nativeFiles.length,candidates:candidates.length,byKind:group('kind'),byMode:group('mode')},coverageEstablished:false,limitations:['This is a conservative source-candidate inventory, not runtime reachability, provider effect, tenant authorization or execution coverage.','Import aliases and literal wrappers are syntax observations. Shadowing, reflection, dynamic imports/calls, generated code and delegated SDK behavior still require manual tracing.','Method-name matches include local maps, database writes and other false positives; no candidate is automatically classified as governed or exempt.','Missing or dynamic HTTP methods remain unresolved, including nominal default GET calls and unknown wrapper semantics.','AWS read/broker labels describe operation names only; they grant no provider-read or credential access.','Native Rust/Swift is hash-inventoried but not parsed. OS commands, external workers, operational scripts, SDK examples and other paths outside the declared scope require separate review.','Every candidate remains unreviewed with no authority or coverage receipt. New/changed source invalidates a prior classification until reviewed.','No source file was imported as executable code, no provider or database was accessed, and no setting or permission was changed.']};
const output=path.join(root,'docs/recovery/2026-11-01/governance-mutation-source-candidates.json');mkdirSync(path.dirname(output),{recursive:true});
const header=JSON.stringify(metadata,null,2).slice(0,-2),text=header+',\n  "sourceFiles": [\n'+sources.map(x=>'    '+JSON.stringify(x)).join(',\n')+'\n  ],\n  "nativeFiles": [\n'+nativeFiles.map(x=>'    '+JSON.stringify(x)).join(',\n')+'\n  ],\n  "candidates": [\n'+candidates.map(x=>'    '+JSON.stringify(x)).join(',\n')+'\n  ]\n}\n';
writeFileSync(output+'.new',text);renameSync(output+'.new',output);console.log(JSON.stringify({output,counts:metadata.counts,coverageEstablished:false}));
