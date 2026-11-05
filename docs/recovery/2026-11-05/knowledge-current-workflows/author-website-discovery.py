"""Author one internal source draft; no ingestion, retrieval or runtime action."""
from pathlib import Path
import hashlib, json, subprocess
ROOT=Path(__file__).resolve().parents[4]
BASE='91520aba56b721c973e23a750fcaab4ee6ddc469'
VERSION='local-source-preview:'+BASE
PREFIX='docs/product/documentation-coverage/'
GUIDES=['website-primary-navigation-controls','website-docs-navigation-controls']
def digest(b): return hashlib.sha256(b).hexdigest()
source_paths=set()
ids=[]
for name in GUIDES:
    guide='docs/product/knowledge/'+name+'.md'
    ledger='docs/product/knowledge/'+name+'.sources.json'
    data=json.loads((ROOT/ledger).read_text())
    source_paths.update([guide,ledger])
    source_paths.update(s['path'] for s in data['sources'])
    ids.extend('proposed.axiom.control.'+f['id'] for f in data['controlFamilies'])
sources=[]
for path in sorted(source_paths):
    data=(ROOT/path).read_bytes()
    assert data==subprocess.check_output(['git','show',BASE+':'+path],cwd=ROOT),path
    sources.append({'path':path,'sha256':digest(data)})
