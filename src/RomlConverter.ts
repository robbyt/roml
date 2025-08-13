import {
  DocumentFeatures,
  LineFeatures,
  EMPTY_DOCUMENT_FEATURES,
  EMPTY_LINE_FEATURES,
} from './types.js';

const SYNTAX_STYLES = {
  QUOTED: (key: string, value: unknown, features: LineFeatures) => `${key}="${value}"`,
  AMPERSAND: (key: string, value: unknown, features: LineFeatures) => `&${key}&${value}`,
  BRACKETS: (key: string, value: unknown, features: LineFeatures) => `${key}<${value}>`,
  PIPES: (key: string, value: unknown, features: LineFeatures) => `||${key}||${value}||`,
  DOUBLE_COLON: (key: string, value: unknown, features: LineFeatures) => `::${key}::${value}::`,
  FAKE_COMMENT: (key: string, value: unknown, features: LineFeatures) => `//${key}//${value}`,
  AT_SANDWICH: (key: string, value: unknown, features: LineFeatures) => `@${key}@${value}@`,
  UNDERSCORE: (key: string, value: unknown, features: LineFeatures) => `_${key}_${value}_`,
} as const;

// Alternative syntax styles for even lines
const EVEN_LINE_STYLES = {
  EQUALS: (key: string, value: unknown, features: LineFeatures) => `${key}=${value}`,
  COLON: (key: string, value: unknown, features: LineFeatures) => `${key}:${value}`,
  TILDE: (key: string, value: unknown, features: LineFeatures) => `${key}~${value}`,
  HASH: (key: string, value: unknown, features: LineFeatures) => `${key}#${value}`,
  PERCENT: (key: string, value: unknown, features: LineFeatures) => `${key}%${value}`,
  DOLLAR: (key: string, value: unknown, features: LineFeatures) => `${key}$${value}`,
  CARET: (key: string, value: unknown, features: LineFeatures) => `${key}^${value}`,
  PLUS: (key: string, value: unknown, features: LineFeatures) => `${key}+${value}`,
} as const;

type SyntaxStyleName = keyof typeof SYNTAX_STYLES;
type EvenLineStyleName = keyof typeof EVEN_LINE_STYLES;
type SyntaxFunction =
  | (typeof SYNTAX_STYLES)[SyntaxStyleName]
  | (typeof EVEN_LINE_STYLES)[EvenLineStyleName];

interface ConversionContext {
  readonly depth: number;
  readonly parentKey?: string;
  readonly path: readonly string[];
  readonly lineNumber: number;
  readonly documentFeatures: DocumentFeatures;
}

const SEMANTIC_CATEGORIES = {
  PERSONAL: ['name', 'first_name', 'last_name', 'email', 'phone', 'address', 'username'] as const,
  STATUS: ['active', 'enabled', 'valid', 'working', 'online', 'disabled', 'inactive'] as const,
  COLLECTIONS: ['tags', 'items', 'list', 'array', 'elements', 'values', 'data'] as const,
  TECHNICAL: ['id', 'uuid', 'hash', 'checksum', 'token', 'key', 'secret'] as const,
  FINANCIAL: ['salary', 'price', 'cost', 'amount', 'total', 'balance', 'fee'] as const,
  TEMPORAL: ['date', 'time', 'created', 'updated', 'timestamp', 'expires'] as const,
} as const;

export class RomlConverter {
  public jsonToRoml(data: Record<string, unknown>): string {
    // Analyze document features (placeholder for Phase 1)
    const documentFeatures = this.analyzeDocumentFeatures(data);

    const context: ConversionContext = {
      depth: 0,
      path: [],
      lineNumber: 1,
      documentFeatures,
    };

    const converted = this.convertObject(data, context);
    return `~ROML~\n${converted.result}`;
  }

