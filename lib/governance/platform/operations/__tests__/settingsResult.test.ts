import {it,expect} from 'vitest';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
import {readSettingsResult} from '../settingsResult';
const body={format:1,purpose:'platform_settings_creation_result_v1',actionId:'platform_action_11111111-1111-4111-8111-111111111111',effectIndex:0,planDigest:'a'.repeat(64),manifestDigest:'b'.repeat(64),nativeKey:'c'.repeat(64),outcome:'confirmed',settingId:'synthetic-id',observedAt:1000};
const receipt=(fields:unknown)=>({...fields as object,receiptDigest:sha256ContentHash(fields)});
it('retains exact nonsecret result integrity while refusing changed or extra fields',()=>{expect(readSettingsResult(receipt(body))).toMatchObject({outcome:'confirmed',settingId:'synthetic-id'});expect(()=>readSettingsResult({...receipt(body),settingId:'other'})).toThrow();expect(()=>readSettingsResult(receipt({...body,value:'SYNTHETIC SECRET'}))).toThrow()});
it('never converts a missing identity or unknown outcome into confirmation',()=>{expect(()=>readSettingsResult(receipt({...body,settingId:null}))).toThrow();expect(()=>readSettingsResult(receipt({...body,outcome:'unknown'}))).toThrow();expect(readSettingsResult(receipt({...body,outcome:'unknown',settingId:null}))).toMatchObject({outcome:'unknown',settingId:null})});
