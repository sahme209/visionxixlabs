// Installed pg 8.23.1 private exports are intentionally untrusted at this boundary.
// requiredChannelBinding validates their runtime shape before using them.
declare module "pg/lib/crypto/sasl.js" { const value: unknown; export default value; }
declare module "pg/lib/crypto/cert-signatures.js" { const value: unknown; export default value; }
