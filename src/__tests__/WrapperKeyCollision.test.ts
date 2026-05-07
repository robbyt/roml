import { RomlFile } from '../file/RomlFile';

describe('Synthetic wrapper-key collision', () => {
  // Regression: top-level non-objects are wrapped as { _items: [...] } or
  // { _value: x } before encoding, then unwrapped by the parser. Those names
  // were valid user keys, so a user object whose root key happened to be
  // `_items` or `_value` would silently lose its envelope on round-trip:
  //   { "_items": [1,2,3] } -> ROML -> [1,2,3]
  //   { "_value": 42 }      -> ROML -> 42

  it('round-trips an object whose root key is _items', () => {
    const input = { _items: [1, 2, 3] };
    expect(RomlFile.romlToJson(RomlFile.jsonToRoml(input))).toEqual(input);
  });

  it('round-trips an object whose root key is _value', () => {
    const input = { _value: 42 };
    expect(RomlFile.romlToJson(RomlFile.jsonToRoml(input))).toEqual(input);
  });

  it('round-trips an object whose root key is _value with a string', () => {
    const input = { _value: 'hello' };
    expect(RomlFile.romlToJson(RomlFile.jsonToRoml(input))).toEqual(input);
  });

  it('round-trips an object containing both _items and _value as keys', () => {
    const input = { _items: 'x', _value: 'y' };
    expect(RomlFile.romlToJson(RomlFile.jsonToRoml(input))).toEqual(input);
  });

  it('still round-trips a true top-level array (the synthetic-wrap case)', () => {
    const input = [1, 2, 3];
    expect(RomlFile.romlToJson(RomlFile.jsonToRoml(input))).toEqual(input);
  });

  it('still round-trips a true top-level primitive', () => {
    expect(RomlFile.romlToJson(RomlFile.jsonToRoml(42))).toEqual(42);
    expect(RomlFile.romlToJson(RomlFile.jsonToRoml('hi'))).toEqual('hi');
    expect(RomlFile.romlToJson(RomlFile.jsonToRoml(true))).toEqual(true);
    expect(RomlFile.romlToJson(RomlFile.jsonToRoml(null))).toEqual(null);
  });
});
