import { RomlFile } from '../file/RomlFile';

describe('Pipe (`|`/`||`) handling in PIPES-style array items', () => {
  // Regression for fuzz limitation #12.
  //
  // PIPES is the `||`-delimited array style (`||` between items,
  // wrapping `||` at start and end): `key||a||b||c||`. The encoder
  // picks the array style by hashing the key, so any single-char key
  // like `x` or any short key like `p` / `pp` deterministically lands
  // in the PIPES bucket. This fixture relies on that determinism so
  // the tests actually exercise the PIPES code path; if the hash
  // changes shape and one of these keys moves to a different style,
  // pick another short key that still routes to PIPES.
  //
  // Pre-fix failure modes:
  //   1. `||` inside an item — `{x: ["a||b", "c"]}` emitted
  //      `x||a||b||c||` and the lexer's plain `value.split('||')`
  //      mis-split into `["a", "b", "c"]` (3 items, lost the `||`).
  //   2. trailing `|` — `{x: ["a|", "b"]}` emitted `x||a|||b||`,
  //      the regex/split combo dropped or mangled the trailing `|`.
  //
  // Fix has two halves:
  //   - encoder: `isAmbiguousString` now flags `|`, so PIPES items
  //     containing pipes route through the QUOTED-inside-PIPES form
  //     (`"a|b"` instead of bare `a|b`).
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
