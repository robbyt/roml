import { RomlFile } from '../file/RomlFile';

describe('Single-element primitive arrays (limitation #3)', () => {
  // Regression for fuzz limitation #3.
  //
  // BRACKETS already appended `<>` as an arity-1 marker so the
  // lexer could distinguish a single-element array from a scalar.
  // The other three inline-array styles didn't:
  //
  //   PIPES        : `x||a||` — lexer's "single-item" branch
  //                  unwrapped to scalar `{x: "a"}`.
  //   JSON_STYLE   : `abc["a"]` — lexer required `,` in content,
  //                  the line fell through and got dropped.
  //   COLON_DELIM  : `id:a` — lexer's COLON-array branch required
  //                  remainder to include another `:`, fell back
  //                  to the scalar KV-COLON parser.
  //
  // Fix: append a trailing-separator arity marker for arity-1 in
  // each style. Mirrors BRACKETS' `<>`.
  //
  //   PIPES        : `x||a||||` (trailing `||`)
  //   JSON_STYLE   : `abc["a",]` (trailing `,`)
  //   COLON_DELIM  : `id:a:` (trailing `:`)
  //
  // The lexer's existing empty-item-filter (PIPES) and empty-current-
  // drop (JSON_STYLE) handle the resulting `["a", ""]` correctly;
  // COLON_DELIM gets a small drop-trailing-empty addition.

  function roundTrip(input: unknown): unknown {
    return RomlFile.romlToJson(RomlFile.jsonToRoml(input));
  }

  // Keys chosen to deterministically route to each style via
  // `selectArrayStyle`, which hashes the key (`simpleHash(key) %
  // 4`) — semantic categories don't apply to array routing. If
  // the hash function changes and one of these keys lands on a
  // different style, swap it for another key whose hash output
  // selects the intended style.
  //   x          -> PIPES        (hash bucket 0)
  //   abc        -> JSON_STYLE   (hash bucket 2)
  //   elements   -> BRACKETS     (hash bucket 1)
  //   id         -> COLON_DELIM  (hash bucket 3)

  describe('PIPES arity-1 (key `x`)', () => {
    it('round-trips a single-element string array', () => {
      expect(roundTrip({ x: ['only'] })).toEqual({ x: ['only'] });
    });

    it('round-trips a single-element number array', () => {
      expect(roundTrip({ x: [42] })).toEqual({ x: [42] });
    });

    it('round-trips a single-element null array', () => {
      expect(roundTrip({ x: [null] })).toEqual({ x: [null] });
    });

    it('round-trips a single-element empty-string array', () => {
      expect(roundTrip({ x: [''] })).toEqual({ x: [''] });
    });

    it('round-trips a single-element boolean array', () => {
      expect(roundTrip({ x: [true] })).toEqual({ x: [true] });
    });

    it('regression: 2-element PIPES still works', () => {
      expect(roundTrip({ x: ['a', 'b'] })).toEqual({ x: ['a', 'b'] });
    });
  });

  describe('JSON_STYLE arity-1 (key `abc`)', () => {
    it('round-trips a single-element string array', () => {
      expect(roundTrip({ abc: ['only'] })).toEqual({ abc: ['only'] });
    });

    it('round-trips a single-element number array', () => {
      expect(roundTrip({ abc: [42] })).toEqual({ abc: [42] });
    });

    it('round-trips a single-element null array', () => {
      expect(roundTrip({ abc: [null] })).toEqual({ abc: [null] });
    });

    it('round-trips a single-element boolean array', () => {
      expect(roundTrip({ abc: [true] })).toEqual({ abc: [true] });
    });

    it('round-trips a single-element empty-string array', () => {
      // Exercises the `abc["",]` shape: the parser must keep the
      // legitimate quoted empty item and drop only the trailing
      // arity-1 marker (Copilot review caught this gap).
      expect(roundTrip({ abc: [''] })).toEqual({ abc: [''] });
    });

    it('regression: 2-element JSON_STYLE still works', () => {
      expect(roundTrip({ abc: ['a', 'b'] })).toEqual({ abc: ['a', 'b'] });
    });
  });

  describe('BRACKETS arity-1 (key `elements`, no-regression)', () => {
    it('round-trips a single-element string array (uses existing `<>` marker)', () => {
      expect(roundTrip({ elements: ['only'] })).toEqual({ elements: ['only'] });
    });

    it('round-trips a single-element number array', () => {
      expect(roundTrip({ elements: [42] })).toEqual({ elements: [42] });
    });

    it('regression: 2-element BRACKETS still works', () => {
      expect(roundTrip({ elements: ['a', 'b'] })).toEqual({ elements: ['a', 'b'] });
    });
  });

  describe('COLON_DELIM arity-1 (key `id`)', () => {
    it('round-trips a single-element string array', () => {
      expect(roundTrip({ id: ['only'] })).toEqual({ id: ['only'] });
    });

    it('round-trips a single-element number array', () => {
      expect(roundTrip({ id: [42] })).toEqual({ id: [42] });
    });

    it('round-trips a single-element null array', () => {
      expect(roundTrip({ id: [null] })).toEqual({ id: [null] });
    });

    it('round-trips a single-element empty-string array', () => {
      expect(roundTrip({ id: [''] })).toEqual({ id: [''] });
    });

    it('regression: 2-element COLON_DELIM still works', () => {
      expect(roundTrip({ id: ['a', 'b'] })).toEqual({ id: ['a', 'b'] });
    });

    it('regression: COLON_DELIM scalar (under non-array key shape) still works', () => {
      // `id` with a scalar string goes through TECHNICAL→AMPERSAND
      // KV path, not COLON_DELIM. Verify the arity-1 fix doesn't
      // collide.
      expect(roundTrip({ id: 'scalar' })).toEqual({ id: 'scalar' });
    });
  });

  describe('PIPES quoted-key boundary (Copilot review on this PR)', () => {
    // A key containing `||` is quoted by the encoder, but the
    // pre-fix lexer regex (`^(.+?)\|\|(.*)\|\|$`) found the
    // first `||` anywhere in the line — including inside the
    // quoted key. `findSeparatorOutsideQuotes(line, '||')` for
    // the key/items boundary fixes it; same shape family as the
    // BRACKETS/JSON_STYLE key-boundary fixes in PR #37.

    it('round-trips a single-element array under a `||`-keyed object', () => {
      const input = { '||': ['only'] };
      expect(roundTrip(input)).toEqual(input);
    });

    it('round-trips a multi-element array under a `||`-keyed object', () => {
      const input = { '||': ['a', 'b'] };
      expect(roundTrip(input)).toEqual(input);
    });

    it('round-trips an array under a key containing `||` in the middle', () => {
      const input = { 'a||b': ['only'] };
      expect(roundTrip(input)).toEqual(input);
    });
  });

  describe('top-level single-element array (uses __roml_items__ wrapper, routes via PIPES)', () => {
    it('round-trips a top-level single-element array', () => {
      expect(roundTrip(['only'])).toEqual(['only']);
    });

    it('round-trips a top-level single-element null array', () => {
      expect(roundTrip([null])).toEqual([null]);
    });

    it('regression: top-level 2-element array still works', () => {
      expect(roundTrip(['a', 'b'])).toEqual(['a', 'b']);
    });
  });
});
