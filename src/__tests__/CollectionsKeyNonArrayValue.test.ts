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
    it('round-trips {name:"alice"} (PERSONAL → QUOTED)', () => {
      const input = { name: 'alice' };
      expect(roundTrip(input)).toEqual(input);
    });

    it('round-trips {active:"yes"} (STATUS)', () => {
      const input = { active: 'yes' };
      expect(roundTrip(input)).toEqual(input);
    });
  });
});
