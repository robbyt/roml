import { RomlToken } from '../lexer/RomlLexer.js';
import { MetaTags, SYNTHETIC_ITEMS_KEY, SYNTHETIC_VALUE_KEY } from '../types.js';

export interface RomlMetadata {
  checksum: string;
  size: number;
  created: string;
  source: 'json' | 'yaml' | 'xml';
}

export interface RomlParseResult {
  data: any;
  metadata: RomlMetadata;
  errors: string[];
  ast: RomlASTNode;
  hasPrimes?: boolean;
  primeValidation?: {
    metaTagPresent: boolean;
    primesDetected: boolean;
    invalidPrimeKeys: string[];
  };
}

// AST Node Types
export type RomlASTNode =
  | RomlDocumentNode
  | RomlObjectNode
  | RomlArrayNode
  | RomlKeyValueNode
  | RomlValueNode;

export interface BaseASTNode {
  type: string;
  startOffset: number;
  endOffset: number;
  lineNumber: number;
  depth: number;
}

export interface RomlDocumentNode extends BaseASTNode {
  type: 'document';
  header?: RomlToken;
  body: RomlObjectNode;
}

export interface RomlObjectNode extends BaseASTNode {
  type: 'object';
  key?: string;
  properties: RomlKeyValueNode[];
  children: (RomlObjectNode | RomlArrayNode)[];
}

export interface RomlArrayNode extends BaseASTNode {
  type: 'array';
  key: string;
  items: (RomlValueNode | RomlObjectNode | RomlArrayNode)[];
  arrayStyle: 'structured' | 'inline';
}

export interface RomlKeyValueNode extends BaseASTNode {
  type: 'keyvalue';
  key: string;
  value: unknown;
  style: string;
  token: RomlToken;
}

export interface RomlValueNode extends BaseASTNode {
  type: 'value';
  value: unknown;
  index?: number;
}

export class RomlParser {
  private tokens: RomlToken[] = [];
  private position: number = 0;
  private errors: string[] = [];
  private metaTagPresent: boolean = false;
  private primesDetected: boolean = false;
  private invalidPrimeKeys: string[] = [];
  // Root-wrapper META state. Set by `checkForMetaTag` when the
  // corresponding tag is seen in the document header. The unwrap
  // logic consults these flags so that a user object whose only key
  // happens to be `__roml_items__` / `__roml_value__` (without the
  // META tag) is round-tripped as an object instead of being
  // unwrapped.
  private rootArrayWrapped: boolean = false;
  private rootPrimitiveWrapped: boolean = false;

  public parse(tokens: RomlToken[]): RomlParseResult {
    this.tokens = tokens;
    this.position = 0;
    this.errors = [];
    this.metaTagPresent = false;
    this.primesDetected = false;
    this.invalidPrimeKeys = [];
    this.rootArrayWrapped = false;
    this.rootPrimitiveWrapped = false;

    // Check for META tag
    this.checkForMetaTag();

    const ast = this.buildAST();

    // Validate prime consistency
    this.validatePrimeConsistency();
    this.validateRootMetaConsistency();

    const data = this.astToData(ast);

    const metadata = this.createMetadata();

    return {
      data,
      metadata,
      errors: this.errors,
      ast,
      hasPrimes: this.primesDetected,
      primeValidation: {
        metaTagPresent: this.metaTagPresent,
        primesDetected: this.primesDetected,
        invalidPrimeKeys: this.invalidPrimeKeys,
      },
    };
  }

  private buildAST(): RomlDocumentNode {
    const headerToken = this.findTokenOfType('HEADER');
    const startOffset = 0;
    const endOffset = this.tokens[this.tokens.length - 1]?.endOffset || 0;

    const body = this.parseObject();

    return {
      type: 'document',
      startOffset,
      endOffset,
      lineNumber: 0,
      depth: 0,
      header: headerToken,
      body,
    };
  }

  private parseObject(key?: string, expectedDepth: number = 0): RomlObjectNode {
    const properties: RomlKeyValueNode[] = [];
    const children: (RomlObjectNode | RomlArrayNode)[] = [];
    const startToken = this.current();

    while (this.position < this.tokens.length) {
      const token = this.current();

      if (!token || token.type === 'EOF') break;

      if (
        (token.type === 'OBJECT_END' || token.type === 'ARRAY_END') &&
        (token.depth || 0) <= expectedDepth
      ) {
        if (token.type === 'OBJECT_END') this.advance();
        break;
      }

      if (token.type === 'KEY_VALUE') {
        const keyValue = this.parseKeyValue(token);
        if (keyValue) properties.push(keyValue);
        this.advance();
      } else if (token.type === 'OBJECT_START') {
        const childObject = this.parseChildObject(token);
        if (childObject) children.push(childObject);
      } else if (token.type === 'ARRAY_START') {
        const childArray = this.parseChildArray(token);
        if (childArray) children.push(childArray);
      } else {
        this.advance();
      }
    }

    return {
      type: 'object',
      key,
      startOffset: startToken?.startOffset || 0,
      endOffset: this.previous()?.endOffset || 0,
      lineNumber: startToken?.lineNumber || 0,
      depth: expectedDepth,
      properties,
      children,
    };
  }

