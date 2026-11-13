import {it,expect} from 'vitest';
import {nativeSettingsTargetKey} from '../settingsReservation';
it('uses exact project/team/name/environment identity, excluding action/artifact/profile and value metadata',()=>{
 const target={projectId:'project',teamId:'team',name:'API_KEY',environment:'production'};
 const key=nativeSettingsTargetKey(target);expect(key).toMatch(/^[a-f0-9]{64}$/);
 for(const field of ['projectId','teamId','name','environment'])expect(nativeSettingsTargetKey({...target,[field]:field==='environment'?'preview':'OTHER'})).not.toBe(key);
 expect(()=>nativeSettingsTargetKey({...target,actionId:'other'})).toThrow();expect(()=>nativeSettingsTargetKey({...target,environment:['production','preview']})).toThrow();
});
