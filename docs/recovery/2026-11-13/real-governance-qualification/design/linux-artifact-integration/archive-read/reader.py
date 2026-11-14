"""Pinned source inspection; no extraction, imports or execution of source bytes."""
import gzip,hashlib,http.client,io,json,os,selectors,stat,subprocess,sys,time
MAX_COMPRESSED=8*1024**2
MAX_EXPANDED=16*1024**2
MAX_ENTRIES=1024
MAX_PATH_BYTES=512
ROOT='clock-bound-371058f8f6a1786d4a4ab3eed9f5f2f16eea7777'
TREE_SHA='dc5518ce9b96bce6fa4a59e468287c02f970f843bc722ea26567ccc04b4f8b2c'
HOST='codeload.github.com'
REQUEST_PATH='/aws/clock-bound/tar.gz/371058f8f6a1786d4a4ab3eed9f5f2f16eea7777'
def need(ok):
    if not ok: raise ValueError('pinned_archive_refused')
def path_ok(value):
    need(isinstance(value,str) and 0<len(value.encode('utf-8'))<=MAX_PATH_BYTES)
    need(not value.startswith('/') and '\\' not in value and all(x not in ('','.','..') for x in value.split('/')))
    need(all(ord(c)>=32 and ord(c)!=127 for c in value))
    return value
def octal(raw):
    need(not raw or not raw[0]&128)
    raw=raw.rstrip(b'\0 ').lstrip(b' ')
    need(bool(raw) and all(c in b'01234567' for c in raw))
    return int(raw,8)
def text(raw):
    head,sep,tail=raw.partition(b'\0');need(not sep or not tail.strip(b'\0'))
    return head.decode('utf-8','strict')
