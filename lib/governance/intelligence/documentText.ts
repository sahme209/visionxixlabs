/** Browser/server shared inert-text validation. No I/O, URLs, models or hashes. */
export function decodePolicyUploadBytes(bytes:Uint8Array):string{
 if(!(bytes instanceof Uint8Array)||bytes.byteLength===0||bytes.byteLength>65536)throw Error('document_byte_limit');
 const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
 if(/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(text)||/-----BEGIN (?:[A-Z ]*PRIVATE KEY)|\bAKIA[A-Z0-9]{16}\b|\b(?:gh[pousr]_[A-Za-z0-9]{20,}|password\s*[:=])/i.test(text))throw Error('document_secret_or_binary_refused');
 if(text.split(/\r?\n/).length>1000)throw Error('document_line_limit');
 return text;
}