  private convertValue(
    key: string,
    value: any,
    context: ConversionContext
  ): { result: string; nextLineNumber: number } {
    const indent = '  '.repeat(context.depth);
    const lineFeatures = this.analyzeLineFeatures(key, value, context);

    if (value === null) {
      return {
        result: `${indent}${this.selectSyntax(key, '__NULL__', context, lineFeatures)(key, '__NULL__', lineFeatures)}`,
        nextLineNumber: context.lineNumber + 1,
      };
    }

    if (value === undefined) {
      return {
        result: `${indent}${this.selectSyntax(key, '__UNDEFINED__', context, lineFeatures)(key, '__UNDEFINED__', lineFeatures)}`,
        nextLineNumber: context.lineNumber + 1,
      };
    }

    if (typeof value === 'boolean') {
      return {
        result: `${indent}${this.selectSyntax(key, value, context, lineFeatures)(key, value, lineFeatures)}`,
        nextLineNumber: context.lineNumber + 1,
      };
    }

    if (typeof value === 'number') {
      return {
        result: `${indent}${this.selectSyntax(key, value, context, lineFeatures)(key, value, lineFeatures)}`,
        nextLineNumber: context.lineNumber + 1,
      };
    }

    if (typeof value === 'string') {
      if (value === '') {
        return {
          result: `${indent}${this.selectSyntax(key, '__EMPTY__', context, lineFeatures)(key, '__EMPTY__', lineFeatures)}`,
          nextLineNumber: context.lineNumber + 1,
        };
      }
      return {
        result: `${indent}${this.selectSyntax(key, value, context, lineFeatures)(key, value, lineFeatures)}`,
        nextLineNumber: context.lineNumber + 1,
      };
    }

    if (Array.isArray(value)) {
      return this.convertArray(key, value, context);
    }

    if (typeof value === 'object') {
      return this.convertObject(key, value, context);
    }

    return {
      result: `${indent}${key}=unknown`,
      nextLineNumber: context.lineNumber + 1,
    };
  }

  private convertArray(
    key: string,
    array: any[],
    context: ConversionContext
  ): { result: string; nextLineNumber: number } {
    const indent = '  '.repeat(context.depth);

    const hasObjects = array.some(
      (item) => typeof item === 'object' && item !== null && !Array.isArray(item)
    );

    if (hasObjects) {
      let currentLineNumber = context.lineNumber + 1;
      const newContext: ConversionContext = {
        ...context,
        depth: context.depth + 1,
        path: [...context.path, key],
      };

      const arrayItems: string[] = [];
      for (let index = 0; index < array.length; index++) {
        const item = array[index];
        const itemContext = { ...newContext, lineNumber: currentLineNumber };

        if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
          const converted = this.convertObject(`[${index}]`, item, itemContext);
          arrayItems.push(converted.result);
          currentLineNumber = converted.nextLineNumber;
        } else {
          const converted = this.convertValue(`[${index}]`, item, itemContext);
          arrayItems.push(converted.result);
          currentLineNumber = converted.nextLineNumber;
        }
      }

      return {
        result: `${indent}${key}[\n${arrayItems.join('\n')}\n${indent}]`,
        nextLineNumber: currentLineNumber + 1,
      };
    }

    // For primitive arrays, they take only one line
    const arrayStyle = this.selectArrayStyle(key, context);

