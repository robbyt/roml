import { RomlFile } from '../file/RomlFile';
import { RomlConverter } from '../RomlConverter';

describe('Type Preservation with Double Quote Rule', () => {
  describe('String vs Number Preservation', () => {
    it('should preserve string "7" vs number 7', () => {
      const input = {
        stringSeven: '7',
        numberSeven: 7,
      };

      const roml = RomlFile.jsonToRoml(input);
      const output = RomlFile.romlToJson(roml);

      expect(output.stringSeven).toBe('7');
      expect(output.stringSeven).toEqual('7');
      expect(typeof output.stringSeven).toBe('string');

      expect(output.numberSeven).toBe(7);
      expect(output.numberSeven).toEqual(7);
      expect(typeof output.numberSeven).toBe('number');
    });

    it('should preserve string "3.14" vs number 3.14', () => {
      const input = {
        stringPi: '3.14',
        numberPi: 3.14,
      };

      const roml = RomlFile.jsonToRoml(input);
      const output = RomlFile.romlToJson(roml);

      expect(output.stringPi).toBe('3.14');
      expect(typeof output.stringPi).toBe('string');

      expect(output.numberPi).toBe(3.14);
      expect(typeof output.numberPi).toBe('number');
    });

    it('should preserve negative number strings', () => {
      const input = {
        stringNeg: '-42',
        numberNeg: -42,
      };

      const roml = RomlFile.jsonToRoml(input);
      const output = RomlFile.romlToJson(roml);

      expect(output.stringNeg).toBe('-42');
      expect(typeof output.stringNeg).toBe('string');

      expect(output.numberNeg).toBe(-42);
      expect(typeof output.numberNeg).toBe('number');
    });
  });

  describe('String vs Boolean Preservation', () => {
    it('should preserve string "true" vs boolean true', () => {
      const input = {
        stringTrue: 'true',
        booleanTrue: true,
        stringFalse: 'false',
        booleanFalse: false,
      };

      const roml = RomlFile.jsonToRoml(input);
      const output = RomlFile.romlToJson(roml);

      expect(output.stringTrue).toBe('true');
      expect(typeof output.stringTrue).toBe('string');

      expect(output.booleanTrue).toBe(true);
      expect(typeof output.booleanTrue).toBe('boolean');

      expect(output.stringFalse).toBe('false');
      expect(typeof output.stringFalse).toBe('string');

      expect(output.booleanFalse).toBe(false);
      expect(typeof output.booleanFalse).toBe('boolean');
    });

    it('should preserve string "yes" and "no"', () => {
      const input = {
        stringYes: 'yes',
        stringNo: 'no',
      };

      const roml = RomlFile.jsonToRoml(input);
      const output = RomlFile.romlToJson(roml);

      expect(output.stringYes).toBe('yes');
      expect(typeof output.stringYes).toBe('string');

      expect(output.stringNo).toBe('no');
      expect(typeof output.stringNo).toBe('string');
    });
  });

  describe('String vs Null Preservation', () => {
    it('should preserve string "null" vs actual null', () => {
      const input = {
        stringNull: 'null',
        actualNull: null,
      };

      const roml = RomlFile.jsonToRoml(input);
      const output = RomlFile.romlToJson(roml);

      expect(output.stringNull).toBe('null');
      expect(typeof output.stringNull).toBe('string');

      expect(output.actualNull).toBe(null);
      expect(typeof output.actualNull).toBe('object'); // null is object in JS
    });
  });

  describe('Arrays with Mixed Types', () => {
    it('should preserve types in arrays', () => {
      const input = {
        mixedArray: ['7', 7, 'true', true, '3.14', 3.14],
      };

      const roml = RomlFile.jsonToRoml(input);
      const output = RomlFile.romlToJson(roml);

      expect(output.mixedArray[0]).toBe('7');
      expect(typeof output.mixedArray[0]).toBe('string');

      expect(output.mixedArray[1]).toBe(7);
      expect(typeof output.mixedArray[1]).toBe('number');

      expect(output.mixedArray[2]).toBe('true');
      expect(typeof output.mixedArray[2]).toBe('string');

      expect(output.mixedArray[3]).toBe(true);
      expect(typeof output.mixedArray[3]).toBe('boolean');

      expect(output.mixedArray[4]).toBe('3.14');
      expect(typeof output.mixedArray[4]).toBe('string');

      expect(output.mixedArray[5]).toBe(3.14);
      expect(typeof output.mixedArray[5]).toBe('number');
    });

    it('should handle arrays of only numeric strings', () => {
      const input = {
        stringNumbers: ['1', '2', '3', '4', '5'],
        actualNumbers: [1, 2, 3, 4, 5],
      };

      const roml = RomlFile.jsonToRoml(input);
      const output = RomlFile.romlToJson(roml);

      output.stringNumbers.forEach((val: any) => {
        expect(typeof val).toBe('string');
      });

      output.actualNumbers.forEach((val: any) => {
        expect(typeof val).toBe('number');
      });
    });
  });

  describe('Nested Objects with Type Preservation', () => {
    it('should preserve types in nested structures', () => {
      const input = {
        user: {
          id: '123',
          numericId: 123,
          active: 'true',
          isActive: true,
          score: '98.5',
          numericScore: 98.5,
        },
      };

      const roml = RomlFile.jsonToRoml(input);
      const output = RomlFile.romlToJson(roml);

      expect(output.user.id).toBe('123');
      expect(typeof output.user.id).toBe('string');

      expect(output.user.numericId).toBe(123);
      expect(typeof output.user.numericId).toBe('number');

      expect(output.user.active).toBe('true');
      expect(typeof output.user.active).toBe('string');

      expect(output.user.isActive).toBe(true);
      expect(typeof output.user.isActive).toBe('boolean');
    });
  });

  describe('Special Values as Strings', () => {
    it('should preserve special value markers as strings', () => {
      const input = {
        nullMarker: '__NULL__',
        emptyMarker: '__EMPTY__',
        undefinedMarker: '__UNDEFINED__',
      };

      const roml = RomlFile.jsonToRoml(input);
      const output = RomlFile.romlToJson(roml);

      expect(output.nullMarker).toBe('__NULL__');
      expect(typeof output.nullMarker).toBe('string');

      expect(output.emptyMarker).toBe('__EMPTY__');
      expect(typeof output.emptyMarker).toBe('string');

      expect(output.undefinedMarker).toBe('__UNDEFINED__');
      expect(typeof output.undefinedMarker).toBe('string');
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero as string vs number', () => {
      const input = {
        stringZero: '0',
        numberZero: 0,
      };

      const roml = RomlFile.jsonToRoml(input);
      const output = RomlFile.romlToJson(roml);

      expect(output.stringZero).toBe('0');
      expect(typeof output.stringZero).toBe('string');

      expect(output.numberZero).toBe(0);
      expect(typeof output.numberZero).toBe('number');
    });

    it('should handle scientific notation strings', () => {
      const input = {
        stringScientific: '1e10',
        numberScientific: 1e10,
      };

      const roml = RomlFile.jsonToRoml(input);
      const output = RomlFile.romlToJson(roml);

      expect(output.stringScientific).toBe('1e10');
      expect(typeof output.stringScientific).toBe('string');

      expect(output.numberScientific).toBe(1e10);
      expect(typeof output.numberScientific).toBe('number');
    });
  });

  describe('Quote Verification in ROML Output', () => {
    it('should add quotes to ambiguous strings in ROML', () => {
      const converter = new RomlConverter();
      const input = { value: '7' };
      const roml = converter.jsonToRoml(input);

      // The string "7" should be quoted to preserve string type
      expect(roml).toContain('"7"');
    });

    it('should not quote unambiguous strings', () => {
      const converter = new RomlConverter();
      const input = { message: 'hello' };
      const roml = converter.jsonToRoml(input);

      // Regular strings don't need quotes (unless style requires it)
      expect(roml).toContain('hello');
    });

    it('should not quote actual numbers', () => {
      const converter = new RomlConverter();
      const input = { count: 7 };
      const roml = converter.jsonToRoml(input);

      // Numbers should not be quoted
      expect(roml).toMatch(/count[^\n]*7(?!")/);
    });
  });
});
