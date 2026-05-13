import { RomlFile } from '../file/RomlFile';

describe('COLON_DELIM items containing `:` (limitation #14 residual)', () => {
  // Regression for the last `:` portion of fuzz limitation #14.
  //
  // COLON_DELIM emits items as `key:a:b:c` (single-`:` separator).
  // The encoder didn't quote items containing `:`, and the lexer's
  // `colonRemainder.split(':')` was a plain split:
  //
  //   {id: ['a:b', 'c']} -> id:a:b:c -> {id: ['a','b','c']}
  //
  // Same family as the PIPES `|` fix (#32), PIPES `"` fix (#36),
  // and BRACKETS `>`/`<` fix (#37): the inline-array style needs
  // both halves to round-trip — encoder routes `:`-bearing items
  // through the QUOTED-inside-COLON path, lexer's split becomes
  // quote-aware via `splitOutsideQuotes`.

  function roundTrip(input: unknown): unknown {
    return RomlFile.romlToJson(RomlFile.jsonToRoml(input));
  }

  // `id` is a TECHNICAL semantic key that gets routed to
  // COLON_DELIM via `selectArrayStyle`. If the hash distribution
  // shifts, swap for another key whose array emission produces
  // `key:item1:item2` shape.

  describe('items containing `:` (the headline case)', () => {
    it('round-trips a mid-string `:`', () => {
      const input = { id: ['a:b', 'c'] };
      expect(roundTrip(input)).toEqual(input);
    });

    it('round-trips a leading `:`', () => {
      const input = { id: [':x', 'y'] };
      expect(roundTrip(input)).toEqual(input);
    });

    it('round-trips a trailing `:`', () => {
      const input = { id: ['x:', 'y'] };
      expect(roundTrip(input)).toEqual(input);
    });

    it('round-trips a lone `:`', () => {
      const input = { id: [':', 'y'] };
      expect(roundTrip(input)).toEqual(input);
    });

    it('round-trips multiple `:`s in one item', () => {
      const input = { id: ['a:b:c', 'd'] };
      expect(roundTrip(input)).toEqual(input);
    });

    it('round-trips `::` (consecutive `:`s) in one item', () => {
      const input = { id: ['a::b', 'c'] };
      expect(roundTrip(input)).toEqual(input);
    });
  });

  describe('escape composition: `:` combined with other tricky bytes', () => {
    it('round-trips `:` plus `"`', () => {
      const input = { id: ['a":b', 'c'] };
      expect(roundTrip(input)).toEqual(input);
    });

    it('round-trips `:` plus `\\`', () => {
      const input = { id: ['a:\\b', 'c'] };
      expect(roundTrip(input)).toEqual(input);
    });

    it('round-trips `:` plus `|`', () => {
      const input = { id: ['a:|b', 'c'] };
      expect(roundTrip(input)).toEqual(input);
    });
  });

  describe('regression: existing COLON_DELIM round-trips still work', () => {
    it('round-trips plain string items', () => {
      const input = { id: ['a', 'b', 'c'] };
      expect(roundTrip(input)).toEqual(input);
    });

    it('round-trips numeric-string items', () => {
      const input = { id: ['1', '2', '3'] };
      expect(roundTrip(input)).toEqual(input);
    });

    it('round-trips an empty-string item via __EMPTY__', () => {
      const input = { id: ['a', '', 'b'] };
      expect(roundTrip(input)).toEqual(input);
    });

    it('round-trips null items via __NULL__', () => {
      const input = { id: ['a', null, 'b'] };
      expect(roundTrip(input)).toEqual(input);
    });
  });
});
