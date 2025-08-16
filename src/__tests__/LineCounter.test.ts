import { RomlConverter } from '../RomlConverter.js';
import { RomlFile } from '../file/RomlFile.js';

describe('ROML Line Counter Behavior', () => {
  let converter: RomlConverter;

  beforeEach(() => {
    converter = new RomlConverter();
  });

  describe('Counter without META tag', () => {
    it('should start counter at 1 (odd) for first data element', () => {
      const data = {
        a: 1, // Counter=1 (odd): numbers on odd use ampersand (1 is not prime)
        b: 4, // Counter=2 (even): numbers on even use colon (4 is not prime)
        c: 6, // Counter=3 (odd): numbers on odd use ampersand (6 is not prime)
      };

      const roml = converter.jsonToRoml(data);
      const lines = roml.split('\n');

      expect(lines[0]).toBe('~ROML~');
      expect(lines[1]).toBe('&a&1'); // Counter 1 (odd) - ampersand
      expect(lines[2]).toBe('b:4'); // Counter 2 (even) - colon
      expect(lines[3]).toBe('&c&6'); // Counter 3 (odd) - ampersand
    });

    it('should alternate boolean styles correctly without META', () => {
      const data = {
        flag1: true, // Counter=1 (odd): booleans on odd use brackets
        flag2: false, // Counter=2 (even): booleans on even use equals with yes/no
        flag3: true, // Counter=3 (odd): brackets
        flag4: false, // Counter=4 (even): equals
      };

      const roml = converter.jsonToRoml(data);

      expect(roml).toContain('flag1<true>'); // Odd - brackets
      expect(roml).toContain('flag2=no'); // Even - equals
      expect(roml).toContain('flag3<true>'); // Odd - brackets
      expect(roml).toContain('flag4=no'); // Even - equals
    });

    it('should follow odd pattern for nested objects', () => {
      const data = {
        obj: {
          // Counter=1 (odd)
          x: 10, // Counter=2 (even)
          y: 20, // Counter=3 (odd)
        }, // Counter=4 (even)
        next: 30, // Counter=5 (odd)
      };

      const roml = converter.jsonToRoml(data);
      const lines = roml.split('\n');

      expect(lines[1]).toBe('obj{'); // Counter 1 (odd)
      expect(lines[2]).toBe('  x:10'); // Counter 2 (even) - colon
      expect(lines[3]).toBe('  &y&20'); // Counter 3 (odd) - ampersand
      expect(lines[4]).toBe('}'); // Counter 4 (even)
      expect(lines[5]).toBe('&next&30'); // Counter 5 (odd) - ampersand
    });
  });

  describe('Counter with META tag (prime numbers)', () => {
    it('should start counter at 2 (even) for first data element with META tag', () => {
      const data = {
        a: 2, // Counter=2 (even): prime, but even counter uses colon
        b: 3, // Counter=3 (odd): prime, odd counter uses ampersand
        c: 4, // Counter=4 (even): not prime, even uses colon
      };

      const roml = converter.jsonToRoml(data);
      const lines = roml.split('\n');

      expect(lines[0]).toBe('~ROML~');
      expect(lines[1]).toBe('# ~META~ SIEVE_OF_ERATOSTHENES_INVOKED');
      expect(lines[2]).toBe('!a:2'); // Counter 2 (even) - colon with prime prefix
      expect(lines[3]).toBe('&!b&3'); // Counter 3 (odd) - ampersand with prime prefix
      expect(lines[4]).toBe('c:4'); // Counter 4 (even) - colon, no prefix
    });

    it('should shift boolean pattern with META tag', () => {
      const data = {
        prime: 7, // Counter=2 (even): prime number
        flag1: true, // Counter=3 (odd): boolean uses brackets
        flag2: false, // Counter=4 (even): boolean uses equals
        value: 11, // Counter=5 (odd): prime uses ampersand
      };

      const roml = converter.jsonToRoml(data);

      expect(roml).toContain('# ~META~ SIEVE_OF_ERATOSTHENES_INVOKED');
      expect(roml).toContain('!prime:7'); // Even - colon
      expect(roml).toContain('flag1<true>'); // Odd - brackets
      expect(roml).toContain('flag2=no'); // Even - equals
      expect(roml).toContain('&!value&11'); // Odd - ampersand
    });

    it('should maintain shifted pattern in nested objects with primes', () => {
      const data = {
        p: 5, // Counter=2 (even): prime
        obj: {
          // Counter=3 (odd)
          x: 7, // Counter=4 (even): prime
          y: 8, // Counter=5 (odd): not prime
        }, // Counter=6 (even)
        z: 9, // Counter=7 (odd): not prime
      };

      const roml = converter.jsonToRoml(data);
      const lines = roml.split('\n').filter((l) => l.trim());

      expect(lines[1]).toBe('# ~META~ SIEVE_OF_ERATOSTHENES_INVOKED');
      expect(lines[2]).toBe('!p:5'); // Counter 2 (even) - colon
      expect(lines[3]).toBe('obj{'); // Counter 3 (odd)
      expect(lines[4]).toContain('!x:7'); // Counter 4 (even) - colon with prefix
      expect(lines[5]).toContain('&y&8'); // Counter 5 (odd) - ampersand
      expect(lines[6]).toBe('}'); // Counter 6 (even)
      expect(lines[7]).toBe('&z&9'); // Counter 7 (odd) - ampersand
    });
  });

  describe('Pattern shift verification', () => {
    it('should produce different patterns for same structure with/without primes', () => {
      // Without primes - starts at counter=1 (odd)
      const noPrimes = { a: 1, b: 4, c: 6 };
      const romlNoPrimes = converter.jsonToRoml(noPrimes);

      // With primes - starts at counter=2 (even) due to META tag
      const withPrimes = { a: 2, b: 3, c: 4 };
      const romlWithPrimes = converter.jsonToRoml(withPrimes);

      // Without primes: odd, even, odd pattern
      expect(romlNoPrimes).toContain('&a&1'); // Counter 1 (odd)
      expect(romlNoPrimes).toContain('b:4'); // Counter 2 (even)
      expect(romlNoPrimes).toContain('&c&6'); // Counter 3 (odd)

      // With primes: even, odd, even pattern (shifted)
      expect(romlWithPrimes).toContain('!a:2'); // Counter 2 (even)
      expect(romlWithPrimes).toContain('&!b&3'); // Counter 3 (odd)
      expect(romlWithPrimes).toContain('c:4'); // Counter 4 (even)
    });

    it('should verify semantic categories respect counter position', () => {
      // Test with 'name' (PERSONAL semantic) at different counter positions

      // Without primes: 'name' is at counter=1 (odd), uses semantic QUOTED
      const noPrimes = { name: 'Alice', value: 10 };
      const romlNoPrimes = converter.jsonToRoml(noPrimes);
      expect(romlNoPrimes).toContain('name="Alice"'); // Odd - semantic applies

      // With a prime to shift pattern: 'name' would be at counter=3 (odd), still uses semantic
      const withPrimeOdd = { x: 2, name: 'Bob', y: 4 };
      const romlPrimeOdd = converter.jsonToRoml(withPrimeOdd);
      expect(romlPrimeOdd).toContain('name="Bob"'); // Still odd - semantic applies

      // Position 'name' at even counter to verify semantic doesn't apply
      const nameEven = { x: 2, y: 3, name: 'Charlie', z: 4 };
      const romlNameEven = converter.jsonToRoml(nameEven);
      // 'name' is at counter=4 (even), semantic categories don't apply on even
      expect(romlNameEven).toContain('name=Charlie'); // Even - no semantic, uses equals
    });
  });

  describe('Comments and line counting', () => {
    it('should parse ROML with comments correctly', () => {
      const romlWithComments = `~ROML~
# This is a comment on line 2
a<true>
# Another comment 
b=no`;

      const parsed = RomlFile.romlToJson(romlWithComments);
      expect(parsed).toEqual({ a: true, b: false });
    });

    it('should handle comments between META tag and data', () => {
      const romlWithCommentsAndMeta = `~ROML~
# ~META~ SIEVE_OF_ERATOSTHENES_INVOKED
# This is a regular comment
!a:2
# Comment between data elements
&!b&3`;

      const parsed = RomlFile.romlToJson(romlWithCommentsAndMeta);
      expect(parsed).toEqual({ a: 2, b: 3 });
    });
  });

  describe('Round-trip preservation with counter patterns', () => {
    it('should preserve data through round-trip regardless of META tag shift', () => {
      const testCases = [
        { a: 1, b: 4, c: 6 }, // No primes
        { a: 2, b: 3, c: 5 }, // All primes
        { x: 7, name: 'Test', y: 11 }, // Mixed with semantic
        { flag1: true, p: 13, flag2: false }, // Booleans and prime
      ];

      for (const original of testCases) {
        const roml = converter.jsonToRoml(original);
        const parsed = RomlFile.romlToJson(roml);
        expect(parsed).toEqual(original);
      }
    });
  });
});
