import { RomlFile } from '../file/RomlFile';

describe('Backslash in key', () => {
  // Regression: `RomlConverter.needsQuotedKey` didn't flag keys
  // containing `\`, so the encoder emitted the raw byte. The lexer's
  // `findSeparatorOutsideQuotes` then treated `\` as an escape that
  // swallows the next char — e.g. a key `\` with an AMPERSAND-style
  // number value `0` rendered as `&\&0`, where `\&` was consumed as
  // the escape and the actual `&` separator was lost. Round-trip
  // dropped the key entirely:
  //
  //   {"\\": 0}     -> ROML -> {}
  //
  // Fix: `needsQuotedKey` returns true for any key containing `\`,
  // routing it through the QUOTED form where `escapeForRoml`
  // doubles the backslash and the lexer's `unescapeStringValue`
  // reverses it cleanly.

  function roundTrip(input: unknown): unknown {
    return RomlFile.romlToJson(RomlFile.jsonToRoml(input));
  }

  it('round-trips a single-backslash key with a numeric value', () => {
    expect(roundTrip({ '\\': 0 })).toEqual({ '\\': 0 });
  });

  it('round-trips a single-backslash key with a string value', () => {
    expect(roundTrip({ '\\': 'hello' })).toEqual({ '\\': 'hello' });
  });

  it('round-trips a single-backslash key with a boolean value', () => {
    expect(roundTrip({ '\\': true })).toEqual({ '\\': true });
  });

  it('round-trips a backslash mid-key', () => {
    expect(roundTrip({ 'a\\b': 1 })).toEqual({ 'a\\b': 1 });
  });

  it('round-trips a key that is two backslashes', () => {
    expect(roundTrip({ '\\\\': 1 })).toEqual({ '\\\\': 1 });
  });

  it('round-trips a `!`-prefixed backslash key (interaction with prime marker)', () => {
    expect(roundTrip({ '!\\': 1 })).toEqual({ '!\\': 1 });
  });

  it('round-trips an array of objects with backslash keys', () => {
    const input = [{ '\\': 0 }, { '\\': 1 }];
    expect(roundTrip(input)).toEqual(input);
  });

  it('still preserves backslash-containing string values (no regression)', () => {
    expect(roundTrip({ a: 'b\\c' })).toEqual({ a: 'b\\c' });
  });
});
