import { RomlFile } from '../file/RomlFile';

describe('Quote-aware lexer regexes', () => {
  // Regression for fuzz limitations #5 and #6.
  //
  // #5 — Bracket regex `^(.+?)<(.+)>$` (in both `analyzeLineStructure`
  // and `parseSpecialCases`) wasn't quote-aware. A quoted key
  // containing `<` plus a boolean value rendered as `"<"<false>`,
  // and the regex split at the FIRST `<` (inside the key's quotes)
  // instead of the structural `<` separator. Round-trip mangled the
  // key/value:
  //
  //   {"<": false}  -> "<"<false>  -> {"\"": "\"<false"}  // wrong
  //
  // #6 — Colon-array regex `^(.+?):(.+)$` in `parseSpecialCases`
  // claimed any line with two `:`s as a colon-delimited array,
  // even when the first `:` was inside a quoted key. So a
  // `"::"=value` (legitimate KEY_VALUE with key `::`) was misread
  // as a colon-array with key `"`:
  //
  //   {"::": null} (nested under another key) -> "::"=__NULL__
  //   -> {"\"": ["", "\"=__NULL__"]}  // wrong
  //
  // Fix: replace both regexes with `findSeparatorOutsideQuotes`
  // (which already exists for AMPERSAND parsing) so the key/value
  // split happens at the structural separator, not at a separator
  // hidden inside a quoted key.

  function roundTrip(input: unknown): unknown {
    return RomlFile.romlToJson(RomlFile.jsonToRoml(input));
  }

  describe('limitation #5: bracket regex quote-awareness', () => {
    it('round-trips `{"<": false}` (single < in key with boolean)', () => {
      expect(roundTrip({ '<': false })).toEqual({ '<': false });
    });

    it('round-trips `{">": true}` (single > in key with boolean)', () => {
      expect(roundTrip({ '>': true })).toEqual({ '>': true });
    });

    it('round-trips `{"<key>": true}` (key with surrounding angle brackets)', () => {
      expect(roundTrip({ '<key>': true })).toEqual({ '<key>': true });
    });

    it('round-trips a key containing < at multiple positions with a boolean value', () => {
      expect(roundTrip({ 'a<b<c': true })).toEqual({ 'a<b<c': true });
    });

    it('still round-trips an ordinary boolean (sanity)', () => {
      expect(roundTrip({ active: true, idle: false })).toEqual({
        active: true,
        idle: false,
      });
    });
  });

  describe('limitation #6: colon-array regex quote-awareness', () => {
    it('round-trips `{"::": null}` (key is two colons)', () => {
      expect(roundTrip({ '::': null })).toEqual({ '::': null });
    });

    it('round-trips `{"::": "value"}` (string value)', () => {
      expect(roundTrip({ '::': 'value' })).toEqual({ '::': 'value' });
    });

    it('round-trips `{":k:": 1}` (colons surrounding the key)', () => {
      expect(roundTrip({ ':k:': 1 })).toEqual({ ':k:': 1 });
    });

    it('round-trips `{"a:b": 1}` (single colon in key)', () => {
      expect(roundTrip({ 'a:b': 1 })).toEqual({ 'a:b': 1 });
    });

    it('round-trips a deeply-nested `::`-keyed object', () => {
      const input = { outer: { '::': null } };
      expect(roundTrip(input)).toEqual(input);
    });

    it('still round-trips a real colon-delimited array (sanity)', () => {
      // The encoder may pick COLON_DELIM for some arrays via the
      // hash-based selector. Round-trip must still work for those.
      const input = { items: ['a', 'b', 'c', 'd'] };
      expect(roundTrip(input)).toEqual(input);
    });
  });
});
