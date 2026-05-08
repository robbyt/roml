import { RomlFile } from '../file/RomlFile';

describe('Empty quoted-value regex (limitation #10)', () => {
  // Regression: `parseSpecialCases` and the inline-array branches
  // used `^"(.+)"$` to detect quoted values. The `(.+)` requires at
  // least one char inside the quotes, so the empty quoted form
  // `""` doesn't match and gets parsed as the literal 2-char value
  // `""` instead of the empty string.
  //
  // After PR #25 the encoder no longer reaches the affected branches
  // for empty-string values (special-value override routes them
  // through FAKE_COMMENT / DOLLAR, both of which already used `*`),
  // so the round-trip path through the encoder doesn't trigger this.
  // But the lexer must still parse hand-written ROML correctly —
  // and it currently doesn't for `::key::""::`, `@key@""@`,
  // `_key_""_`, the multi-bracket array item `<""\>`, and the
  // pipe-array per-item / single-value forms.
  //
  // Fix: change `^"(.+)"$` to `^"(.*)"$` in all five remaining
  // sites so the empty case parses as an empty string.

  describe('hand-written ROML decoding', () => {
    it('parses DOUBLE_COLON empty-quoted-value as empty string', () => {
      expect(RomlFile.romlToJson('~ROML~\n::k::""::')).toEqual({ k: '' });
    });

    it('parses AT_SANDWICH empty-quoted-value as empty string', () => {
      expect(RomlFile.romlToJson('~ROML~\n@k@""@')).toEqual({ k: '' });
    });

    it('parses UNDERSCORE empty-quoted-value as empty string', () => {
      expect(RomlFile.romlToJson('~ROML~\n_k_""_')).toEqual({ k: '' });
    });

    it('parses multi-bracket array with an empty quoted item', () => {
      // multiBracketMatch fires when `line.includes('><')`, so we
      // need at least two brackets. Empty `""` should decode to ''.
      expect(RomlFile.romlToJson('~ROML~\nxs<a><""><b>')).toEqual({
        xs: ['a', '', 'b'],
      });
    });

    it('parses pipe-array with an empty quoted item', () => {
      expect(RomlFile.romlToJson('~ROML~\nxs||a||""||b||')).toEqual({
        xs: ['a', '', 'b'],
      });
    });

    it('parses single-value pipe-array form with empty quoted value', () => {
      // Single-value pipe form: `key||""||`. Should decode to the
      // empty string (or, for synthetic wrapper keys, an empty
      // string in a 1-element array).
      expect(RomlFile.romlToJson('~ROML~\nx||""||')).toEqual({ x: '' });
    });
  });

  describe('encoder round-trip (sanity, was already working post-PR#25)', () => {
    function roundTrip(input: unknown): unknown {
      return RomlFile.romlToJson(RomlFile.jsonToRoml(input));
    }

    it('round-trips an empty-string value under a TEMPORAL key', () => {
      expect(roundTrip({ created: '' })).toEqual({ created: '' });
    });

    it('round-trips an empty-string value under an ordinary key', () => {
      expect(roundTrip({ x: '' })).toEqual({ x: '' });
    });
  });
});
