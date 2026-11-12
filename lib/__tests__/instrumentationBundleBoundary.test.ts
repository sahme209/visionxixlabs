import { expect, it } from 'vitest';
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
import ts from 'typescript';
type Stats = { toJson(options: Record<string, boolean>): { errors?: Array<{message: string}>; modules?: Array<{name?: string}> } };
type Compiler = { run(done: (error: Error | null, stats?: Stats) => void): void; close(done: (error: Error | null) => void): void };
const webpack = createRequire(import.meta.url)('next/dist/compiled/webpack/webpack').webpack as {
 (options: Record<string, unknown>): Compiler;
 DefinePlugin: new (values: Record<string, string>) => unknown;
};
/** Compile the actual hook; do not launch it or execute any emitted application. */
it('excludes the real Node driver from Edge instrumentation while retaining it for Node', async () => {
 const root=process.cwd(),directory=mkdtempSync(join(tmpdir(),'axiom-instrumentation-bundle-'));
 try {
  const entry=join(directory,'hook.mjs'),factory=join(directory,'factory.mjs');
  writeFileSync(entry,ts.transpileModule(readFileSync(join(root,'instrumentation.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText);
  // Only store IO is substituted. Its actual driver dependency is deliberately
  // retained so an unexcluded Edge import reproduces missing Node-core errors.
  writeFileSync(factory,'import {PrismaPg} from "@prisma/adapter-pg"; export async function configureStoresFromEnv(){return {mode:"prisma",wired:{driver:PrismaPg}}}');
  async function compile(runtime: 'edge' | 'nodejs') {
   return new Promise<{errors: Array<{message: string}>;driver: boolean}>((resolve,reject)=>{
    const compiler=webpack({mode:'development',target:runtime==='edge'?'webworker':'node',context:root,entry,cache:false,devtool:false,
     resolve:{modules:[join(root,'node_modules')],alias:{'@/lib/platform/storeFactory$':factory}},output:{path:join(directory,runtime),filename:'bundle.js'},plugins:[new webpack.DefinePlugin({'process.env.NEXT_RUNTIME':JSON.stringify(runtime)})]});
    compiler.run((error,stats)=>compiler.close(closeError=>{
     if(error||closeError||!stats){reject(error||closeError||new Error('compiler_result_unavailable'));return}
     const info=stats.toJson({all:false,errors:true,modules:true});
     resolve({errors:info.errors??[],driver:(info.modules??[]).some(module=>module.name?.includes('node_modules/@prisma/adapter-pg/'))});
    }));
   });
  }
  const edge=await compile('edge');expect(edge.errors).toHaveLength(0);expect(edge.driver).toBe(false);
  const node=await compile('nodejs');expect(node.errors).toHaveLength(0);expect(node.driver).toBe(true);
 }finally{rmSync(directory,{recursive:true,force:true})}
},20_000);
