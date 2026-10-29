import {describe,it,expect} from "vitest";
import {parseSavedBotTaskCreate,parseSavedBotTaskUpdate,savedBotTaskContentHash} from "../savedTaskSchema";
const draft={title:"Audit task",instruction:"Inspect the authorized context",context:"Public example"};
const create={...draft,clientRequestId:"d276a5da-20c9-48d6-ad1b-88d3124766a7"};
describe("saved Bot task boundary",()=>{
 it("accepts an explicit bounded saved draft",()=>expect(parseSavedBotTaskCreate(create).title).toBe(draft.title));
 it("defaults only optional context",()=>{const {context,...body}=create;expect(parseSavedBotTaskCreate(body).context).toBe("")});
 for(const property of ["organizationId","actorId","status","tools","execute","approvalId"]){it(`refuses caller authority ${property}`,()=>expect(()=>parseSavedBotTaskCreate({...create,[property]:"injected"})).toThrow())}
 it("requires explicit nonblank task text",()=>expect(()=>parseSavedBotTaskCreate({...create,instruction:"  "})).toThrow());
 it("enforces title and instruction limits",()=>{expect(()=>parseSavedBotTaskCreate({...create,title:"x".repeat(201)})).toThrow();expect(()=>parseSavedBotTaskCreate({...create,instruction:"x".repeat(4001)})).toThrow()});
 it("bounds aggregate UTF8 bytes including multibyte content",()=>expect(()=>parseSavedBotTaskCreate({...create,instruction:"界".repeat(4000),context:"界".repeat(4000)})).toThrow());
 it("refuses malformed save identifiers",()=>expect(()=>parseSavedBotTaskCreate({...create,clientRequestId:"../task"})).toThrow());
 it("rejects unpaired Unicode surrogates",()=>expect(()=>parseSavedBotTaskCreate({...create,context:"\ud800"})).toThrow());
 it("requires a nonnegative integer version for edits",()=>{expect(parseSavedBotTaskUpdate({...draft,expectedVersion:0}).expectedVersion).toBe(0);for(const expectedVersion of [-1,1.5,"1",2147483648])expect(()=>parseSavedBotTaskUpdate({...draft,expectedVersion})).toThrow()});
 it("hashes content independently of request key and object property order",()=>{expect(savedBotTaskContentHash(draft)).toBe(savedBotTaskContentHash({context:draft.context,instruction:draft.instruction,title:draft.title}));expect(savedBotTaskContentHash(draft)).not.toBe(savedBotTaskContentHash({...draft,instruction:"Different task"}))});
 it("preserves meaningful instruction formatting",()=>expect(parseSavedBotTaskCreate({...create,instruction:"  indented\nsecond line"}).instruction).toBe("  indented\nsecond line"));
});
