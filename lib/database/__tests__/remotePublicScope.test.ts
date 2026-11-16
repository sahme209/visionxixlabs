import {expect,it} from 'vitest';
import {Client} from 'pg';
import {directNeonSessionOptions} from '../directNeonSession';
import {postgresConnectionOptions} from '../postgresConnectionPolicy';
it('removes unsupported startup options on a remote alternate path without weakening TLS',()=>{
 const options=directNeonSessionOptions(postgresConnectionOptions('postgresql://synthetic@ep-fictional-pooler.c-4.us-east-1.aws.neon.tech/fictional?sslmode=require'));
 const Ctor=options.Client??Client;const client=Reflect.construct(Ctor,[options]);
 expect(Reflect.apply(Reflect.get(client,'getStartupConf'),client,[])).not.toHaveProperty('options');
 expect(options.ssl).toEqual({rejectUnauthorized:true});
});

import {afterEach,beforeEach,vi} from 'vitest';
import type {PoolConfig,QueryResult} from 'pg';
import type {SqlQuery} from '@prisma/driver-adapter-utils';
import {connectRemotePublicScope} from '../remotePublicScope';

const application:SqlQuery={sql:'SELECT synthetic_application',args:['unchanged'],argTypes:[{scalarType:'string',dbType:'TEXT',arity:'scalar'}]};
type Config={text:string;values?:unknown[];query_timeout?:number};
let clients:Physical[]=[];
let onConnect:(client:Physical,done:()=>void)=>void;
let commands:Array<{client:Physical;config:Config}>=[];
let act:(config:Config,client:Physical)=>Promise<QueryResult>;
const row=(command:string,show='public'):QueryResult=>({command,rowCount:command==='SHOW'?1:0,oid:0,fields:command==='SHOW'?[{name:'search_path',tableID:0,columnID:0,dataTypeID:25,dataTypeSize:-1,dataTypeModifier:-1,format:'text'}]:[],rows:command==='SHOW'?[[show]]:[]});
class Physical extends Client {
 ended=0;
 constructor(config?:PoolConfig){super(config);clients.push(this)}
 connect():Promise<Client>;
 connect(callback:((error:Error)=>void)|((error:null,client:Client)=>void)):void;
 connect(callback?:((error:Error)=>void)|((error:null,client:Client)=>void)):Promise<Client>|void {if(callback){onConnect(this,()=>Reflect.apply(callback,undefined,[null,this]));return}return Promise.resolve(this)}
 // The real adapter/Pool execute, only the physical wire is synthetic.
 query(...args:unknown[]):any {
  const config=args[0] as Config;commands.push({client:this,config});
  const pending=act(config,this);const callback=args.at(-1);
  if(typeof callback==='function'){pending.then(value=>callback(null,value),error=>callback(error));return undefined}
  return pending;
 }
 end():Promise<void>;
 end(callback:(error:Error)=>void):void;
 end(callback?:(error:Error)=>void):Promise<void>|void {this.ended++;queueMicrotask(()=>{this.emit('end');if(callback)Reflect.apply(callback,undefined,[null])});if(!callback)return Promise.resolve()}
}
const config=():PoolConfig=>({host:'synthetic.invalid',user:'synthetic',database:'synthetic',Client:Physical,max:1,connectionTimeoutMillis:50,idleTimeoutMillis:0,ssl:{rejectUnauthorized:true}});
const sqls=()=>commands.map(x=>x.config.text);
const turn=()=>new Promise<void>(resolve=>setImmediate(resolve));
beforeEach(()=>{clients=[];commands=[];onConnect=(_client,done)=>queueMicrotask(done);act=async c=>row(c.text==='SHOW search_path'?'SHOW':c.text.startsWith('SET ')?'SET':c.text.split(' ')[0]);});
afterEach(()=>vi.useRealTimers());
it('uses the actual PrismaPg/Pool BEGIN/schema ACK/query/COMMIT lease and reuses only committed clients',async()=>{
 const adapter=await connectRemotePublicScope(config());
 try{
  await adapter.queryRaw(application);await adapter.executeRaw({...application,sql:'UPDATE synthetic_application'});
  expect(sqls()).toEqual(['BEGIN','SET LOCAL search_path TO public','SHOW search_path',application.sql,'COMMIT','BEGIN','SET LOCAL search_path TO public','SHOW search_path','UPDATE synthetic_application','COMMIT']);
  expect(clients).toHaveLength(1);expect(clients[0].ended).toBe(0);
  expect(commands[3].config).toMatchObject({text:application.sql,values:application.args,rowMode:'array'});
  expect(commands[3].config).not.toHaveProperty('query_timeout');
  for(const command of commands.filter(x=>x.config.text!==application.sql&&x.config.text!=='UPDATE synthetic_application'))expect(command.config.query_timeout).toBe(50);
 }finally{await adapter.dispose()}
 expect(clients[0].ended).toBe(1);
});
it('initializes explicit transactions once, retains savepoints and engine commit SQL without an extra COMMIT',async()=>{
 const adapter=await connectRemotePublicScope(config());
 try{
  const tx=await adapter.startTransaction('SERIALIZABLE');
  await tx.executeRaw({sql:'SET TRANSACTION READ ONLY',args:[],argTypes:[]});
  await tx.createSavepoint!('synthetic_one');await tx.rollbackToSavepoint!('synthetic_one');await tx.releaseSavepoint!('synthetic_one');
  await tx.queryRaw(application);await tx.executeRaw({sql:'COMMIT',args:[],argTypes:[]});await tx.commit();
  expect(sqls()).toEqual(['BEGIN','SET TRANSACTION ISOLATION LEVEL SERIALIZABLE','SET LOCAL search_path TO public','SHOW search_path','SET TRANSACTION READ ONLY','SAVEPOINT synthetic_one','ROLLBACK TO SAVEPOINT synthetic_one','RELEASE SAVEPOINT synthetic_one',application.sql,'COMMIT']);
 }finally{await adapter.dispose()}
});
it('refuses explicit commit without an actual COMMIT ACK and discards before reuse',async()=>{
 const adapter=await connectRemotePublicScope(config());
 try{const tx=await adapter.startTransaction();await expect(tx.commit()).rejects.toThrow('postgres_public_scope_unavailable');expect(clients[0].ended).toBe(1);await adapter.queryRaw(application);expect(clients).toHaveLength(2)}finally{await adapter.dispose()}
});
it.each(['BEGIN','SET LOCAL search_path TO public','SHOW search_path','COMMIT'])('actual command mismatch for %s prevents success and discards',async target=>{
 act=async c=>row(c.text===target?'SELECT':c.text==='SHOW search_path'?'SHOW':c.text.startsWith('SET ')?'SET':c.text.split(' ')[0]);
 const adapter=await connectRemotePublicScope(config());
 try{await expect(adapter.queryRaw(application)).rejects.toBeDefined();expect(clients[0].ended).toBe(1);if(target!=='COMMIT')expect(sqls()).not.toContain(application.sql)}finally{await adapter.dispose()}
});
it.each(['shadow','public, shadow'])('malformed public scope ACK %s executes no application query',async value=>{
 act=async c=>row(c.text==='SHOW search_path'?'SHOW':c.text.startsWith('SET ')?'SET':c.text.split(' ')[0],value);
 const adapter=await connectRemotePublicScope(config());
 try{await expect(adapter.queryRaw(application)).rejects.toThrow('postgres_public_scope_unavailable');expect(sqls()).not.toContain(application.sql);expect(clients[0].ended).toBe(1)}finally{await adapter.dispose()}
});
it('preserves the first application failure when rollback also fails, with one dirty discard',async()=>{
 const primary=Object.assign(new Error('synthetic_primary'),{code:'23505'});
 act=async c=>{if(c.text===application.sql)throw primary;if(c.text==='ROLLBACK')throw new Error('synthetic_cleanup');return row(c.text==='SHOW search_path'?'SHOW':c.text.startsWith('SET ')?'SET':c.text.split(' ')[0])};
 const adapter=await connectRemotePublicScope(config());
 try{await expect(adapter.queryRaw(application)).rejects.toBe(primary);expect(clients[0].ended).toBe(1);expect(sqls().filter(x=>x==='ROLLBACK')).toHaveLength(1)}finally{await adapter.dispose()}
});
it('a successful rollback acknowledges cleanup and permits healthy reuse after an application failure',async()=>{
 let fail=true;act=async c=>{if(c.text===application.sql&&fail){fail=false;throw Object.assign(new Error('synthetic_failure'),{code:'23505'})}return row(c.text==='SHOW search_path'?'SHOW':c.text.startsWith('SET ')?'SET':c.text.split(' ')[0])};
 const adapter=await connectRemotePublicScope(config());
 try{await expect(adapter.queryRaw(application)).rejects.toBeDefined();expect(clients[0].ended).toBe(0);await adapter.queryRaw(application);expect(clients).toHaveLength(1)}finally{await adapter.dispose()}
});
it('timeout quarantines a late initialization completion without app SQL or reuse',async()=>{
 let complete!:(value:QueryResult)=>void;
 act=async c=>c.text==='SHOW search_path'?new Promise<QueryResult>(resolve=>{complete=resolve}):row(c.text.startsWith('SET ')?'SET':c.text.split(' ')[0]);
 const adapter=await connectRemotePublicScope({...config(),connectionTimeoutMillis:10});
 try{await expect(adapter.queryRaw(application)).rejects.toBeDefined();expect(clients[0].ended).toBe(1);complete(row('SHOW'));await turn();expect(sqls()).not.toContain(application.sql);expect(clients[0].ended).toBe(1)}finally{await adapter.dispose()}
});
it('parallel transactions have independent physical leases and out-of-order terminal ACKs',async()=>{
 const adapter=await connectRemotePublicScope({...config(),max:2});
 try{const [a,b]=await Promise.all([adapter.startTransaction(),adapter.startTransaction()]);await b.executeRaw({sql:'COMMIT',args:[],argTypes:[]});await b.commit();await expect(a.commit()).rejects.toThrow('postgres_public_scope_unavailable');expect(clients.filter(x=>x.ended===1)).toHaveLength(1);await adapter.queryRaw(application);expect(clients).toHaveLength(2)}finally{await adapter.dispose()}
});
it('refuses remote scripts rather than silently executing an unscoped parser',async()=>{
 const adapter=await connectRemotePublicScope(config());try{await expect(adapter.executeScript('SELECT synthetic')).rejects.toThrow('postgres_remote_script_unavailable');expect(commands).toHaveLength(0)}finally{await adapter.dispose()}
});
it('known local and Unix startup behavior is retained for administrative commands',()=>{
 for(const host of ['localhost','127.0.0.1']){const options=postgresConnectionOptions(`postgresql://synthetic@${host}/synthetic`);expect(directNeonSessionOptions(options)).toBe(options)}
 const options=postgresConnectionOptions('postgresql://synthetic@localhost/synthetic?host=%2Fprivate%2Ftmp%2Fsynthetic');expect(directNeonSessionOptions(options)).toBe(options);
});

