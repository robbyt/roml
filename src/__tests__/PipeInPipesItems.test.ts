import { RomlFile } from '../file/RomlFile';

describe('Pipe (`|`/`||`) handling in PIPES-style array items', () => {
  // Regression for fuzz limitation #12.
  //
  // PIPES is the `||`-delimited array style (`||` between items,
  // wrapping `||` at start and end): `key||a||b||c||`. The encoder
  // picks the array style by hashing the key (`simpleHash(key) % 4`),
  // so only some keys land in the PIPES bucket. The keys used here
  // (`x`, `foo`-paired-with-`x`) currently hash to PIPES; if the
  // hash function changes and they no longer do, swap in another key
  // whose hash output selects PIPES — keeping the test exercising
  // the PIPES code path is what makes it a regression for #12.
  //
  // Pre-fix failure modes:
  //   1. `||` inside an item — `{x: ["a||b", "c"]}` emitted
  //      `x||a||b||c||` and the lexer's plain `value.split('||')`
  //      mis-split into `["a", "b", "c"]` (3 items, lost the `||`).
  //   2. trailing `|` — `{x: ["a|", "b"]}` emitted `x||a|||b||`,
  //      the regex/split combo dropped or mangled the trailing `|`.
  //
  // Fix has two halves:
  //   - encoder: the PIPES array emitter (in `RomlConverter.ts`)
  //     now wraps any item containing `|` via the existing
  //     QUOTED-inside-PIPES path (`"a|b"` instead of bare `a|b`).
  //     The check is local to the PIPES emitter — NOT in
  //     `isAmbiguousString` — so scalar `|`-bearing values under
  //     non-COLLECTIONS keys keep their existing unquoted-style
  //     routing and don't hit the QUOTED escape pipeline (which
  //     would expose a separate, pre-existing unescape-ordering
  //     quirk for literal `\r`/`\n`/`\t`, tracked as #16).
  //   - lexer: PIPES content split is now quote-aware via
  //     `splitOutsideQuotes`, so `||` inside a quoted item is part
  //     of the item rather than a separator.

  function roundTrip(input: unknown): unknown {
    return RomlFile.romlToJson(RomlFile.jsonToRoml(input));
  }

  describe('array items containing pipes', () => {
    it('round-trips a single-`|` item', () => {
      const input = { x: ['a|b', 'c'] };
      expect(roundTrip(input)).toEqual(input);
    });

    it('round-trips a double-`||` item', () => {
      const input = { x: ['a||b', 'c'] };
      expect(roundTrip(input)).toEqual(input);
    });

    it('round-trips a triple-`|||` item', () => {
      const input = { x: ['a|||b', 'c'] };
      expect(roundTrip(input)).toEqual(input);
    });

    it('round-trips a trailing-`|` item', () => {
      const input = { x: ['a|', 'b'] };
      expect(roundTrip(input)).toEqual(input);
    });

    it('round-trips a leading-`|` item', () => {
      const input = { x: ['|a', 'b'] };
      expect(roundTrip(input)).toEqual(input);
    });

    it('round-trips a 2-element array of lone-`|` items', () => {
      const input = { x: ['|', '|'] };
      expect(roundTrip(input)).toEqual(input);
    });

    it('round-trips an item containing both `"` and `|` (escape composition)', () => {
      const input = { x: ['a"|b', 'c'] };
      expect(roundTrip(input)).toEqual(input);
    });

    it('round-trips an item containing `\\` and `|` together', () => {
      const input = { x: ['a\\|b', 'c'] };
      expect(roundTrip(input)).toEqual(input);
    });
  });

  describe('regression: existing PIPES round-trips still work', () => {
    it('round-trips a plain array (no pipes in items)', () => {
      const input = { x: ['a', 'b', 'c'] };
      expect(roundTrip(input)).toEqual(input);
    });

    it('round-trips a multi-key object that mixes PIPES and other styles', () => {
      const input = { x: ['a|b', 'c'], foo: 42 };
      expect(roundTrip(input)).toEqual(input);
    });
  });
});
