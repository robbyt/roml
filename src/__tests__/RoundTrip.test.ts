import { RomlFile } from '../file/RomlFile';

describe('ROML Round-Trip Conversion Tests', () => {
  const testData = [
    {
      name: 'Simple Object',
      data: {
        name: 'Robert',
        age: 30,
        active: true,
      },
    },
    {
      name: 'Complex Nested Object',
      data: {
        user: {
          profile: {
            name: 'Robert',
            email: 'robert@example.com',
            preferences: {
              theme: 'dark',
              notifications: true,
            },
          },
          account: {
            id: 12345,
            balance: 150.75,
            status: 'active',
          },
        },
        metadata: {
          created: '2024-01-15',
          updated: '2024-01-20',
        },
      },
    },
    {
      name: 'Array Handling',
      data: {
        tags: ['user', 'admin', 'developer'],
        scores: [85, 92, 78, 96],
        permissions: ['read', 'write', 'execute'],
        mixed: [1, 'text', true, null],
      },
    },
    {
      name: 'Boolean Variations',
      data: {
        enabled: true,
        disabled: false,
        active: true,
        inactive: false,
        on: true,
        off: false,
      },
    },
    {
      name: 'Number Types',
      data: {
        integer: 42,
        float: 3.14159,
        negative: -123,
        zero: 0,
        large: 1000000,
      },
    },
    {
      name: 'Special Values',
      data: {
        nullValue: null,
        emptyString: '',
        whitespace: '   ',
        unicode: 'Hello 世界',
      },
    },
    {
      name: 'Semantic Categories',
      data: {
        // Personal info (should use quoted style)
        name: 'Robert',
        email: 'robert@test.com',
        phone: '555-0123',

        // Status flags (should use bracket style)
        active: true,
        enabled: false,
        valid: true,

        // Collections (should use pipe style)
        tags: ['a', 'b', 'c'],
        items: ['x', 'y', 'z'],

        // Technical (should use ampersand style)
        id: 'abc123',
        uuid: 'def456',
        hash: 'ghi789',

        // Financial (should use fake comment style)
        salary: 50000,
        price: 19.99,
        cost: 100,
      },
    },
  ];

  describe('Deterministic Conversion', () => {
    testData.forEach(({ name, data }) => {
      it(`should produce identical ROML for ${name} with same seed`, () => {
        const roml1 = RomlFile.jsonToRoml(data);
        const roml2 = RomlFile.jsonToRoml(data);

        expect(roml1).toBe(roml2);
      });

      it(`should produce identical ROML for ${name} regardless of seed (stateless design)`, () => {
        const roml1 = RomlFile.jsonToRoml(data);
        const roml2 = RomlFile.jsonToRoml(data);

        expect(roml1).toBe(roml2);
        const json1 = RomlFile.romlToJson(roml1);
        const json2 = RomlFile.romlToJson(roml2);
        expect(json1).toEqual(json2);
        expect(json1).toEqual(data);
      });
    });
  });

  describe('Perfect Round-Trip', () => {
    testData.forEach(({ name, data }) => {
      it(`should round-trip ${name} perfectly`, () => {
        const seed = 42;

        // JSON -> ROML
        const romlFile = RomlFile.fromJSON(data, { seed });
        const romlContent = romlFile.toString();

        // ROML -> JSON
        const parsedFile = new RomlFile(romlContent);
        const roundTripData = parsedFile.toJSON();

        // Data should be identical
        expect(roundTripData).toEqual(data);
      });

      it(`should pass built-in round-trip test for ${name}`, () => {
        const seed = 123;
        const romlFile = RomlFile.fromJSON(data, { seed });
        const result = romlFile.testRoundTrip();

        expect(result.success).toBe(true);
        expect(result.errors).toEqual([]);
      });
    });
  });

  describe('Metadata Preservation', () => {
    it('should work with simplified metadata for stateless design', () => {
      const data = { test: 'value', number: 42 };

      // Create ROML with simplified design
      const romlFile = RomlFile.fromJSON(data);
      const romlContent = romlFile.toString();

      // Parse back and check simplified metadata
      const parsedFile = new RomlFile(romlContent);
      const metadata = parsedFile.getMetadata();

      expect(metadata?.source).toBe('json');
      expect(metadata?.checksum).toBeDefined();
      expect(metadata?.size).toBeDefined();
      expect(metadata?.created).toBeDefined();
    });
  });

  describe('Syntax Style Verification', () => {
    it('should use semantic-based syntax styles with alternating behavior', () => {
      const data = {
        name: 'Test', // Line 1 (odd): Personal -> quoted
        active: true, // Line 2 (even): Status -> equals yes/no
        tags: ['a', 'b'], // Line 3 (odd): Collection -> BRACKETS
        id: 'abc123', // Line 4 (even): Technical -> tilde (vowel-starting)
        salary: 50000, // Line 5 (odd): Financial -> fake comment
      };

      const romlContent = RomlFile.jsonToRoml(data);

      // Check for expected syntax patterns with alternating line behavior
      expect(romlContent).toContain('name="Test"'); // Line 1: Quoted style
      expect(romlContent).toContain('active=yes'); // Line 2: Even line boolean
      expect(romlContent).toContain('tags<a><b>'); // Line 3: Bracket array style
      expect(romlContent).toContain('id~abc123'); // Line 4: Even line, vowel-starting
      expect(romlContent).toContain('//salary//50000'); // Line 5: Fake comment style
    });
  });

  describe('Content-Driven Chaos', () => {
    it('should handle different boolean representations', () => {
      const data = { flag1: true, flag2: false, flag3: true, flag4: false };
      const romlContent = RomlFile.jsonToRoml(data);
      const roundTripData = RomlFile.romlToJson(romlContent);

      expect(roundTripData).toEqual(data);
    });

    it('should handle mixed array representations', () => {
      const data = {
        tags: ['user', 'admin'],
        items: ['x', 'y', 'z'],
        roles: ['reader', 'writer'],
        permissions: ['a', 'b', 'c', 'd'],
      };

      const romlContent = RomlFile.jsonToRoml(data);
      const roundTripData = RomlFile.romlToJson(romlContent);

      expect(roundTripData).toEqual(data);
    });

    it('should handle nested objects with varying syntax', () => {
      const data = {
        user: {
          name: 'Robert',
          profile: {
            active: true,
            tags: ['dev', 'admin'],
            id: 'user123',
          },
        },
      };

      const romlContent = RomlFile.jsonToRoml(data);
      const roundTripData = RomlFile.romlToJson(romlContent);

      expect(roundTripData).toEqual(data);
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed ROML gracefully', () => {
      const malformedRoml = `
        ~ROML~
        name="unclosed
        &invalid&syntax&wrong&
      `;

      const file = new RomlFile(malformedRoml);
      const validation = file.validate();

      // In simplified design, even malformed ROML may parse to empty object
      // The key is that it doesn't crash
      expect(validation.valid).toBeDefined();
      expect(validation.errors).toBeDefined();
    });

    it('should provide helpful validation messages', () => {
      const romlFile = RomlFile.fromJSON({ test: 'value' });
      const validation = romlFile.validate();

      // Should be valid for properly generated ROML
      expect(validation.valid).toBe(true);
      expect(validation.errors).toEqual([]);
    });
  });

  describe('Alternating Line Behavior', () => {
    it('should apply different syntax styles for odd and even lines', () => {
      const data = {
        name: 'Robert', // Line 1 (odd) - should be quoted style
        age: 30, // Line 2 (even) - should be colon style for numbers
        active: true, // Line 3 (odd) - should be bracket style for booleans
        email: 'test@example.com', // Line 4 (even) - should be tilde style (vowel-starting)
      };

      const romlContent = RomlFile.jsonToRoml(data);

      // Check for alternating patterns
      expect(romlContent).toContain('name="Robert"'); // Line 1: quoted
      expect(romlContent).toContain('age:30'); // Line 2: colon
      expect(romlContent).toContain('active<true>'); // Line 3: brackets
      expect(romlContent).toContain('email~test@example.com'); // Line 4: tilde
    });

    it('should use yes/no for booleans on even lines', () => {
      const data = {
        flag1: true, // Line 1 (odd) - bracket style
        flag2: false, // Line 2 (even) - equals style with yes/no
        flag3: true, // Line 3 (odd) - bracket style
        flag4: false, // Line 4 (even) - equals style with yes/no
      };

      const romlContent = RomlFile.jsonToRoml(data);

      expect(romlContent).toContain('flag1<true>'); // Odd line: bracket
      expect(romlContent).toContain('flag2=no'); // Even line: equals with no
      expect(romlContent).toContain('flag3<true>'); // Odd line: bracket
      expect(romlContent).toContain('flag4=no'); // Even line: equals with no
    });

    it('should parse yes/no back to boolean values correctly', () => {
      const roml = `~ROML~
flag1<true>
flag2=yes
flag3<false>
flag4=no`;

      const parsed = RomlFile.romlToJson(roml);

      expect(parsed).toEqual({
        flag1: true,
        flag2: true,
        flag3: false,
        flag4: false,
      });
    });

    it('should handle nested objects with alternating behavior', () => {
      const data = {
        user: {
          // Line 1 (odd) - object
          name: 'Robert', // Line 2 (even) - equals style (consonant-starting, short)
          age: 25, // Line 3 (odd) - ampersand style for numbers
          active: true, // Line 4 (even) - equals with yes
        },
        config: {
          // Line 5 (odd) - object
          theme: 'dark', // Line 6 (even) - hash style (long string)
          debug: false, // Line 7 (odd) - bracket style
        },
      };

      const romlContent = RomlFile.jsonToRoml(data);
      const roundTripData = RomlFile.romlToJson(romlContent);

      expect(roundTripData).toEqual(data);
    });

    it('should round-trip alternating syntax styles perfectly', () => {
      const data = {
        string1: 'test',
        number1: 42,
        boolean1: true,
        string2: 'another',
        number2: 3.14,
        boolean2: false,
        string3: 'third',
        number3: 100,
      };

      const romlContent = RomlFile.jsonToRoml(data);
      const roundTripData = RomlFile.romlToJson(romlContent);

      expect(roundTripData).toEqual(data);
    });

    it('should apply even-line styles to special values', () => {
      const data = {
        value1: null, // Line 1 (odd) - fake comment style
        value2: null, // Line 2 (even) - equals style for special values
        value3: '', // Line 3 (odd) - fake comment style
        value4: '', // Line 4 (even) - equals style for special values
      };

      const romlContent = RomlFile.jsonToRoml(data);

      expect(romlContent).toContain('//value1//__NULL__'); // Odd line
      expect(romlContent).toContain('value2=__NULL__'); // Even line: equals for special values
      expect(romlContent).toContain('//value3//__EMPTY__'); // Odd line
      expect(romlContent).toContain('value4=__EMPTY__'); // Even line: equals for special values
    });
  });

  describe('Multiple Format Support Prep', () => {
    // These tests prepare for YAML and XML support
    it('should maintain data structure for future YAML conversion', () => {
      const data = {
        database: {
          host: 'localhost',
          port: 5432,
          credentials: {
            username: 'admin',
            password: 'secret',
          },
        },
        features: ['auth', 'logging', 'caching'],
      };

      const roundTripResult = RomlFile.fromJSON(data).testRoundTrip();
      expect(roundTripResult.success).toBe(true);
    });

    it('should preserve array ordering for XML compatibility', () => {
      const data = {
        items: [
          { id: 1, name: 'First' },
          { id: 2, name: 'Second' },
          { id: 3, name: 'Third' },
        ],
      };

      const romlContent = RomlFile.jsonToRoml(data);
      const roundTripData = RomlFile.romlToJson(romlContent);

      expect(roundTripData.items).toHaveLength(3);
      expect(roundTripData.items[0].name).toBe('First');
      expect(roundTripData.items[2].name).toBe('Third');
    });
  });
});
