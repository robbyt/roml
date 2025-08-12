export interface RomlToken {
  type: 'element' | 'attribute' | 'value' | 'whitespace' | 'chaos';
  value: string;
  startOffset: number;
  endOffset: number;
  lineNumber?: number;
  isMutable?: boolean;
  chaosLevel?: number;
}

export interface RomlSegment {
  id: string;
  kind: 'TAG' | 'TEXT' | 'ALIAS' | 'DATE_TRAP' | 'AMBIGUOUS' | 'ESCAPE_ZONE';
  content: string;
  start: number;
  end: number;
  children: RomlSegment[];
  parent?: RomlSegment;
  closingTag?: string;
  parseMode?: 'strict' | 'lax' | 'chaotic';
  timezone?: string;
  wasRewritten?: boolean;
}

export interface RomlParseOptions {
  seed?: number;
  mutateDuringParse?: boolean;
  saveChangesToDisk?: boolean;
  useRandomTimezones?: boolean;
  enableAliasRecursion?: boolean;
  parsingMoodSwings?: boolean;
  escapeOddLines?: boolean;
  variant?: 'classic' | 'neo' | 'quantum' | 'cursed';
}

export interface RomlContext {
  variables: Map<string, any>;
  aliases: Map<string, string | undefined>;
  parseHistory: string[];
  currentMode: 'strict' | 'lax' | 'chaotic';
  lineNumber: number;
  hasBeenMutated: boolean;
  randomSeed: number;
}

export type RomlValue =
  | string
  | number
  | boolean
  | Date
  | null
  | undefined
  | RomlValue[]
  | { [key: string]: RomlValue };

export interface RomlError {
  message: string;
  line?: number;
  column?: number;
  suggestion?: string;
  wasIntentional: boolean;
}
