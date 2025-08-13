import { isPrime, containsPrime, objectContainsPrimes, extractPrimes } from '../primeUtils.js';

describe('Prime Utilities', () => {
  describe('isPrime', () => {
    it('should handle small primes correctly', () => {
      expect(isPrime(2)).toBe(true);
      expect(isPrime(3)).toBe(true);
      expect(isPrime(5)).toBe(true);
      expect(isPrime(7)).toBe(true);
      expect(isPrime(11)).toBe(true);
    });

    it('should handle small non-primes correctly', () => {
      expect(isPrime(0)).toBe(false);
      expect(isPrime(1)).toBe(false);
      expect(isPrime(4)).toBe(false);
      expect(isPrime(6)).toBe(false);
      expect(isPrime(8)).toBe(false);
      expect(isPrime(9)).toBe(false);
      expect(isPrime(10)).toBe(false);
    });

    it('should handle medium-sized primes (using sieve)', () => {
      const mediumPrimes = [97, 101, 103, 107, 109, 113, 127, 131, 137, 139];
      mediumPrimes.forEach((prime) => {
        expect(isPrime(prime)).toBe(true);
      });
    });

    it('should handle medium-sized non-primes (using sieve)', () => {
      const mediumNonPrimes = [100, 102, 104, 105, 106, 108, 110, 111, 112, 114];
      mediumNonPrimes.forEach((nonPrime) => {
        expect(isPrime(nonPrime)).toBe(false);
      });
    });

    it('should handle large primes (using trial division)', () => {
      // These are larger than SIEVE_LIMIT (10000) so will use trial division
      expect(isPrime(10007)).toBe(true);
      expect(isPrime(10009)).toBe(true);
      expect(isPrime(10037)).toBe(true);
    });

    it('should handle large non-primes (using trial division)', () => {
      expect(isPrime(10001)).toBe(false); // 73 × 137
      expect(isPrime(10005)).toBe(false); // 3 × 5 × 23 × 29
      expect(isPrime(10006)).toBe(false); // 2 × 5003
    });

    it('should handle edge cases and invalid inputs', () => {
      expect(isPrime(-1)).toBe(false);
      expect(isPrime(-10)).toBe(false);
      expect(isPrime(1.5)).toBe(false);
      expect(isPrime(2.7)).toBe(false);
      expect(isPrime(NaN)).toBe(false);
      expect(isPrime(Infinity)).toBe(false);
      expect(isPrime(-Infinity)).toBe(false);
    });
  });

  describe('containsPrime', () => {
    it('should detect primes in primitive numbers', () => {
      expect(containsPrime(2)).toBe(true);
      expect(containsPrime(7)).toBe(true);
      expect(containsPrime(4)).toBe(false);
      expect(containsPrime(10)).toBe(false);
    });

    it('should handle non-numeric primitives', () => {
      expect(containsPrime('hello')).toBe(false);
      expect(containsPrime(true)).toBe(false);
      expect(containsPrime(false)).toBe(false);
      expect(containsPrime(null)).toBe(false);
      expect(containsPrime(undefined)).toBe(false);
    });

    it('should detect primes in simple arrays', () => {
      expect(containsPrime([1, 2, 3])).toBe(true); // 2 and 3 are prime
      expect(containsPrime([4, 6, 8, 9])).toBe(false);
      expect(containsPrime([1, 4, 6, 11])).toBe(true); // 11 is prime
      expect(containsPrime([])).toBe(false); // empty array
    });

    it('should detect primes in mixed arrays', () => {
      expect(containsPrime([1, 'text', 2, true])).toBe(true); // 2 is prime
      expect(containsPrime(['a', 'b', 4, false])).toBe(false);
      expect(containsPrime([null, undefined, 7])).toBe(true); // 7 is prime
    });

    it('should detect primes in nested arrays', () => {
      expect(
        containsPrime([
          [1, 2],
          [4, 6],
        ])
      ).toBe(true); // 2 is prime
      expect(
        containsPrime([
          [4, 6],
          [8, 9],
        ])
      ).toBe(false);
      expect(containsPrime([1, [2, [3, 4]]])).toBe(true); // 2 and 3 are prime
    });

    it('should detect primes in simple objects', () => {
      expect(containsPrime({ a: 7 })).toBe(true);
      expect(containsPrime({ a: 8, b: 9 })).toBe(false);
      expect(containsPrime({ x: 1, y: 2, z: 4 })).toBe(true); // 2 is prime
    });

    it('should detect primes in nested objects', () => {
      expect(containsPrime({ a: { b: 11 } })).toBe(true);
      expect(containsPrime({ a: { b: { c: 13 } } })).toBe(true);
      expect(containsPrime({ x: { y: 8 }, z: { w: 9 } })).toBe(false);
    });

    it('should detect primes in mixed object/array structures', () => {
      expect(containsPrime({ arr: [1, 2, 3] })).toBe(true); // 2 and 3 are prime
      expect(containsPrime({ obj: { num: 17 } })).toBe(true); // 17 is prime
      expect(containsPrime({ mixed: [{ a: 19 }, { b: 20 }] })).toBe(true); // 19 is prime
    });
  });

  describe('objectContainsPrimes', () => {
    it('should detect primes in flat objects', () => {
      expect(objectContainsPrimes({ age: 23 })).toBe(true); // 23 is prime
      expect(objectContainsPrimes({ count: 24 })).toBe(false);
      expect(objectContainsPrimes({ a: 10, b: 11, c: 12 })).toBe(true); // 11 is prime
    });

    it('should detect primes in nested structures', () => {
      expect(
        objectContainsPrimes({
          user: { age: 31 }, // 31 is prime
          data: [4, 6, 8],
        })
      ).toBe(true);

      expect(
        objectContainsPrimes({
          user: { age: 30 },
          data: [4, 6, 8],
        })
      ).toBe(false);
    });

    it('should handle complex nested structures', () => {
      const complexObject = {
        level1: {
          level2: {
            level3: {
              deepPrime: 41, // This should be detected
            },
            otherValue: 42,
          },
          arrayData: [1, 4, 6, 8, 9, 10],
        },
        topLevel: 'string',
      };

      expect(objectContainsPrimes(complexObject)).toBe(true);
    });

    it('should handle objects with no primes', () => {
      const noPrimesObject = {
        user: {
          age: 30,
          score: 100,
        },
        data: [4, 6, 8, 9, 10, 12],
        meta: {
          count: 20,
          total: 50,
        },
      };

      expect(objectContainsPrimes(noPrimesObject)).toBe(false);
    });
  });

  describe('extractPrimes', () => {
    it('should extract primes from primitive values', () => {
      expect(extractPrimes(7)).toEqual([7]);
      expect(extractPrimes(10)).toEqual([]);
      expect(extractPrimes('text')).toEqual([]);
    });

    it('should extract primes from arrays', () => {
      expect(extractPrimes([2, 4, 7, 8, 11])).toEqual([2, 7, 11]);
      expect(extractPrimes([4, 6, 8, 9])).toEqual([]);
    });

    it('should extract primes from objects', () => {
      const obj = {
        a: 3,
        b: 4,
        c: 7,
        d: 10,
      };
      expect(extractPrimes(obj)).toEqual([3, 7]);
    });

    it('should extract and deduplicate primes', () => {
      const dataWithDuplicates = {
        arr1: [2, 3, 5],
        arr2: [3, 5, 7], // 3 and 5 are duplicated
        single: 2, // 2 is duplicated
      };

      expect(extractPrimes(dataWithDuplicates)).toEqual([2, 3, 5, 7]);
    });

    it('should sort extracted primes', () => {
      const unsortedData = {
        large: 23,
        small: 2,
        medium: 11,
        tiny: 3,
      };

      expect(extractPrimes(unsortedData)).toEqual([2, 3, 11, 23]);
    });

    it('should handle complex nested structures', () => {
      const complexData = {
        level1: {
          primes: [13, 17],
          nested: {
            prime: 19,
            array: [2, 4, 29],
          },
        },
        topPrime: 5,
      };

      expect(extractPrimes(complexData)).toEqual([2, 5, 13, 17, 19, 29]);
    });
  });
});
