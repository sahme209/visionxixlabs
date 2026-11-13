import {it,expect} from 'vitest';
import {readOperationalEcsResult} from '../ecsExecution';
it('refuses invented acceptance receipts without exact target, lease and result integrity',()=>{expect(()=>readOperationalEcsResult({kind:'accepted',deploymentId:'ecs-svc/1'})).toThrow()});