rows=[
('website.primary.skip','Activate Skip to content when it receives keyboard focus.','local-preference','Requests both menus closed, focuses the first main, adding tabindex -1 only if absent; missing main has no destination. Real keyboard/AT/focus placement remains unaccepted.'),
('website.primary.home','Follow Vision XIX Labs home from the header.','read','Requests menu closure and navigates to /. Does not sign out or cancel ongoing work.'),
('website.primary.link','Choose Product, Integrations, Security, Docs or Demo from the wide header.','read','Follows that literal route, not an operational command or capability grant. Header presence is not destination health or deployed-version qualification.'),
('website.primary.more-toggle','Toggle More or press ArrowDown on its trigger.','local-preference','Click toggles local disclosure; ArrowDown opens/focuses the first link. role=group is not a roving ARIA menu or focus trap. Escape and outside/blur behavior have separate limits.'),
('website.primary.more-link','Choose Pricing, Support (account required), Status or Company in More.','read','Requests local menu closure while following its route. /account/help separately requires browser identity; /status navigation does not establish service health.'),
('website.primary.signin-wide','Choose Sign in in the wide header.','read','Opens /auth/signin; this header does not inspect the current session. Visible label is not signed-out proof or completed login.'),
('website.primary.download-wide','Choose Download in the wide header.','read','Opens /download; no specific installer is selected or hash/signature checked by this link.'),
('website.primary.mobile-open','Open navigation menu at a narrow viewport.','local-preference','Shows the full-screen dialog, closes More, makes only its header bar inert, captures/restores scroll styles and schedules initial Close focus. Not whole-page isolation.'),
('website.primary.mobile-close','Choose Close navigation menu in the narrow dialog.','local-preference','Closes locally and schedules trigger focus. Blank space within the full-screen dialog is inside, not a separate backdrop close target.'),
('website.primary.mobile-link','Choose one of the ten narrow navigation destinations.','read','Uses five primary plus four secondary entries and Founding Supporters in preserved order; requests menu closure. Not an authenticated action catalogue.'),
('website.primary.signin-mobile','Follow Sign in from the narrow dialog.','read','Requests menu closure and opens the same browser sign-in route; no provider consent or device pairing is completed.'),
('website.primary.download-mobile','Follow Download from the narrow dialog.','read','Requests menu closure and opens /download; installation/session acceptance remains separate.'),
('website.footer.explore','Choose Explore Axiom in the footer.','read','Opens /product; starts no underlying operational pipeline or AI call through this handler.'),
('website.footer.supporters','Choose Founding Supporters in the footer.','read','Opens /support; distinct from account help and contact, not purchase/subscription or customer-ticket acceptance.'),
('website.footer.home','Follow the footer Vision XIX Labs link.','read','Navigates to / without signing out or altering account authority.'),
('website.footer.column-link','Choose a footer Product, Company or Legal link.','read','Fifteen literal records preserve two Security entries; supporters also has a separate CTA. Links do not attest current legal approval, pricing, support resolution or service readiness.'),
('website.docs.landing.task-link','On /docs choose a task under Get started, Complete a task, Look up a control or Resolve a problem.','read','Fifteen landing routes navigate to guides. Before following operational steps check installed-version and preview scope; page availability is not deployment permission.'),
('website.docs.contents.toggle','Use Documentation contents at narrow widths.','local-preference','Initially collapsed disclosure toggles contents. At wide layout contents remain visible; it is not a modal. Opening does not itself focus search.'),
('website.docs.filter.query','Enter task words or a guide heading in Find a guide.','local-preference','Local AND-substring match over catalogue label/section plus indexed literal summaries/headings; no article-body, private knowledge, AI, fuzzy ranking or request submission. Query can persist in the mounted layout.'),
('website.docs.filter.clear','Use Clear guide filter if the raw query is nonempty or matches nothing.','local-preference','Clears local query and returns search focus, including whitespace-only input. Does not clear remote data or browser history.'),
('website.docs.sidebar.guide-link','Follow a matching guide in contents.','read','Twenty-three catalogue entries define the current search universe, not all28source pages. Exact pathname alone determines current-page semantics; a filter can hide the current guide.'),
('website.docs.article.previous','Follow Previous where an article supplies a previous link.','read','Uses that caller-provided label/href, not browser history or filtered results; absent previous metadata gives a noninteractive spacer.'),
('website.docs.article.next','Follow Next where an article supplies a next link.','read','Uses explicit caller metadata, not inferred sidebar ordering. Not every page mounts pagination, and source presence is not HTTP verification.'),
('website.docs.feedback.contact','Use Open support request in the Still blocked card.','read','Navigates to /contact; does not submit a ticket or helpfulness vote. Contact recording, email and resolution have their own gates; never include credentials in support material.')]
assert ['proposed.axiom.control.'+r[0] for r in rows]==ids
article={
'schema':1,'id':'axiom.help.website.navigation-docs-discovery','revision':1,'status':'draft','classification':'internal',
 'title':'Find the right website destination and guide without mistaking navigation for authority',
 'productVersion':VERSION,'screenIds':['proposed.axiom.screen.website.primary-navigation','proposed.axiom.screen.website.docs-discovery'], 'controlIds':ids,
 'goal':'Use the shared website menus, footer and Docs discovery/recovery controls with exact source/version citations and truthful operational limits.',
 'prerequisites':[
 'Internal source-only draft for the exact local preview, not the installed public release. No browser/media/AT/editorial/customer acceptance is established.',
 'Source guides retain their historical pins49c5 and8a80. Their selected bytes match this new91520 snapshot; new sources are bound explicitly, not silently rebinding historical articles.',
 'Supplemental to the older website-teaching-navigation draft; its conceptual/demo/skip coverage and historical bytes are preserved, not superseded.'],
 'permissions':[
 'Navigation, focus, filters and local menus grant no account, role, deployment, provider, AI-credit or approval authority. Destinations may load their own content/state and require current access.',
 'Operational actions still require current exact authority, genuine independent review and one-attempt execution where applicable; a guide or simulated demo cannot approve them.',
 'Source-derived public destinations do not permit new authentication, provider requests, consent, purchases, uploads or documentation publication.'],
 'steps':[{'instruction':r[0]+': '+r[1],'effect':r[2],'expectedState':r[3]} for r in rows],
 'expectedOutcome':'Locate an appropriate page/guide and understand the next supported boundary; no successful sign-in, installation, ticket, deployment, rollback or live service result is inferred.',
 'limitations':[
 'Sixteen direct shared-navigation declarations and eight Docs families are finite source scopes, not all website body controls, runtime instances, operational capability or completed B4/B5.',
 'More/mobile Escape handlers lack IME ownership guards; mobile Tab handling contains boundary traversal only and inertness covers the bar, not the whole page. Browser/AT/modal guarantees remain open.',
 'Responsive home-focus recovery applies only when an open panel owned focus. Pathname closure does not promise query/hash-only or every hidden-trigger focus recovery.',
 'Docs controlled focus/IME checks are distinct from actual browser behavior. The23sidebar and15landing records are not every Docs page; five source pages are outside the catalogue.',
 'The imported heading index covers literal extracted metadata, not full bodies. Filtering does not perform freshness checks on each keystroke; explicit article pagination can differ from catalogue order.',
 'No authentic media, genuine editorial approval, shipped-version qualification, executed retrieval or customer-approved answer exists in this article.'],
 'recovery':[
 'If a guide is hidden, clear/simplify the local filter. If the destination is unavailable, preserve the original task/outcome and find applicable help; do not infer no provider effect from a page failure.',
 'Close a local menu deliberately; closure is not cancellation of requests from another page. Do not use account changes or navigation as an authorization/refusal workaround.',
 'Uncertain or consumed operational actions must not be resent from guide instructions. Preserve the original record and use the separately approved supported observation/recovery process.',
 'A missing source, wrong version or ineligible draft requires refusal/escalation, not substitution of an older article or invented approval.'],
 'searchTerms':['More destinations','Open navigation menu','Close navigation menu','Skip to content','Support account required','Founding Supporters','Find a guide','Clear guide filter','No guides match','Documentation contents','Previous Next','Open support request','Docs search not AI','menu focus after resize','local preview not shipped'],
 'sources':sources,'media':[],
 'verification':{'kind':'source-only','evidencePaths':['docs/product/knowledge/'+g+'.md' for g in GUIDES]+['docs/recovery/2026-11-05/website-primary-navigation-source-guide/source-verification.json','docs/recovery/2026-11-05/website-docs-navigation-source-guide/README.md'],'verifiedVersion':VERSION,'verifiedAt':'2026-11-05T13:11:45Z'},
 'review':{'reviewer':None,'reviewedAt':None},'supersedes':None}
