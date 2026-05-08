import { RomlFile } from '../file/RomlFile';

describe('Type-aware syntax selection', () => {
  // Regression for fuzz limitations #7 and #8.
  //
  // #7: `selectSyntax`'s semantic-category override fired regardless
  // of value type. PERSONAL → QUOTED, which wraps the value in
  // double quotes, so a non-string value gets stringified:
  //
  //   {name: false}  -> name="false"  -> {"name": "false"}
  //   {name: 42}     -> name="42"     -> {"name": "42"}
  //   {name: null}   -> name="__NULL__" -> {"name": "__NULL__"}
  //
  // #8: `null` is passed to `selectSyntax` as the sentinel string
  // `'__NULL__'`, so it took the string branch instead of the
  // special-value branch. With a vowel-starting key on an odd line
  // that branch picks QUOTED, again wrapping the sentinel:
  //
  //   {u: null}      -> u="__NULL__" -> {"u": "__NULL__"}
  //
  // Fix:
  //  - Reorder `isSpecialValue` ahead of the type-specific branches
  //    so null / undefined / empty-string sentinels always pick a
  //    style that emits the marker UNQUOTED (FAKE_COMMENT on odd
  //    lines, DOLLAR on even).
  //  - Constrain the semantic-category override to `valueType ===
  //    'string'` so it only applies to true string values; non-string
  //    values fall through to the value-type branches (BRACKETS for
  //    booleans, AMPERSAND/COLON for numbers, etc.).

  function roundTrip(input: unknown): unknown {
    return RomlFile.romlToJson(RomlFile.jsonToRoml(input));
  }

  describe('limitation #7: semantic-category override for non-string values', () => {
    it('round-trips `name: false` (PERSONAL → would force QUOTED)', () => {
      expect(roundTrip({ name: false })).toEqual({ name: false });
    });

    it('round-trips `name: 42` (PERSONAL → would force QUOTED)', () => {
      expect(roundTrip({ name: 42 })).toEqual({ name: 42 });
    });

    it('round-trips `name: null` (combines #7 and #8)', () => {
      expect(roundTrip({ name: null })).toEqual({ name: null });
    });

    it('round-trips `id: true` (TECHNICAL semantic skipped for non-string; falls through to boolean branch)', () => {
      // `id` is in the TECHNICAL category which would normally map
      // to AMPERSAND, but the type-aware gate skips the override for
      // non-strings so a boolean value goes through the boolean
      // branch instead (BRACKETS on odd lines / `=yes|no` on even).
      expect(roundTrip({ id: true })).toEqual({ id: true });
    });

    it('round-trips `salary: 50000` (FINANCIAL — preserved as number)', () => {
      expect(roundTrip({ salary: 50000 })).toEqual({ salary: 50000 });
    });

    it('still round-trips `name: "Robert"` (PERSONAL strings still quote)', () => {
      expect(roundTrip({ name: 'Robert' })).toEqual({ name: 'Robert' });
    });
  });

  describe('limitation #8: null with vowel-starting key', () => {
    it('round-trips `u: null` (single-letter vowel key)', () => {
      expect(roundTrip({ u: null })).toEqual({ u: null });
    });

    it('round-trips `a: null`', () => {
      expect(roundTrip({ a: null })).toEqual({ a: null });
    });

    it('round-trips `email: null` (vowel-start + PERSONAL semantic)', () => {
      expect(roundTrip({ email: null })).toEqual({ email: null });
    });

    it('round-trips multiple vowel-start null keys in one object', () => {
      const input = { i: null, e: null, o: null };
      expect(roundTrip(input)).toEqual(input);
    });

    it('still round-trips a consonant-key null (no regression)', () => {
      expect(roundTrip({ x: null })).toEqual({ x: null });
    });

    it('round-trips a null at the second-and-beyond entry positions', () => {
      // Forces the null to land on counter=2 (even line, DOLLAR).
      const input = { first: 1, u: null, third: 'x' };
      expect(roundTrip(input)).toEqual(input);
    });

    it('round-trips null deeply nested under vowel-starting keys', () => {
      const input = { a: { o: { u: null } } };
      expect(roundTrip(input)).toEqual(input);
    });
  });
});
