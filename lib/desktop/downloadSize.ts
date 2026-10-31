/** Decimal download units match browser/file-manager MB. This is compressed
 * installer size from the selected published asset, never installed footprint. */
export function formatDesktopInstallerSize(bytes:number):string|null{
 if(!Number.isSafeInteger(bytes)||bytes<=0)return null;
 return bytes>=1_000_000?`${(bytes/1_000_000).toFixed(1)} MB`:bytes>=1000?`${(bytes/1000).toFixed(1)} kB`:`${bytes} bytes`;
}
