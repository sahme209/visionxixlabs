import {it,expect,vi} from 'vitest';
import {createManualReleaseSqlRepository} from '../manualReleaseSqlRepository';
import type {PlatformSqlDatabase} from '../../sqlRepository';
it('requires the exact held lock before storage or identity reads and parameterizes identities',async()=>{
 const query=vi.fn(async()=>[{userId:'actor',sessionId:'session'}]);
 const db:PlatformSqlDatabase={$transaction:async fn=>fn({$queryRawUnsafe:query as never,$executeRawUnsafe:async()=>1})};
 const repo=createManualReleaseSqlRepository(db);
 await expect(repo.transaction(tx=>tx.read('unlocked'))).rejects.toThrow();expect(query).not.toHaveBeenCalled();
 await repo.transaction(async tx=>{await tx.lock('record');expect(await tx.readSessionPrincipal('session')).toEqual({userId:'actor',sessionId:'session'});await expect(tx.read('other')).rejects.toThrow()});
 expect(query.mock.calls[1]).toEqual([expect.stringContaining('WHERE s.id=$1'),'session']);
});
