import { RomlConverter } from '../RomlConverter.js';

describe('ROML Prime Number Integration', () => {
  let converter: RomlConverter;

  beforeEach(() => {
    converter = new RomlConverter();
  });

  describe('META Tag Generation', () => {
    it('should generate SIEVE_OF_ERATOSTHENES_INVOKED when primes detected', () => {
      const dataWithPrimes = {
        age: 23, // Prime number
        name: 'Alice',
        active: true,
      };

      const romlOutput = converter.jsonToRoml(dataWithPrimes);

      expect(romlOutput).toContain('~META~ SIEVE_OF_ERATOSTHENES_INVOKED');
      expect(romlOutput).toMatch(/^~ROML~\n# ~META~ SIEVE_OF_ERATOSTHENES_INVOKED/);
    });

    it('should not generate META tag when no primes detected', () => {
      const dataWithoutPrimes = {
        age: 24, // Not prime
        name: 'Bob',
        active: false,
      };

      const romlOutput = converter.jsonToRoml(dataWithoutPrimes);

      expect(romlOutput).not.toContain('~META~ SIEVE_OF_ERATOSTHENES_INVOKED');
      expect(romlOutput).toMatch(/^~ROML~\n/);
      expect(romlOutput).not.toContain('~META~');
    });

    it('should detect primes in nested objects', () => {
      const dataWithNestedPrimes = {
        user: {
          id: 17, // Prime number
          name: 'Charlie',
        },
        settings: {
          theme: 'dark',
        },
      };

      const romlOutput = converter.jsonToRoml(dataWithNestedPrimes);

      expect(romlOutput).toContain('~META~ SIEVE_OF_ERATOSTHENES_INVOKED');
    });

    it('should detect primes in arrays', () => {
      const dataWithArrayPrimes = {
        primeNumbers: [2, 3, 5, 7],
        name: 'Math Test',
      };

      const romlOutput = converter.jsonToRoml(dataWithArrayPrimes);

      expect(romlOutput).toContain('~META~ SIEVE_OF_ERATOSTHENES_INVOKED');
    });

    it('should detect primes in mixed array types', () => {
      const dataWithMixedArray = {
        values: [1, 'text', 7, true, 11], // Contains primes 7 and 11
        name: 'Mixed Test',
      };

      const romlOutput = converter.jsonToRoml(dataWithMixedArray);

      expect(romlOutput).toContain('~META~ SIEVE_OF_ERATOSTHENES_INVOKED');
    });
  });

  describe('Prime Prefix Application', () => {
    it('should add ! prefix to keys with prime values', () => {
      const dataWithPrimes = {
        age: 17, // Prime - should get ! prefix
        count: 8, // Not prime - no prefix
        id: 23, // Prime - should get ! prefix
      };

      const romlOutput = converter.jsonToRoml(dataWithPrimes);

      // Should contain prime prefixes
      expect(romlOutput).toMatch(/!age/);
      expect(romlOutput).toMatch(/!id/);

      // Should not prefix non-prime keys
      expect(romlOutput).not.toMatch(/!count/);
    });

    it('should handle prime prefixes on both odd and even lines', () => {
      const testData = {
        first: 2, // Prime, line 1 (odd)
        second: 4, // Not prime, line 2 (even)
        third: 3, // Prime, line 3 (odd)
        fourth: 6, // Not prime, line 4 (even)
        fifth: 5, // Prime, line 5 (odd)
        sixth: 8, // Not prime, line 6 (even)
      };

      const romlOutput = converter.jsonToRoml(testData);

      // Prime keys should have ! prefix regardless of line position
      expect(romlOutput).toMatch(/!first/);
      expect(romlOutput).toMatch(/!third/);
      expect(romlOutput).toMatch(/!fifth/);

      // Non-prime keys should not have ! prefix
      expect(romlOutput).not.toMatch(/!second[^a-z]/);
      expect(romlOutput).not.toMatch(/!fourth/);
      expect(romlOutput).not.toMatch(/!sixth/);
    });

    it('should apply prefix to array keys containing primes', () => {
      const dataWithPrimeArrays = {
        primes: [2, 3, 5], // Array contains primes
        evens: [2, 4, 6], // Array contains primes (2)
        odds: [1, 9, 15], // Array contains no primes
      };

      const romlOutput = converter.jsonToRoml(dataWithPrimeArrays);

      expect(romlOutput).toMatch(/!primes/);
      expect(romlOutput).toMatch(/!evens/);
      expect(romlOutput).not.toMatch(/!odds/);
    });

    it('should apply prefix to object keys with nested primes', () => {
      const dataWithNestedPrimes = {
        user: { age: 17 }, // Nested prime
        admin: { age: 18 }, // No nested primes
        guest: { id: 2 }, // Nested prime
      };

      const romlOutput = converter.jsonToRoml(dataWithNestedPrimes);

      // Objects don't get prefix, only the keys with prime values inside them
      expect(romlOutput).not.toMatch(/!user/);
      expect(romlOutput).not.toMatch(/!admin/);
      expect(romlOutput).not.toMatch(/!guest/);
      // But the nested keys with prime values should have prefixes
      expect(romlOutput).toMatch(/!age/); // age: 17 is prime
      expect(romlOutput).toMatch(/!id/); // id: 2 is prime
    });
  });

  describe('Different Syntax Styles with Primes', () => {
    it('should apply prime prefixes across different syntax styles', () => {
      const testData = {
        name: 2, // Personal semantic -> QUOTED style with prime
        active: 3, // Status semantic -> BRACKETS style with prime
        id: 4, // Technical semantic -> AMPERSAND style, no prime
        price: 7, // Financial semantic -> FAKE_COMMENT style with prime
      };

      const romlOutput = converter.jsonToRoml(testData);

      // Check that different styles all support prime prefixes
      expect(romlOutput).toMatch(/!name/); // Quoted style
      expect(romlOutput).toMatch(/!active/); // Brackets style
      expect(romlOutput).not.toMatch(/!id/); // No prime prefix for 4
      expect(romlOutput).toMatch(/!price/); // Fake comment style
    });

    it('should handle boolean values with prime prefixes', () => {
      const testData = {
        isPrime2: 2, // Prime number
        isPrime4: 4, // Not prime
        flag: true, // Boolean, no prime
      };

      const romlOutput = converter.jsonToRoml(testData);

      expect(romlOutput).toMatch(/!isPrime2/);
      expect(romlOutput).not.toMatch(/!isPrime4[^a-z]/);
      expect(romlOutput).not.toMatch(/!flag/);
    });

    it('should handle even line styles with prime prefixes', () => {
      // Create data that will land on even lines
      const testData = {
        a: 1, // Line 2 (even)
        b: 2, // Line 3 (odd) - prime, should get prefix
        c: 3, // Line 4 (even) - prime
        d: 4, // Line 5 (odd) - not prime
        e: 5, // Line 6 (even) - prime
      };

      const romlOutput = converter.jsonToRoml(testData);

      // Both odd and even line primes should get prefixes
      expect(romlOutput).toMatch(/!b/); // Odd line with prime
      expect(romlOutput).toMatch(/!c/); // Even line with prime
      expect(romlOutput).toMatch(/!e/); // Even line with prime
      expect(romlOutput).not.toMatch(/!d[^a-z]/); // Odd line without prime
      expect(romlOutput).not.toMatch(/!a[^a-z]/); // Even line without prime
    });
  });

  describe('Round-Trip Conversion with Primes', () => {
    it('should preserve prime data through round-trip conversion', () => {
      const originalData = {
        age: 23, // Prime
        count: 10, // Not prime
        id: 17, // Prime
        values: [2, 3, 4, 5], // Array with primes
      };

      const romlOutput = converter.jsonToRoml(originalData);

      // Verify META tag is present
      expect(romlOutput).toContain('~META~ SIEVE_OF_ERATOSTHENES_INVOKED');

      // Note: Full round-trip testing would require parser implementation
      // For now, verify ROML format is correct
      expect(romlOutput).toMatch(/!age/);
      expect(romlOutput).toMatch(/!id/);
      expect(romlOutput).toMatch(/!values/);
      expect(romlOutput).not.toMatch(/!count[^a-z]/);
    });

    it('should maintain deterministic output with primes', () => {
      const testData = {
        prime1: 7,
        notPrime: 8,
        prime2: 11,
      };

      const output1 = converter.jsonToRoml(testData);
      const output2 = converter.jsonToRoml(testData);

      // Should produce identical output every time
      expect(output1).toBe(output2);

      // Both should have META tag
      expect(output1).toContain('~META~ SIEVE_OF_ERATOSTHENES_INVOKED');
      expect(output2).toContain('~META~ SIEVE_OF_ERATOSTHENES_INVOKED');
    });
  });

  describe('Edge Cases with Primes', () => {
    it('should handle special numeric values', () => {
      const testData = {
        zero: 0, // Not prime
        one: 1, // Not prime
        two: 2, // Smallest prime
        negative: -7, // Negative (not considered prime)
      };

      const romlOutput = converter.jsonToRoml(testData);

      expect(romlOutput).toMatch(/!two/); // 2 is prime
      expect(romlOutput).not.toMatch(/!zero/);
      expect(romlOutput).not.toMatch(/!one[^a-z]/);
      expect(romlOutput).not.toMatch(/!negative/);
    });

    it('should handle large prime numbers', () => {
      const testData = {
        largePrime: 982451653, // Large prime number
        largeComposite: 982451654, // Large non-prime
      };

      const romlOutput = converter.jsonToRoml(testData);

      expect(romlOutput).toContain('~META~ SIEVE_OF_ERATOSTHENES_INVOKED');
      expect(romlOutput).toMatch(/!largePrime/);
      expect(romlOutput).not.toMatch(/!largeComposite/);
    });

    it('should handle empty data structures', () => {
      const testData = {
        emptyArray: [],
        emptyObject: {},
        nullValue: null,
        undefinedValue: undefined,
        emptyString: '',
      };

      const romlOutput = converter.jsonToRoml(testData);

      // Should not generate META tag for empty structures
      expect(romlOutput).not.toContain('~META~ SIEVE_OF_ERATOSTHENES_INVOKED');
      expect(romlOutput).not.toContain('!');
    });

    it('should handle mixed data types in arrays', () => {
      const testData = {
        mixedWithPrime: ['hello', 7, true, null, 11],
        mixedWithoutPrime: ['world', 4, false, undefined, 6],
      };

      const romlOutput = converter.jsonToRoml(testData);

      expect(romlOutput).toContain('~META~ SIEVE_OF_ERATOSTHENES_INVOKED');
      expect(romlOutput).toMatch(/!mixedWithPrime/);
      expect(romlOutput).not.toMatch(/!mixedWithoutPrime/);
    });
  });

  describe('Line Numbering with META Tags', () => {
    it('should correctly adjust line numbers when META tag is present', () => {
      const testData = {
        first: 2, // Should be line 2 due to META tag (line 1)
        second: 3, // Should be line 3
        third: 4, // Should be line 4
      };

      const romlOutput = converter.jsonToRoml(testData);

      // Verify structure: ~ROML~ line, META line, then data lines
      const lines = romlOutput.split('\n');
      expect(lines[0]).toBe('~ROML~');
      expect(lines[1]).toBe('# ~META~ SIEVE_OF_ERATOSTHENES_INVOKED');
      expect(lines[2]).toMatch(/!first/); // Prime on line 2 (even)
      expect(lines[3]).toMatch(/!second/); // Prime on line 3 (odd)
      expect(lines[4]).not.toMatch(/!/); // Not prime on line 4 (even)
    });

    it('should maintain normal line numbering without META tag', () => {
      const testData = {
        first: 4, // Should be line 1 (odd)
        second: 6, // Should be line 2 (even)
        third: 8, // Should be line 3 (odd)
      };

      const romlOutput = converter.jsonToRoml(testData);

      // Verify structure: ~ROML~ line, then data lines
      const lines = romlOutput.split('\n');
      expect(lines[0]).toBe('~ROML~');
      expect(lines[1]).toMatch(/first/); // Line 1 (odd)
      expect(lines[2]).toMatch(/second/); // Line 2 (even)
      expect(lines[3]).toMatch(/third/); // Line 3 (odd)

      // No META tag should be present
      expect(romlOutput).not.toContain('~META~');
    });
  });
});
