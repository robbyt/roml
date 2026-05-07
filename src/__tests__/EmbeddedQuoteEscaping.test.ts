import { RomlFile } from '../file/RomlFile';

describe('Embedded-quote escaping in non-QUOTED string styles', () => {
  // Regression: when a string value happens to start or end with `"`, the
  // encoder picked a non-QUOTED style (e.g. FAKE_COMMENT, EQUALS, BRACKETS,
  // DOUBLE_COLON) and emitted the bytes verbatim. The decoder's value-quoting
  // detection (`/^"(.*)"$/`) then unwrapped what looked like a quoted value,
  // either dropping the outer quote bytes or mangling the contents:
  //   {"foo":"\"hello\""}     -> //foo//"hello"     -> {"foo":"hello"}
  //   {"foo":"\"a\",\"b\""}   -> //foo//"a","b"     -> {"foo":"a\",\"b"}
  //
  // Fix: treat any value that starts or ends with `"` as ambiguous so it
  // routes through the QUOTED style with the existing escape pipeline.

  function roundTrip(input: unknown): unknown {
    return RomlFile.romlToJson(RomlFile.jsonToRoml(input));
  }

  it('round-trips a string fully wrapped in literal quotes', () => {
    const input = { foo: '"hello"' };
    expect(roundTrip(input)).toEqual(input);
  });

  it('round-trips a string ending in a literal quote', () => {
    const input = { foo: 'hello"' };
    expect(roundTrip(input)).toEqual(input);
  });

  it('round-trips a string starting with a literal quote', () => {
    const input = { foo: '"hello' };
    expect(roundTrip(input)).toEqual(input);
  });

  it('round-trips a comma-separated quoted-pair string', () => {
    const input = { foo: '"a","b"' };
    expect(roundTrip(input)).toEqual(input);
  });

  it('round-trips a value that is just two quote chars', () => {
    const input = { foo: '""' };
    expect(roundTrip(input)).toEqual(input);
  });

  it('round-trips a string with quotes only in the middle (already worked)', () => {
    const input = { foo: 'say "hi" please' };
    expect(roundTrip(input)).toEqual(input);
  });
});
