/**
 * Type definitions for ROML features and conversion
 */

/**
 * META tag constants for ROML documents
 */
export enum MetaTags {
  SIEVE_OF_ERATOSTHENES_INVOKED = 'SIEVE_OF_ERATOSTHENES_INVOKED',
}

/**
 * Synthetic wrapper key names used to encode top-level non-object roots
 * (arrays, primitives) as if they were objects. These are intentionally
 * unusual identifiers so they do not collide with realistic user keys; if
 * a user really has these as root keys, round-trip is lossy by design.
 */
export const SYNTHETIC_ITEMS_KEY = '__roml_items__';
export const SYNTHETIC_VALUE_KEY = '__roml_value__';

/**
 * Document-level features detected during initial scan
 * These features determine META tags and document-wide behavior
 */
export interface DocumentFeatures {
  readonly primesDetected: boolean;
  readonly rootType: 'object' | 'array' | 'primitive';
  // Future features can be added here:
  // readonly hasComplexArrays: boolean;
  // readonly containsNestedObjects: boolean;
  // readonly hasLargeStrings: boolean;
}

/**
 * Line-level features for individual key-value pairs
 * These features determine syntax modifications for specific lines
 */
export interface LineFeatures {
  readonly containsPrime: boolean;
  readonly hasLargeArray: boolean;
  readonly isNestedObject: boolean;
  readonly keyStartsWithVowel: boolean;
  readonly hasLongString: boolean;
  readonly isSpecialValue: boolean;
  readonly nestingDepth: number;
  readonly needsQuotes: boolean;
  readonly needsQuotedKey: boolean;
}

/**
 * Default empty document features for initialization
 */
export const EMPTY_DOCUMENT_FEATURES: DocumentFeatures = {
  primesDetected: false,
  rootType: 'object',
} as const;

/**
 * Default empty line features for initialization
 */
export const EMPTY_LINE_FEATURES: LineFeatures = {
  containsPrime: false,
  hasLargeArray: false,
  isNestedObject: false,
  keyStartsWithVowel: false,
  hasLongString: false,
  isSpecialValue: false,
  nestingDepth: 0,
  needsQuotes: false,
  needsQuotedKey: false,
} as const;
