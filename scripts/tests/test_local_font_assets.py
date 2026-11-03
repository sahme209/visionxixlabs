"""Acceptance of retained local font bytes/CSS; not vendor or rendering attestation."""
import hashlib,json,re,subprocess,unittest
from pathlib import Path
ROOT=Path(__file__).parents[2]
class LocalFonts(unittest.TestCase):
 def manifest(self):return json.loads((ROOT/'public/fonts/provenance.json').read_text())
 def test_remote_font_fetches_removed_from_actual_entrypoints(self):
  layout=(ROOT/'app/layout.tsx').read_text();css=(ROOT/'app/globals.css').read_text()
  self.assertNotRegex(layout,r'next/font/google|\bInter\(|\bJetBrains_Mono\(')
  self.assertNotRegex(css,r'@import\s+(?:url\()?[^;]*(?:fonts\.googleapis|fonts\.gstatic)')
 def test_all_retained_subsets_bytes_variable_faces_and_license_notices(self):
  data=self.manifest();self.assertEqual(data['licenseStatus'],'official_notices_included');self.assertEqual(data['publicationStatus'],'not_authorized_by_license_reads');self.assertEqual(data['upstreamAuthenticity'],'unavailable')
  self.assertEqual(data['retainedFaceMapSha256'],'056b263b45c747a74809e0e605bf5556dd126bbe4759727abf4dde9e8f784333')
  faces=data['faces'];self.assertEqual(len(faces),13)
  self.assertEqual({f['family']for f in faces},{'Inter','JetBrains Mono'})
  self.assertEqual(sum(f['family']=='Inter'for f in faces),7);self.assertEqual(sum(f['family']=='JetBrains Mono'for f in faces),6)
  self.assertEqual({p.name for p in (ROOT/'public/fonts').glob('*.woff2')},{f['file']for f in faces})
  css=(ROOT/'styles/local-fonts.css').read_text();blocks=re.findall(r'@font-face\s*\{([^}]+)\}',css)
  actual={}
  for block in blocks:
   fields={k.strip():v.strip()for k,v in re.findall(r'([\w-]+)\s*:\s*([^;]+);',block)}
   url=re.search(r'url\([\'"]?(/fonts/[^\)\'\"]+)',fields.get('src',''))
   if url:actual[Path(url.group(1)).name]=fields
  self.assertEqual(len(actual),13)
  for face in faces:
   body=(ROOT/'public/fonts'/face['file']).read_bytes();self.assertEqual(len(body),face['size']);self.assertEqual(hashlib.sha256(body).hexdigest(),face['sha256'])
   declaration=actual[face['file']];self.assertEqual(declaration['unicode-range'],face['unicodeRange']);self.assertEqual(declaration['font-style'],'normal');self.assertEqual(declaration['font-display'],'swap')
   self.assertEqual(declaration['font-weight'],'100 900'if face['family']=='Inter'else'100 800');self.assertEqual(declaration['font-family'].strip('"'),face['family'])
  # Source-derived golden acceptance maps, not a runtime identity or license grant.
  golden=[[f['family'],f['file'],f['sha256'],f['unicodeRange']]for f in faces]
  self.assertEqual(hashlib.sha256(json.dumps(golden,separators=(',',':')).encode()).hexdigest(),data['retainedFaceMapSha256'])
 def test_preserved_variables_fallback_metrics_and_only_latin_preloads(self):
  data=self.manifest();layout=(ROOT/'app/layout.tsx').read_text();css=(ROOT/'styles/local-fonts.css').read_text()
  self.assertIn('axiom-font-inter axiom-font-mono antialiased',layout)
  self.assertRegex(css,r'--font-inter:\s*"Inter",\s*"Inter Fallback"')
  self.assertRegex(css,r'--font-mono:\s*"JetBrains Mono",\s*"JetBrains Mono Fallback"')
  for family,values in [('Inter Fallback',['90.44%','22.52%','0.00%','107.12%']),('JetBrains Mono Fallback',['75.79%','22.29%','0.00%','134.59%'])]:
   block=next(b for b in re.findall(r'@font-face\s*\{([^}]+)\}',css)if 'font-family: "'+family+'"'in b)
   self.assertIn('local("Arial")',block)
   for value in values:self.assertIn(value,block)
  preloads=re.findall(r'<link\s+rel="preload"\s+href="/fonts/([^\"]+)"',layout)
  self.assertEqual(set(preloads),{f['file']for f in data['faces']if f['preload']});self.assertEqual(len(preloads),2)
  self.assertTrue(all(f['subset']=='latin'for f in data['faces']if f['preload']))
 def test_official_notices_are_packaged_byte_exact_with_matching_copyright(self):
  expected={'Inter':('Inter-OFL.txt','262481e844521b326f5ecd053e59b98c8b2da78c8ee1bdbb6e8174305e54935a',b'2016 The Inter Project Authors'),'JetBrains Mono':('JetBrainsMono-OFL.txt','a76abf002c49097d146e86740a3105a5d00450b1592e820a1109a8c5680cd697',b'2020 The JetBrains Mono Project Authors')}
  notices=self.manifest()['licenseNotices'];self.assertEqual(set(notices),set(expected))
  for family,(name,digest,copyright)in expected.items():
   notice=notices[family];self.assertEqual(notice['file'],name)
   raw=(ROOT/'public/fonts'/name).read_bytes()
   self.assertEqual(hashlib.sha256(raw).hexdigest(),digest);self.assertEqual(notice['sha256'],digest)
   self.assertIn(copyright,raw);self.assertIn(b'SIL OPEN FONT LICENSE Version 1.1',raw)
   self.assertIn(b'TERMINATION',raw);self.assertIn(b'DISCLAIMER',raw)
  self.assertFalse(self.manifest()['publicationAuthorized'])
 def test_actual_font_metadata_matches_declared_families_and_axes(self):
  node=Path('/Users/samirahmed/.nvm/versions/node/v24.21.0/bin/node');fontkit=ROOT/'node_modules/next/dist/compiled/@next/font/dist/fontkit/index.js'
  if not node.exists()or not fontkit.exists():self.skipTest('installed pinned Node/Next font parser prerequisite unavailable')
  script="const fs=require('node:fs'),create=require(process.argv[1]).default;const root=process.argv[2];const manifest=JSON.parse(fs.readFileSync(root+'/provenance.json','utf8'));console.log(JSON.stringify(manifest.faces.map(face=>{const f=create(fs.readFileSync(root+'/'+face.file));return {file:face.file,family:f.familyName,subfamily:f.subfamilyName,axes:f.variationAxes,version:f.version}})))"
  command=[str(node),'-e',script,str(fontkit),str(ROOT/'public/fonts')]
  if Path('/usr/bin/sandbox-exec').exists():command=['/usr/bin/sandbox-exec','-p','(version 1)(allow default)(deny network*)(deny file-write*)',*command]
  result=subprocess.run(command,capture_output=True,text=True,timeout=10,env={'PATH':'/usr/bin:/bin','LANG':'C'})
  self.assertEqual(result.returncode,0,result.stderr);observed=json.loads(result.stdout)
  for item,face in zip(observed,self.manifest()['faces']):
   self.assertEqual(item['family'],face['family']);self.assertEqual(item['subfamily'],'Regular');self.assertEqual(item['version'],face['metadata']['version']);self.assertEqual(item['axes'],face['metadata']['variationAxes'])
if __name__=='__main__':unittest.main()
