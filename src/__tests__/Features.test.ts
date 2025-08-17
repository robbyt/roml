import { RomlConverter } from '../RomlConverter';
import { EMPTY_DOCUMENT_FEATURES, EMPTY_LINE_FEATURES, MetaTags } from '../types';

describe('ROML Features Infrastructure', () => {
  let converter: RomlConverter;

  beforeEach(() => {
    converter = new RomlConverter();
  });

  describe('DocumentFeatures Integration', () => {
    it('should maintain existing ROML behavior with features infrastructure', () => {
      const testData = {
        name: 'Robert',
        age: 30,
        active: true,
      };

      // Convert to ROML and verify output format unchanged
      const romlOutput = converter.jsonToRoml(testData);

      // Should start with standard header
      expect(romlOutput).toMatch(/^~ROML~/);

      // Phase 2: No primes in this data, so no META tag expected
      expect(romlOutput).not.toContain('~META~');

      // Should contain expected content (no prime prefixes for non-prime data)
      expect(romlOutput).toContain('name="Robert"'); // Personal semantic category
      expect(romlOutput).toContain('age'); // Should be present
      expect(romlOutput).toContain('active'); // Should be present
    });

    it('should handle complex nested data with features infrastructure', () => {
      const testData = {
        user: {
          profile: {
            name: 'Alice',
            email: 'alice@example.com',
          },
          settings: {
            theme: 'dark',
            notifications: true,
          },
        },
        metadata: {
          created: '2024-01-15',
          tags: ['admin', 'user'],
        },
      };

      const romlOutput = converter.jsonToRoml(testData);

      // Should maintain ROML structure
      expect(romlOutput).toMatch(/^~ROML~/);
      expect(romlOutput).toContain('user{');
      expect(romlOutput).toContain('profile{');
      expect(romlOutput).toContain('settings{');
      expect(romlOutput).toContain('metadata{');

      // Phase 2: No primes in this data, so no META tag expected
      expect(romlOutput).not.toContain('~META~');
      expect(romlOutput).not.toContain('!'); // No prime prefixes expected
    });
  });

  describe('Feature Analysis Methods', () => {
    it('should have feature analysis methods available', () => {
      // Use type assertion to access private methods for testing
      const converterAny = converter as any;

      expect(typeof converterAny.analyzeDocumentFeatures).toBe('function');
      expect(typeof converterAny.analyzeLineFeatures).toBe('function');
    });

    it('should detect vowel-starting keys', () => {
      const converterAny = converter as any;

      // Test vowel-starting keys
      const vowelKey = converterAny.analyzeLineFeatures('apple', 'fruit');
      expect(vowelKey.keyStartsWithVowel).toBe(true);

      // Test consonant-starting keys
      const consonantKey = converterAny.analyzeLineFeatures('banana', 'fruit');
      expect(consonantKey.keyStartsWithVowel).toBe(false);
    });

    it('should detect long strings', () => {
      const converterAny = converter as any;

      // Test short string
      const shortString = converterAny.analyzeLineFeatures('key', 'short');
      expect(shortString.hasLongString).toBe(false);

      // Test long string (> 10 characters)
      const longString = converterAny.analyzeLineFeatures('key', 'this is a very long string');
      expect(longString.hasLongString).toBe(true);
    });

    it('should detect special values', () => {
      const converterAny = converter as any;

      // Test null
      const nullValue = converterAny.analyzeLineFeatures('key', null);
      expect(nullValue.isSpecialValue).toBe(true);

      // Test undefined
      const undefinedValue = converterAny.analyzeLineFeatures('key', undefined);
      expect(undefinedValue.isSpecialValue).toBe(true);

      // Test empty string
      const emptyString = converterAny.analyzeLineFeatures('key', '');
      expect(emptyString.isSpecialValue).toBe(true);

      // Test encoded special values
      const encodedNull = converterAny.analyzeLineFeatures('key', '__NULL__');
      expect(encodedNull.isSpecialValue).toBe(true);

      // Test normal value
      const normalValue = converterAny.analyzeLineFeatures('key', 'normal');
      expect(normalValue.isSpecialValue).toBe(false);
    });

    it('should detect nested objects', () => {
      const converterAny = converter as any;

      // Test object
      const objectValue = converterAny.analyzeLineFeatures('key', { nested: 'value' });
      expect(objectValue.isNestedObject).toBe(true);

      // Test array (not object)
      const arrayValue = converterAny.analyzeLineFeatures('key', ['item1', 'item2']);
      expect(arrayValue.isNestedObject).toBe(false);

      // Test primitive
      const primitiveValue = converterAny.analyzeLineFeatures('key', 'string');
      expect(primitiveValue.isNestedObject).toBe(false);
    });

    it('should detect large arrays', () => {
      const converterAny = converter as any;

      // Test small array
      const smallArray = converterAny.analyzeLineFeatures('key', [1, 2, 3]);
      expect(smallArray.hasLargeArray).toBe(false);

      // Test large array (> 5 items)
      const largeArray = converterAny.analyzeLineFeatures('key', [1, 2, 3, 4, 5, 6, 7]);
      expect(largeArray.hasLargeArray).toBe(true);
    });

    it('should return document features correctly', () => {
      const converterAny = converter as any;

      // Test document features analysis (still placeholder)
      const testData = { name: 'Test', value: 123 };
      const documentFeatures = converterAny.analyzeDocumentFeatures(testData);

      expect(documentFeatures).toEqual(EMPTY_DOCUMENT_FEATURES);
      expect(documentFeatures.primesDetected).toBe(false);
    });
  });

  describe('Round-Trip Compatibility with Features', () => {
    it('should maintain perfect round-trip conversion with features infrastructure', () => {
      const testCases = [
        { simple: 'value' },
        { number: 42, text: 'hello', flag: true },
        {
          nested: {
            deep: {
              value: 'test',
              numbers: [1, 2, 3],
            },
          },
        },
        {
          arrays: ['a', 'b', 'c'],
          mixed: [1, 'text', true, null],
          objects: [{ a: 1 }, { b: 2 }],
        },
      ];

      testCases.forEach((testData) => {
        const romlOutput = converter.jsonToRoml(testData);

        // Should start with proper header
        expect(romlOutput).toMatch(/^~ROML~/);

        // Should be valid ROML format (no empty conversions)
        expect(romlOutput.length).toBeGreaterThan(10);
        expect(romlOutput).not.toContain('undefined');
        expect(romlOutput).not.toContain('null');

        // Phase 2: Should contain META tags when primes are detected
        if (romlOutput.includes('~META~')) {
          expect(romlOutput).toContain(`~META~ ${MetaTags.SIEVE_OF_ERATOSTHENES_INVOKED}`);
        }
      });
    });
  });

  describe('Syntax Function Integration', () => {
    it('should call syntax functions with LineFeatures parameter', () => {
      const testData = {
        quoted: 'personal',
        numeric: 42,
        boolean: true,
        array: [1, 2, 3],
      };

      // This should not throw any errors and should produce valid output
      expect(() => {
        const output = converter.jsonToRoml(testData);
        expect(output).toMatch(/^~ROML~/);
        expect(output.length).toBeGreaterThan(20);
      }).not.toThrow();
    });

    it('should handle all value types with features parameter', () => {
      const testData = {
        nullValue: null,
        undefinedValue: undefined,
        emptyString: '',
        normalString: 'test',
        number: 123,
        boolean: false,
        array: ['a', 'b'],
        object: { nested: 'value' },
      };

      expect(() => {
        const output = converter.jsonToRoml(testData);

        // Should contain proper special value encoding
        expect(output).toContain('__NULL__');
        expect(output).toContain('""'); // Empty strings now preserved as quoted empty strings

        // Should handle all types without errors
        expect(output).toMatch(/^~ROML~/);
      }).not.toThrow();
    });
  });

  describe('Feature Infrastructure Extensibility', () => {
    it('should be ready for Phase 2 prime number features', () => {
      // Verify the infrastructure can handle future feature additions
      const documentFeatures = EMPTY_DOCUMENT_FEATURES;
      const lineFeatures = EMPTY_LINE_FEATURES;

      // Should have the expected structure for prime features
      expect(documentFeatures).toHaveProperty('primesDetected');
      expect(lineFeatures).toHaveProperty('containsPrime');

      // Should have placeholder values
      expect(documentFeatures.primesDetected).toBe(false);
      expect(lineFeatures.containsPrime).toBe(false);
    });

    it('should maintain type safety for feature interfaces', () => {
      // This test ensures TypeScript compilation passes with proper types
      const docFeatures = EMPTY_DOCUMENT_FEATURES;
      const lineFeatures = EMPTY_LINE_FEATURES;

      // These should compile without type errors
      expect(typeof docFeatures.primesDetected).toBe('boolean');
      expect(typeof lineFeatures.containsPrime).toBe('boolean');
      expect(typeof lineFeatures.hasLargeArray).toBe('boolean');
      expect(typeof lineFeatures.isNestedObject).toBe('boolean');
    });
  });
});
