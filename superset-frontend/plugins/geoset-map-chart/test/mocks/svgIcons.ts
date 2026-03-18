/**
 * Shared mock for svgIcons utilities.
 *
 * Import this file (e.g. `import '../mocks/svgIcons'`) at the top of any test
 * that transitively imports svgIcons.  babel-jest hoists the jest.mock() calls
 * into the importing module, so the mocks apply as expected.
 */
jest.mock('../../src/utils/svgIcons', () => ({
  getColoredSvgUrl: (name: string) => `mock-${name}.svg`,
}));

jest.mock('../../src/utils/svgIcons/index', () => ({
  loadSvgTemplate: () => '<svg></svg>',
  svgTemplates: {},
  getColoredSvgUrl: (name: string) => `mock-${name}.svg`,
}));
