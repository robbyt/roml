import { RomlToken } from '../lexer/RomlLexer';

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
  items: (RomlValueNode | RomlObjectNode)[];
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

  public parse(tokens: RomlToken[]): RomlParseResult {
    this.tokens = tokens;
    this.position = 0;
    this.errors = [];

    const ast = this.buildAST();

    const data = this.astToData(ast);

    const metadata = this.createMetadata();

    return {
      data,
      metadata,
      errors: this.errors,
      ast,
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
    if (!token.key) return null;

    this.advance();
    const childObject = this.parseObject(token.key, (token.depth || 0) + 1);
    return childObject;
  }

  private parseChildArray(token: RomlToken): RomlArrayNode | null {
    if (!token.key) return null;

    this.advance();
    const items: (RomlValueNode | RomlObjectNode)[] = [];

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
      } else if (current.type === 'KEY_VALUE') {
        this.advance();
      } else {
        this.advance();
      }
    }

    return {
      type: 'array',
      key: token.key,
      startOffset: token.startOffset,
      endOffset: this.previous()?.endOffset || token.endOffset,
      lineNumber: token.lineNumber,
      depth: token.depth || 0,
      items,
      arrayStyle: 'structured',
    };
  }

  private parseKeyValue(token: RomlToken): RomlKeyValueNode | null {
    if (!token.key || token.parsedValue === undefined) return null;

    return {
      type: 'keyvalue',
      key: token.key,
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
    return this.objectNodeToData(ast.body);
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
}
