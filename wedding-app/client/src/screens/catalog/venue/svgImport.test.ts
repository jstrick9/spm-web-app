import { describe, expect, it } from 'vitest';
import { importSvgPaths } from './svgImport';

describe('SVG venue import', () => {
  it('imports editable path geometry with standard transforms', () => {
    const paths = importSvgPaths('<svg><g transform="translate(10 5)"><path transform="scale(2)" d="M 0 0 L 10 0 L 10 5 Z" /></g></svg>', 'test');
    expect(paths).toHaveLength(1);
    expect(paths[0].points).toEqual([10, 5, 30, 5, 30, 15, 10, 5]);
  });
});
