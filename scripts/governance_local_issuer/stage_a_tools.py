"""Private source-owned Stage A tool composition. No caller runner/policy switch.

Only execute_stage_a_packet applies the policy. This object does not attest it.
"""
from pathlib import Path
from governance_local_issuer import fixture_recipe_packet as files
engine=files.engine_tools
builder=engine.builder()
class _ContainedCommands:
 def __init__(self,p):self.repo=p['repo'];self.revision=p['sourceRevision'];self.node=p['node']['path'];self.npm=p['npmCli']['path'];self.work=Path(p['work']);self.cache=p['cache']
 def git(self,repo,args):
  allowed=[['rev-parse',self.revision+'^{commit}'],['archive','--format=tar',self.revision],*[['show',self.revision+':'+name]for name in ('package.json','package-lock.json','prisma/schema.prisma')]]
  if str(repo)!=self.repo or args not in allowed:builder.fail('fixed_stage_a_git_operation_required')
  return ['/usr/bin/git','-C',self.repo,*args]
 def install_node(self,node,source_cache,protected_repo):
  if str(node)!=self.node or str(protected_repo)!=self.repo or str(source_cache)!=self.cache:builder.fail('fixed_stage_a_install_required')
  return [self.node]
class _Builder:
 def __init__(self,p):self.commands=_ContainedCommands(p)
 def git_bytes(self,repo,args):return builder._git_bytes_core(repo,args,self.commands)
 def source_inputs(self,repo,revision):
  if revision!=self.commands.revision:builder.fail('fixed_stage_a_revision_required')
  return builder._source_inputs_core(repo,revision,self.git_bytes)
 def install_offline(self,stage,plan,cache,node,npm,source_cache,repo):
  if str(npm)!=self.commands.npm or Path(stage)!=self.commands.work/'offline/stage' or Path(cache)!=self.commands.work/'offline/npm-cache':builder.fail('fixed_stage_a_install_required')
  self.commands.install_node(node,source_cache,repo)
  return builder._install_offline_core(stage,plan,cache,node,npm,source_cache,repo,self.commands)
 def observe_generation_sources(self,*args):return builder.observe_generation_sources(*args)
 def observe_build_sources(self,*args):return builder.observe_build_sources(*args)
 def json_data(self,*args):return builder.json_data(*args)
class _Engine:
 def __init__(self,p,b):
  self.builder=b;self.stage=str(Path(p['work'])/'offline/stage');self.run=str(Path(p['work'])/'generation');self.bound=p['boundInputs']['path'];self.repo=p['repo'];self.revision=p['sourceRevision'];self.cache=p['cache'];self.node=p['node']['path']
 def _coordinates(self,stage,directory,repo,revision,cache,node):
  if tuple(map(str,(stage,directory,repo,revision,cache,node)))!=(self.stage,self.bound,self.repo,self.revision,self.cache,self.node):engine.fail('fixed_stage_a_generation_required')
 def verify_archived_inputs(self,stage,repo,revision):
  if tuple(map(str,(stage,repo,revision)))!=(self.stage,self.repo,self.revision):engine.fail('fixed_stage_a_generation_required')
  return engine._verify_archived_inputs(stage,repo,revision,self.builder)
 def verify_generation_sources(self,stage,cache):
  if tuple(map(str,(stage,cache)))!=(self.stage,self.cache):engine.fail('fixed_stage_a_generation_required')
  return engine._verify_generation_sources(stage,cache,self.builder)
 def prepare_generation(self,stage,directory,repo,revision,cache,node):
  self._coordinates(stage,directory,repo,revision,cache,node);return engine._prepare_generation(stage,directory,repo,revision,cache,node,self)
 def execute_generation(self,stage,directory,repo,revision,cache,node,run,timeout=120):
  self._coordinates(stage,directory,repo,revision,cache,node)
  if str(run)!=self.run:engine.fail('fixed_stage_a_generation_required')
  return engine._execute_generation(stage,directory,repo,revision,cache,node,run,timeout,self)
 def generation_node(self,node,stage,directory,run):
  if tuple(map(str,(node,stage,directory,run)))!=(self.node,self.stage,self.bound,self.run):engine.fail('fixed_stage_a_generation_required')
  return [self.node]
class _Tools:
 def __init__(self,p):self.builder=_Builder(p);self.engine=_Engine(p,self.builder)
def _create_stage_a_tools(verified_packet):return _Tools(verified_packet)
