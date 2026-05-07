import { RomlFile } from '../file/RomlFile';

describe('Strings ending in `{` or `[` (collision with OBJECT_START / ARRAY_START)', () => {
  // Regression: the lexer interprets any line ending in `{` as an
  // OBJECT_START and any line ending in `[` as an ARRAY_START
  // regardless of the line's structure. A string value `"{"` would
  // emit `//key//{` (FAKE_COMMENT) and silently be reinterpreted as
  // opening a child object whose key is `//key//`. Same shape for `[`.
  //
  // Fix: route values ending in `{` or `[` through the QUOTED style,
  // where the trailing brace/bracket is inside `"…"` and can no
  // longer be mistaken for a structural opener.

  function roundTrip(input: unknown): unknown {
    return RomlFile.romlToJson(RomlFile.jsonToRoml(input));
  }

  it('round-trips a value that is just `{`', () => {
    expect(roundTrip({ k: '{' })).toEqual({ k: '{' });
  });

  it('round-trips a value that is just `[`', () => {
    expect(roundTrip({ k: '[' })).toEqual({ k: '[' });
  });

  it('round-trips a value ending in `{`', () => {
    expect(roundTrip({ k: 'open {' })).toEqual({ k: 'open {' });
  });

  it('round-trips a value ending in `[`', () => {
    expect(roundTrip({ k: 'list [' })).toEqual({ k: 'list [' });
  });

  it('round-trips top-level string `{`', () => {
    expect(roundTrip('{')).toEqual('{');
  });

  it('round-trips top-level string `[`', () => {
    expect(roundTrip('[')).toEqual('[');
  });

  it('round-trips an array element that is just `{`', () => {
    expect(roundTrip({ xs: ['{', '[', 'plain'] })).toEqual({
      xs: ['{', '[', 'plain'],
    });
  });

  it('still preserves a string that has `{` in the middle (sanity)', () => {
    expect(roundTrip({ k: 'mid{dle' })).toEqual({ k: 'mid{dle' });
  });
});
