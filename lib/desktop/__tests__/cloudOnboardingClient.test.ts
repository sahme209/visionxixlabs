import {afterEach,expect,it,vi} from 'vitest';
import {DesktopClient} from '../../../desktop/src/lib/desktopClient';
const data={aws:{vault:'available',broker:'present',liveMode:'enabled',localPrerequisites:'present',providerValidation:'not_checked'},azure:{vault:'available',localPrerequisites:'present',providerValidation:'not_checked'}};
const client=(token='axm.desk.fixture')=>new DesktopClient({apiBase:'https://service.example.test',sessionToken:token});
afterEach(()=>vi.unstubAllGlobals());
it('reads the fixed readiness endpoint with paired bearer and no cookies or overrides',async()=>{const fetch=vi.fn().mockResolvedValue(Response.json({ok:true,data}));vi.stubGlobal('fetch',fetch);expect(await client().cloudOnboardingReadiness()).toEqual({ok:true,data});expect(fetch).toHaveBeenCalledWith('https://service.example.test/api/desktop/cloud/onboarding-readiness',expect.objectContaining({method:'GET',credentials:'omit',headers:expect.objectContaining({Authorization:'Bearer axm.desk.fixture'})}));});
it.each([{},null,{...data,connected:true},{...data,aws:{...data.aws,providerValidation:'verified'}}])('refuses invalid readiness DTOs without upgrading them',async bad=>{vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json({ok:true,data:bad})));expect(await client().cloudOnboardingReadiness()).toMatchObject({ok:false});});
it('never uses API-key authority for local setup evidence',async()=>{const fetch=vi.fn();vi.stubGlobal('fetch',fetch);expect(await client('vxlk_fixture').cloudOnboardingReadiness()).toMatchObject({ok:false});expect(fetch).not.toHaveBeenCalled();});
