import { RomlFile } from '../file/RomlFile';

describe('Even-line boolean handler honors needs-quoted-key', () => {
  // Regression: `selectSyntax`'s even-line boolean branch is the one
  // syntax that bypasses `createSyntaxStyle` entirely — it returns an
  // ad-hoc closure that emits `${prefix}${key}=${yes/no}`. That
  // closure used the raw `key` instead of running it through
  // `formatKeyName`, so a key that needed quoting (empty, whitespace,
  // separator-char, `!`-prefix, `[N]`-shape) lost its quoting only
  // when it landed on an even-numbered line with a boolean value.
  //
  // The shape only manifests with two-or-more keys because the FIRST
  // key of an object lands on counter=1 (odd), which uses the
  // `BRACKETS` style routed through `createSyntaxStyle` correctly.
  // The second key on counter=2 (even) hits the broken inline path.

  function roundTrip(input: unknown): unknown {
    return RomlFile.romlToJson(RomlFile.jsonToRoml(input));
  }

  it('round-trips an even-line space-only key with a boolean value', () => {
    // First entry forces the second to land on an even line.
    const input = { first: true, ' ': false };
    expect(roundTrip(input)).toEqual(input);
  });

  it('round-trips an even-line empty-string key with a boolean value', () => {
    const input = { first: true, '': false };
    expect(roundTrip(input)).toEqual(input);
  });

  it('round-trips an even-line key containing `=` with a boolean value', () => {
    const input = { first: true, 'a=b': false };
    expect(roundTrip(input)).toEqual(input);
  });

  it('round-trips an even-line `!`-prefix key with a boolean value', () => {
    const input = { first: true, '!warn': true };
    expect(roundTrip(input)).toEqual(input);
  });

  it('still round-trips two ordinary boolean entries (sanity)', () => {
    const input = { foo: true, bar: false };
    expect(roundTrip(input)).toEqual(input);
  });

  it('round-trips multiple stress-keyed boolean entries in a row', () => {
    // Forces several different even-line cases through the inline
    // handler in one document.
    const input = {
      a: true,
      ' ': false,
      b: true,
      '': true,
      c: false,
      'x=y': false,
    };
    expect(roundTrip(input)).toEqual(input);
  });
});
