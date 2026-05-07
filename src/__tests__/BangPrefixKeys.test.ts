import { RomlFile } from '../file/RomlFile';

describe('Keys starting with `!` (collision with prime marker)', () => {
  // Regression: the parser strips a leading `!` from any key as the prime
  // marker. Keys whose actual JSON name begins with `!` (e.g. `!warn`) were
  // round-tripped without the leading byte:
  //   {"!warn": 1}  -> ROML -> {"warn": 1}
  // The encoder didn't quote them because `needsQuotedKey` ignored `!`.
  //
  // Fix: quote keys starting with `!` so the parser sees the real name
  // inside quotes and the prime-prefix logic doesn't fire.

  function roundTrip(input: unknown): unknown {
    return RomlFile.romlToJson(RomlFile.jsonToRoml(input));
  }

  it('round-trips a string key starting with !', () => {
    const input = { '!warn': 1 };
    expect(roundTrip(input)).toEqual(input);
  });

  it('round-trips a string key starting with ! whose value is also prime', () => {
    // 7 IS prime; without the fix, `!warn` would be ambiguous with the
    // prime-marker semantics. With the fix, the key is quoted and treated
    // as a literal name; the prime prefix would still apply to the
    // *output*, but only on the unquoted form, so the value being prime
    // doesn't hide the bug.
    const input = { '!warn': 7 };
    expect(roundTrip(input)).toEqual(input);
  });

  it('round-trips a key that is just !', () => {
    const input = { '!': 'lonely' };
    expect(roundTrip(input)).toEqual(input);
  });

  it('round-trips a !alert key with a string value', () => {
    const input = { '!alert': 'fire' };
    expect(roundTrip(input)).toEqual(input);
  });

  it('round-trips a nested object with !-prefixed keys at multiple levels', () => {
    const input = { outer: { '!warn': 1, '!error': 'oops' } };
    expect(roundTrip(input)).toEqual(input);
  });

  it('still preserves prime-prefix semantics for ordinary keys', () => {
    // Sanity: the fix must not regress prime-prefix behaviour for normal
    // keys whose values happen to be prime.
    const input = { count: 7 };
    expect(roundTrip(input)).toEqual(input);
  });
});
