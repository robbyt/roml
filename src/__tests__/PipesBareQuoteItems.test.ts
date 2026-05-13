import { RomlFile } from '../file/RomlFile';

describe('PIPES items containing bare `"` (limitation #14 residual)', () => {
  // Regression for the PIPES portion of fuzz limitation #14 that
  // PR #35 (limitation #11) left as a follow-up.
  //
  // The PIPES array emitter flagged items containing `|` (PR #32)
  // and items that `isAmbiguousString` already routed through
  // QUOTED (e.g. leading/trailing `"`). But a `"` in the middle
  // of an item passed through unquoted, and the lexer's
  // `splitOutsideQuotes` would then toggle `inQuotes` mid-item:
  //
  //   {x: ['a"b', 'c']} -> x||a"b||c|| -> {x: 'a"b||c'}
  //
  // The lexer reads the first `"` of `a"b` as a quote-open,
  // continues in-quotes past the `||` separator, and never closes
  // because the item has no second `"`. Result: a single-string
  // scalar containing the would-be-separator bytes.
  //
  // Even-count internal `"`s happened to round-trip because the
  // state ends balanced (`a"b"c` → in, out, end), so this bug
  // surfaces specifically with odd-count bare-`"` items.
  //
  // Fix: extend the PIPES item-quoting check in `RomlConverter.ts`
  // to also flag items containing any `"`. Routes them through
  // the existing QUOTED-inside-PIPES path, which uses
  // `escapeStringValue` to escape the embedded quotes.

  function roundTrip(input: unknown): unknown {
    return RomlFile.romlToJson(RomlFile.jsonToRoml(input));
  }

  describe('items with odd-count internal quotes (previously broken)', () => {
    it('round-trips a single mid-string `"`', () => {
      const input = { x: ['a"b', 'c'] };
      expect(roundTrip(input)).toEqual(input);
    });

    it('round-trips three internal quotes', () => {
      const input = { x: ['a"b"c"d', 'e'] };
      expect(roundTrip(input)).toEqual(input);
    });

    it('round-trips a top-level array root with bare-`"` item', () => {
      const input = ['a"b', 'c'];
      expect(roundTrip(input)).toEqual(input);
    });

    it('round-trips a `"` next to `|` in an item', () => {
      const input = { x: ['a"|b', 'c'] };
      expect(roundTrip(input)).toEqual(input);
    });

    it('round-trips an item with `"` and embedded `\\`', () => {
      const input = { x: ['a"\\b', 'c'] };
      expect(roundTrip(input)).toEqual(input);
    });
  });

  describe('regression: items that already worked still work', () => {
    it('round-trips leading-`"` items (`isAmbiguousString` flagged)', () => {
      const input = { x: ['"x', 'y'] };
      expect(roundTrip(input)).toEqual(input);
    });

    it('round-trips trailing-`"` items', () => {
      const input = { x: ['x"', 'y'] };
      expect(roundTrip(input)).toEqual(input);
    });

    it('round-trips lone-`"` items', () => {
      const input = { x: ['"', 'y'] };
      expect(roundTrip(input)).toEqual(input);
    });

    it('round-trips even-count internal quotes (state was balanced)', () => {
      const input = { x: ['a"b"c', 'd'] };
      expect(roundTrip(input)).toEqual(input);
    });

    it('round-trips plain items (no quotes)', () => {
      const input = { x: ['a', 'b', 'c'] };
      expect(roundTrip(input)).toEqual(input);
    });

    it('round-trips items containing `|` (#12 fix path)', () => {
      const input = { x: ['a|b', 'c'] };
      expect(roundTrip(input)).toEqual(input);
    });
  });
});
