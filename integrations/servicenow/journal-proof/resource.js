/* Local installable resource source only. GET /change/{sys_id}/journal-proof.
 * The service must require OAuth + axiom.change_evidence_read and the reviewed
 * REST_Endpoint ACL. Keep x_axiom_evidence.journal_proof_enabled absent/false
 * until the installed scope/ACL/token tests pass. Never expose Table API. */
(function process(request, response) {
    function stop(status) { response.setStatus(status); response.setBody({error:'journal_proof_unavailable'}); }
    response.setHeader('Cache-Control','no-store');
    if (gs.getProperty('x_axiom_evidence.journal_proof_enabled','false') !== 'true') { stop(503); return; }
    if (!gs.getUserID() || gs.getUserName() === 'guest') { stop(401); return; }
    var id = String(request.pathParams.sys_id || '');
    var query = request.queryParams || {}, keys = Object.keys(query);
    var expected = String(query.note_digest || '');
    if (!/^[a-f0-9]{32}$/.test(id) || keys.length !== 1 || keys[0] !== 'note_digest' || !/^[a-f0-9]{64}$/.test(expected)) { stop(400); return; }
    try {
        var change = new GlideRecordSecure('change_request');
        if (!change.get(id) || !change.canRead() || !change.getElement('work_notes').canRead()) { stop(404); return; }
        var journal = new GlideRecordSecure('sys_journal_field');
        journal.addQuery('element_id',id); journal.addQuery('name','change_request'); journal.addQuery('element','work_notes');
        journal.orderByDesc('sys_created_on'); journal.setLimit(51); journal.query();
        var seen = 0, matches = 0, matchedEntry = null;
        while (journal.next()) {
            seen++; if (seen > 50 || !journal.canRead() || !journal.getElement('value').canRead()) { stop(409); return; }
            if (String(journal.getValue('element_id')) !== id || String(journal.getValue('name')) !== 'change_request' || String(journal.getValue('element')) !== 'work_notes') { stop(409); return; }
            var value = String(journal.getValue('value') || '');
            if (value.length > 8192 || value.indexOf('Axiom verified workflow evidence\n') !== 0 || /[^\x09\x0a\x0d\x20-\x7e]/.test(value)) continue;
            if (String(new GlideDigest().getSHA256Hex(JSON.stringify(value))).toLowerCase() === expected) {
                if (!journal.getElement('sys_id').canRead() || !journal.getElement('sys_created_on').canRead()) { stop(409); return; }
                matches++; matchedEntry = {id:String(journal.getValue('sys_id')),createdAt:String(journal.getValue('sys_created_on'))};
                if (!/^[a-f0-9]{32}$/.test(matchedEntry.id) || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(matchedEntry.createdAt)) { stop(409); return; }
            }
        }
        if (matches > 1) { stop(409); return; }
        // ServiceNow adds the single result envelope during serialization.
        response.setStatus(200); response.setBody({present:matches===1,changeSysId:id,entryDigest:expected,observedAt:gs.nowDateTime(),entry:matchedEntry});
    } catch (error) { stop(409); }
})(request, response);
