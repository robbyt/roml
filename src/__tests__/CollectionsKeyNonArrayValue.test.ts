import { RomlFile } from '../file/RomlFile';

describe('COLLECTIONS-key scalar values skip the PIPES override', () => {
  // Regression for fuzz limitation #13.
  //
  // `SEMANTIC_CATEGORIES.COLLECTIONS` ({tags, items, list, array,
  // elements, values, data}) was mapped to PIPES via
  // `getSemanticStyle`, and `selectSyntax` applied that override
  // for any string value (after limitation #7 added the
  // `valueType === 'string'` gate). The PIPES KV template
  // `||${key}||${value}||` is byte-for-byte identical to a
  // single-item PIPES array's emission, so a scalar value under
  // a COLLECTIONS key emitted an ambiguous line that the lexer's
  // `^(.+?)\|\|(.*)\|\|$` regex (lazy on the key, greedy on the
  // value) reattached the leading `||` of the PIPES wrapper to
  // the key:
  //
  //   {tags: "plain"} -> ||tags||plain|| -> {"||tags": "plain"}
  //
  // Fix: skip the COLLECTIONS-PIPES override for scalar string
  // values. Other semantic styles (PERSONAL → QUOTED, STATUS, ...)
  // round-trip strings cleanly via their existing escape
  // pipelines, so they stay applied.
  //
  // Arrays under COLLECTIONS keys are unaffected — array styling
  // goes through `selectArrayStyle`, not `selectSyntax`.

  function roundTrip(input: unknown): unknown {
    return RomlFile.romlToJson(RomlFile.jsonToRoml(input));
  }

  describe('every COLLECTIONS keyword as a scalar string value', () => {
    it('round-trips {tags:"x"}', () => {
      const input = { tags: 'x' };
      expect(roundTrip(input)).toEqual(input);
    });

    it('round-trips {items:"x"}', () => {
      const input = { items: 'x' };
      expect(roundTrip(input)).toEqual(input);
    });

    it('round-trips {list:"x"}', () => {
      const input = { list: 'x' };
      expect(roundTrip(input)).toEqual(input);
    });

    it('round-trips {array:"x"}', () => {
      const input = { array: 'x' };
      expect(roundTrip(input)).toEqual(input);
    });

    it('round-trips {elements:"x"}', () => {
      const input = { elements: 'x' };
      expect(roundTrip(input)).toEqual(input);
    });

    it('round-trips {values:"x"}', () => {
      const input = { values: 'x' };
      expect(roundTrip(input)).toEqual(input);
    });

    it('round-trips {data:"x"}', () => {
      const input = { data: 'x' };
      expect(roundTrip(input)).toEqual(input);
    });
  });

  describe('edge values that previously confused the PIPES KV path', () => {
    it('round-trips {tags:""}', () => {
      const input = { tags: '' };
      expect(roundTrip(input)).toEqual(input);
    });

    it('round-trips {tags:"||"}', () => {
      const input = { tags: '||' };
      expect(roundTrip(input)).toEqual(input);
    });

    it('round-trips {tags:"a||b"}', () => {
      const input = { tags: 'a||b' };
      expect(roundTrip(input)).toEqual(input);
    });

    it('round-trips {tags:"plain text with spaces"}', () => {
      const input = { tags: 'plain text with spaces' };
      expect(roundTrip(input)).toEqual(input);
    });
  });

  describe('mixed-case keys (override uses lowerKey)', () => {
    it('round-trips {Tags:"x"}', () => {
      const input = { Tags: 'x' };
      expect(roundTrip(input)).toEqual(input);
    });

    it('round-trips {TAGS:"x"}', () => {
      const input = { TAGS: 'x' };
      expect(roundTrip(input)).toEqual(input);
    });
  });

  describe('regression: arrays under COLLECTIONS keys still work', () => {
    it('round-trips {tags:["a","b"]}', () => {
      const input = { tags: ['a', 'b'] };
      expect(roundTrip(input)).toEqual(input);
    });

    it('round-trips {items:["a","b","c"]}', () => {
      const input = { items: ['a', 'b', 'c'] };
      expect(roundTrip(input)).toEqual(input);
    });
  });

  describe('regression: other semantic categories still apply their override', () => {
    // These cases assert against the EMITTED ROML, not just the
    // round-trip equality, because round-trip alone would pass
    // even if the override silently stopped applying — every
    // semantic style produces a different shape, and as long as
    // each shape round-trips, equality wouldn't catch a regression.
    // Asserting on the emitted ROML pins the style choice.

    it('PERSONAL keys still route to QUOTED (`name="alice"`)', () => {
      const roml = RomlFile.jsonToRoml({ name: 'alice' });
      expect(roml).toContain('name="alice"');
      expect(roundTrip({ name: 'alice' })).toEqual({ name: 'alice' });
    });

    it('STATUS keys still route to BRACKETS (`active<"yes">`)', () => {
      const roml = RomlFile.jsonToRoml({ active: 'yes' });
      expect(roml).toContain('active<');
      expect(roundTrip({ active: 'yes' })).toEqual({ active: 'yes' });
    });

    it('TECHNICAL keys still route to AMPERSAND (`&id&abc`)', () => {
      const roml = RomlFile.jsonToRoml({ id: 'abc' });
      expect(roml).toContain('&id&');
      expect(roundTrip({ id: 'abc' })).toEqual({ id: 'abc' });
    });
  });

  describe('regression: COLLECTIONS keys no longer route scalars to PIPES KV', () => {
    // Asserting on the emitted ROML rather than just round-trip
    // equality — the previous PIPES-KV emission was structurally
    // distinguishable (`||tags||plain||`), so explicitly checking
    // the output does NOT start with `||` confirms the override
    // skip is what's doing the work, not some other accident.

    it('{tags:"plain"} no longer emits a `||tags||...||` PIPES line', () => {
      const roml = RomlFile.jsonToRoml({ tags: 'plain' });
      expect(roml).not.toMatch(/^\|\|tags\|\|/m);
    });

    it('{items:"x"} no longer emits a `||items||...||` PIPES line', () => {
      const roml = RomlFile.jsonToRoml({ items: 'x' });
      expect(roml).not.toMatch(/^\|\|items\|\|/m);
    });
  });
});