def validate_against_inventory(compressed,inventory,root=ROOT):
    need(isinstance(compressed,bytes) and 0<len(compressed)<=MAX_COMPRESSED)
    path_ok(root);need('/' not in root and isinstance(inventory,dict) and bool(inventory))
    directories={root}
    for name,want in inventory.items():
        path_ok(name);need(isinstance(want,dict) and want.get('mode') in ('100644','100755'))
        need(type(want.get('size')) is int and 0<=want['size']<=MAX_EXPANDED)
        need(isinstance(want.get('sha'),str) and len(want['sha'])==40 and all(c in '0123456789abcdef' for c in want['sha']))
        parts=(root+'/'+name).split('/')
        directories.update('/'.join(parts[:i]) for i in range(1,len(parts)))
    try:
        with gzip.GzipFile(fileobj=io.BytesIO(compressed)) as z:
            expanded=z.read(MAX_EXPANDED+1);need(len(expanded)<=MAX_EXPANDED)
            need(z.read(1)==b'')
    except (OSError,EOFError,UnicodeError) as e: raise ValueError('pinned_archive_refused') from e
    need(len(expanded)%512==0)
    result={};seen=set();pos=0;count=0;ended=False
    while pos<len(expanded):
        header=expanded[pos:pos+512];pos+=512
        if header==bytes(512):
            need(pos+512<=len(expanded) and expanded[pos:]==bytes(len(expanded)-pos));ended=True;break
        count+=1;need(count<=MAX_ENTRIES)
        need(octal(header[148:156])==sum(header[:148])+8*32+sum(header[156:]))
        need(header[257:263] in (b'ustar\0',b'ustar '))
        kind=header[156:157];need(kind in (b'0',b'\0',b'5',b'g'))
        name=text(header[:100]);prefix=text(header[345:500]);name=(prefix+'/'+name) if prefix else name
        if kind==b'5' and name.endswith('/'):name=name[:-1]
        path_ok(name);need(name not in seen);seen.add(name)
        need(not text(header[157:257]))
        length=octal(header[124:136]);mode=octal(header[100:108]);need(mode&~0o777==0)
        need(length<=MAX_EXPANDED and pos+((length+511)//512)*512<=len(expanded))
        body=expanded[pos:pos+length];padding=expanded[pos+length:pos+((length+511)//512)*512];need(not padding.strip(b'\0'))
        pos+=((length+511)//512)*512
        if kind==b'g':
            # Git archive's single global commit comment is inert metadata.
            need(count==1 and name=='pax_global_header' and length<=1024)
            expected=b'comment=371058f8f6a1786d4a4ab3eed9f5f2f16eea7777\n'
            prefix,separator,payload=body.partition(b' ')
            need(separator==b' ' and prefix.isdigit() and prefix==str(len(body)).encode() and payload==expected)
            continue
        if kind==b'5':need(name in directories and length==0);continue
        need(name.startswith(root+'/'));relative=name[len(root)+1:];need(relative in inventory)
        want=inventory[relative];need(length==want['size'])
        need(bool(mode&0o111)==(want['mode']=='100755'))
        need(hashlib.sha1(b'blob '+str(length).encode()+b'\0'+body).hexdigest()==want['sha'])
        result[relative]=body
    need(ended and set(result)==set(inventory))
    return result
def validate_archive(compressed,tree_bytes):
    need(hashlib.sha256(tree_bytes).hexdigest()==TREE_SHA)
    tree=json.loads(tree_bytes);need(tree.get('truncated') is False)
    inventory={}
    for entry in tree['tree']:
        need(entry['type'] in ('tree','blob'))
        if entry['type']=='blob':
            need(entry['path'] not in inventory);inventory[entry['path']]={k:entry[k] for k in ('sha','size','mode')}
    need(len(tree['tree'])==413 and len(inventory)==322 and sum(v['size'] for v in inventory.values())==3751845)
    return validate_against_inventory(compressed,inventory)
def _network_worker():
    # Direct HTTPSConnection does not consult proxy variables or follow redirects.
    c=http.client.HTTPSConnection(HOST,timeout=30)
    try:
        c.request('GET',REQUEST_PATH,headers={'Accept':'application/octet-stream','User-Agent':'Axiom-pinned-source-inspection/1','Connection':'close'})
        r=c.getresponse();need(r.status==200)
        if r.getheader('Content-Length') is not None:need(int(r.getheader('Content-Length'))<=MAX_COMPRESSED)
        size=0
        while True:
            data=r.read1(min(65536,MAX_COMPRESSED+1-size))
            if not data:break
            size+=len(data);need(size<=MAX_COMPRESSED)
            sys.stdout.buffer.write(data);sys.stdout.buffer.flush()
    finally:c.close()
def download_once():
    # Hard outer deadline includes DNS, TLS, headers and every chunk. Worker is
    # local reviewed code, not any fetched script. No alternate URL or retry.
    deadline=time.monotonic()+30
    child=subprocess.Popen([sys.executable,'-I',os.path.realpath(__file__),'--network-worker'],stdin=subprocess.DEVNULL,stdout=subprocess.PIPE,stderr=subprocess.DEVNULL,env={},start_new_session=True)
    data=bytearray();selector=selectors.DefaultSelector();selector.register(child.stdout,selectors.EVENT_READ)
    try:
        while True:
            remaining=deadline-time.monotonic();need(remaining>0)
            events=selector.select(remaining);need(bool(events))
            chunk=os.read(child.stdout.fileno(),min(65536,MAX_COMPRESSED+1-len(data)))
            if not chunk:break
            data.extend(chunk);need(len(data)<=MAX_COMPRESSED)
        need(child.wait(timeout=max(0.001,deadline-time.monotonic()))==0)
        return bytes(data)
    finally:
        selector.close();child.stdout.close()
        if child.poll() is None:child.kill()
        child.wait(timeout=5)
def save_verified(destination,files):
    # Own newly created directory only; no overwrite and no archive metadata.
    os.mkdir(destination,0o700)
    root=os.open(destination,os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW)
    try:
        for name,data in files.items():
            path_ok(name);parts=name.split('/');fd=os.dup(root)
            try:
                for part in parts[:-1]:
                    try:os.mkdir(part,0o700,dir_fd=fd)
                    except FileExistsError:pass
                    nxt=os.open(part,os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW,dir_fd=fd);os.close(fd);fd=nxt
                    s=os.fstat(fd);need(s.st_uid==os.getuid() and stat.S_IMODE(s.st_mode)==0o700)
                target=os.open(parts[-1],os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600,dir_fd=fd)
                with os.fdopen(target,'wb') as f:f.write(data)
            finally:os.close(fd)
    finally:os.close(root)
def run_once(output,tree_bytes):
    os.mkdir(output,0o700) # existing output permanently refuses another attempt
    status={'complete':False,'requestConsumed':False}
    def receipt():
        tmp=os.path.join(output,'RESULT.json')
        fd=os.open(tmp,os.O_WRONLY|os.O_CREAT|os.O_TRUNC|os.O_NOFOLLOW,0o600)
        with os.fdopen(fd,'w') as f:json.dump(status,f,sort_keys=True)
    receipt()
    try:
        need(hashlib.sha256(tree_bytes).hexdigest()==TREE_SHA)
        status['requestConsumed']=True;receipt()
        body=download_once();status['archiveSha256']=hashlib.sha256(body).hexdigest();status['compressedBytes']=len(body)
        files=validate_archive(body,tree_bytes);save_verified(os.path.join(output,'source'),files)
        status.update(complete=True,files=len(files),sourceBytes=sum(map(len,files.values())))
    except Exception:
        status['failed']=True;raise ValueError('pinned_archive_refused') from None
    finally:receipt()
if __name__=='__main__':
    if sys.argv[1:]==['--network-worker']:
        try:_network_worker()
        except Exception:sys.exit(70)
    else:sys.exit('No implicit acquisition entrypoint; reviewed root invocation required')
