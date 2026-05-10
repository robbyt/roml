/**
 * Type definitions for ROML features and conversion
 */

/**
 * META tag constants for ROML documents
 */
export enum MetaTags {
  SIEVE_OF_ERATOSTHENES_INVOKED = 'SIEVE_OF_ERATOSTHENES_INVOKED',
  /**
   * Marks a document whose JSON root was an array. The encoder wraps
   * such roots as `{__roml_items__: [...]}` for downstream encoding,
   * and this META tag is what tells the parser the wrap is synthetic
   * (so a user document with a real `__roml_items__` key as its only
   * top-level key does not get unwrapped).
   */
  ROOT_ARRAY = 'ROOT_ARRAY',
  /**
   * Marks a document whose JSON root was a primitive (string, number,
   * boolean, null). The encoder wraps such roots as
   * `{__roml_value__: x}`. As with ROOT_ARRAY, the META tag is what
   * licenses the parser to unwrap.
   */
  ROOT_PRIMITIVE = 'ROOT_PRIMITIVE',
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
