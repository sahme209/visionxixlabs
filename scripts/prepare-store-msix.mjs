import {readFileSync,mkdirSync,writeFileSync,copyFileSync,existsSync} from 'node:fs';
import {join,resolve,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const here=dirname(fileURLToPath(import.meta.url));
const escape=value=>value.replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll("'",'&apos;');
export function createStoreManifest(identity){
 if(!identity||typeof identity!=='object'||Array.isArray(identity)||Object.keys(identity).sort().join(',')!=='displayName,name,publisher,publisherDisplayName')throw Error('Exact Partner Center identity required');
 const {name,publisher,publisherDisplayName,displayName}=identity;
 if(typeof name!=='string'||!/^[A-Za-z0-9][A-Za-z0-9.-]{2,49}$/.test(name)||/replace|placeholder|example/i.test(name)||typeof publisher!=='string'||!/^CN=[^<>\x00-\x1f]{1,240}$/.test(publisher))throw Error('Reserved Partner Center identity required');
 for(const value of [displayName,publisherDisplayName])if(typeof value!=='string'||!value.trim()||value!==value.trim()||value.length>200||/[\x00-\x1f\x7f]/.test(value))throw Error('Valid Store display labels required');
 return `<?xml version="1.0" encoding="utf-8"?>
<Package xmlns="http://schemas.microsoft.com/appx/manifest/foundation/windows10" xmlns:uap="http://schemas.microsoft.com/appx/manifest/uap/windows10" xmlns:uap10="http://schemas.microsoft.com/appx/manifest/uap/windows10/10" xmlns:rescap="http://schemas.microsoft.com/appx/manifest/foundation/windows10/restrictedcapabilities" IgnorableNamespaces="uap uap10 rescap">
 <Identity Name="${escape(name)}" Publisher="${escape(publisher)}" Version="0.1.21.0" ProcessorArchitecture="x64"/>
 <Properties><DisplayName>${escape(displayName)}</DisplayName><PublisherDisplayName>${escape(publisherDisplayName)}</PublisherDisplayName><Description>Governed cloud operations and release delivery</Description><Logo>Assets\\StoreLogo.png</Logo></Properties>
 <Resources><Resource Language="en-us"/></Resources>
 <Dependencies><TargetDeviceFamily Name="Windows.Desktop" MinVersion="10.0.19041.0" MaxVersionTested="10.0.26100.0"/></Dependencies>
 <Capabilities><rescap:Capability Name="runFullTrust"/></Capabilities>
 <Applications><Application Id="AxiomAgent" Executable="axiom-desktop.exe" uap10:RuntimeBehavior="packagedClassicApp" uap10:TrustLevel="mediumIL">
  <uap:VisualElements DisplayName="${escape(displayName)}" Description="Governed cloud operations and release delivery" Square150x150Logo="Assets\\Square150x150Logo.png" Square44x44Logo="Assets\\Square44x44Logo.png" BackgroundColor="transparent"/>
  <Extensions><uap:Extension Category="windows.protocol"><uap:Protocol Name="axiom-agent"><uap:DisplayName>Axiom secure desktop pairing</uap:DisplayName></uap:Protocol></uap:Extension></Extensions>
 </Application></Applications>
</Package>
`;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const [identityFile,output,...extra]=process.argv.slice(2);
 if(!identityFile||!output||extra.length)throw Error('Usage: node scripts/prepare-store-msix.mjs <partner-center-identity.json> <new-output-directory>');
 const xml=createStoreManifest(JSON.parse(readFileSync(identityFile,'utf8'))),root=resolve(output);
 if(existsSync(root))throw Error('Output exists; never overwrite a prepared package');
 mkdirSync(join(root,'Assets'),{recursive:true});writeFileSync(join(root,'AppxManifest.xml'),xml,{flag:'wx'});
 for(const name of ['StoreLogo.png','Square150x150Logo.png','Square44x44Logo.png'])copyFileSync(join(here,'../desktop/src-tauri/icons',name),join(root,'Assets',name));
 writeFileSync(join(root,'PREPARATION-ONLY.json'),JSON.stringify({format:1,version:'0.1.21',architecture:'x64',status:'awaiting_verified_windows_payload_and_windows_acceptance',signed:false,storeSubmitted:false,installAccepted:false,requiredExecutable:'axiom-desktop.exe',pairingProtocol:'axiom-agent'},null,2)+'\n',{flag:'wx'});
 console.log('Manifest and existing Axiom assets prepared. No executable, MSIX, signature, submission or install acceptance was produced.');
}
