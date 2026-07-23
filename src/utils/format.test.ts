import { describe, expect, it } from 'vitest';
import { formatMomentDate, initials, isUpcoming } from './format';

describe('moment formatting', () => {
  it('creates compact initials', () => expect(initials('Ada Lovelace')).toBe('AL'));
  it('formats local calendar dates without timezone drift', () => expect(formatMomentDate('2026-07-22')).toContain('2026'));
  it('distinguishes upcoming moments', () => expect(isUpcoming('2026-07-23', new Date('2026-07-22T12:00:00'))).toBe(true));
});