  private parseChildObject(token: RomlToken): RomlObjectNode | null {
    if (token.key === undefined) return null;

    // The lexer already stripped the prime prefix and surrounding
    // quotes from `token.key`; just record whether a `!` was present
    // so prime-validation can fire against the parent document.
    if (token.keyHasPrimePrefix) {
      this.primesDetected = true;
    }

    this.advance();
    const childObject = this.parseObject(token.key, (token.depth || 0) + 1);
    return childObject;
  }

  private parseChildArray(token: RomlToken): RomlArrayNode | null {
    if (token.key === undefined) return null;

    // The lexer already stripped the prime prefix and surrounding
    // quotes from `token.key`; just record whether a `!` was present.
    if (token.keyHasPrimePrefix) {
      this.primesDetected = true;
    }
    const cleanKey = token.key;

    this.advance();
    const items: (RomlValueNode | RomlObjectNode | RomlArrayNode)[] = [];

    while (this.position < this.tokens.length) {
      const current = this.current();
      if (!current || current.type === 'EOF') break;

      if (current.type === 'ARRAY_END' && (current.depth || 0) <= (token.depth || 0)) {
        this.advance();
        break;
      }

      if (current.type === 'ARRAY_ITEM') {
        this.advance();
        const itemObject = this.parseObject(current.key, (current.depth || 0) + 1);
        items.push(itemObject);
      } else if (current.type === 'ARRAY_START') {
        // Handle nested arrays
        const nestedArray = this.parseChildArray(current);
        if (nestedArray) {
          items.push(nestedArray);
        }
      } else if (current.type === 'KEY_VALUE') {
        // Handle primitive array items (e.g., [0]:42, [1]//text)
        // Check for prime prefixes in array item keys
        if (current.key && current.key.startsWith('!')) {
          this.primesDetected = true;
          // Validate that the value is actually prime (same logic as parseKeyValue)
          let numericValue: number | null = null;
          if (typeof current.parsedValue === 'number') {
            numericValue = current.parsedValue;
          } else if (typeof current.parsedValue === 'string') {
            const parsed = parseFloat(current.parsedValue);
            if (!isNaN(parsed) && String(parsed) === current.parsedValue) {
              numericValue = parsed;
            }
          }
          if (numericValue !== null && !this.isPrime(numericValue)) {
            this.invalidPrimeKeys.push(
              `Line ${current.lineNumber + 1}: Key "${current.key}" has prime prefix but value ${numericValue} is not prime`
            );
            this.errors.push(
              `Invalid prime prefix at line ${current.lineNumber + 1}: Key "${current.key}" is marked as prime but value ${numericValue} is not a prime number`
            );
          }
        }

        const arrayIndex = this.extractArrayIndex(current.key || '');
        const valueNode: RomlValueNode = {
          type: 'value',
          value: current.parsedValue !== undefined ? current.parsedValue : current.value,
          index: arrayIndex,
          startOffset: current.startOffset,
          endOffset: current.endOffset || current.startOffset,
          lineNumber: current.lineNumber || 0,
          depth: current.depth || 0,
        };
        items.push(valueNode);
        this.advance();
      } else {
        this.advance();
      }
    }

    return {
      type: 'array',
      key: cleanKey,
      startOffset: token.startOffset,
      endOffset: this.previous()?.endOffset || token.endOffset,
      lineNumber: token.lineNumber,
      depth: token.depth || 0,
      items,
      arrayStyle: 'structured',
    };
  }

