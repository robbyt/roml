import { RomlFile } from '../file/RomlFile';

describe('BRACKETS items containing `>` or `<` (limitation #9)', () => {
  // Regression for fuzz limitation #9.
  //
  // BRACKETS emits items as `<value>`, so a `>` byte inside the
  // item content terminates the item early. The lexer used
  // `<([^>]*)>` (matchAll), structurally unable to represent
  // any `>` inside an item:
  //
  //   {elements: ['a>b', 'c']} -> elements<a>b><c> -> {elements: ['a','c']}
  //
  // `<` happened to round-trip because the regex `[^>]*` doesn't
  // exclude it, but a leading `>` collapsed entire items because
  // the empty match between consecutive `>`s got filtered out as
  // an empty string.
  //
  // Fix has two halves:
  //   - encoder: flag `>` and `<` in items so they route through
  //     the existing `<"escaped">` (QUOTED-inside-BRACKETS) path.
  //   - lexer: replace the regex extraction with a quote-aware
  //     walker that treats `>` as an item terminator only outside
  //     a `"..."` region within the item. Mirrors the
  //     `splitOutsideQuotes` pattern from #12 but for the
  //     between-marker shape rather than separator-split.

  function roundTrip(input: unknown): unknown {
    return RomlFile.romlToJson(RomlFile.jsonToRoml(input));
  }

  describe('items with `>` (the headline #9 case)', () => {
    it('round-trips a mid-string `>`', () => {
      const input = { elements: ['a>b', 'c'] };
      expect(roundTrip(input)).toEqual(input);
    });

    it('round-trips a leading `>`', () => {
      const input = { elements: ['>x', 'y'] };
      expect(roundTrip(input)).toEqual(input);
    });

    it('round-trips a trailing `>`', () => {
      const input = { elements: ['x>', 'y'] };
      expect(roundTrip(input)).toEqual(input);
    });

    it('round-trips a lone `>`', () => {
      const input = { elements: ['>', 'y'] };
      expect(roundTrip(input)).toEqual(input);
    });

    it('round-trips multiple `>`s in one item', () => {
      const input = { elements: ['a>b>c', 'd'] };
      expect(roundTrip(input)).toEqual(input);
    });
  });

  describe('items with `<`', () => {
    it('round-trips a mid-string `<` (no regression)', () => {
      const input = { elements: ['a<b', 'c'] };
      expect(roundTrip(input)).toEqual(input);
    });

    it('round-trips a leading `<`', () => {
      const input = { elements: ['<x', 'y'] };
      expect(roundTrip(input)).toEqual(input);
    });
  });

  describe('items combining `<` and `>`', () => {
    it('round-trips an item with `<>` inside', () => {
      const input = { elements: ['a<>b', 'c'] };
      expect(roundTrip(input)).toEqual(input);
    });

    it('round-trips an item with HTML-like content', () => {
      const input = { elements: ['<tag>content</tag>', 'c'] };
      expect(roundTrip(input)).toEqual(input);
    });
  });

  describe('items with bare `"` (Copilot review on this PR)', () => {
    // The lexer walker tracks quote state, so a bare middle-`"`
    // in an item (not caught by `isAmbiguousString`, which only
    // flags leading/trailing `"`) would put the walker into
    // `inQuotes` and prevent the closing `>` from ending the
    // item. Encoder must quote any `"`-bearing item.

    it('round-trips a mid-string `"`', () => {
      const input = { elements: ['a"b', 'c'] };
      expect(roundTrip(input)).toEqual(input);
    });

    it('round-trips multiple `"`s in one item', () => {
      const input = { elements: ['a"b"c', 'd'] };
      expect(roundTrip(input)).toEqual(input);
    });

    it('round-trips a lone-`"` item (also worked pre-fix via leading/trailing check)', () => {
      const input = { elements: ['"', 'y'] };
      expect(roundTrip(input)).toEqual(input);
    });
  });

  describe('escape composition: `>` combined with other tricky bytes', () => {
    it('round-trips `>` plus `"`', () => {
      const input = { elements: ['a">b', 'c'] };
      expect(roundTrip(input)).toEqual(input);
    });

    it('round-trips `>` plus `\\`', () => {
      const input = { elements: ['a>\\b', 'c'] };
      expect(roundTrip(input)).toEqual(input);
    });

    it('round-trips `>` plus `|`', () => {
      const input = { elements: ['a>|b', 'c'] };
      expect(roundTrip(input)).toEqual(input);
    });
  });

  describe('top-level array roots with `>` items', () => {
    it('round-trips an array root with a `>`-bearing item', () => {
      const input = ['a>b', 'c'];
      expect(roundTrip(input)).toEqual(input);
    });
  });

  describe('regression: existing BRACKETS round-trips still work', () => {
    it('round-trips plain string items', () => {
      const input = { elements: ['a', 'b', 'c'] };
      expect(roundTrip(input)).toEqual(input);
    });

    it('round-trips a single-element array (uses the `<>` arity marker)', () => {
      const input = { elements: ['only'] };
      expect(roundTrip(input)).toEqual(input);
    });

    it('round-trips empty-string items via __EMPTY__', () => {
      const input = { elements: ['a', '', 'b'] };
      expect(roundTrip(input)).toEqual(input);
    });

    it('round-trips null items via __NULL__', () => {
      const input = { elements: ['a', null, 'b'] };
      expect(roundTrip(input)).toEqual(input);
    });
  });
});
