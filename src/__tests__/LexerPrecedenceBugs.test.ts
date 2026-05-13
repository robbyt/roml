import { RomlFile } from '../file/RomlFile';

describe('Lexer precedence bugs surfaced at fuzz numRuns=1000', () => {
  // Hand-written regression tests for the three lexer-precedence
  // bugs that PR #41's numRuns bump (100 → 1000) surfaced at the
  // pinned seed. Each fix is also exercised by the fuzz, but
  // pinning the cases here means they stay covered even if the
  // fuzz arbitrary, seed, or `numRuns` ever changes.

  function roundTrip(input: unknown): unknown {
    return RomlFile.romlToJson(RomlFile.jsonToRoml(input));
  }

  describe('QUOTED key containing `="` (PR #41 fix 1)', () => {
    // `{"u=":" "}` encodes to `"u="=" "`. The previous regex
    // `^(.+?)="(.*)"$` lazy-found the FIRST `="` (inside the
    // quoted key at position 2), reading the key as `"u`. The
    // fix uses `findSeparatorOutsideQuotes(line, '="')` for the
    // structural KV boundary, so the `="` inside the quoted
    // region is correctly skipped.

    it('round-trips a key with a single `=`', () => {
      expect(roundTrip({ 'u=': ' ' })).toEqual({ 'u=': ' ' });
    });

    it('round-trips a key containing `="` exactly', () => {
      expect(roundTrip({ 'u="': 'v' })).toEqual({ 'u="': 'v' });
    });

    it('round-trips a key with `=` and `"` non-adjacent', () => {
      expect(roundTrip({ 'a=b"c': 'x' })).toEqual({ 'a=b"c': 'x' });
    });

    it('round-trips a key with `=` mid-string and value with `=` too', () => {
      expect(roundTrip({ 'k=ey': 'v=al' })).toEqual({ 'k=ey': 'v=al' });
    });

    it('round-trips nested objects with `=`-bearing keys', () => {
      expect(roundTrip({ '': { 'u=': ' ' } })).toEqual({ '': { 'u=': ' ' } });
    });
  });

  describe('PIPES-vs-EQUALS precedence (PR #41 fix 2)', () => {
    // `{" ":"||"}` encodes to `" "=||` (EQUALS KV with a bare
    // `||` value). The previous PIPES branch fired on
    // `line.endsWith('||')` without checking for an earlier KV
    // separator, so it read the line as `{" "=:[]}`. The fix
    // adds the same "earlier-separator-outside-quotes" rejection
    // already present on the COLON-array gate.

    it('round-trips a value `||` under a space key (EQUALS-line case)', () => {
      expect(roundTrip({ ' ': '||' })).toEqual({ ' ': '||' });
    });

    it('round-trips a value ending in `||` under a space key', () => {
      expect(roundTrip({ ' ': 'a||' })).toEqual({ ' ': 'a||' });
    });

    it('round-trips a value `||` under a `=`-bearing key', () => {
      // Encoder uses QUOTED-key for `a=`; value `||` should
      // emit unquoted. Tests both the QUOTED-boundary fix and
      // the PIPES-precedence fix together.
      expect(roundTrip({ 'a=': '||' })).toEqual({ 'a=': '||' });
    });

    it('round-trips the original fuzz counterexample shape', () => {
      const input = { '': { '': { '': '', ' ': '||' } } };
      expect(roundTrip(input)).toEqual(input);
    });
  });

  describe('Multi-bracket-array gate vs quoted-key `><` (PR #43 fix)', () => {
    // `{"><": false}` encodes to `"><"<false>` (BRACKETS KV with
    // a quoted key + boolean value on odd lines). The previous
    // multi-bracket-array gate `line.includes('><')` fired
    // because the QUOTED key contains `><`, mis-classifying the
    // line as a 1-element BRACKETS array. The fix uses
    // `findSeparatorOutsideQuotes(line, '><')` so the `><`
    // inside the quoted region is correctly skipped.

    it('round-trips a `><`-keyed boolean false', () => {
      expect(roundTrip({ '><': false })).toEqual({ '><': false });
    });

    it('round-trips a `><`-keyed boolean true', () => {
      expect(roundTrip({ '><': true })).toEqual({ '><': true });
    });

    it('round-trips a mid-key `><`', () => {
      expect(roundTrip({ 'a><b': false })).toEqual({ 'a><b': false });
    });

    it('regression: 2-element BRACKETS array still classifies as array', () => {
      expect(roundTrip({ elements: ['a', 'b'] })).toEqual({ elements: ['a', 'b'] });
    });

    it('regression: arity-1 BRACKETS array still classifies as array', () => {
      expect(roundTrip({ elements: ['only'] })).toEqual({ elements: ['only'] });
    });
  });

  describe('AMPERSAND vs COLON-array precedence (PR #41 fix 3)', () => {
    // `{token: "::"}` encodes to `&token&::` (TECHNICAL key
    // → AMPERSAND style with `::` scalar). The previous
    // COLON-array gate didn't have `&` in its
    // `earlierSeparators` list, so it re-read the line as a
    // `&token&`-keyed colon-array with one empty item. The
    // fix adds `&` alongside `=`, `:`, `~`, `#`, `%`, `$`,
    // `^`, `+`.

    it('round-trips a TECHNICAL-keyed `::` value', () => {
      expect(roundTrip({ token: '::' })).toEqual({ token: '::' });
    });

    it('round-trips a TECHNICAL-keyed value with multiple `:`s', () => {
      expect(roundTrip({ token: ':a:b:' })).toEqual({ token: ':a:b:' });
    });

    it('round-trips a TECHNICAL-keyed scalar without colons', () => {
      // Regression: TECHNICAL→AMPERSAND override still applies
      // when no `:` is present.
      expect(roundTrip({ token: 'value' })).toEqual({ token: 'value' });
    });

    it('round-trips multiple TECHNICAL keys with colon-bearing values', () => {
      expect(
        roundTrip({ token: '::', id: 'a:b', hash: ':x' })
      ).toEqual({ token: '::', id: 'a:b', hash: ':x' });
    });
  });
});