  private parseKeyValue(token: RomlToken): RomlKeyValueNode | null {
    if (token.key === undefined || token.parsedValue === undefined) return null;

    // The lexer already strips any prime-marker `!` and surrounding
    // quotes from `token.key`, surfacing the structural information via
    // `token.keyHasPrimePrefix` and `token.keyWasQuoted`. So `token.key`
    // is the literal JSON key name; we just decide whether to treat the
    // line as a prime-prefixed line.
    const cleanKey = token.key;
    if (token.keyHasPrimePrefix) {
      this.primesDetected = true;

      // Validate that the value is actually prime (handle both numbers and numeric strings)
      let numericValue: number | null = null;
      if (typeof token.parsedValue === 'number') {
        numericValue = token.parsedValue;
      } else if (typeof token.parsedValue === 'string') {
        const parsed = parseFloat(token.parsedValue);
        if (!isNaN(parsed) && String(parsed) === token.parsedValue) {
          numericValue = parsed;
        }
      }

      if (numericValue !== null && !this.isPrime(numericValue)) {
        // `cleanKey` is unescaped, so it can contain `"`, `\n`, control
        // chars, etc. Use JSON.stringify to render an unambiguous,
        // self-delimiting representation of the key including the `!`
        // prime marker.
        const displayKey = JSON.stringify('!' + cleanKey);
        this.invalidPrimeKeys.push(
          `Line ${token.lineNumber + 1}: Key ${displayKey} has prime prefix but value ${numericValue} is not prime`
        );
        this.errors.push(
          `Invalid prime prefix at line ${token.lineNumber + 1}: Key ${displayKey} is marked as prime but value ${numericValue} is not a prime number`
        );
      }
    }

    return {
      type: 'keyvalue',
      key: cleanKey,
      value: token.parsedValue,
      style: token.style || 'UNKNOWN',
      startOffset: token.startOffset,
      endOffset: token.endOffset,
      lineNumber: token.lineNumber,
      depth: token.depth || 0,
      token,
    };
  }

  private astToData(ast: RomlDocumentNode): any {
    const objectData = this.objectNodeToData(ast.body);

    // Unwrap synthetic objects back to original types
    return this.unwrapSyntheticObject(objectData);
  }

  /**
   * Unwrap synthetic objects back to their original types.
   *
   * The unwrap is META-tag-gated: the encoder emits
   * `# ~META~ ROOT_ARRAY` or `# ~META~ ROOT_PRIMITIVE` whenever it
   * synthetically wraps a non-object root, and only the presence of
   * the matching META tag licenses the parser to unwrap. Without the
   * tag, a wrapper-shaped user document (e.g. `{"__roml_items__":
   * [1,2,3]}` written by hand) is round-tripped as a regular object
   * rather than collapsed to an array.
   */
  private unwrapSyntheticObject(data: Record<string, any>): any {
    const keys = Object.keys(data);

    // Check for array wrapper: {"__roml_items__": [...]}
    if (
      this.rootArrayWrapped &&
      keys.length === 1 &&
      keys[0] === SYNTHETIC_ITEMS_KEY &&
      Array.isArray(data[SYNTHETIC_ITEMS_KEY])
    ) {
      return data[SYNTHETIC_ITEMS_KEY];
    }

    // Check for primitive wrapper: {"__roml_value__": ...}
    if (
      this.rootPrimitiveWrapped &&
      keys.length === 1 &&
      keys[0] === SYNTHETIC_VALUE_KEY
    ) {
      return data[SYNTHETIC_VALUE_KEY];
    }

    // Regular object - return as-is
    return data;
  }

  private objectNodeToData(node: RomlObjectNode): Record<string, any> {
    const result: Record<string, any> = {};
    const seen = new Set<string>();
    const recordKey = (key: string, lineNumber: number) => {
      if (seen.has(key)) {
        this.errors.push(`Duplicate key "${key}" at line ${lineNumber + 1}`);
      } else {
        seen.add(key);
      }
    };

    // Use `Object.defineProperty` rather than `result[key] = value`
    // so user-supplied keys like `__proto__` become own properties
    // of `result` instead of triggering the inherited
    // prototype-setter (which would silently drop the assignment,
    // since `__proto__`'s setter rejects non-object values). Same
    // concern for `constructor` etc., but `__proto__` is the only
    // one that actively swallows the write. `Object.defineProperty`
    // bypasses the prototype chain entirely and creates a true
    // own property regardless of key name. (Fuzz-surfaced when the
    // #4 empty-array screen was dropped — input `{"":{"__proto__":
    // " "}}` was round-tripping as `{"":{}}`.)
    const setKey = (key: string, value: unknown) => {
      Object.defineProperty(result, key, {
        value,
        writable: true,
        enumerable: true,
        configurable: true,
      });
    };

    for (const prop of node.properties) {
      recordKey(prop.key, prop.lineNumber);
      setKey(prop.key, prop.value);
    }

    for (const child of node.children) {
      if (child.type === 'object') {
        recordKey(child.key!, child.lineNumber);
        setKey(child.key!, this.objectNodeToData(child));
      } else if (child.type === 'array') {
        recordKey(child.key, child.lineNumber);
        setKey(child.key, this.arrayNodeToData(child));
      }
    }

    return result;
  }

