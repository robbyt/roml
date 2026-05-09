import { RomlFile } from '../file/RomlFile';

describe('Root-wrapper META-tag disambiguation', () => {
  // Regression for fuzz limitation #1.
  //
  // The encoder wraps top-level non-object roots as
  // `{__roml_items__: [...]}` (for arrays) or `{__roml_value__: x}`
  // (for primitives) so the rest of the encoder can assume an
  // object root. The parser used to unconditionally unwrap any
  // single-key object whose key matched a wrapper sentinel, which
  // meant a user document of that exact shape was structurally
  // indistinguishable from an encoder-wrapped non-object root and
  // got silently collapsed on round-trip:
  //
  //   {"__roml_items__":[1,2,3]}  -> ROML -> [1,2,3]   (data lost)
  //
  // Fix: the encoder now emits a META tag in the document header
  // (`# ~META~ ROOT_ARRAY` or `# ~META~ ROOT_PRIMITIVE`) whenever it
  // synthetically wraps. The parser only unwraps when the matching
  // META tag is present. A user document with the wrapper sentinel
  // as a key produces no META tag and so round-trips intact.

  function roundTrip(input: unknown): unknown {
    return RomlFile.romlToJson(RomlFile.jsonToRoml(input));
  }

  describe('encoder emits the META tag for synthetic wraps', () => {
    it('emits ROOT_ARRAY when the input is a top-level array', () => {
      const roml = RomlFile.jsonToRoml([1, 2, 3]);
      expect(roml).toContain('# ~META~ ROOT_ARRAY');
    });

    it('emits ROOT_PRIMITIVE when the input is a top-level primitive', () => {
      expect(RomlFile.jsonToRoml(42)).toContain('# ~META~ ROOT_PRIMITIVE');
      expect(RomlFile.jsonToRoml('hi')).toContain('# ~META~ ROOT_PRIMITIVE');
      expect(RomlFile.jsonToRoml(true)).toContain('# ~META~ ROOT_PRIMITIVE');
      expect(RomlFile.jsonToRoml(null)).toContain('# ~META~ ROOT_PRIMITIVE');
    });

    it('does NOT emit a root-wrapper META for object roots', () => {
      const roml = RomlFile.jsonToRoml({ a: 1 });
      expect(roml).not.toContain('# ~META~ ROOT_ARRAY');
      expect(roml).not.toContain('# ~META~ ROOT_PRIMITIVE');
    });

    it('does NOT emit a root-wrapper META for objects whose key happens to be the sentinel', () => {
      // Critical for limitation #1: a user object with the wrapper
      // key gets no META, so the parser does not unwrap it.
      const a = RomlFile.jsonToRoml({ __roml_items__: [1, 2, 3] });
      const b = RomlFile.jsonToRoml({ __roml_value__: 42 });
      expect(a).not.toContain('# ~META~ ROOT_ARRAY');
      expect(b).not.toContain('# ~META~ ROOT_PRIMITIVE');
    });
  });

  describe('round-trip for genuine non-object roots', () => {
    it('top-level array round-trips via the META + wrap', () => {
      expect(roundTrip([1, 2, 3])).toEqual([1, 2, 3]);
    });

    it('top-level primitives round-trip via the META + wrap', () => {
      expect(roundTrip(42)).toEqual(42);
      expect(roundTrip('hello')).toEqual('hello');
      expect(roundTrip(true)).toEqual(true);
      expect(roundTrip(false)).toEqual(false);
      expect(roundTrip(null)).toEqual(null);
    });

    it('nested arrays of objects round-trip', () => {
      expect(roundTrip([{ a: 1 }, { b: 2 }])).toEqual([{ a: 1 }, { b: 2 }]);
    });
  });

  describe('user objects with wrapper-key shapes round-trip intact', () => {
    it('round-trips `{"__roml_items__": [...]}` as an object, not an array', () => {
      const input = { __roml_items__: [1, 2, 3] };
      expect(roundTrip(input)).toEqual(input);
    });

    it('round-trips `{"__roml_value__": x}` as an object, not the inner value', () => {
      expect(roundTrip({ __roml_value__: 42 })).toEqual({ __roml_value__: 42 });
      expect(roundTrip({ __roml_value__: 'x' })).toEqual({ __roml_value__: 'x' });
      expect(roundTrip({ __roml_value__: null })).toEqual({ __roml_value__: null });
    });

    it('round-trips an object containing both wrapper sentinels as keys', () => {
      const input = { __roml_items__: 'a', __roml_value__: 'b' };
      expect(roundTrip(input)).toEqual(input);
    });

    it('round-trips a wrapper-shape object inside a deeper structure', () => {
      const input = { outer: { __roml_items__: [1, 2, 3] } };
      expect(roundTrip(input)).toEqual(input);
    });
  });

  describe('hand-written ROML decoding', () => {
    it('without ROOT_ARRAY META, a `__roml_items__` single-key shape decodes as an object', () => {
      const roml = '~ROML~\n__roml_items__||1||2||3||';
      expect(RomlFile.romlToJson(roml)).toEqual({ __roml_items__: [1, 2, 3] });
    });

    it('with ROOT_ARRAY META, the same payload decodes as the unwrapped array', () => {
      const roml = '~ROML~\n# ~META~ ROOT_ARRAY\n__roml_items__||1||2||3||';
      expect(RomlFile.romlToJson(roml)).toEqual([1, 2, 3]);
    });

    it('with ROOT_PRIMITIVE META, a `__roml_value__` payload decodes as the unwrapped primitive', () => {
      // Note: counter advances past two header lines, so the data
      // line lands on counter=2 (even). For a string value `hi`
      // (consonant key, short string) the encoder's hash-fallback
      // picks an EQUALS family style; here we just check that the
      // META + payload combination yields the inner primitive.
      expect(
        RomlFile.romlToJson('~ROML~\n# ~META~ ROOT_PRIMITIVE\n__roml_value__="hi"')
      ).toEqual('hi');
    });

    it('declaring both ROOT_ARRAY and ROOT_PRIMITIVE is a parse error', () => {
      const roml =
        '~ROML~\n# ~META~ ROOT_ARRAY\n# ~META~ ROOT_PRIMITIVE\n__roml_items__||1||';
      expect(() => RomlFile.romlToJson(roml)).toThrow(/only one root-wrapper tag/i);
    });
  });
});
