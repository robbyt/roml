import { RomlFile } from '../file/RomlFile.js';
import { MetaTags } from '../types.js';

/**
 * Comprehensive TDD tests for top-level type support
 * These tests ensure ROML supports all valid JSON input types: objects, arrays, and primitives
 */
describe('ROML Top-Level Type Support', () => {
  describe('Wrapper Approach Verification', () => {
    it('should wrap arrays in _items key', () => {
      const array = [1, 2, 3];
      const romlContent = RomlFile.jsonToRoml(array);

      expect(romlContent).toContain('~ROML~');
      expect(romlContent).toContain('_items');
      expect(romlContent).not.toContain('ROOT_TYPE_ARRAY'); // No longer generated
    });

    it('should wrap primitives in _value key', () => {
      const primitive = 42;
      const romlContent = RomlFile.jsonToRoml(primitive);

      expect(romlContent).toContain('~ROML~');
      expect(romlContent).toContain('_value');
      expect(romlContent).not.toContain('ROOT_TYPE_PRIMITIVE'); // No longer generated
    });

    it('should not wrap objects (unchanged behavior)', () => {
      const object = { name: 'test' };
      const romlContent = RomlFile.jsonToRoml(object);

      expect(romlContent).toContain('~ROML~');
      expect(romlContent).not.toContain('_items');
      expect(romlContent).not.toContain('_value');
      expect(romlContent).toContain('name');
    });
  });

  describe('Primitive Type Round-Trip', () => {
    describe('Numbers', () => {
      const numberTests = [
        { name: 'positive integer', value: 42 },
        { name: 'negative integer', value: -123 },
        { name: 'zero', value: 0 },
        { name: 'positive float', value: 3.14159 },
        { name: 'negative float', value: -9876.54321 },
        { name: 'scientific notation positive', value: 1.23e10 },
        { name: 'scientific notation negative', value: 1.23e-10 },
        { name: 'large number', value: 1234567890 },
        { name: 'small decimal', value: 0.001 },
      ];

      numberTests.forEach(({ name, value }) => {
        it(`should round-trip ${name}: ${value}`, () => {
          const romlContent = RomlFile.jsonToRoml(value);
          const roundTripData = RomlFile.romlToJson(romlContent);

          expect(roundTripData).toBe(value);
          expect(typeof roundTripData).toBe('number');
        });
      });
    });

    describe('Strings', () => {
      const stringTests = [
        { name: 'basic string', value: 'hello world' },
        { name: 'empty string', value: '' },
        { name: 'whitespace string', value: '   ' },
        { name: 'unicode string', value: 'Hello 世界 🌍' },
        { name: 'string with quotes', value: 'She said "hello"' },
        { name: 'string with backslashes', value: 'path\\to\\file' },
        { name: 'string with newlines', value: 'line1\nline2\nline3' },
        { name: 'string with tabs', value: 'col1\tcol2\tcol3' },
      ];

      stringTests.forEach(({ name, value }) => {
        it(`should round-trip ${name}`, () => {
          const romlContent = RomlFile.jsonToRoml(value);
          const roundTripData = RomlFile.romlToJson(romlContent);

          expect(roundTripData).toBe(value);
          expect(typeof roundTripData).toBe('string');
        });
      });
    });

    describe('Booleans', () => {
      it('should round-trip true', () => {
        const romlContent = RomlFile.jsonToRoml(true);
        const roundTripData = RomlFile.romlToJson(romlContent);

        expect(roundTripData).toBe(true);
        expect(typeof roundTripData).toBe('boolean');
      });

      it('should round-trip false', () => {
        const romlContent = RomlFile.jsonToRoml(false);
        const roundTripData = RomlFile.romlToJson(romlContent);

        expect(roundTripData).toBe(false);
        expect(typeof roundTripData).toBe('boolean');
      });
    });

    describe('Special Values', () => {
      it('should round-trip null', () => {
        const romlContent = RomlFile.jsonToRoml(null);
        const roundTripData = RomlFile.romlToJson(romlContent);

        expect(roundTripData).toBeNull();
      });
    });
  });

  describe('Type Preservation - Ambiguous Strings', () => {
    const ambiguousTests = [
      { name: 'string that looks like number', value: '42', expectedType: 'string' },
      { name: 'string that looks like float', value: '3.14', expectedType: 'string' },
      { name: 'string that looks like boolean true', value: 'true', expectedType: 'string' },
      { name: 'string that looks like boolean false', value: 'false', expectedType: 'string' },
      { name: 'string that looks like null', value: 'null', expectedType: 'string' },
      { name: 'string yes', value: 'yes', expectedType: 'string' },
      { name: 'string no', value: 'no', expectedType: 'string' },
    ];

    ambiguousTests.forEach(({ name, value, expectedType }) => {
      it(`should preserve ${name} as string type`, () => {
        const romlContent = RomlFile.jsonToRoml(value);
        const roundTripData = RomlFile.romlToJson(romlContent);

        expect(roundTripData).toBe(value);
        expect(typeof roundTripData).toBe(expectedType);
      });

      it(`should quote ${name} in ROML output to preserve type`, () => {
        const romlContent = RomlFile.jsonToRoml(value);

        // Ambiguous strings should be quoted in output
        expect(romlContent).toContain(`"${value}"`);
      });
    });
  });

  describe('Simple Array Round-Trip', () => {
    describe('Empty Arrays', () => {
      it('should round-trip empty array', () => {
        const array: unknown[] = [];
        const romlContent = RomlFile.jsonToRoml(array);
        const roundTripData = RomlFile.romlToJson(romlContent);

        expect(roundTripData).toEqual(array);
        expect(Array.isArray(roundTripData)).toBe(true);
        expect(roundTripData).toHaveLength(0);
      });
    });

    describe('Primitive Arrays', () => {
      const primitiveArrayTests = [
        { name: 'number array', value: [1, 2, 3, 4, 5] },
        { name: 'string array', value: ['a', 'b', 'c'] },
        { name: 'boolean array', value: [true, false, true, false] },
        { name: 'mixed primitive array', value: [1, 'text', true, null, 3.14] },
        { name: 'single item array', value: [42] },
        { name: 'array with null', value: [null, null, null] },
        { name: 'array with empty strings', value: ['', '', ''] },
      ];

      primitiveArrayTests.forEach(({ name, value }) => {
        it(`should round-trip ${name}`, () => {
          const romlContent = RomlFile.jsonToRoml(value);
          const roundTripData = RomlFile.romlToJson(romlContent);

          expect(roundTripData).toEqual(value);
          expect(Array.isArray(roundTripData)).toBe(true);
          expect(roundTripData).toHaveLength(value.length);
        });
      });
    });

    describe('Arrays with Ambiguous Strings', () => {
      it('should preserve string types in arrays', () => {
        const array = ['42', 'true', 'false', 'null'];
        const romlContent = RomlFile.jsonToRoml(array);
        const roundTripData = RomlFile.romlToJson(romlContent);

        expect(roundTripData).toEqual(array);
        expect(roundTripData.every((item: unknown) => typeof item === 'string')).toBe(true);
      });

      it('should quote ambiguous strings in array output', () => {
        const array = ['42', 'true', 'null'];
        const romlContent = RomlFile.jsonToRoml(array);

        // Should contain quoted versions to preserve string type
        expect(romlContent).toContain('"42"');
        expect(romlContent).toContain('"true"');
        expect(romlContent).toContain('"null"');
      });
    });
  });

  describe('Object Array Round-Trip', () => {
    describe('Simple Object Arrays', () => {
      it('should round-trip array of simple objects', () => {
        const array = [
          { name: 'Alice', age: 30 },
          { name: 'Bob', age: 25 },
        ];
        const romlContent = RomlFile.jsonToRoml(array);
        const roundTripData = RomlFile.romlToJson(romlContent);

        expect(roundTripData).toEqual(array);
        expect(Array.isArray(roundTripData)).toBe(true);
        expect(roundTripData).toHaveLength(2);
        expect(roundTripData[0]).toEqual({ name: 'Alice', age: 30 });
        expect(roundTripData[1]).toEqual({ name: 'Bob', age: 25 });
      });

      it('should round-trip array with empty objects', () => {
        const array = [{}, { value: 42 }, {}];
        const romlContent = RomlFile.jsonToRoml(array);
        const roundTripData = RomlFile.romlToJson(romlContent);

        expect(roundTripData).toEqual(array);
        expect(roundTripData[0]).toEqual({});
        expect(roundTripData[1]).toEqual({ value: 42 });
        expect(roundTripData[2]).toEqual({});
      });
    });

    describe('Complex Object Arrays', () => {
      it('should round-trip array with nested objects', () => {
        const array = [
          {
            user: {
              name: 'Alice',
              profile: { active: true, roles: ['admin', 'user'] },
            },
          },
          {
            user: {
              name: 'Bob',
              profile: { active: false, roles: ['user'] },
            },
          },
        ];
        const romlContent = RomlFile.jsonToRoml(array);
        const roundTripData = RomlFile.romlToJson(romlContent);

        expect(roundTripData).toEqual(array);
        expect(roundTripData[0].user.profile.roles).toEqual(['admin', 'user']);
        expect(roundTripData[1].user.profile.roles).toEqual(['user']);
      });

      it('should round-trip array mixing objects and primitives', () => {
        const array = [{ id: 1, name: 'first' }, 'separator', { id: 2, name: 'second' }, 42];
        const romlContent = RomlFile.jsonToRoml(array);
        const roundTripData = RomlFile.romlToJson(romlContent);

        expect(roundTripData).toEqual(array);
      });
    });
  });

  describe('Nested Array Round-Trip', () => {
    it('should round-trip array of arrays', () => {
      const array = [
        [1, 2],
        [3, 4],
        [5, 6],
      ];
      const romlContent = RomlFile.jsonToRoml(array);
      const roundTripData = RomlFile.romlToJson(romlContent);

      expect(roundTripData).toEqual(array);
      expect(Array.isArray(roundTripData[0])).toBe(true);
      expect(roundTripData[0]).toEqual([1, 2]);
    });

    it('should round-trip deeply nested arrays', () => {
      const array = [
        [
          [1, 2],
          [3, 4],
        ],
        [
          [5, 6],
          [7, 8],
        ],
      ];
      const romlContent = RomlFile.jsonToRoml(array);
      const roundTripData = RomlFile.romlToJson(romlContent);

      expect(roundTripData).toEqual(array);
    });
  });

  describe('Prime Number Integration', () => {
    it('should not add prime META tag for primitives (wrapper approach excludes synthetic keys)', () => {
      const prime = 7;
      const romlContent = RomlFile.jsonToRoml(prime);

      expect(romlContent).not.toContain(MetaTags.SIEVE_OF_ERATOSTHENES_INVOKED);
      expect(romlContent).toContain('_value');
    });

    it('should not add prime META tag for arrays (wrapper approach excludes synthetic keys)', () => {
      const primes = [2, 3, 5, 7];
      const romlContent = RomlFile.jsonToRoml(primes);

      expect(romlContent).not.toContain(MetaTags.SIEVE_OF_ERATOSTHENES_INVOKED);
      expect(romlContent).toContain('_items');
    });

    it('should not add prime META tag for non-prime primitives', () => {
      const nonPrime = 8;
      const romlContent = RomlFile.jsonToRoml(nonPrime);

      expect(romlContent).not.toContain(MetaTags.SIEVE_OF_ERATOSTHENES_INVOKED);
      expect(romlContent).toContain('_value');
    });

    it('should not add prime META tag for arrays without primes', () => {
      const nonPrimes = [4, 6, 8, 9];
      const romlContent = RomlFile.jsonToRoml(nonPrimes);

      expect(romlContent).not.toContain(MetaTags.SIEVE_OF_ERATOSTHENES_INVOKED);
      expect(romlContent).toContain('_items');
    });

    it('should still add prime META tag for objects with primes (real user data)', () => {
      const objectWithPrime = { key: 7 };
      const romlContent = RomlFile.jsonToRoml(objectWithPrime);

      expect(romlContent).toContain(`# ~META~ ${MetaTags.SIEVE_OF_ERATOSTHENES_INVOKED}`);
      expect(romlContent).toContain('!key');
    });
  });

  describe('Wrapper Syntax Pattern Verification', () => {
    describe('Primitive Patterns', () => {
      it('should use _value wrapper for primitives', () => {
        const romlContent = RomlFile.jsonToRoml(42);
        const lines = romlContent.split('\n');

        // Should have header and _value key
        expect(lines[0]).toBe('~ROML~');
        expect(romlContent).toContain('_value');
        expect(romlContent).toContain('42');
      });

      it('should quote ambiguous strings in _value wrapper', () => {
        const romlContent = RomlFile.jsonToRoml('42');

        expect(romlContent).toContain('_value');
        expect(romlContent).toContain('"42"');
      });
    });

    describe('Array Patterns', () => {
      it('should use _items wrapper for primitive arrays', () => {
        const array = [1, 2, 3];
        const romlContent = RomlFile.jsonToRoml(array);

        // Should use _items key with array values
        expect(romlContent).toContain('_items');
        // Should contain one of the array patterns for the values
        const hasJsonStyle = romlContent.includes('[1,2,3]');
        const hasPipeStyle = romlContent.includes('||1||2||3||');
        const hasBracketStyle = romlContent.includes('<1><2><3>');
        const hasColonStyle = romlContent.includes('1:2:3');

        expect(hasJsonStyle || hasPipeStyle || hasBracketStyle || hasColonStyle).toBe(true);
      });

      it('should use _items wrapper for object arrays', () => {
        const array = [{ name: 'test' }];
        const romlContent = RomlFile.jsonToRoml(array);

        // Should use _items key with structured array format
        expect(romlContent).toContain('_items');
        expect(romlContent).toContain('[');
        expect(romlContent).toContain('[0]{');
        expect(romlContent).toContain('}');
        expect(romlContent).toContain(']');
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle array with all types of values', () => {
      const array = [
        42, // number
        'text', // string
        true, // boolean
        null, // null
        { key: 'val' }, // object
        [1, 2], // nested array
        '', // empty string
        0, // zero
      ];
      const romlContent = RomlFile.jsonToRoml(array);
      const roundTripData = RomlFile.romlToJson(romlContent);

      expect(roundTripData).toEqual(array);
    });

    it('should handle very large arrays', () => {
      const array = Array.from({ length: 100 }, (_, i) => i);
      const romlContent = RomlFile.jsonToRoml(array);
      const roundTripData = RomlFile.romlToJson(romlContent);

      expect(roundTripData).toEqual(array);
      expect(roundTripData).toHaveLength(100);
    });

    it('should handle arrays with duplicate values', () => {
      const array = [1, 1, 2, 2, 3, 3];
      const romlContent = RomlFile.jsonToRoml(array);
      const roundTripData = RomlFile.romlToJson(romlContent);

      expect(roundTripData).toEqual(array);
    });

    it('should handle objects with problematic key names', () => {
      const problematicKeys = {
        normal_key: 'normal value',
        '# comment-like': 'hash value',
        'key:with:colons': 'colon value',
        'key=with=equals': 'equals value',
        'key&with&ampersands': 'ampersand value',
        'key~with~tildes': 'tilde value',
        'key/with/slashes': 'slash value',
        'key@with@ats': 'at value',
        key$with$dollars: 'dollar value',
        'key%with%percents': 'percent value',
        'key^with^carets': 'caret value',
        'key+with+plus': 'plus value',
        'key<with>brackets': 'bracket value',
        'key|with|pipes': 'pipe value',
        'key[with]squares': 'square value',
        'key{with}braces': 'brace value',
        key_with_underscores: 'underscore value',
        'key with spaces': 'space value',
        '"key with quotes"': 'quote value',
      };

      const romlContent = RomlFile.jsonToRoml(problematicKeys);
      const roundTripData = RomlFile.romlToJson(romlContent);

      expect(roundTripData).toEqual(problematicKeys);

      // Verify that problematic keys are quoted in ROML output
      expect(romlContent).toContain('"# comment-like"');
      expect(romlContent).toContain('"key:with:colons"');
      expect(romlContent).toContain('"key=with=equals"');
    });
  });
});
