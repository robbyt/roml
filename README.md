# ROML: Robert's Opaque Mangling Language

ROML is a deliberately obfuscated markup language that transforms readable JSON into syntactically complex but deterministic output. It uses several seemingly arbitrary syntax styles within a single document, selected through content-driven rules that prioritize inscrutability and complexity over clarity.

The resulting format is intentionally difficult to read and write, but the underlying transformations are completely deterministic and reversible.

## What is ROML?

Following the style of many other serialization or document formats, ROML is both an implementation and a specification. Since no formal specification was written before implementation, ROML is chaotic and incomplete. The format uses content-driven syntax selection to create obfuscated but deterministic output.

Each ROML document begins with the `~ROML~` header, followed by data encoded using many different syntax styles. Different delimiters are required based on key characteristics, such as hard-coded semantic categories, line position, and the presence of certain characters in keys or values.

ROML alternates behavior for even or odd lines in the document. Odd-numbered lines use one set of eight syntax styles, while even-numbered lines use a different set of eight styles. Boolean values are `<true>` on odd lines and vary by context on even lines.

ROML's syntax selection works deterministically based on key names, value types, line positions, semantic categorization, and nesting depth. Identical JSON input produces identical ROML output.

**No formal specification exists for ROML.** The lack of a complete specification is inspired by other serialization formats, the format is defined only through this implementation and the limited examples.

One of ROML's core principles is the deliberate absence of a formal specification!

For those needing detailed guidance on the format's encoding and decoding rules, see the [ROML Format Guide](./FORMAT.md). This guide provides a more comprehensive verbal description of the format's behavior. However, remember that the authoritative definition remains in this implementation itself, which may change over time. Semantic versioning may not be strictly followed, and the format may evolve unpredictably. Type-safety of ROML documents is not guaranteed, and the format may not be suitable for encoding complex data structures or large datasets.

## Features

- **Alternating line behavior**: Different syntax styles for odd vs even lines, creating visual rhythm
- **Content-driven syntax selection**: Sixteen syntax styles based on key characteristics and semantic categories
- **Deterministic obfuscation**: Same input always produces identical ROML output
- **Perfect round-trip conversion**: No data loss during JSON ↔ ROML transformations
- **Stateless operation**: No external dependencies or seed values required
- **Human-writable**: Complex but learnable rules for manual ROML creation
- **TypeScript implementation**: Type safety with const assertions and type guards

## Installation

```bash
npm install roml
```

## Usage

### CLI Usage

```bash
# Convert JSON to ROML
echo '{"name":"Robert","age":30}' | roml encode

# Convert ROML to JSON  
echo 'name="Robert"' | roml decode

# File conversion
cat data.json | roml encode > output.roml
cat input.roml | roml decode > output.json
```

### TypeScript API

```typescript
import { RomlFile } from 'roml';

// Convert JSON to ROML
const jsonData = { name: "Robert", age: 30, active: true };
const romlContent = RomlFile.jsonToRoml(jsonData);

// Convert ROML back to JSON
const parsedData = RomlFile.romlToJson(romlContent);

// File operations
const romlFile = RomlFile.fromJSON(jsonData);
romlFile.saveToFile('output.roml');

const loadedFile = RomlFile.fromFile('output.roml');
const roundTripResult = loadedFile.testRoundTrip();
```

## Syntax Examples

ROML uses different syntax styles based on content analysis and line position:

```roml
~ROML~
name="Robert"             // Counter: 1 (odd): Personal info uses quoted style
age:30                    // Counter: 2 (even): Numbers use colon style
active<true>              // Counter: 3 (odd): Booleans use bracket style
email~robert@example.com  // Counter: 4 (even): Vowel-starting keys use tilde style
//salary//50000           // Counter: 5 (odd): Financial info uses fake comment style
balance:1000              // Counter: 6 (even): Numbers use colon style
@created@2024-01-15@      // Counter: 7 (odd): Temporal info uses at-sandwich style
tags<user><admin>         // Counter: 8 (even): Arrays determined by hash
settings{                 // Counter: 9 (odd): Object opener
  theme=dark              // Counter: 10 (even): Nested content uses equals style
  notifications<true>     // Counter: 11 (odd): Nested booleans use bracket style
}                         // Counter: 12 (even): Object closer
```

### Alternating Line Behavior

ROML uses different syntax styles based on an internal counter (odd vs even), not the visible text line numbers:

**Odd Lines (1, 3, 5...):**
- `name="value"` - Quoted style for personal info
- `&key&value` - Ampersand style for technical/numeric data
- `key<value>` - Bracket style for booleans
- `//key//value` - Fake comment style for financial data
- `@key@value@` - At-sandwich style for temporal data

**Even Lines (2, 4, 6...):**
- `key=value` or `key=yes/no` - Equals style for general data and booleans
- `key:value` - Colon style for numeric data
- `key~value` - Tilde style for vowel-starting keys
- `key#value` - Hash style for long strings
- `key$value` - Dollar style for special values

The same JSON structure always produces identical ROML output. The alternating pattern creates visual rhythm while maintaining deterministic conversion.

### Array and Special Value Handling

**Array Representations:**
- **Primitive arrays**: Use pipe-delimited format (`||item1||item2||`) or bracket enclosures (`<item1><item2>`)
- **Object arrays**: Use numbered containers (`[0]{...}`, `[1]{...}`)
- **Object nesting**: Uses standard brace notation (`{...}`)

**Special Values:**
- **Null values**: `__NULL__`
- **Empty strings**: `__EMPTY__`
- **Whitespace**: Preserved exactly as-is

### Prime Number Handling

ROML includes automatic prime number detection that affects both syntax and metadata:

**Prime Detection Features:**
- **Automatic detection**: All numeric values are checked for primality using the Sieve of Eratosthenes
- **Prime prefixes**: Keys with prime values get a `!` prefix (e.g., `!score:7` instead of `score:7`)
- **META tag generation**: Documents containing primes automatically include `# ~META~ SIEVE_OF_ERATOSTHENES_INVOKED`
- **Cross-syntax support**: Prime prefixes work with all 16 syntax styles (odd/even line patterns)

**Prime Examples:**

```roml
~ROML~
# ~META~ SIEVE_OF_ERATOSTHENES_INVOKED
!score:7                  // Counter: 2 (even): Colon style with prime prefix
&!rating&13               // Counter: 3 (odd): Ampersand style with prime prefix
count:4                   // Counter: 4 (even): Colon style, no prefix
```

**Validation Rules:**
- Prime prefixes (`!`) are only valid when the value is actually prime
- Documents with prime prefixes must include the `# ~META~ SIEVE_OF_ERATOSTHENES_INVOKED` tag
- Documents with the META tag must contain actual prime-prefixed keys
- Invalid prime usage results in parsing errors with specific guidance
- The Sieve of Eratosthenes provides reliable prime detection up to 10,000

## Development

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Run tests
npm test

# Run demo
npm run demo
```

## License

Apache 2.0