path=ROOT/(PREFIX+'articles/website-navigation-docs-discovery.r1.json')
path.write_text(json.dumps(article,indent=2,ensure_ascii=False)+'\n')
questions=[
 ('identity','Does the Sign in link mean my browser is signed out?','No. The header does not read current session identity; follow the browser sign-in/access workflow separately.'),
 ('support','Does Founding Supporters open a support ticket?','No. /support is distinct from authenticated /account/help and /contact. Link navigation is not a recorded request.'),
 ('search','Can Docs search my private repo or read every article body using AI?','No. It is local AND-substring filtering of the catalogue and indexed literal headings/summaries, not private/full-body/AI search.'),
 ('filter','I cannot find a guide that was visible before.','Clear/simplify the filter; the mounted query can hide the current guide. The catalogue has23entries and does not include every source page.'),
 ('pagination','Is Next always the next sidebar result?','No. The shared primitive follows the explicit caller-supplied link, not search order/history; absent metadata is not an active control.'),
 ('modal','Does the mobile menu make the entire page inert and guarantee all keyboard focus stays inside?','No. Only the header bar is inert; Tab boundary wrapping is not universal focus-in recovery or browser/AT qualification.'),
 ('escape','Can I transfer the command palette IME acceptance to More/menu Escape?','No. These source handlers have no composition guard; separate Docs/palette behavior does not qualify them.'),
 ('resize','Will every focused header element survive every viewport change?','Not established. Current recovery is conditional on focus inside an open panel, not a universal hidden-trigger or query/hash-only route guarantee.'),
 ('status','Does Service status or footer service-verified copy prove current deployment health?','No. Navigation and rendered copy are not current service reads, authority or verified outcomes.'),
 ('uncertain','A provider action was uncertain. Can I follow a guide and resend it?','No. Preserve its consumed history and use supported separately approved observation/recovery; page navigation cannot grant retry authority.'),
 ('source','Can a citation with a changed source hash still be used silently?','No. Quarantine/refuse the changed source/version and require re-review; do not automatically rewrite hashes or reuse historical applicability.'),
 ('eligibility','Can this draft answer a customer because its schema passes?','No. It is internal/draft/local-preview with null editorial review and no media/customer acceptance. Return applicable approved evidence unavailable instead.')]
citation=article['id']+' revision1 only after genuine approval and exact applicable version/source validation; otherwise disclose approved applicable evidence is unavailable'
evaluation={'schema':1,'articleId':article['id'],'revision':1,'productVersion':VERSION,'articleSha256':digest(path.read_bytes()),'status':'proposed-not-executed','scope':'Proposed cases for this internal source draft; no retrieval/AI/customer approval or execution acceptance.','cases':[{'id':'website-discovery-'+q[0],'question':q[1],'requiredResponse':q[2],'requiredCitation':citation} for q in questions]}
(ROOT/(PREFIX+'website-navigation-docs-discovery-evaluation.r1.json')).write_text(json.dumps(evaluation,indent=2,ensure_ascii=False)+'\n')
print(json.dumps({'article':str(path.relative_to(ROOT)),'controlFamilies':len(ids),'steps':len(rows),'sourceFiles':len(sources),'proposedCases':len(questions),'customerEligible':False}))