    switch (arrayStyle) {
      case 'PIPES':
        const pipeItems = array
          .map((item) => {
            if (item === null) return '__NULL__';
            if (item === '') return '__EMPTY__';
            if (item === undefined) return '__UNDEFINED__';
            return String(item);
          })
          .join('||');
        return {
          result: `${indent}${key}||${pipeItems}||`,
          nextLineNumber: context.lineNumber + 1,
        };

      case 'BRACKETS':
        const bracketItems = array
          .map((item) => {
            if (item === null) return '<__NULL__>';
            if (item === '') return '<__EMPTY__>';
            if (item === undefined) return '<__UNDEFINED__>';
            return `<${item}>`;
          })
          .join('');
        return {
          result: `${indent}${key}${bracketItems}`,
          nextLineNumber: context.lineNumber + 1,
        };

      case 'JSON_STYLE':
        return {
          result: `${indent}${key}[${array.map((item) => `"${item}"`).join(',')}]`,
          nextLineNumber: context.lineNumber + 1,
        };

      case 'COLON_DELIM':
        const colonItems = array.map((item) => {
          if (item === null) return '__NULL__';
          if (item === '') return '__EMPTY__';
          if (item === undefined) return '__UNDEFINED__';
          return String(item);
        });
        return {
          result: `${indent}${key}:${colonItems.join(':')}`,
          nextLineNumber: context.lineNumber + 1,
        };

      default:
        return {
          result: `${indent}${key}||${array.join('||')}||`,
          nextLineNumber: context.lineNumber + 1,
        };
    }
  }

  private convertObject(
    keyOrObj: string | any,
    objOrContext?: any,
    context?: ConversionContext
  ): { result: string; nextLineNumber: number } {
    if (typeof keyOrObj === 'string' && objOrContext && context) {
      const key = keyOrObj;
      const obj = objOrContext;
      const indent = '  '.repeat(context.depth);
      let currentLineNumber = context.lineNumber + 1;

      const newContext: ConversionContext = {
        ...context,
        depth: context.depth + 1,
        parentKey: key,
        path: [...context.path, key],
      };

      const entries: string[] = [];
      for (const [k, v] of Object.entries(obj)) {
        const entryContext = { ...newContext, lineNumber: currentLineNumber };
        const converted = this.convertValue(k, v, entryContext);
        entries.push(converted.result);
        currentLineNumber = converted.nextLineNumber;
      }

      return {
        result: `${indent}${key}{\n${entries.join('\n')}\n${indent}}`,
        nextLineNumber: currentLineNumber + 1,
      };
    } else {
      const obj = keyOrObj;
      const ctx = objOrContext;
      let currentLineNumber = ctx.lineNumber;

      const entries: string[] = [];
      for (const [k, v] of Object.entries(obj)) {
        const entryContext = { ...ctx, lineNumber: currentLineNumber };
        const converted = this.convertValue(k, v, entryContext);
        entries.push(converted.result);
        currentLineNumber = converted.nextLineNumber;
      }

      return {
        result: entries.join('\n'),
        nextLineNumber: currentLineNumber,
      };
    }
  }

  private selectSyntax(
    key: string,
    value: unknown,
    context: ConversionContext,
    lineFeatures: LineFeatures
  ): (key: string, value: unknown, features: LineFeatures) => string {
    const isEvenLine = context.lineNumber % 2 === 0;
    const keyHash = this.simpleHash(key);
    const valueType = typeof value;
    const valueLength = String(value).length;

    // Check semantic categories first (apply to both odd and even lines)
    const semanticStyle = this.getSemanticStyle(key);
    if (semanticStyle && !isEvenLine) {
      return SYNTAX_STYLES[semanticStyle];
    }

    // Alternating line behavior for different value types
    if (valueType === 'boolean') {
      if (isEvenLine) {
        // Even lines: use equals notation with yes/no
        return (key: string, value: unknown, features: LineFeatures) =>
          `${key}=${value === true ? 'yes' : 'no'}`;
      } else {
        // Odd lines: use bracket notation
        return SYNTAX_STYLES.BRACKETS;
      }
    }

    if (valueType === 'number') {
      if (isEvenLine) {
        // Even lines: use colon notation
        return EVEN_LINE_STYLES.COLON;
      } else {
        // Odd lines: use ampersand notation
        return SYNTAX_STYLES.AMPERSAND;
      }
    }

    if (valueType === 'string') {
      if (isEvenLine) {
        if (lineFeatures.keyStartsWithVowel) {
          return EVEN_LINE_STYLES.TILDE;
        } else if (lineFeatures.hasLongString) {
          return EVEN_LINE_STYLES.HASH;
        } else {
          return EVEN_LINE_STYLES.EQUALS;
        }
      } else {
        if (lineFeatures.keyStartsWithVowel) {
          return SYNTAX_STYLES.QUOTED;
        } else if (lineFeatures.hasLongString) {
          return SYNTAX_STYLES.DOUBLE_COLON;
        } else {
          return SYNTAX_STYLES.FAKE_COMMENT;
        }
      }
    }

    // Handle special values (null, undefined, empty)
    if (lineFeatures.isSpecialValue) {
      if (isEvenLine) {
        return EVEN_LINE_STYLES.DOLLAR;
      } else {
        return SYNTAX_STYLES.FAKE_COMMENT;
      }
    }

    // Fallback selection based on line parity
    if (isEvenLine) {
      const evenStyleNames = Object.keys(EVEN_LINE_STYLES) as EvenLineStyleName[];
      const selector = (keyHash + lineFeatures.nestingDepth + valueLength) % evenStyleNames.length;
      const styleName = evenStyleNames[selector];
      return EVEN_LINE_STYLES[styleName];
    } else {
      const styleNames = Object.keys(SYNTAX_STYLES) as SyntaxStyleName[];
      const selector = (keyHash + lineFeatures.nestingDepth + valueLength) % styleNames.length;
      const styleName = styleNames[selector];
      return SYNTAX_STYLES[styleName];
    }
  }

  private getSemanticStyle(key: string): SyntaxStyleName | null {
    const lowerKey = key.toLowerCase();

    if ((SEMANTIC_CATEGORIES.PERSONAL as readonly string[]).includes(lowerKey)) {
      return 'QUOTED';
    }
    if ((SEMANTIC_CATEGORIES.STATUS as readonly string[]).includes(lowerKey)) {
      return 'BRACKETS';
    }
    if ((SEMANTIC_CATEGORIES.COLLECTIONS as readonly string[]).includes(lowerKey)) {
      return 'PIPES';
    }
    if ((SEMANTIC_CATEGORIES.TECHNICAL as readonly string[]).includes(lowerKey)) {
      return 'AMPERSAND';
    }
    if ((SEMANTIC_CATEGORIES.FINANCIAL as readonly string[]).includes(lowerKey)) {
      return 'FAKE_COMMENT';
    }
    if ((SEMANTIC_CATEGORIES.TEMPORAL as readonly string[]).includes(lowerKey)) {
      return 'AT_SANDWICH';
    }

    return null;
  }

  private selectArrayStyle(
    key: string,
    context: ConversionContext
  ): 'PIPES' | 'BRACKETS' | 'JSON_STYLE' | 'COLON_DELIM' {
    const keyHash = this.simpleHash(key);
    const styles = ['PIPES', 'BRACKETS', 'JSON_STYLE', 'COLON_DELIM'] as const;
    return styles[keyHash % styles.length];
  }

  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  /**
   * Analyze document-level features (Phase 1: placeholder implementation)
   */
  private analyzeDocumentFeatures(data: Record<string, unknown>): DocumentFeatures {
    // Phase 1: Return empty features, actual detection logic will be added in Phase 2
    return EMPTY_DOCUMENT_FEATURES;
  }

  /**
   * Analyze line-level features for a key-value pair
   */
  private analyzeLineFeatures(
    key: string,
    value: unknown,
    context?: ConversionContext
  ): LineFeatures {
    const keyStartsWithVowel = /^[aeiouAEIOU]/.test(key);
    const hasLongString = typeof value === 'string' && value.length > 10;
    const isSpecialValue =
      value === '__NULL__' ||
      value === '__UNDEFINED__' ||
      value === '__EMPTY__' ||
      value === null ||
      value === undefined ||
      value === '';
    const isNestedObject = typeof value === 'object' && value !== null && !Array.isArray(value);
    const hasLargeArray = Array.isArray(value) && value.length > 5;
    const nestingDepth = context?.depth || 0;

    return {
      containsPrime: false, // Will be implemented in Phase 2
      hasLargeArray,
      isNestedObject,
      keyStartsWithVowel,
      hasLongString,
      isSpecialValue,
      nestingDepth,
    };
  }
}
