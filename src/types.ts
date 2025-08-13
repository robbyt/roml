/**
 * Type definitions for ROML features and conversion
 */

/**
 * Document-level features detected during initial scan
 * These features determine META tags and document-wide behavior
 */
export interface DocumentFeatures {
  readonly primesDetected: boolean;
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
  readonly hasLargeArray: boolean; // example future feature
  readonly isNestedObject: boolean; // example future feature
  // Additional line-level features can be added as needed
}

/**
 * Default empty document features for initialization
 */
export const EMPTY_DOCUMENT_FEATURES: DocumentFeatures = {
  primesDetected: false,
} as const;

/**
 * Default empty line features for initialization
 */
export const EMPTY_LINE_FEATURES: LineFeatures = {
  containsPrime: false,
  hasLargeArray: false,
  isNestedObject: false,
} as const;