  private arrayNodeToData(node: RomlArrayNode): any[] {
    return node.items.map((item) => {
      if (item.type === 'object') {
        return this.objectNodeToData(item);
      } else if (item.type === 'array') {
        return this.arrayNodeToData(item);
      } else {
        return item.value;
      }
    });
  }

  private createMetadata(): RomlMetadata {
    return {
      checksum: 'simplified',
      size: this.tokens.length,
      created: new Date().toISOString().split('T')[0],
      source: 'json',
    };
  }

  private current(): RomlToken | undefined {
    return this.tokens[this.position];
  }

  private previous(): RomlToken | undefined {
    return this.tokens[this.position - 1];
  }

  private advance(): RomlToken | undefined {
    if (!this.isAtEnd()) this.position++;
    return this.previous();
  }

  private isAtEnd(): boolean {
    return this.position >= this.tokens.length || this.current()?.type === 'EOF';
  }

  private findTokenOfType(type: RomlToken['type']): RomlToken | undefined {
    return this.tokens.find((token) => token.type === type);
  }

  private extractArrayIndex(key: string): number {
    // Extract array index from keys like "[0]", "[1]", etc.
    const match = key.match(/\[(\d+)\]/);
    return match ? parseInt(match[1], 10) : 0;
  }

  private checkForMetaTag(): void {
    // Look for META tags in HEADER tokens or in the raw value of
    // tokens. A document can carry several META tags simultaneously
    // (e.g. a top-level array of primes carries both ROOT_ARRAY and
    // SIEVE_OF_ERATOSTHENES_INVOKED), so we don't break on the
    // first match — keep scanning to set every flag we see.
    for (const token of this.tokens) {
      const value = token.value;
      if (typeof value !== 'string') continue;
      if (value.includes(`~META~ ${MetaTags.SIEVE_OF_ERATOSTHENES_INVOKED}`)) {
        this.metaTagPresent = true;
      }
      if (value.includes(`~META~ ${MetaTags.ROOT_ARRAY}`)) {
        this.rootArrayWrapped = true;
      }
      if (value.includes(`~META~ ${MetaTags.ROOT_PRIMITIVE}`)) {
        this.rootPrimitiveWrapped = true;
      }
    }
  }

  private validatePrimeConsistency(): void {
    if (this.primesDetected && !this.metaTagPresent) {
      this.errors.push(
        `Document contains prime-prefixed keys but is missing the required ~META~ ${MetaTags.SIEVE_OF_ERATOSTHENES_INVOKED} tag. ` +
          'Add the META tag at the beginning of the document or remove prime prefixes (!).'
      );
    }

    if (this.metaTagPresent && !this.primesDetected) {
      this.errors.push(
        `Document declares ~META~ ${MetaTags.SIEVE_OF_ERATOSTHENES_INVOKED} but contains no prime-prefixed keys. ` +
          'Remove the META tag or add prime prefixes (!) to keys with prime number values.'
      );
    }
  }

  /**
   * Validate that the root-wrapper META tags are mutually exclusive.
   * A document may declare `ROOT_ARRAY` or `ROOT_PRIMITIVE`, not
   * both, since they describe contradictory wrap shapes.
   *
   * Shape-level validation (`ROOT_ARRAY` requires a single-key
   * `__roml_items__: [...]` payload, etc.) is intentionally not
   * performed here; if a hand-written document declares the META
   * but ships a different shape, `unwrapSyntheticObject` will
   * simply not unwrap, and the user gets back the literal payload
   * they wrote. That degrades silently to "regular object" rather
   * than throwing, which preserves the loose-parsing posture of the
   * format.
   */
  private validateRootMetaConsistency(): void {
    if (this.rootArrayWrapped && this.rootPrimitiveWrapped) {
      this.errors.push(
        `Document declares both ~META~ ${MetaTags.ROOT_ARRAY} and ~META~ ${MetaTags.ROOT_PRIMITIVE}; only one root-wrapper tag may appear.`
      );
    }
  }

  private isPrime(n: number): boolean {
    if (!Number.isInteger(n) || n <= 1) return false;
    if (n <= 3) return true;
    if (n % 2 === 0 || n % 3 === 0) return false;
    for (let i = 5; i * i <= n; i += 6) {
      if (n % i === 0 || n % (i + 2) === 0) return false;
    }
    return true;
  }
}
