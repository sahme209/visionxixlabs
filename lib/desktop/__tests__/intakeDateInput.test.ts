import {expect,it} from 'vitest';
import {intakeDateInputValue} from '../../../desktop/src/lib/intakeDateInput';
it('preserves the original instant when a local revision control is saved again',()=>{
 for (const instant of ['2026-10-29T00:00:00.000Z','2026-10-29T03:45:00.000Z','2026-01-12T02:15:00.000Z']) {
  expect(new Date(intakeDateInputValue(instant)).toISOString()).toBe(instant);
 }
});
it.each([null,undefined,{},'invalid',''])('refuses invalid date value',value=>expect(intakeDateInputValue(value)).toBe(''));
