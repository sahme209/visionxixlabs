"""Read-only per-role saved-file observations; never execution or signature authority."""
import copy,math,re
from .saved_profile_observation import inspect_empty_dictionary,inspect_guard_no_entitlements
ROLES=('owner','maintenance','bootstrap','guard')

def observe_role_profiles(roles,preparation_receipts):
 """Join exactly four selected roles to their own current saved evidence."""
 # Deferred because the system packet reader also uses this observer.
 from . import system_build_inputs as inputs
 need=inputs._need
 need(type(roles)is dict and set(roles)==set(ROLES),'four_exact_profile_roles_required')
 need(type(preparation_receipts)is list and 1<=len(preparation_receipts)<=8,'profile_preparations_required')
 original=copy.deepcopy((roles,preparation_receipts));snapshots=[]
 def read(bound,limit=2*1024**3):
  need(type(bound)is dict,'profile_binding_required')
  data=inputs._bound(bound,limit)
  # Retain inode/time identity as well as content across this whole observation.
  again,snapshot=inputs.prep._snapshot(inputs.Path(bound['path']),limit)
  need(data==again,'profile_input_changed');snapshots.append((copy.deepcopy(bound),limit,snapshot));return data
 def record(bound):return inputs.strict_json(read(bound,8*1024**2))
 representations=[]
 try:
  for bound in preparation_receipts:record(bound)
  for role in ROLES:
   item=roles[role]
   need(type(item)is dict and set(item)=={'identifier','artifact','resultReceipt','displayStdout','displayStderr','provenance','rawLogs'} and item['identifier']==inputs.ROLE_IDENTIFIERS[role],'fixed_role_identifier_required')
   data=read(item['artifact']);mode=item['artifact']['mode'];need((int(mode,8)if type(mode)is str else mode)==0o600,'quarantined_role_mode_required')
   result=record(item['resultReceipt']);need(type(result)is dict and inputs._same_artifact(result.get('artifact_after',result.get('copy_after')),item['artifact']),'saved_role_artifact_mismatch')
   commands=result.get('results',result.get('actualCommandsCompleted'))
   need(type(commands)is list and len(commands)==3 and all(type(c)is dict and c.get('state')=='completed' and type(c.get('exit',c.get('exit_code')))is int and c.get('exit',c.get('exit_code'))==0 for c in commands),'saved_static_sequence_required')
   if role!='guard':need(result.get('profile_matches',result.get('profile_matches_candidate'))is True,'saved_profile_required')
   proof=item['provenance'];need(type(proof)is dict and set(proof)=={'signingPacket','compileReceipt','preparationReceipt','savedCommands'},'native_compile_provenance_required')
   for key in ('compileReceipt','preparationReceipt'):record(proof[key])
   packet=record(proof['signingPacket']);need(type(packet)is dict,'signing_packet_required');saved=record(proof['savedCommands']);need(saved==commands,'supplement_saved_commands_mismatch')
   inputs._provenance(role,item,result,commands,preparation_receipts,build_node=None)
   if type(packet.get('leaves'))is list:
    matching=[leaf for leaf in packet['leaves']if type(leaf)is dict and leaf.get('role')==role];need(len(matching)==1,'signed_leaf_role_required');source=matching[0]['sourceArtifact']
   else:source=packet['artifact']
   read(source)
   logs=item['rawLogs'];need(type(logs)is list and len(logs)==3 and logs[2]=={'stdout':item['displayStdout'],'stderr':item['displayStderr']},'three_raw_command_log_pairs_required')
   outputs=[]
   for command,log in zip(commands,logs):
    need(type(log)is dict and set(log)=={'stdout','stderr'},'exact_raw_log_pair_required')
    out=read(log['stdout'],65536);err=read(log['stderr'],65536);elapsed=command.get('elapsed_seconds')
    need(type(elapsed)in(int,float) and math.isfinite(elapsed) and 0<=elapsed<=10,'bounded_saved_command_required')
    need(type(command.get('stdout_bytes'))is int and type(command.get('stderr_bytes'))is int and len(out)==command['stdout_bytes'] and len(err)==command['stderr_bytes'] and len(out)+len(err)<=65536,'saved_raw_log_counts_mismatch');outputs.append((out,err))
   out,err=outputs[2];text=err.decode('utf8')
   for key,value in [('Identifier',item['identifier']),('TeamIdentifier','FG5N98FE6W'),('Format','Mach-O thin (arm64)'),('Info.plist','not bound'),('Sealed Resources','none')]:
    need(re.findall('^'+re.escape(key)+'=(.*)$',text,re.M)==[value],'saved_role_display_mismatch')
   need(re.findall(r'flags=(0x[0-9a-f]+)\(runtime\)',text)==['0x10000'],'standalone_runtime_profile_required')
   if role=='guard':
    need(out==b'','guard_empty_entitlement_display_required');observation=inspect_guard_no_entitlements(data,item['identifier'],'FG5N98FE6W')
    need(re.findall(r'^CDHash=(.*)$',text,re.M)==[observation['cdhash']],'saved_guard_cdhash_mismatch')
   else:
    need(out.lstrip().startswith((b'<?xml',b'<plist')),'explicit_xml_dictionary_required');observation=inspect_empty_dictionary(out)
   representations.append({'role':role,'identifier':item['identifier'],'artifact':item['artifact'],'signingPacket':proof['signingPacket'],'savedCommands':proof['savedCommands'],'resultReceipt':item['resultReceipt'],'sourceArtifact':source,'observation':observation})
  for bound,limit,snapshot in snapshots:
   inputs._bound(bound,limit);_,current=inputs.prep._snapshot(inputs.Path(bound['path']),limit);need(current==snapshot,'profile_evidence_changed_during_observation')
  need((roles,preparation_receipts)==original,'profile_arguments_changed_during_observation')
 except (KeyError,TypeError,UnicodeError,AttributeError,OverflowError) as error:
  raise ValueError('saved_role_profiles_unavailable') from error
 return copy.deepcopy({'format':'axiom.saved-system-role-profiles/2','representations':representations,'executionAuthorized':False,'installationReady':False,'cryptographicSignatureVerifiedHere':False,'operationalIdentity':'unavailable'})
