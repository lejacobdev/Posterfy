import { describe, expect, it } from 'vitest';
import { autoColumnCount, splitIntoColumns } from './text';

describe('splitIntoColumns', () => {
  it('splits evenly, filling column by column', () => {
    const { columns } = splitIntoColumns([1, 2, 3, 4, 5, 6], 2);
    expect(columns).toEqual([
      [1, 2, 3],
      [4, 5, 6],
    ]);
  });

  it('puts the remainder in earlier columns', () => {
    const { columns } = splitIntoColumns([1, 2, 3, 4, 5], 2);
    expect(columns[0]).toHaveLength(3);
    expect(columns[1]).toHaveLength(2);
  });

  it('never returns more columns than items', () => {
    const { columns } = splitIntoColumns([1], 3);
    expect(columns).toHaveLength(1);
  });

  it('survives an empty list', () => {
    expect(splitIntoColumns([], 3).columns).toEqual([]);
  });

  it('reports the tallest column height', () => {
    expect(splitIntoColumns([1, 2, 3, 4, 5], 2).rows).toBe(3);
  });
});

describe('autoColumnCount', () => {
  it('keeps short tracklists in one column', () => {
    expect(autoColumnCount(9)).toBe(1);
    expect(autoColumnCount(12)).toBe(1);
  });

  it('moves to two columns for medium lists', () => {
    expect(autoColumnCount(20)).toBe(2);
  });

  it('uses three columns for long lists', () => {
    expect(autoColumnCount(40)).toBe(3);
  });

  it('respects the available column budget', () => {
    expect(autoColumnCount(40, 2)).toBe(2);
    expect(autoColumnCount(40, 1)).toBe(1);
  });
});
