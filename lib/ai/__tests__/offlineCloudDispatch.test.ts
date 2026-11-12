import {afterEach,it,expect,vi} from 'vitest';
import {aiFetch} from '../aiFetch';
import {generateText as openai} from '../providers/openai';
import {generateText as anthropic} from '../providers/anthropic';
import {generateText as gemini} from '../providers/gemini';
import {VercelGatewayProvider} from '../providers/VercelGatewayProvider';
import {sendSmallSonnet55Messages} from '../providers/sonnet55Messages';
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals()});
it.each(['true','invalid',''])('refuses buffered legacy transport before fetch for mode %s',async mode=>{
 vi.stubEnv('AXIOM_OFFLINE_MODE',mode);const fetcher=vi.fn(async()=>Response.json({}));vi.stubGlobal('fetch',fetcher);
 await expect(aiFetch({provider:'ollama',url:'http://127.0.0.1:11434/v1/chat/completions'})).rejects.toThrow('installation_cloud_ai_unavailable');expect(fetcher).not.toHaveBeenCalled();
});
it.each([['openai',openai],['anthropic',anthropic],['gemini',gemini]] as const)('refuses old direct %s before key/SDK use',async(_name,call)=>{
 vi.stubEnv('AXIOM_OFFLINE_MODE','true');vi.stubEnv('OPENAI_API_KEY','');vi.stubEnv('ANTHROPIC_API_KEY','');vi.stubEnv('GEMINI_API_KEY','');
 await expect(call({prompt:'private text'})).rejects.toThrow('installation_cloud_ai_unavailable');
});
it('refuses both Gateway buffered and admitted stream entrypoints',async()=>{
 vi.stubEnv('AXIOM_OFFLINE_MODE','true');const provider=new VercelGatewayProvider();
 await expect(provider.generateText('private text')).rejects.toThrow('installation_cloud_ai_unavailable');
 await expect(provider.streamTextOnce('private text').next()).rejects.toThrow('installation_cloud_ai_unavailable');
 await expect(sendSmallSonnet55Messages('private text',{})).rejects.toThrow('installation_cloud_ai_unavailable');
});
it('preserves normal online shared transport behavior',async()=>{
 vi.stubEnv('AXIOM_OFFLINE_MODE','false');const fetcher=vi.fn(async()=>Response.json({ok:true}));vi.stubGlobal('fetch',fetcher);
 expect((await aiFetch({provider:'openai',url:'https://api.openai.com/v1/chat/completions',body:{value:'test'}})).res.ok).toBe(true);expect(fetcher).toHaveBeenCalledTimes(1);
});
it('refuses direct streams, image generation and live Gateway catalog reads offline',async()=>{
 vi.stubEnv('AXIOM_OFFLINE_MODE','true');const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);
 const {DirectChatStreamProvider}=await import('../providers/directChatStream');
 const p=new DirectChatStreamProvider({provider:'openai',defaultModel:'gpt-4o',baseUrl:'https://api.openai.com/v1',apiKey:'synthetic'});
 await expect(p.streamText('private text').next()).rejects.toThrow('installation_cloud_ai_unavailable');
 const {generateBrandImage}=await import('@/lib/growth/imageGenerator');
 await expect(generateBrandImage({category:'product_education',postSummary:'private text'})).rejects.toThrow('installation_cloud_ai_unavailable');
 const {loadGatewayModelCatalog}=await import('../gatewayModelCatalog');await expect(loadGatewayModelCatalog()).rejects.toThrow('installation_cloud_ai_unavailable');expect(fetcher).not.toHaveBeenCalled();
});
