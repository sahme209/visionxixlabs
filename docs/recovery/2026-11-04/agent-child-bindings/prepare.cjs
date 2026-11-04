const fs=require('node:fs'),crypto=require('node:crypto'),cp=require('node:child_process'),ts=require('typescript');
const dest='docs/product/knowledge/agent-child-bindings.json';if(fs.existsSync(dest))throw Error('fresh preparation outputs required');
const sha=x=>crypto.createHash('sha256').update(x).digest('hex'),baselineCommit=cp.execFileSync('/usr/bin/git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const plans=[
 ['ConversationRename',['agent.workspace.rename-open','agent.workspace.rename-title','agent.workspace.rename-save','agent.workspace.rename-refresh','agent.workspace.rename-cancel'],'Choose the conversation and scope'],
 ['AgentModelSelector',['agent.workspace.model-search','agent.workspace.model-select'],'Compose and send deliberately'],
 ['AgentMessageContent',['agent.workspace.copy-code','agent.workspace.message-link'],'Read evidence and receipts accurately'],
 ['FileDiff',['shared.file-diff-previous','shared.file-diff-next'],'Review proposals without collapsing the two decisions'],
 ['AgentApprovedActions',['agent.workspace.action-outcome','agent.workspace.action-readiness','agent.workspace.action-prepare','agent.workspace.action-execute','agent.workspace.action-cancel'],'Approved actions: requester-only deliberate execution'],
 ['AgentGithubReceipts',['agent.workspace.github-receipt-link'],'Read evidence and receipts accurately'],
 ['AgentRestartReceipts',['agent.workspace.workflow-receipt-refresh'],'Read evidence and receipts accurately'],
 ['Disclosure',['shared.disclosure-toggle'],'Qualification and remaining boundaries'],
];
let controls=[],files=[];
for(const [name,ids,guideSection] of plans){
 const source='desktop/src/components/'+name+'.tsx',text=fs.readFileSync(source,'utf8'),f=ts.createSourceFile(source,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),nodes=[],tagCounts={};
 if(text.includes('data-help-id'))throw Error('existing bindings require review');
 function v(n){if((ts.isJsxOpeningElement(n)||ts.isJsxSelfClosingElement(n))&&['button','input','select','textarea','summary','a'].includes(n.tagName.getText(f)))nodes.push(n);ts.forEachChild(n,v)}v(f);
 if(nodes.length!==ids.length)throw Error(name+' inventory drift');
 nodes.forEach((n,i)=>{const tag=n.tagName.getText(f),element=ts.isJsxOpeningElement(n)?n.parent:n;tagCounts[tag]=(tagCounts[tag]||0)+1;controls.push({helpId:ids[i],source,tag,guideSection,anchor:element.getText(f).replace(/\s+/g,' ').slice(0,200),nodeSha256:sha(element.getText(f))})});
 files.push({source,baselineSha256:sha(text),declarations:nodes.length,tagCounts});
 fs.writeFileSync('work/agent-child-bindings/baseline-'+name+'.tsx',text);
 let next=text;for(let i=nodes.length-1;i>=0;i--){const pos=nodes[i].tagName.end;next=next.slice(0,pos)+' data-help-id="'+ids[i]+'"'+next.slice(pos)}
 fs.writeFileSync('work/agent-child-bindings/prepared-'+name+'.tsx',next);
}
const inventory={format:'axiom.product-control-bindings/1',status:'INTERNAL DRAFT',customerEligible:false,publicationApproved:false,baselineCommit,declarations:19,countMethod:'Every intrinsic button/input/select/textarea/summary/a declaration in eight complete files, including local helper functions and Markdown render callbacks. Select options belong to the parent select; forms and display nodes are not independent controls.',files,unbound:['AgentChatView.tsx main 46 declarations and all its local helper components are outside this unit','Custom imported components and third-party Markdown internals are excluded; only locally authored render callbacks are included','Native external-link/clipboard implementations, settings destinations, provider/service/runtime state and generated select options have no new binding'],controls};
fs.writeFileSync(dest,JSON.stringify(inventory,null,2)+'\n');
