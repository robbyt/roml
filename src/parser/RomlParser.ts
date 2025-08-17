import { RomlToken } from '../lexer/RomlLexer.js';
import { MetaTags } from '../types.js';

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

  public parse(tokens: RomlToken[]): RomlParseResult {
    this.tokens = tokens;
    this.position = 0;
    this.errors = [];
    this.metaTagPresent = false;
    this.primesDetected = false;
    this.invalidPrimeKeys = [];

    // Check for META tag
    this.checkForMetaTag();

    const ast = this.buildAST();

    // Validate prime consistency
    this.validatePrimeConsistency();

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

    // Strip prime prefix from object key
    let cleanKey = token.key;
    if (token.key.startsWith('!')) {
      this.primesDetected = true;
      cleanKey = token.key.substring(1);
    }

    this.advance();
    const childObject = this.parseObject(cleanKey, (token.depth || 0) + 1);
    return childObject;
  }

  private parseChildArray(token: RomlToken): RomlArrayNode | null {
    if (token.key === undefined) return null;

    // Strip prime prefix from array key
    let cleanKey = token.key;
    if (token.key.startsWith('!')) {
      this.primesDetected = true;
      cleanKey = token.key.substring(1);
    }

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

    // Check for prime prefixes and validate
    let cleanKey = token.key;
    if (token.key.startsWith('!')) {
      this.primesDetected = true;
      cleanKey = token.key.substring(1);

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
        this.invalidPrimeKeys.push(
          `Line ${token.lineNumber + 1}: Key "${token.key}" has prime prefix but value ${numericValue} is not prime`
        );
        this.errors.push(
          `Invalid prime prefix at line ${token.lineNumber + 1}: Key "${token.key}" is marked as prime but value ${numericValue} is not a prime number`
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
   * Unwrap synthetic objects back to their original types
   */
  private unwrapSyntheticObject(data: Record<string, any>): any {
    const keys = Object.keys(data);

    // Check for array wrapper: {"_items": [...]}
    if (keys.length === 1 && keys[0] === '_items' && Array.isArray(data._items)) {
      return data._items;
    }

    // Check for primitive wrapper: {"_value": ...}
    if (keys.length === 1 && keys[0] === '_value') {
      return data._value;
    }

    // Regular object - return as-is
    return data;
  }

  private objectNodeToData(node: RomlObjectNode): Record<string, any> {
    const result: Record<string, any> = {};

    for (const prop of node.properties) {
      result[prop.key] = prop.value;
    }

    for (const child of node.children) {
      if (child.type === 'object') {
        result[child.key!] = this.objectNodeToData(child);
      } else if (child.type === 'array') {
        result[child.key] = this.arrayNodeToData(child);
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
    // Look for META tag in HEADER token or in the raw value of tokens
    for (const token of this.tokens) {
      if (token.type === 'HEADER' && token.value) {
        if (token.value.includes(`~META~ ${MetaTags.SIEVE_OF_ERATOSTHENES_INVOKED}`)) {
          this.metaTagPresent = true;
          break;
        }
      }
      // Also check in the raw token value in case it's in a comment-style line
      if (
        token.value &&
        typeof token.value === 'string' &&
        token.value.includes(`~META~ ${MetaTags.SIEVE_OF_ERATOSTHENES_INVOKED}`)
      ) {
        this.metaTagPresent = true;
        break;
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
