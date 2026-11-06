import errno,json,os,subprocess
from unittest.mock import patch
seen=[]
def denied(path,flags,*args,**kwargs):
 seen.append({'path':path,'flags':flags})
 raise PermissionError(errno.EPERM,'synthetic inherited write denial',path)
with patch.object(subprocess.os,'open',side_effect=denied),patch.object(subprocess.Popen,'_execute_child')as execute:
 try:
  subprocess.Popen(['DO_NOT_EXECUTE'],stdin=subprocess.DEVNULL,stdout=1,stderr=subprocess.STDOUT)
 except PermissionError as error:
  assert error.errno==errno.EPERM
 else:raise AssertionError('expected prelaunch refusal')
 assert not execute.called
assert seen==[{'path':os.devnull,'flags':os.O_RDWR}]
print(json.dumps({'stdlib':subprocess.__file__,'openCalls':seen,'executeChildCalls':0,'mechanism':'DEVNULL opens write-capable descriptor before child launch','scope':'all os.open calls mocked; no process launched'}))
