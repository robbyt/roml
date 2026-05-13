import { RomlFile } from '../file/RomlFile';

describe('JSON_STYLE array items: encoder/decoder escape symmetry', () => {
  // Regression for fuzz limitation #11.
  //
  // The JSON_STYLE array emitter (src/RomlConverter.ts ~line 510)
  // emits items via `JSON.stringify`, which escapes `"` as `\"` and
  // `\` as `\\`. The lexer's `parseJsonValue` (src/lexer/RomlLexer.ts
  // ~line 943) recognised quoted strings via
  // `trimmed.startsWith('"') && trimmed.endsWith('"')` and returned
  // `trimmed.slice(1, -1)` — bare slice, NO unescaping. So a single
  // `"` in an item round-tripped as `\"` (the escape sequence bytes
  // never got reversed).
  //
  // Trace for `{abc: ['a"b', 'c']}` (key `abc` hashes to JSON_STYLE):
  //   - encoder emits `abc["a\"b","c"]` — 5 bytes inside the first
  //     quoted item: `a`, `\`, `"`, `b`.
  //   - lexer slices outer quotes → `a\"b` (4 bytes left intact).
  //   - round-trip: `a"b` (3 bytes) → `a\"b` (4 bytes). One byte
  //     leaked from the escape sequence.
  //
  // Fix: `parseJsonValue` now uses `JSON.parse(trimmed)` for quoted
  // strings — the symmetric inverse of `JSON.stringify`. Handles
  // every JSON-defined escape (`\"`, `\\`, `\n`, `\r`, `\t`, `\b`,
  // `\f`, `\/`, `\uXXXX`) correctly. Falls back to the literal slice
  // if JSON.parse throws on pathological hand-written input.

  function roundTrip(input: unknown): unknown {
    return RomlFile.romlToJson(RomlFile.jsonToRoml(input));
  }

  // `abc` and `zzz` hash to JSON_STYLE under the current encoder
  // (`simpleHash(key) % 4`). If the hash distribution shifts, swap
  // these for any other key whose array emission produces
  // `key["item1","item2"]` shape.

  describe('items containing `"` (the headline #11 case)', () => {
    it('round-trips an item with a mid-string `"`', () => {
      const input = { abc: ['a"b', 'c'] };
      expect(roundTrip(input)).toEqual(input);
    });

    it('round-trips an item with a leading `"`', () => {
      const input = { abc: ['"x', 'y'] };
      expect(roundTrip(input)).toEqual(input);
    });

    it('round-trips an item with a trailing `"`', () => {
      const input = { abc: ['x"', 'y'] };
      expect(roundTrip(input)).toEqual(input);
    });

    it('round-trips an item that is a lone `"`', () => {
      const input = { abc: ['"', 'x'] };
      expect(roundTrip(input)).toEqual(input);
    });

    it('round-trips an item with multiple `"`s', () => {
      const input = { abc: ['"a"b"', 'c'] };
      expect(roundTrip(input)).toEqual(input);
    });
  });

  describe('items containing `\\` (sibling escape mismatch)', () => {
    it('round-trips an item with a mid-string `\\`', () => {
      const input = { abc: ['a\\b', 'c'] };
      expect(roundTrip(input)).toEqual(input);
    });

    it('round-trips an item with a leading `\\`', () => {
      const input = { abc: ['\\x', 'y'] };
      expect(roundTrip(input)).toEqual(input);
    });

    it('round-trips an item that is a lone `\\`', () => {
      const input = { abc: ['\\', 'x'] };
      expect(roundTrip(input)).toEqual(input);
    });

    it('round-trips an item with `\\\\` (two backslashes)', () => {
      const input = { abc: ['a\\\\b', 'c'] };
      expect(roundTrip(input)).toEqual(input);
    });
  });

  describe('items combining `"` and `\\`', () => {
    it('round-trips `a"\\b`', () => {
      const input = { abc: ['a"\\b', 'c'] };
      expect(roundTrip(input)).toEqual(input);
    });

    it('round-trips `\\"`', () => {
      const input = { abc: ['\\"', 'x'] };
      expect(roundTrip(input)).toEqual(input);
    });
  });

  describe('items containing JSON-recognised escapes (real control chars)', () => {
    it('round-trips an item with a real newline', () => {
      const input = { abc: ['line1\nline2', 'c'] };
      expect(roundTrip(input)).toEqual(input);
    });

    it('round-trips an item with a real tab', () => {
      const input = { abc: ['col1\tcol2', 'c'] };
      expect(roundTrip(input)).toEqual(input);
    });
  });

  describe('regression: existing JSON_STYLE behaviour still works', () => {
    it('round-trips plain string items', () => {
      const input = { abc: ['a', 'b', 'c'] };
      expect(roundTrip(input)).toEqual(input);
    });

    it('round-trips mixed-type items (numbers, booleans, strings)', () => {
      const input = { abc: ['a', 42, true, 'b'] };
      expect(roundTrip(input)).toEqual(input);
    });

    it('round-trips an empty string item', () => {
      const input = { abc: ['', 'x'] };
      expect(roundTrip(input)).toEqual(input);
    });

    it('round-trips a null item', () => {
      const input = { abc: [null, 'x'] };
      expect(roundTrip(input)).toEqual(input);
    });
  });
});
