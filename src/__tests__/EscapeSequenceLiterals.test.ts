import { RomlFile } from '../file/RomlFile';

describe('Literal escape sequences in keys and values', () => {
  // Regression for fuzz limitation #16.
  //
  // `unescapeStringValue` (src/lexer/RomlLexer.ts) used a chained
  // `.replace()` pipeline (`\\n` → newline, `\\r` → CR, `\\t` → tab,
  // `\\"` → `"`, `\\\\` → `\`) that doesn't compose for the literal
  // 2-byte sequences `\n` / `\r` / `\t` (backslash followed by the
  // letter `n` / `r` / `t` — NOT the control char).
  //
  // Trace for a user key `\n` (2 bytes: `\`, `n`):
  //   - encoder `escapeForRoml` doubles `\` → `\\`, emits 3 bytes
  //     `\\n` (`\`, `\`, `n`).
  //   - lexer `unescapeStringValue`:
  //       step 1 `/\\n/g` → newline matches the LAST 2 bytes
  //       (`\`+`n`), leaves `\` + newline (2 bytes, newline embedded).
  //       step 5 `/\\\\/g` → `\` has nothing to match.
  //   - round-trip: `\n` (2 bytes) → `\` + newline.
  //
  // Fix: rewrite `unescapeStringValue` as a single-pass walker
  // (`/\\(.)/g` with an escape-map callback) so each `\X` pair is
  // resolved atomically. Same function feeds keys (extractKey) and
  // quoted values across every syntax style, so one rewrite fixes
  // every code path.

  function roundTrip(input: unknown): unknown {
    return RomlFile.romlToJson(RomlFile.jsonToRoml(input));
  }

  describe('literal escape sequences in keys', () => {
    it('round-trips {"\\\\n":1} (key is two bytes: `\\`, `n`)', () => {
      const input = { '\\n': 1 };
      expect(roundTrip(input)).toEqual(input);
    });

    it('round-trips {"\\\\r":1}', () => {
      const input = { '\\r': 1 };
      expect(roundTrip(input)).toEqual(input);
    });

    it('round-trips {"\\\\t":1}', () => {
      const input = { '\\t': 1 };
      expect(roundTrip(input)).toEqual(input);
    });

    it('round-trips {"a\\\\nb":"x"} (literal `\\n` mid-key)', () => {
      const input = { 'a\\nb': 'x' };
      expect(roundTrip(input)).toEqual(input);
    });

    it('round-trips {"\\\\\\\\n":1} (literal `\\\\n`: backslash, backslash, n)', () => {
      const input = { '\\\\n': 1 };
      expect(roundTrip(input)).toEqual(input);
    });

    it('round-trips {"\\\\":0} (lone backslash, no regression)', () => {
      const input = { '\\': 0 };
      expect(roundTrip(input)).toEqual(input);
    });
  });

  describe('literal escape sequences in values (forced through QUOTED path)', () => {
    // `\n` / `\r` / `\t` alone in a value don't trigger
    // `isAmbiguousString`, so they emit unquoted and skip
    // `unescapeStringValue` entirely. Combining the literal
    // escape with a value-shape that DOES force quoting (a
    // leading `"`, a trailing `]`, etc.) is what surfaces the
    // mangling on the value side.

    it('round-trips a value with leading `"` and literal `\\n`', () => {
      const input = { x: '"\\n' };
      expect(roundTrip(input)).toEqual(input);
    });

    it('round-trips a value ending in `]` with literal `\\n`', () => {
      const input = { x: '\\n]' };
      expect(roundTrip(input)).toEqual(input);
    });

    it('round-trips a value ending in `}` with literal `\\r`', () => {
      const input = { x: '\\r}' };
      expect(roundTrip(input)).toEqual(input);
    });

    it('round-trips a value with trailing `"` and literal `\\t`', () => {
      const input = { x: '\\t"' };
      expect(roundTrip(input)).toEqual(input);
    });
  });

  describe('control chars (must still round-trip — the rewrite preserves them)', () => {
    it('round-trips a real newline char in a value', () => {
      const input = { x: 'line1\nline2' };
      expect(roundTrip(input)).toEqual(input);
    });

    it('round-trips a real tab char in a value', () => {
      const input = { x: 'col1\tcol2' };
      expect(roundTrip(input)).toEqual(input);
    });

    it('round-trips a real CR char in a value', () => {
      const input = { x: 'a\rb' };
      expect(roundTrip(input)).toEqual(input);
    });

    it('round-trips an embedded `"` in a value', () => {
      const input = { x: 'say "hi"' };
      expect(roundTrip(input)).toEqual(input);
    });
  });
});