it('retained transaction methods cannot operate on or release a subsequent checkout',async()=>{
 const adapter=await connectRemotePublicScope(config());
 try{const old=await adapter.startTransaction();await old.executeRaw({sql:'COMMIT',args:[],argTypes:[]});await old.commit();const current=await adapter.startTransaction();
 for(const operation of [()=>old.queryRaw(application),()=>old.executeRaw(application),()=>old.rollback(),()=>old.commit(),()=>old.createSavepoint!('old'),()=>old.rollbackToSavepoint!('old'),()=>old.releaseSavepoint!('old')])await expect(Promise.resolve().then(async()=>{await operation()})).rejects.toThrow('postgres_public_scope_unavailable');
 expect(clients).toHaveLength(1);expect(clients[0].ended).toBe(0);await current.queryRaw(application);await current.executeRaw({sql:'COMMIT',args:[],argTypes:[]});await current.commit();expect(clients[0].ended).toBe(0);
 }finally{await adapter.dispose()}
});

import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {PrismaPg} from '@prisma/adapter-pg';
it('pins both installed adapter formats and pg pool private protocol sources used by the guards',()=>{
 const pins:Record<string,string>={
  'pg/lib/client.js':'ad6aa93c26b0bf26db1f2ebe74216212790a04c41af5585c63760f9fa8322a32',
  'pg-pool/index.js':'6f304776edaabde2954cbf8c4366fa6d9512bfba0e408e78cc56b3c46c69d058',
  'pg-pool/esm/index.mjs':'521c8058172944cb9ceaee95073b49950a3906f91263303837e89f9ee346e81e',
  '@prisma/adapter-pg/dist/index.js':'d57ac2ea38047c648b0f3b4b8012031b5adaa9f919dbb21419a4153f7e02d3c4',
  '@prisma/adapter-pg/dist/index.mjs':'e6879b3429f9efade5696321da768476fd4710f2aff7de95c01cca15d6a8d1d1',
 };
 for(const [file,hash] of Object.entries(pins))expect(createHash('sha256').update(readFileSync(resolve('node_modules',file))).digest('hex')).toBe(hash);
});
it.each(['pg','pg-pool','@prisma/adapter-pg'])('refuses changed %s version before pool creation',async name=>{
 const file=resolve('node_modules',name,'package.json');
 vi.doMock(file,()=>({default:{version:'0.0.0-synthetic'}}));
 vi.resetModules();
 try{const changed=await import('../remotePublicScope');await expect(changed.connectRemotePublicScope(config())).rejects.toThrow('postgres_public_scope_unavailable');expect(clients).toHaveLength(0)}
 finally{vi.doUnmock(file);vi.resetModules()}
});
it('refuses a changed private transaction data-field contract and discards its active lease',async()=>{
 const original=PrismaPg.prototype.connect;
 const spy=vi.spyOn(PrismaPg.prototype,'connect').mockImplementation(async function(this:PrismaPg){const adapter=await original.call(this);const start=adapter.startTransaction.bind(adapter);adapter.startTransaction=async isolation=>{const tx=await start(isolation);Object.defineProperty(tx,'client',{value:{},configurable:true});return tx};return adapter});
 const adapter=await connectRemotePublicScope(config());
 try{await expect(adapter.queryRaw(application)).rejects.toThrow('postgres_public_scope_unavailable');expect(clients[0].ended).toBe(1);expect(sqls()).not.toContain(application.sql);await expect(adapter.queryRaw(application)).rejects.toThrow('postgres_public_scope_unavailable');expect(clients).toHaveLength(1)}finally{spy.mockRestore();await adapter.dispose()}
});
it('refuses a changed phantom transaction contract and never executes application SQL',async()=>{
 const original=PrismaPg.prototype.connect;
 const spy=vi.spyOn(PrismaPg.prototype,'connect').mockImplementation(async function(this:PrismaPg){const adapter=await original.call(this);const start=adapter.startTransaction.bind(adapter);adapter.startTransaction=async isolation=>{const tx=await start(isolation);Object.defineProperty(tx.options,'usePhantomQuery',{get(){throw Error('getter_not_allowed')}});return tx};return adapter});
 const adapter=await connectRemotePublicScope(config());
 try{await expect(adapter.queryRaw(application)).rejects.toThrow('postgres_public_scope_unavailable');expect(clients[0].ended).toBe(1);expect(sqls()).not.toContain(application.sql)}finally{spy.mockRestore();await adapter.dispose()}
});
it('a timed-out COMMIT is never reported successful and late ACK cannot clean a new lease',async()=>{
 let late!:(result:QueryResult)=>void;let hold=true;
 act=async c=>c.text==='COMMIT'&&hold?new Promise<QueryResult>(resolve=>{late=resolve}):row(c.text==='SHOW search_path'?'SHOW':c.text.startsWith('SET ')?'SET':c.text.split(' ')[0]);
 const adapter=await connectRemotePublicScope({...config(),connectionTimeoutMillis:10});
 try{await expect(adapter.queryRaw(application)).rejects.toBeDefined();expect(clients[0].ended).toBe(1);hold=false;const next=await adapter.startTransaction();late(row('COMMIT'));await turn();await expect(next.commit()).rejects.toThrow('postgres_public_scope_unavailable');expect(clients).toHaveLength(2);expect(clients[1].ended).toBe(1)}finally{await adapter.dispose()}
});
it('explicit rollback without terminal acknowledgment discards instead of pooling a dirty transaction',async()=>{
 const adapter=await connectRemotePublicScope(config());
 try{const tx=await adapter.startTransaction();await tx.rollback();expect(clients[0].ended).toBe(1);expect(sqls()).not.toContain('ROLLBACK')}finally{await adapter.dispose()}
});
it('the first query refuses a non-writable pool release contract before sending BEGIN',async()=>{
 Object.defineProperty(Physical.prototype,'release',{configurable:true,set(value:unknown){Object.defineProperty(this,'release',{configurable:true,writable:false,value})}});
 const adapter=await connectRemotePublicScope(config());
 try{await expect(adapter.queryRaw(application)).rejects.toBeDefined();expect(commands).toHaveLength(0);expect(clients[0].ended).toBe(1)}finally{delete (Physical.prototype as unknown as {release?:unknown}).release;await adapter.dispose()}
});
it('refuses an adapter that does not own the exact pool',async()=>{
 const original=PrismaPg.prototype.connect;
 const spy=vi.spyOn(PrismaPg.prototype,'connect').mockImplementation(async function(this:PrismaPg){const adapter=await original.call(this);Object.defineProperty(adapter,'underlyingDriver',{value:()=>({})});return adapter});
 try{await expect(connectRemotePublicScope(config())).rejects.toThrow('postgres_public_scope_unavailable');expect(commands).toHaveLength(0);expect(clients).toHaveLength(0)}finally{spy.mockRestore()}
});
it('retires the actual Pool late-connect timeout lease even when pg-pool releases without a first query',async()=>{
 vi.useFakeTimers();
 const added:object[]=[],deleted:object[]=[];
 const add=Set.prototype.add,remove=Set.prototype.delete;
 const isLease=(v:unknown):v is object=>!!v&&typeof v==='object'&&Object.getOwnPropertyDescriptor(v,'client')?.value instanceof Physical;
 const addSpy=vi.spyOn(Set.prototype,'add').mockImplementation(function(this:Set<unknown>,v:unknown){if(isLease(v))added.push(v);return add.call(this,v)});
 const removeSpy=vi.spyOn(Set.prototype,'delete').mockImplementation(function(this:Set<unknown>,v:unknown){if(isLease(v))deleted.push(v);return remove.call(this,v)});
 const adapter=await connectRemotePublicScope(config());
 try{
  const first=await adapter.startTransaction();
  let finishConnect!:()=>void;onConnect=(_client,done)=>{finishConnect=done};
  const waiting=adapter.queryRaw(application).catch(error=>error);
  await vi.advanceTimersByTimeAsync(30);await first.rollback();await vi.advanceTimersByTimeAsync(20);
  expect(await waiting).toBeInstanceOf(Error);expect(clients).toHaveLength(2);
  finishConnect();await vi.advanceTimersByTimeAsync(0);
  const lateLease=added.find(x=>Object.getOwnPropertyDescriptor(x,'client')?.value===clients[1]);
  expect(lateLease).toBeDefined();expect(deleted).toContain(lateLease);
  expect(commands.filter(x=>x.client===clients[1])).toHaveLength(0);
 }finally{await adapter.dispose();addSpy.mockRestore();removeSpy.mockRestore();vi.useRealTimers()}
});
it('a queued start cannot acquire a usable lease after another start invalidates the private contract',async()=>{
 const original=PrismaPg.prototype.connect;let first=true;
 const spy=vi.spyOn(PrismaPg.prototype,'connect').mockImplementation(async function(this:PrismaPg){const adapter=await original.call(this);const start=adapter.startTransaction.bind(adapter);adapter.startTransaction=async isolation=>{const tx=await start(isolation);if(first){first=false;Object.defineProperty(tx,'client',{value:{},configurable:true})}return tx};return adapter});
 const adapter=await connectRemotePublicScope(config());
 try{
  const outcomes=await Promise.allSettled([adapter.startTransaction(),adapter.startTransaction()]);
  expect(outcomes.map(x=>x.status)).toEqual(['rejected','rejected']);
  expect(clients).toHaveLength(2);expect(commands.filter(x=>x.client===clients[1])).toHaveLength(0);
  expect(clients.every(client=>client.ended===1)).toBe(true);
 }finally{
  // Also lets the deliberate historical counterfactual terminate cleanly.
  for(const client of clients.filter(x=>x.ended===0)){const release=Object.getOwnPropertyDescriptor(client,'release')?.value;if(typeof release==='function')Reflect.apply(release,client,[new Error('synthetic_cleanup')])}
  spy.mockRestore();await adapter.dispose();
 }
});
