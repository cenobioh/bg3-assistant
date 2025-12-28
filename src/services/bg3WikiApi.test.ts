/**
 * Test cases for Act detection functionality
 * 
 * To test manually, you can import determineActFromLocation and test these cases:
 * 
 * import { determineActFromLocation } from './bg3WikiApi';
 * 
 * const testCases = [
 *   { location: 'Underdark - Found in a stone altar', expected: 1 },
 *   { location: 'The Underdark', expected: 1 },
 *   { location: 'Found in the Underdark', expected: 1 },
 *   { location: 'Underdark area', expected: 1 },
 * ];
 * 
 * for (const testCase of testCases) {
 *   const result = await determineActFromLocation(testCase.location);
 *   console.log(`${testCase.location} -> Act ${result} (expected ${testCase.expected})`);
 * }
 */

// Test cases that should map to Act 1
export const ACT_1_TEST_CASES = [
  'Underdark',
  'The Underdark',
  'Underdark - Found in a stone altar',
  'Found in the Underdark',
  'Underdark area',
  'Underdark area, near the Sussur Tree',
  'Emerald Grove - Found in a chest',
  'Grymforge - Sold by vendor',
  'Mountain Pass',
  'Arcane Tower - Found at the top',
];

// Test cases that should map to Act 2
export const ACT_2_TEST_CASES = [
  'Shadow-Cursed Lands - Found in a chest',
  'Moonrise Towers',
  'Last Light Inn - Sold by vendor',
  'Gauntlet of Shar',
];

// Test cases that should map to Act 3
export const ACT_3_TEST_CASES = [
  'Baldur\'s Gate - Found in Lower City',
  'Lower City - Sold by vendor',
  'Upper City',
  'House of Hope',
];

// Specific test case for Phalar Aluve
export const PHALAR_ALUVE_TEST_CASES = [
  'Underdark',
  'The Underdark',
  'Underdark - Found in a stone altar',
  'Found in the Underdark',
  'Underdark area, near the Sussur Tree',
];

