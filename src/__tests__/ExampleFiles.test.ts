import { RomlFile } from '../file/RomlFile.js';
import * as path from 'path';
import * as fs from 'fs';

describe('Example Files', () => {
  describe('primes.roml example', () => {
    it('should successfully parse examples/primes.roml without errors', () => {
      const examplesDir = path.join(process.cwd(), 'examples');
      const primesPath = path.join(examplesDir, 'primes.roml');

      // Verify the file exists
      expect(fs.existsSync(primesPath)).toBe(true);

      // Parse the file
      const romlFile = RomlFile.fromFile(primesPath);
      const parseResult = romlFile.parse();

      // Should parse without errors
      expect(parseResult.errors).toHaveLength(0);
      expect(parseResult.data).toBeDefined();

      // Should have META tag validation
      expect(parseResult.primeValidation?.metaTagPresent).toBe(true);
      expect(parseResult.primeValidation?.primesDetected).toBe(true);
      expect(parseResult.primeValidation?.invalidPrimeKeys).toHaveLength(0);
    });

    it('should parse examples/primes.roml with expected data structure', () => {
      const examplesDir = path.join(process.cwd(), 'examples');
      const primesPath = path.join(examplesDir, 'primes.roml');

      const romlFile = RomlFile.fromFile(primesPath);
      const data = romlFile.toJSON();

      // Check basic prime numbers
      expect(data.count).toBe(7);
      expect(data.value).toBe(13);
      expect(data.composite).toBe(4);

      // Check type preservation (quoted strings remain strings)
      expect(data.message).toBe('7');
      expect(typeof data.message).toBe('string');
      expect(data.primeString).toBe('13');
      expect(typeof data.primeString).toBe('string');

      // Check edge cases
      expect(data.negative).toBe(-7);
      expect(data.zero).toBe(0);
      expect(data.one).toBe(1);
      expect(data.two).toBe(2);
      expect(data.large).toBe(97);

      // Check nested object
      expect(data.nested).toBeDefined();
      expect(data.nested.prime).toBe(17);
      expect(data.nested.notPrime).toBe(15);
      expect(data.nested.text).toBe('prime');
      expect(typeof data.nested.text).toBe('string');

      // Check arrays
      expect(data.primes).toEqual([2, 3, 5, 7]);
      expect(data.mixed).toEqual([2, 4, 7, 9]);
      expect(data.strings).toEqual(['2', '3', '5']);

      // Verify string array elements are actually strings
      expect(typeof data.strings[0]).toBe('string');
      expect(typeof data.strings[1]).toBe('string');
      expect(typeof data.strings[2]).toBe('string');
    });

    it('should successfully round-trip examples/primes.roml', () => {
      const examplesDir = path.join(process.cwd(), 'examples');
      const primesPath = path.join(examplesDir, 'primes.roml');

      const originalFile = RomlFile.fromFile(primesPath);
      const roundTripResult = originalFile.testRoundTrip();

      expect(roundTripResult.success).toBe(true);
      expect(roundTripResult.errors).toHaveLength(0);
    });

    it('should validate that prime prefixes are correctly applied in examples/primes.roml', () => {
      const examplesDir = path.join(process.cwd(), 'examples');
      const primesPath = path.join(examplesDir, 'primes.roml');

      const content = fs.readFileSync(primesPath, 'utf-8');

      // Check that prime values have ! prefixes
      expect(content).toMatch(/!count:/); // 7 is prime
      expect(content).toMatch(/&!value&/); // 13 is prime
      expect(content).toMatch(/!two:/); // 2 is prime
      expect(content).toMatch(/&!large&/); // 97 is prime
      expect(content).toMatch(/&!prime&/); // 17 is prime (in nested)
      expect(content).toMatch(/!primes\|\|/); // array with primes
      expect(content).toMatch(/!mixed:/); // mixed array with primes

      // Check that non-prime values don't have ! prefixes
      expect(content).toMatch(/composite:4/); // 4 is not prime
      expect(content).toMatch(/&negative&-7/); // -7 is not prime
      expect(content).toMatch(/zero:0/); // 0 is not prime
      expect(content).toMatch(/&one&1/); // 1 is not prime
      expect(content).toMatch(/notPrime:15/); // 15 is not prime (in nested)

      // Check that string arrays don't get prime prefixes
      expect(content).toMatch(/strings\[/); // string array, no ! prefix
    });
  });
});
