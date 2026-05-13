import { RomlFile } from '../file/RomlFile';

describe('Empty primitive arrays (limitation #4)', () => {
  // Regression for fuzz limitation #4.
  //
  // PIPES emits empty arrays as `key||||` and the lexer
  // correctly returns `[]`. The other three inline-array styles
  // didn't:
  //
  //   BRACKETS    : encoder emitted `key` (no items), the lexer
  //                  dropped the line entirely.
  //   JSON_STYLE  : encoder emitted `key[]`, the lexer required
  //                  `,` in content and the line fell through.
  //   COLON_DELIM : encoder emitted `key:`, the lexer's
  //                  COLON-array gate (`remainder.includes(':')`)
  //                  failed and the line was parsed as a scalar
  //                  KV-COLON with empty value.
  //
  // Fix: special-case `array.length === 0` in `convertArray` to
  // route through the PIPES emitter regardless of the key's
  // hash. PIPES already handles arity-0 correctly via its
  // existing `key||||` shape, and the encoder already special-
  // cases the synthetic-wrapper keys to PIPES in the same way
  // (`selectArrayStyle`'s `isSyntheticWrapperKey` shortcut).

  function roundTrip(input: unknown): unknown {
    return RomlFile.romlToJson(RomlFile.jsonToRoml(input));
  }

  describe('empty arrays under each hash bucket', () => {
    it('round-trips an empty array under key `x` (hash bucket 0, PIPES)', () => {
      expect(roundTrip({ x: [] })).toEqual({ x: [] });
    });

    it('round-trips an empty array under key `elements` (hash bucket 1, BRACKETS)', () => {
      expect(roundTrip({ elements: [] })).toEqual({ elements: [] });
    });

    it('round-trips an empty array under key `abc` (hash bucket 2, JSON_STYLE)', () => {
      expect(roundTrip({ abc: [] })).toEqual({ abc: [] });
    });

    it('round-trips an empty array under key `id` (hash bucket 3, COLON_DELIM)', () => {
      expect(roundTrip({ id: [] })).toEqual({ id: [] });
    });
  });

  describe('top-level empty array (synthetic-wrapper PIPES, no-regression)', () => {
    it('round-trips a top-level empty array', () => {
      expect(roundTrip([])).toEqual([]);
    });
  });

  describe('multiple empty arrays in one object', () => {
    it('round-trips a mix of empty-array keys across hash buckets', () => {
      expect(
        roundTrip({ x: [], elements: [], abc: [], id: [] })
      ).toEqual({ x: [], elements: [], abc: [], id: [] });
    });

    it('round-trips an empty array alongside a non-empty array', () => {
      expect(
        roundTrip({ x: [], y: ['a'] })
      ).toEqual({ x: [], y: ['a'] });
    });
  });

  describe('regression: non-empty arrays still pick by hash', () => {
    it('regression: 2-element under PIPES key', () => {
      expect(roundTrip({ x: ['a', 'b'] })).toEqual({ x: ['a', 'b'] });
    });

    it('regression: 2-element under BRACKETS key', () => {
      expect(roundTrip({ elements: ['a', 'b'] })).toEqual({ elements: ['a', 'b'] });
    });

    it('regression: 2-element under JSON_STYLE key', () => {
      expect(roundTrip({ abc: ['a', 'b'] })).toEqual({ abc: ['a', 'b'] });
    });

    it('regression: 2-element under COLON_DELIM key', () => {
      expect(roundTrip({ id: ['a', 'b'] })).toEqual({ id: ['a', 'b'] });
    });

    it('regression: 1-element under PIPES key (arity-1 marker)', () => {
      expect(roundTrip({ x: ['only'] })).toEqual({ x: ['only'] });
    });
  });
});
