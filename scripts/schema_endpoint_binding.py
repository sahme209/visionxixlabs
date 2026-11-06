"""Private response projection only. No IO, provider calls, logging or SQL.

Raw detail/URI stay caller-owned ephemeral inputs; Python strings cannot be
securely erased. This does not authenticate human authorization or prove PITR.
"""
import re
from urllib.parse import urlsplit,unquote,parse_qsl
VERCEL_PROJECT='prj_BwKc7V1daPJ938ZW2QKYxZsTkZnp'
VERCEL_TEAM='team_j0CEiAAorasdEVQyeAJjpNfm'
NEON_PROJECT='odd-union-57413470'
NEON_BRANCH='br-holy-voice-ai303o8m'
_UNVERIFIED={'status':'unverified','reason':'private_endpoint_binding_unverified'}
def _selected(metadata):
 if type(metadata)is not dict or type(metadata.get('envs'))is not list:return None
 matches=[x for x in metadata['envs']if type(x)is dict and x.get('key')=='DATABASE_URL'and type(x.get('target'))is list and 'production'in x['target']]
 if len(matches)!=1:return None
 item=matches[0]
 if not isinstance(item.get('id'),str)or not re.fullmatch(r'[A-Za-z0-9_-]{1,100}',item['id'])or type(item.get('updatedAt'))is not int:return None
 # Deliberately project away ALL values, even encrypted/plaintext metadata values.
 return {'id':item['id'],'updatedAt':item['updatedAt']}
def select_database_env_id(metadata):
 """Internal selection only, no metadata values returned or retained."""
 try:
  selected=_selected(metadata);return None if selected is None else selected['id']
 except Exception:return None
def verify_private_endpoint_binding(metadata,detail,endpoint_metadata):
 """Exact private existing URI→official endpoint→historical branch join.

Call only after explicit permission for private existing DATABASE_URL inspection.
No raw exception is ever exposed. This function never connects to the URI.
"""
 try:
  selected=_selected(metadata)
  if selected is None or type(detail)is not dict or detail.get('id')!=selected['id']or detail.get('key')!='DATABASE_URL'or detail.get('updatedAt')!=selected['updatedAt']or type(detail.get('target'))is not list or 'production'not in detail['target']:return dict(_UNVERIFIED)
  value=detail.get('value')
  if type(value)is not str or len(value)>8192 or any(ord(c)<33 for c in value):return dict(_UNVERIFIED)
  uri=urlsplit(value)
  if uri.scheme not in ('postgres','postgresql')or uri.fragment or uri.port not in (None,5432)or not uri.password or unquote(uri.username or '')!='neondb_owner'or uri.path!='/neondb':return dict(_UNVERIFIED)
  host=uri.hostname
  if type(host)is not str or not re.fullmatch(r'ep-[a-z0-9-]+(?:\.[a-z0-9-]+)+\.neon\.tech',host):return dict(_UNVERIFIED)
  options=parse_qsl(uri.query,keep_blank_values=True,strict_parsing=True)
  allowed={'sslmode','channel_binding','connect_timeout','pgbouncer','connection_limit','pool_timeout'}
  if any(k not in allowed for k,v in options)or len({k for k,v in options})!=len(options)or dict(options).get('sslmode')not in ('require','verify-full'):return dict(_UNVERIFIED)
  if type(endpoint_metadata)is not dict or type(endpoint_metadata.get('endpoints'))is not list:return dict(_UNVERIFIED)
  canonical=host.split('.',1);first=canonical[0];canonical_host=(first[:-7]if first.endswith('-pooler')else first)+'.'+canonical[1]
  matches=[e for e in endpoint_metadata['endpoints']if type(e)is dict and e.get('project_id')==NEON_PROJECT and e.get('branch_id')==NEON_BRANCH and e.get('host')==canonical_host and e.get('id')==canonical_host.split('.',1)[0]and e.get('type')=='read_write']
  if len(matches)!=1:return dict(_UNVERIFIED)
  return {'status':'binding_verified','vercel_project':VERCEL_PROJECT,'vercel_team':VERCEL_TEAM,'environment_id':selected['id'],'environment_updated_at':selected['updatedAt'],'neon_project':NEON_PROJECT,'neon_branch':NEON_BRANCH,'endpoint_id':matches[0]['id'],'canonical_host':canonical_host,'database':'neondb','role':'neondb_owner','credentialValueRetained':False,'operationalAuthorityGranted':False}
 except Exception:return dict(_UNVERIFIED)
