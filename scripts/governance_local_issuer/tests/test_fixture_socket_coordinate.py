"""Source/ABI-only socket contract. No socket, compiler, Node or host calls."""
import re
import unittest
from pathlib import Path
from urllib.parse import quote, unquote
ROOT=Path(__file__).resolve().parents[3]
class SocketCoordinate(unittest.TestCase):
 def test_darwin_budget_and_all_consumers(self):
  header=(ROOT/'packages/verified-issuer-runtime/native/synthetic_resource_contract.h').read_text()
  generation=re.search(r'#define AX_SYNTH_GENERATION "([a-f0-9]{32})"',header)[1]
  prefix,suffix=re.search(r'#define AX_SYNTH_SOCKET_PATH "([^"]+)" AX_SYNTH_GENERATION "([^"]+)"',header).groups()
  selected=prefix+generation+suffix
  self.assertEqual(selected,'/Library/AxiomQ/'+generation+'/socket')
  sdk=Path('/Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/sys/un.h').read_text()
  capacity=int(re.search(r'sun_path\[(\d+)\]',sdk)[1])
  self.assertEqual(capacity,104)
  old='/Library/Application Support/Vision XIX Labs/Axiom Synthetic Custodian/generations/'+generation+'/fixture/socket'
  self.assertEqual(len((old+'/.s.PGSQL.5432').encode()),144)
  self.assertGreater(len((old+'/.s.PGSQL.5432').encode())+1,capacity)
  self.assertEqual(len((selected+'/.s.PGSQL.5432').encode())+1,70)
  self.assertLessEqual(len((selected+'/.s.PGSQL.5432').encode())+1,capacity)
  self.assertEqual(unquote(quote(selected,safe='-_.~')),selected)
  native=(ROOT/'packages/verified-issuer-runtime/native/synthetic_fixture_producer.c').read_text()
  self.assertIn('const unsigned char*raw=(const unsigned char*)AX_SYNTH_SOCKET_PATH;',native)
  ts=(ROOT/'lib/governance/qualification/fixtureAuthorizationFrame.ts').read_text()
  self.assertIn("FIXTURE_SOCKET_DIRECTORY='/Library/AxiomQ/'+FIXTURE_GENERATION+'/socket'",ts)
  for name in ['privateSyntheticFixtureProducer.ts','privateFixtureSchedule.ts','privateFixtureAuthentication.ts']:
   body=(ROOT/'lib/governance/qualification'/name).read_text()
   self.assertIn('FIXTURE_SOCKET_DIRECTORY',body)
   self.assertNotIn('/fixture/socket',body)
if __name__=='__main__':unittest.main()
