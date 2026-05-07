import { RomlFile } from '../file/RomlFile';

describe('Non-finite number encoding (NaN, Infinity, -Infinity)', () => {
  // Regression: non-finite numbers were emitted as the literal identifier
  // (e.g. `&x&NaN`, `&x&Infinity`) and parsed back as the string `"NaN"` /
  // `"Infinity"`. JSON.stringify coerces all three to `null`, so ROML's
  // round-trip diverged from the JSON contract.
  //
  // Fix: coerce NaN / Infinity / -Infinity to null on encode, matching
  // JSON.stringify behaviour.

  function jsonStringifyParity(input: unknown): unknown {
    return JSON.parse(JSON.stringify(input));
  }

  function roundTrip(input: unknown): unknown {
    return RomlFile.romlToJson(RomlFile.jsonToRoml(input));
  }

  it('encodes NaN as null', () => {
    const input = { x: NaN };
    expect(roundTrip(input)).toEqual({ x: null });
    expect(roundTrip(input)).toEqual(jsonStringifyParity(input));
  });

  it('encodes positive Infinity as null', () => {
    const input = { x: Infinity };
    expect(roundTrip(input)).toEqual({ x: null });
    expect(roundTrip(input)).toEqual(jsonStringifyParity(input));
  });

  it('encodes negative Infinity as null', () => {
    const input = { x: -Infinity };
    expect(roundTrip(input)).toEqual({ x: null });
    expect(roundTrip(input)).toEqual(jsonStringifyParity(input));
  });

  it('preserves the literal string "NaN" as a string', () => {
    // The string "NaN" must NOT be confused with the number NaN.
    const input = { x: 'NaN' };
    expect(roundTrip(input)).toEqual(input);
  });

  it('preserves finite numbers untouched', () => {
    const input = { a: 0, b: 1, c: -1, d: 1.5, e: -0 };
    const out = roundTrip(input) as Record<string, number>;
    expect(out.a).toBe(0);
    expect(out.b).toBe(1);
    expect(out.c).toBe(-1);
    expect(out.d).toBe(1.5);
  });

  it('coerces non-finite numbers inside arrays', () => {
    const input = { xs: [1, NaN, 2, Infinity, 3, -Infinity] };
    expect(roundTrip(input)).toEqual({ xs: [1, null, 2, null, 3, null] });
    expect(roundTrip(input)).toEqual(jsonStringifyParity(input));
  });
});
