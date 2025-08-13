import { RomlFile } from '../file/RomlFile.js';
import { RomlConverter } from '../RomlConverter.js';
import { RomlLexer } from '../lexer/RomlLexer.js';
import { RomlParser } from '../parser/RomlParser.js';

describe('Prime Number META Tag Validation', () => {
  describe('Round-trip conversion with primes', () => {
    it('should successfully round-trip data with primes when META tag is present', () => {
      const input = {
        count: 7,
        value: 13,
        nested: {
          prime: 17,
          composite: 10,
        },
      };

      const converter = new RomlConverter();
      const roml = converter.jsonToRoml(input);

      // Should have META tag
      expect(roml).toContain('~META~ SIEVE_OF_ERATOSTHENES_INVOKED');

      // Parse it back
      const lexer = new RomlLexer(roml);
      const parser = new RomlParser();
      const tokens = lexer.tokenize();
      const result = parser.parse(tokens);

      expect(result.errors).toHaveLength(0);
      expect(result.data).toEqual(input);
      expect(result.primeValidation?.metaTagPresent).toBe(true);
      expect(result.primeValidation?.primesDetected).toBe(true);
    });

    it('should fail when primes are present but META tag is missing', () => {
      // Manually create ROML with prime prefixes but no META tag
      const romlWithoutMeta = `!count="7"
!value="13"
nested{
  !prime="17"
  composite="10"
}`;

      const lexer = new RomlLexer(romlWithoutMeta);
      const parser = new RomlParser();
      const tokens = lexer.tokenize();
      const result = parser.parse(tokens);

      // Should have parse error
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain(
        'missing the required ~META~ SIEVE_OF_ERATOSTHENES_INVOKED tag'
      );
      expect(result.errors[0]).toContain('Add the META tag at the beginning');
      expect(result.primeValidation?.metaTagPresent).toBe(false);
      expect(result.primeValidation?.primesDetected).toBe(true);
    });

    it('should fail when META tag is present but no primes exist', () => {
      // Manually create ROML with META tag but no primes
      const romlWithMetaNoPrimes = `~ROML~
# ~META~ SIEVE_OF_ERATOSTHENES_INVOKED
composite="4"
another="6"
value="8"`;

      const lexer = new RomlLexer(romlWithMetaNoPrimes);
      const parser = new RomlParser();
      const tokens = lexer.tokenize();
      const result = parser.parse(tokens);

      // Should have fatal parse error
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain(
        'declares ~META~ SIEVE_OF_ERATOSTHENES_INVOKED but contains no prime-prefixed keys'
      );
      expect(result.errors[0]).toContain('Remove the META tag or add prime prefixes');
      expect(result.primeValidation?.metaTagPresent).toBe(true);
      expect(result.primeValidation?.primesDetected).toBe(false);
    });

    it('should fail with actionable error when prime prefix used on non-prime value', () => {
      const romlWithInvalidPrime = `~ROML~
# ~META~ SIEVE_OF_ERATOSTHENES_INVOKED
!notPrime="8"
!actualPrime="7"`;

      const lexer = new RomlLexer(romlWithInvalidPrime);
      const parser = new RomlParser();
      const tokens = lexer.tokenize();
      const result = parser.parse(tokens);

      // Should have error for non-prime with prime prefix
      expect(result.errors.length).toBeGreaterThan(0);
      const error = result.errors.find((e) => e.includes('line 3'));
      expect(error).toBeDefined();
      expect(error).toContain('marked as prime but value 8 is not a prime number');
      expect(result.primeValidation?.invalidPrimeKeys.length).toBeGreaterThan(0);
    });
  });

  describe('Error messages', () => {
    it('should provide line numbers in error messages', () => {
      const romlWithErrors = `!first="4"
!second="5"
!third="6"`;

      const lexer = new RomlLexer(romlWithErrors);
      const parser = new RomlParser();
      const tokens = lexer.tokenize();
      const result = parser.parse(tokens);

      // Check for line-specific errors (lines are 1-indexed)
      const line1Error = result.errors.find((e) => e.includes('value 4 is not a prime'));
      const line3Error = result.errors.find((e) => e.includes('value 6 is not a prime'));

      expect(line1Error).toBeDefined();
      expect(line3Error).toBeDefined();
    });

    it('should handle prime detection in arrays correctly', () => {
      const input = {
        primes: [2, 3, 5, 7],
        mixed: [2, 4, 7, 9],
      };

      const converter = new RomlConverter();
      const roml = converter.jsonToRoml(input);

      // Parse back
      const lexer = new RomlLexer(roml);
      const parser = new RomlParser();
      const tokens = lexer.tokenize();
      const result = parser.parse(tokens);

      expect(result.errors).toHaveLength(0);
      expect(result.data).toEqual(input);
    });
  });

  describe('Complex nested structures with primes', () => {
    it('should handle deeply nested objects with prime values', () => {
      const input = {
        level1: {
          prime1: 11,
          level2: {
            prime2: 13,
            level3: {
              prime3: 17,
              composite: 15,
            },
          },
        },
      };

      const file = RomlFile.fromJSON(input);
      const roml = file.toRoml();
      expect(roml).toContain('~META~ SIEVE_OF_ERATOSTHENES_INVOKED');

      const parsed = file.toJSON();
      expect(parsed).toEqual(input);
    });

    it('should preserve non-prime values without prefixes', () => {
      const input = {
        prime: 23,
        composite: 24,
        string: 'test',
        boolean: true,
        array: [1, 2, 3, 4, 5],
      };

      const converter = new RomlConverter();
      const roml = converter.jsonToRoml(input);

      // Check that only prime gets prefix
      expect(roml).toMatch(/!prime/);
      expect(roml).not.toMatch(/!composite/);
      expect(roml).not.toMatch(/!string/);
      expect(roml).not.toMatch(/!boolean/);

      // Round-trip should work
      const lexer = new RomlLexer(roml);
      const parser = new RomlParser();
      const tokens = lexer.tokenize();
      const result = parser.parse(tokens);

      expect(result.errors).toHaveLength(0);
      expect(result.data).toEqual(input);
    });
  });

  describe('Manual ROML editing scenarios', () => {
    it('should provide helpful error when user forgets META tag', () => {
      const manualRoml = `!myPrime="7"
regular="value"`;

      const lexer = new RomlLexer(manualRoml);
      const parser = new RomlParser();
      const tokens = lexer.tokenize();
      const result = parser.parse(tokens);

      expect(result.errors[0]).toContain(
        'Add the META tag at the beginning of the document or remove prime prefixes (!)'
      );
    });

    it('should provide helpful error when user incorrectly marks non-prime', () => {
      const manualRoml = `~ROML~
# ~META~ SIEVE_OF_ERATOSTHENES_INVOKED
!wrongPrime="10"`;

      const lexer = new RomlLexer(manualRoml);
      const parser = new RomlParser();
      const tokens = lexer.tokenize();
      const result = parser.parse(tokens);

      const error = result.errors.find((e) => e.includes('line 3'));
      expect(error).toBeDefined();
      expect(error).toContain('value 10 is not a prime number');
    });

    it('should successfully parse manually edited ROML with correct prime prefixes', () => {
      const manualRoml = `~ROML~
# ~META~ SIEVE_OF_ERATOSTHENES_INVOKED
!firstPrime="2"
!secondPrime="3"
composite="4"
!thirdPrime="5"`;

      const lexer = new RomlLexer(manualRoml);
      const parser = new RomlParser();
      const tokens = lexer.tokenize();
      const result = parser.parse(tokens);

      expect(result.errors).toHaveLength(0);
      // Quoted values are preserved as strings per Double Quote Rule
      expect(result.data).toEqual({
        firstPrime: '2',
        secondPrime: '3',
        composite: '4',
        thirdPrime: '5',
      });
    });
  });
});
