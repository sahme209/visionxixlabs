/** Pure compatibility reader; never rewrites errors, retries or performs IO.
 * Only own data properties are trusted; arbitrary text/getters remain unknown. */
function ownData(value: unknown, key: string): unknown {
  if (!value || typeof value !== 'object') return undefined;
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  if (descriptor && !Object.hasOwn(descriptor, 'value')) throw new Error('database_error_data_unavailable');
  return descriptor?.value;
}
function adapterConflict(error: unknown): boolean {
  return ownData(error, 'name') === 'DriverAdapterError'
    && ownData(ownData(error, 'cause'), 'kind') === 'TransactionWriteConflict';
}
export function databaseErrorCode(error: unknown): string | undefined {
  try {
    const code = ownData(error, 'code');
    if (typeof code === 'string') {
      // Prisma 7 raw-query errors can wrap the same adapter abort. Inspect only
      // this fixed path; every other existing code keeps its original meaning.
      if (code === 'P2010') {
        try { if (adapterConflict(ownData(ownData(error, 'meta'), 'driverAdapterError'))) return 'P2034'; } catch { /* retain original code */ }
      }
      return code;
    }
    if (adapterConflict(error)) return 'P2034';
    return undefined;
  } catch { return undefined; }
}
