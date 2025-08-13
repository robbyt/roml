/**
 * Prime number detection utilities for ROML
 *
 * Implements efficient prime detection using the Sieve of Eratosthenes
 * for the range needed by ROML processing, with fallback for larger numbers.
 */

// Cache for sieve results up to this limit
const SIEVE_LIMIT = 10000;
let sieveCache: boolean[] | null = null;

/**
 * Generate sieve of Eratosthenes for efficient prime detection
 */
function generateSieve(limit: number): boolean[] {
  const sieve = new Array(limit + 1).fill(true);
  sieve[0] = sieve[1] = false; // 0 and 1 are not prime

  for (let i = 2; i * i <= limit; i++) {
    if (sieve[i]) {
      for (let j = i * i; j <= limit; j += i) {
        sieve[j] = false;
      }
    }
  }

  return sieve;
}

/**
 * Initialize the prime sieve cache
 */
function initializeSieve(): void {
  if (!sieveCache) {
    sieveCache = generateSieve(SIEVE_LIMIT);
  }
}

/**
 * Check if a number is prime using trial division (for numbers > SIEVE_LIMIT)
 */
function isPrimeByTrialDivision(num: number): boolean {
  if (num < 2) return false;
  if (num === 2) return true;
  if (num % 2 === 0) return false;

  for (let i = 3; i * i <= num; i += 2) {
    if (num % i === 0) return false;
  }

  return true;
}

/**
 * Determine if a number is prime
 *
 * @param num - The number to test
 * @returns true if the number is prime, false otherwise
 */
export function isPrime(num: number): boolean {
  // Handle edge cases
  if (!Number.isInteger(num) || num < 0) {
    return false;
  }

  // Use sieve for numbers within cache range
  if (num <= SIEVE_LIMIT) {
    initializeSieve();
    return sieveCache![num];
  }

  // Use trial division for larger numbers
  return isPrimeByTrialDivision(num);
}

/**
 * Check if any value in a data structure contains prime numbers
 *
 * @param value - The value to analyze (can be primitive, array, or object)
 * @returns true if any prime numbers are found
 */
export function containsPrime(value: unknown): boolean {
  if (typeof value === 'number') {
    return isPrime(value);
  }

  if (Array.isArray(value)) {
    return value.some((item) => containsPrime(item));
  }

  if (typeof value === 'object' && value !== null) {
    return Object.values(value).some((item) => containsPrime(item));
  }

  // Strings, booleans, null, undefined don't contain primes
  return false;
}

/**
 * Analyze an entire object for prime numbers
 *
 * @param obj - The object to scan for prime numbers
 * @returns true if any prime numbers are found anywhere in the object
 */
export function objectContainsPrimes(obj: Record<string, unknown>): boolean {
  return Object.values(obj).some((value) => containsPrime(value));
}

/**
 * Get all prime numbers found in a value (for debugging/testing)
 *
 * @param value - The value to analyze
 * @returns Array of all prime numbers found
 */
export function extractPrimes(value: unknown): number[] {
  const primes: number[] = [];

  function collectPrimes(val: unknown): void {
    if (typeof val === 'number' && isPrime(val)) {
      primes.push(val);
    } else if (Array.isArray(val)) {
      val.forEach((item) => collectPrimes(item));
    } else if (typeof val === 'object' && val !== null) {
      Object.values(val).forEach((item) => collectPrimes(item));
    }
  }

  collectPrimes(value);
  return [...new Set(primes)].sort((a, b) => a - b); // Remove duplicates and sort
}
