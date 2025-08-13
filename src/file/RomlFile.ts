import { RomlLexer } from '../lexer/RomlLexer.js';
import { RomlParser, RomlMetadata, RomlParseResult } from '../parser/RomlParser.js';
import { RomlConverter } from '../RomlConverter.js';
import * as crypto from 'crypto';
import * as fs from 'fs';

export interface RomlOptions {
  seed?: number;
  preserveFormatting?: boolean;
}

export class RomlFile {
  private content: string;
  private originalData?: any;
  private metadata?: RomlMetadata;
  private lexer: RomlLexer;
  private parser: RomlParser;
  private converter: RomlConverter;
  private options: RomlOptions;

  constructor(content: string, options: RomlOptions = {}) {
    this.content = content;
    this.options = options;
    this.lexer = new RomlLexer(content);
    this.parser = new RomlParser();
    this.converter = new RomlConverter();
  }

  public static fromJSON(jsonData: any, options: RomlOptions = {}): RomlFile {
    const converter = new RomlConverter();
    const romlContent = converter.jsonToRoml(jsonData);
    const file = new RomlFile(romlContent, options);
    file.originalData = jsonData;
    return file;
  }

  public static fromFile(filePath: string, options: RomlOptions = {}): RomlFile {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    return new RomlFile(content, options);
  }

  public parse(): RomlParseResult {
    try {
      // Use lexer → parser → AST pipeline
      const tokens = this.lexer.tokenize();
      const parseResult = this.parser.parse(tokens);
      return parseResult;
    } catch (error) {
      // Create minimal AST for error case
      const errorAST = {
        type: 'document' as const,
        startOffset: 0,
        endOffset: 0,
        lineNumber: 0,
        depth: 0,
        body: {
          type: 'object' as const,
          startOffset: 0,
          endOffset: 0,
          lineNumber: 0,
          depth: 0,
          properties: [],
          children: [],
        },
      };

      return {
        data: {},
        metadata: {
          checksum: 'error',
          size: 0,
          created: new Date().toISOString().split('T')[0],
          source: 'json',
        },
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        ast: errorAST,
      };
    }
  }

  public toJSON(): any {
    const parseResult = this.parse();
    return parseResult.data;
  }

  public toRoml(): string {
    return this.content;
  }

  public toString(): string {
    return this.content;
  }

  // Round-trip testing methods
  public testRoundTrip(): { success: boolean; errors: string[] } {
    const errors: string[] = [];

    try {
      // Parse ROML to JSON
      const jsonData = this.toJSON();

      const newRomlFile = RomlFile.fromJSON(jsonData);

      // Compare the data structures
      const originalData = jsonData;
      const roundTripData = newRomlFile.toJSON();

      const dataMatches = this.deepEqual(originalData, roundTripData);

      if (!dataMatches) {
        errors.push('Round-trip data mismatch');
      }

      return {
        success: errors.length === 0,
        errors,
      };
    } catch (error) {
      errors.push(`Round-trip error: ${error}`);
      return {
        success: false,
        errors,
      };
    }
  }

  // Conversion methods for different formats
  public static jsonToRoml(jsonData: any): string {
    const converter = new RomlConverter();
    return converter.jsonToRoml(jsonData);
  }

  public static romlToJson(romlContent: string): any {
    const file = new RomlFile(romlContent);
    return file.toJSON();
  }

  // Utility methods
  public getMetadata(): RomlMetadata | undefined {
    if (!this.metadata) {
      const parseResult = this.parse();
      this.metadata = parseResult.metadata;
    }
    return this.metadata;
  }

  public getChecksum(): string {
    return crypto.createHash('md5').update(this.content).digest('hex').substring(0, 8);
  }

  public validate(): { valid: boolean; errors: string[] } {
    try {
      const parseResult = this.parse();
      return {
        valid: parseResult.errors.length === 0,
        errors: parseResult.errors,
      };
    } catch (error) {
      return {
        valid: false,
        errors: [`Validation error: ${error}`],
      };
    }
  }

  // Helper method for deep equality comparison
  private deepEqual(obj1: any, obj2: any): boolean {
    if (obj1 === obj2) return true;

    if (obj1 == null || obj2 == null) return obj1 === obj2;

    if (typeof obj1 !== typeof obj2) return false;

    if (typeof obj1 !== 'object') return obj1 === obj2;

    if (Array.isArray(obj1) !== Array.isArray(obj2)) return false;

    if (Array.isArray(obj1)) {
      if (obj1.length !== obj2.length) return false;
      for (let i = 0; i < obj1.length; i++) {
        if (!this.deepEqual(obj1[i], obj2[i])) return false;
      }
      return true;
    }

    const keys1 = Object.keys(obj1);
    const keys2 = Object.keys(obj2);

    if (keys1.length !== keys2.length) return false;

    for (const key of keys1) {
      if (!keys2.includes(key)) return false;
      if (!this.deepEqual(obj1[key], obj2[key])) return false;
    }

    return true;
  }

  // Save methods
  public saveToFile(filePath: string): void {
    fs.writeFileSync(filePath, this.content, 'utf-8');
  }

  public saveJSONToFile(filePath: string): void {
    const jsonData = this.toJSON();
    fs.writeFileSync(filePath, JSON.stringify(jsonData, null, 2), 'utf-8');
  }
}
