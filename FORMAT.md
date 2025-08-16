# ROML Format Guide

This document describes ROML (Robert's Opaque Mangling Language) encoding and decoding rules. ROML lacks a formal specification by design. This guide documents the rules for translation between ROML and JSON formats.

## Document Structure

ROML documents begin with `~ROML~` on line 1. Subsequent content follows alternating line behavior rules.

## Line Counting Rules

ROML uses an internal line counter for determining syntax styles, not visible text line numbers.

The counter starts after all header lines are processed. Its initial value equals the number of header lines:
- With just `~ROML~`: counter starts at 1 (odd)
- With `~ROML~` and a META tag: counter starts at 2 (even)

The counter increments for each data element:
- Key-value pairs
- Object markers (`key{` and `}`)
- Array markers (`key[` and `]`)
- Array item markers (`[0]{`, `[1]{`, etc.)

The counter does not increment for:
- Header lines (`~ROML~`, META tags)
- Indentation
- Comments

## Alternating Line Behavior

ROML alternates between two sets of syntax styles based on whether the internal counter is odd or even.

### Odd-Line Syntax Styles (Internal counter: 1, 3, 5, ...)

1. **QUOTED**: `key="value"` - Double quotes around the value
2. **AMPERSAND**: `&key&value` - Ampersands surround both key and value
3. **BRACKETS**: `key<value>` - Angle brackets around the value
4. **PIPES**: `||key||value||` - Double pipes surround and separate key and value
5. **DOUBLE_COLON**: `::key::value::` - Double colons surround and separate key and value
6. **FAKE_COMMENT**: `//key//value` - Double slashes
7. **AT_SANDWICH**: `@key@value@` - At signs surround and separate key and value
8. **UNDERSCORE**: `_key_value_` - Underscores surround and separate key and value

### Even-Line Syntax Styles (Internal counter: 2, 4, 6, ...)

1. **EQUALS**: `key=value` - Equals sign separator
2. **COLON**: `key:value` - Colon separator
3. **TILDE**: `key~value` - Tilde separator
4. **HASH**: `key#value` - Hash/pound sign separator
5. **PERCENT**: `key%value` - Percent sign separator
6. **DOLLAR**: `key$value` - Dollar sign separator
7. **CARET**: `key^value` - Caret separator
8. **PLUS**: `key+value` - Plus sign separator

## Syntax Selection Rules

The syntax style for each line is determined by the following priority order:

### Priority 1: Semantic Categories (Odd Lines Only)

On odd-numbered lines, if the key (case-insensitive) exactly matches one of these keywords, use the specified style:

**PERSONAL** → QUOTED style (`key="value"`)
- Keywords: `name`, `first_name`, `last_name`, `email`, `phone`, `address`, `username`

**STATUS** → BRACKETS style (`key<value>`)
- Keywords: `active`, `enabled`, `valid`, `working`, `online`, `disabled`, `inactive`

**COLLECTIONS** → PIPES style (`||key||value||`)
- Keywords: `tags`, `items`, `list`, `array`, `elements`, `values`, `data`

**TECHNICAL** → AMPERSAND style (`&key&value`)
- Keywords: `id`, `uuid`, `hash`, `checksum`, `token`, `key`, `secret`

**FINANCIAL** → FAKE_COMMENT style (`//key//value`)
- Keywords: `salary`, `price`, `cost`, `amount`, `total`, `balance`, `fee`

**TEMPORAL** → AT_SANDWICH style (`@key@value@`)
- Keywords: `date`, `time`, `created`, `updated`, `timestamp`, `expires`

### Priority 2: Value Type Rules

If no semantic category matches, apply these rules based on value type:

**Boolean Values:**
- Odd lines: Use BRACKETS style with `<true>` or `<false>`
- Even lines: Use EQUALS style with `=yes` (for true) or `=no` (for false)

**Number Values:**
- Odd lines: Use AMPERSAND style (`&key&123`)
- Even lines: Use COLON style (`key:123`)

**String Values:**
- Check if key starts with a vowel (a, e, i, o, u, case-insensitive)
- Check if value length > 10 characters

For odd lines:
- Vowel-starting key: QUOTED style (`key="value"`)
- Value length > 10: DOUBLE_COLON style (`::key::value::`)
- Otherwise: FAKE_COMMENT style (`//key//value`)

For even lines:
- Vowel-starting key: TILDE style (`key~value`)
- Value length > 10: HASH style (`key#value`)
- Otherwise: EQUALS style (`key=value`)

### Priority 3: Special Values

For null, undefined, or empty values:
- Odd lines: FAKE_COMMENT style (`//key//special`)
- Even lines: DOLLAR style (`key$special`)

### Priority 4: Fallback Algorithm

If no other rules apply, use a deterministic hash-based selection:
1. Calculate hash of the key
2. Add nesting depth and value length
3. Use modulo to select from available styles for that line type

## Special Value Encoding

- **null**: Encoded as `__NULL__`
- **empty string**: Encoded as `__EMPTY__`
- **undefined**: Encoded as `__UNDEFINED__`
- **whitespace**: Preserved exactly as-is
- **booleans on odd lines**: `<true>` or `<false>`
- **booleans on even lines**: `yes` or `no`

## Array Encoding Rules

### Primitive Arrays (strings, numbers, booleans, nulls)

Primitive arrays are encoded on a single line using one of four styles, selected via hash of the key:

1. **PIPES**: `key||item1||item2||item3||`
2. **BRACKETS**: `key<item1><item2><item3>`
3. **JSON_STYLE**: `key["item1","item2","item3"]`
4. **COLON_DELIM**: `key:item1:item2:item3`

Special values in primitive arrays:
- null → `__NULL__`
- empty string → `__EMPTY__`
- undefined → `__UNDEFINED__`

### Object Arrays

Arrays containing objects use this format:
```roml
key[
  [0]{
    field1="value1"
    field2:123
  }
  [1]{
    field1="value2"
    field2:456
  }
]
```

Each array item:
- Starts with `[index]{` on its own line
- Contains the object's key-value pairs (following alternating line rules)
- Ends with `}` on its own line

## Object Encoding Rules

Objects are encoded with:
- Opening: `key{` on its own line
- Contents: Indented by 2 spaces, following alternating line rules
- Closing: `}` on its own line at the same indentation as opening

Nested objects follow the same rules, with additional indentation.

## Decoding Rules

To decode ROML back to JSON:

1. **Identify syntax style** by pattern matching:
   - Look for delimiters and separators
   - Extract key and value based on identified pattern

2. **Decode special values**:
   - `__NULL__` → null
   - `__EMPTY__` → ""
   - `__UNDEFINED__` → undefined (or omit)
   - `yes` → true (even lines)
   - `no` → false (even lines)
   - `<true>` → true (odd lines)
   - `<false>` → false (odd lines)

3. **Parse arrays**:
   - Primitive arrays: Split by delimiter, decode special values
   - Object arrays: Parse each `[index]{...}` block recursively

4. **Parse objects**:
   - Identify `key{` opening and `}` closing
   - Recursively parse contents

5. **Handle data types**:
   - Numbers: Parse numeric strings
   - Strings: Preserve as-is (after removing style-specific delimiters)
   - Booleans: Convert from yes/no or <true>/<false>

## Complete Example

Input JSON:
```json
{
  "name": "Robert",
  "age": 30,
  "active": true,
  "email": "robert@example.com",
  "salary": 75000,
  "created": "2024-01-01",
  "tags": ["dev", "admin"],
  "settings": {
    "theme": "dark",
    "notifications": true
  }
}
```

Output ROML:
```roml
~ROML~                     // Header (not counted)
name="Robert"              // Counter: 1 (odd) - semantic PERSONAL → quoted style
age:30                     // Counter: 2 (even) - number → colon style
active<true>               // Counter: 3 (odd) - boolean → brackets style
email~robert@example.com   // Counter: 4 (even) - vowel-starting key → tilde style
//salary//75000            // Counter: 5 (odd) - semantic FINANCIAL → fake comment style
created=2024-01-01         // Counter: 6 (even) - string → equals style (no semantic on even)
tags<dev><admin>           // Counter: 7 (odd) - array uses BRACKETS style (hash-selected)
settings{                  // Counter: 8 (even) - object opener
  //theme//dark            // Counter: 9 (odd) - string → fake comment style
  notifications=yes        // Counter: 10 (even) - boolean → equals with yes
}                          // Counter: 11 (odd) - object closer
```

## Counter Examples

### Without META Tag
```json
{"a": true, "b": 42}
```
Becomes:
```roml
~ROML~          // Header (counter not started)
a<true>         // Counter: 1 (odd) → brackets for boolean
b:42            // Counter: 2 (even) → colon for number
```

### With META Tag
```json
{"a": 1, "b": 2, "c": 3}
```
Becomes:
```roml
~ROML~                                  // Header (counter not started)
# ~META~ SIEVE_OF_ERATOSTHENES_INVOKED // META tag (counter not started)
a:1                                     // Counter: 2 (even) → colon for number (no prefix, 1 isn't prime)
&!b&2                                   // Counter: 3 (odd) → ampersand for number with prime prefix
!c:3                                    // Counter: 4 (even) → colon for number with prime prefix
```

The META tag shifts the alternating pattern by changing the counter's starting value from odd to even.

### Nested Objects
```roml
~ROML~
data{           // Counter: 1 (odd)
  x=10          // Counter: 2 (even)
  y<true>       // Counter: 3 (odd)
}               // Counter: 4 (even)
next=value      // Counter: 5 (odd)
```

Nesting depth does not affect counter progression.

## Design Principles

1. **No formal specification exists** - This is intentional. ROML is defined by its implementation, not by a specification.

2. **Deterministic** - The same input always produces the same output.

3. **Case-insensitive keyword matching** - Semantic categories match keywords regardless of case.

4. **Exact keyword matching only** - "firstName" won't match the "name" keyword; only exact matches work.

5. **Line position matters** - The same key-value pair will use different syntax depending on which line it appears on.

6. **Indentation is visual only** - Indentation doesn't affect parsing or line counting.

## Prime Number Detection and Prefixes

ROML includes prime number detection that adds metadata and special prefixes when prime values are present.

### Prime Detection Rules

Detection criteria:
- Only **numeric values** (JavaScript `number` type) are checked for primality
- String values like `"7"` or `"prime"` are **NOT** considered prime numbers
- Negative numbers, zero, and one are **NOT** considered prime
- Both integer and floating-point numbers are checked (though only integers can be prime)

Prefix system:
- Keys whose **values** are prime numbers get a `!` prefix
- Example: `{"count": 7}` becomes `!count:7` in ROML
- The prefix appears on the **key**, not the value
- Arrays containing prime numbers get the prefix on the array key: `!primes||2||3||5||`

### META Tag Requirement

When any prime numbers are detected in the data:

1. **META tag is mandatory**: `# ~META~ SIEVE_OF_ERATOSTHENES_INVOKED`
2. **Tag placement**: Must appear after the `~ROML~` header, typically on line 2
3. **Comment syntax**: Uses `#` to avoid namespace conflicts with data keys named "~META~"

### Validation Rules

- Documents with prime numbers must include the META tag
- Documents with the META tag must contain prime numbers
- Violations result in parse errors

Error examples:
```roml
# ERROR: Prime numbers without META tag
!count:7
value:13
```

```roml 
# ERROR: META tag without prime numbers
~ROML~
# ~META~ SIEVE_OF_ERATOSTHENES_INVOKED
count:4
value:6
```

Parser error messages:
- Missing META: "Document contains prime-prefixed keys but is missing the required ~META~ SIEVE_OF_ERATOSTHENES_INVOKED tag"
- Unused META: "Document declares ~META~ SIEVE_OF_ERATOSTHENES_INVOKED but contains no prime-prefixed keys"
- Invalid prefix: "Invalid prime prefix at line X: Key '!name' is marked as prime but value 8 is not a prime number"

### Prime Detection Examples
```roml
~ROML~
# ~META~ SIEVE_OF_ERATOSTHENES_INVOKED
!count:7          # 7 is prime
!value:13         # 13 is prime  
composite:4       # 4 is not prime
message="seven"   # Non-numeric string (preserved as string)
```

String vs number distinction:
```json
{
  "primeNumber": 7,     // Gets ! prefix (numeric 7 is prime)
  "sevenText": "seven", // No prefix (non-numeric string)
  "notPrime": 8         // No prefix (8 is not prime)
}
```


Array handling:
```roml
~ROML~
# ~META~ SIEVE_OF_ERATOSTHENES_INVOKED
!primes||2||3||5||7||    # Array key gets prefix (contains primes)
mixed:2:4:7:9           # Mixed array (contains some primes)
strings["2","3","5"]    # String array (no numeric primes)
```

Nested objects:
```roml
~ROML~
# ~META~ SIEVE_OF_ERATOSTHENES_INVOKED
data{
  !prime:17       # Prime in nested object
  composite:15    # Not prime
  nested{
    !anotherPrime:23  # Deeply nested prime
  }
}
```

### Round-Trip Conversion
- Prime prefixes are stripped during parsing: `!count:7` → `{"count": 7}`
- Original data is perfectly preserved through JSON→ROML→JSON conversion
- META tag is automatically generated when converting from JSON containing primes
- Parser validates prefix correctness and META tag consistency

Implementation details:
- Prime detection uses Sieve of Eratosthenes for numbers ≤ 10,000
- Larger numbers use trial division for efficiency
- Prime detection occurs during JSON→ROML conversion
- Validation occurs during ROML→JSON parsing

See `examples/primes.roml` for a comprehensive example showing all prime number handling scenarios.

## Type Preservation: The Double Quote Rule

ROML uses a simple and elegant rule to preserve type information during round-trip conversion:

Quoted values are always preserved as strings. When a value is enclosed in double quotes, it will always be parsed as a string, never converted to another type.

### Type Examples

String vs Number:
```roml
count="7"      # String "7" (quotes preserve string type)
count=7        # Number 7 (no quotes, parsed as number)
price="19.99"  # String "19.99"
price=19.99    # Number 19.99
```

String vs Boolean:
```roml
active="true"  # String "true" (quotes preserve string type)
active=true    # Boolean true (no quotes, parsed as boolean)
active=yes     # Boolean true (even-line syntax)
active="yes"   # String "yes" (quotes preserve string)
```

String vs Null:
```roml
value="null"   # String "null" (quotes preserve string type)
value=__NULL__ # Actual null value
```

During encoding (JSON→ROML):
- Strings that look like numbers, booleans, or null are automatically quoted
- Example: `{"count": "7"}` → `count="7"`
- Regular strings may or may not be quoted depending on syntax style

During parsing (ROML→JSON):
- Values with quotes are preserved as strings
- Values without quotes undergo type inference

Arrays follow the same rules:
- `items||"7"||7||` → `["7", 7]` (string "7" and number 7)
- `values<"true"><false>` → `["true", false]` (string and boolean)

This ensures perfect round-trip conversion:
```json
// Original JSON
{
  "stringId": "123",
  "numberId": 123,
  "isActive": "false",
  "isEnabled": false
}

// Converts to ROML and back to identical JSON
{
  "stringId": "123",    // Preserved as string
  "numberId": 123,      // Preserved as number
  "isActive": "false",  // Preserved as string
  "isEnabled": false    // Preserved as boolean
}
```

ROML automatically detects ambiguous strings (strings that look like other types) and adds quotes during encoding to ensure they remain strings after parsing.

The authoritative definition of ROML is its implementation, not this documentation.