import { RomlFile } from '../file/RomlFile.js';

describe('Quoted Keys Round-Trip Tests', () => {
  describe('should handle quoted keys in all ROML syntax patterns', () => {
    it('should handle quoted keys with TILDE pattern', () => {
      const testData = { url: 'http://www.JSON.org/' };
      const romlContent = RomlFile.jsonToRoml(testData);
      const roundTripData = RomlFile.romlToJson(romlContent);
      expect(roundTripData).toEqual(testData);
    });

    it('should handle quoted keys with AMPERSAND pattern', () => {
      const testData = { E: 1.23456789e34 };
      const romlContent = RomlFile.jsonToRoml(testData);
      const roundTripData = RomlFile.romlToJson(romlContent);
      expect(roundTripData).toEqual(testData);
    });

    it('should handle quoted keys with BRACKETS pattern', () => {
      const testData = { false: false };
      const romlContent = RomlFile.jsonToRoml(testData);
      const roundTripData = RomlFile.romlToJson(romlContent);
      expect(roundTripData).toEqual(testData);
    });

    it('should handle quoted keys with EQUALS pattern', () => {
      const testData = { special: 'value' };
      const romlContent = RomlFile.jsonToRoml(testData);
      const roundTripData = RomlFile.romlToJson(romlContent);
      expect(roundTripData).toEqual(testData);
    });

    it('should handle empty string key', () => {
      const testData = { '': 'empty key value' };
      const romlContent = RomlFile.jsonToRoml(testData);
      const roundTripData = RomlFile.romlToJson(romlContent);
      expect(roundTripData).toEqual(testData);
    });

    it('should handle complex quoted keys with ROML syntax characters', () => {
      const testData = {
        'key~with~tildes': 'value1',
        'key=with=equals': 'value2',
        'key#with#hash': 'value3',
        'key&with&ampersand': 'value4',
        'key:with:colons': 'value5',
      };
      const romlContent = RomlFile.jsonToRoml(testData);
      const roundTripData = RomlFile.romlToJson(romlContent);
      expect(roundTripData).toEqual(testData);
    });

    it('should handle the problematic special key from the main test', () => {
      const testData = { special: "`1~!@#$%^&*()_+-={':[,]}|;.</>?" };
      const romlContent = RomlFile.jsonToRoml(testData);
      const roundTripData = RomlFile.romlToJson(romlContent);
      expect(roundTripData).toEqual(testData);
    });

    it('should handle the complex unicode key from the main test', () => {
      const testData = {
        '/\\"\uCAFE\uBABE\uAB98\uFCDE\ubcda\uef4A\b\f\n\r\t`1~!@#$%^&*()_+-=[]{}|;:\',./<>?':
          'A key can be any string',
      };
      const romlContent = RomlFile.jsonToRoml(testData);
      const roundTripData = RomlFile.romlToJson(romlContent);
      expect(roundTripData).toEqual(testData);
    });
  });
});
