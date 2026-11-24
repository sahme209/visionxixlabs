import {expect, it} from "vitest";
import {sha256OfCanonicalJson} from "../evidencePackGenerator";
import {summarizeIncidentEvidence} from "../incidentEvidencePack";

const timestamp = "2026-11-20T12:00:00.000Z";
const release = {organizationId:"org",id:"release",releaseTag:"v2",commitSha:"a".repeat(40)};
const content = {
  schemaVersion:2, generatedAtIso:timestamp, release,
  branchValidation:{total:1,checks:[{privateDetail:"hidden evidence"}]},
  changeTickets:{count:0,items:[]},
  readiness:{overallScore:52,evaluatedAt:timestamp},
};
const pack = (contentJson: unknown, contentHash = sha256OfCanonicalJson(contentJson)) => ({
  contentJson, contentHash, organizationId:"org", releaseId:"release",
});

it("projects verified saved evidence without exposing stored details", () => {
  expect(summarizeIncidentEvidence(pack(content), release)).toEqual({
    state:"recorded", generatedAt:timestamp, branchCheckCount:1, changeTicketCount:0,
    readiness:{score:52,evaluatedAt:timestamp},
  });
  expect(summarizeIncidentEvidence(null,release)).toEqual({state:"missing"});
});

it.each([
  {...pack(content), organizationId:"foreign"},
  pack({...content,release:{...release,commitSha:"b".repeat(40)}}),
  pack({...content,branchValidation:{total:2,checks:[]}}),
  pack({...content,generatedAtIso:"2026-11-19T12:00:00Z"},sha256OfCanonicalJson(content)),
])("withholds wrongly scoped, malformed or altered evidence", row => {
  expect(summarizeIncidentEvidence(row,release)).toEqual({state:"unavailable"});
});

it("preserves legacy evidence while withholding a timestamp that was outside its digest", () => {
  const legacyHash = sha256OfCanonicalJson({...content,readiness:{...content.readiness,evaluatedAt:{}}});
  const newDigest = sha256OfCanonicalJson({...content,readiness:{...content.readiness,evaluatedAt:new Date(timestamp)}});
  expect(newDigest).toBe(sha256OfCanonicalJson(content));
  expect(newDigest).not.toBe(legacyHash);
  expect(summarizeIncidentEvidence(pack(content,legacyHash),release)).toMatchObject({
    state:"recorded", readiness:{score:52,evaluatedAt:null},
  });
  expect(summarizeIncidentEvidence(pack({...content,readiness:{...content.readiness,overallScore:99}},legacyHash),release)).toEqual({state:"unavailable"});
});
