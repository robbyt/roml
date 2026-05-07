import { RomlFile } from '../file/RomlFile';

describe('OBJECT_START / ARRAY_START key quoting symmetry', () => {
  // Regression: KEY_VALUE lines route the key through `formatKeyName`
  // (which quotes empty / whitespace / separator-char keys), but the
  // encoder's OBJECT_START (`key{`) and ARRAY_START (`key[`) emitters
  // used the raw key. An empty-string key with an object value then
  // emits a bare `{` on a line, which the lexer matches against `^}$`
  // / `^]$` / `^(.+?)\{$` / etc — a leading `{` requires at least one
  // char before it, so the line is silently dropped. Same shape for
  // arrays. Whitespace-only / separator-char keys with object or array
  // values had analogous failures.
  //
  // Fix: format the key in the encoder for OBJECT_START / ARRAY_START
  // emit, then teach the lexer to extract the same way as KEY_VALUE
  // (strip optional `!` and surrounding `"…"`) and the parser to
  // consume the cleaned key directly.

  function roundTrip(input: unknown): unknown {
    return RomlFile.romlToJson(RomlFile.jsonToRoml(input));
  }

  it('round-trips an empty-string key whose value is an object', () => {
    expect(roundTrip({ '': {} })).toEqual({ '': {} });
  });

  it('round-trips an empty-string key whose value is an array', () => {
    expect(roundTrip({ '': [] })).toEqual({ '': [] });
  });

  it('round-trips a space-only key whose value is an object', () => {
    expect(roundTrip({ ' ': {} })).toEqual({ ' ': {} });
  });

  it('round-trips a key containing `=` whose value is an object', () => {
    expect(roundTrip({ 'a=b': { x: 1 } })).toEqual({ 'a=b': { x: 1 } });
  });

  it('round-trips a key containing `<` whose value is an object', () => {
    expect(roundTrip({ '<key>': { x: 1 } })).toEqual({ '<key>': { x: 1 } });
  });

  it('round-trips a key containing `:` whose value is an array of objects', () => {
    expect(roundTrip({ 'a:b': [{ x: 1 }, { y: 2 }] })).toEqual({
      'a:b': [{ x: 1 }, { y: 2 }],
    });
  });

  it('round-trips a quoted-key user-supplied `[0]` shape (still allowed as a regular key)', () => {
    // The structural `[N]` form is reserved for array items, but a
    // user object can still legitimately use `[0]` as a key with an
    // object value — the encoder must quote it, and the lexer must
    // distinguish it from an array-item opener.
    expect(roundTrip({ '[0]': { x: 1 } })).toEqual({ '[0]': { x: 1 } });
  });

  it('still round-trips a normal nested object (sanity)', () => {
    expect(roundTrip({ outer: { inner: 1 } })).toEqual({ outer: { inner: 1 } });
  });

  it('still round-trips a normal nested array (sanity)', () => {
    expect(roundTrip({ items: [{ a: 1 }, { b: 2 }] })).toEqual({
      items: [{ a: 1 }, { b: 2 }],
    });
  });

  it('still preserves the prime prefix on an object-valued key whose key was quoted', () => {
    // `[0]` triggers needsQuotedKey AND is an unusual edge case; the
    // prime detection should still apply transparently to its
    // children.
    const input = { '[0]': { p: 7 } };
    expect(roundTrip(input)).toEqual(input);
  });
});
