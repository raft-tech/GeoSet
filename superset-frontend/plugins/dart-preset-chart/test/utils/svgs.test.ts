import { getSvg } from '../../src/utils/svgs';

describe('svgs', () => {
  it('getSvg()', () => {
    let svg = getSvg('circle', 'testFillColor', 1982);
    expect(svg.includes('testFillColor')).toEqual(true);
    expect(svg.includes('1982')).toEqual(true);

    svg = getSvg('fire', 'testFillColor', 1092);
    expect(svg.includes('testFillColor')).toEqual(true);
    expect(svg.includes('1092')).toEqual(true);

    svg = getSvg('point', 'testFillColor');
    expect(svg.includes('testFillColor')).toEqual(true);

    svg = getSvg('fema', 'testFillColor');
    expect(svg.includes('testFillColor')).toEqual(false);

    svg = getSvg('line', 'testFillColor');
    expect(svg.includes('testFillColor')).toEqual(true);
  });
});
