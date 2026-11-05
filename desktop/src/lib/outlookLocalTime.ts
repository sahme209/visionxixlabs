/** Convert a datetime-local value without silently normalizing invalid dates or
 * nonexistent wall times. Fall-back overlaps retain Date's existing choice;
 * the saved action still presents the exact UTC instant for separate review. */
export function outlookLocalTimeToUtc(value: string): string {
  const parts = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/.exec(value);
  if (!parts || parts[0] !== value) throw new Error('invalid_outlook_local_time');
  const date = new Date(value);
  const expected = [Number(parts[1]), Number(parts[2]), Number(parts[3]), Number(parts[4]), Number(parts[5]), Number(parts[6] ?? 0), Number((parts[7] ?? '').padEnd(3, '0'))];
  const actual = [date.getFullYear(), date.getMonth() + 1, date.getDate(), date.getHours(), date.getMinutes(), date.getSeconds(), date.getMilliseconds()];
  if (!Number.isFinite(date.getTime()) || actual.some((part, index) => part !== expected[index])) throw new Error('invalid_outlook_local_time');
  return date.toISOString();
}
