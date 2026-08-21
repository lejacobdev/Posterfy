import { describe, expect, it } from 'vitest';
import {
  applyCustomTemplate,
  listCustomTemplates,
  removeCustomTemplate,
  renameCustomTemplate,
  saveCustomTemplate,
} from './customTemplates';
import { DEFAULT_OPTIONS } from '@/lib/poster/defaults';

describe('saveCustomTemplate', () => {
  it('records a template, most-recent first', () => {
    saveCustomTemplate('Midnight Remix', { ...DEFAULT_OPTIONS, template: 'vinyl' });
    const [entry] = listCustomTemplates();
    expect(entry).toMatchObject({ name: 'Midnight Remix', baseTemplate: 'vinyl' });
  });

  it('trims the given name', () => {
    saveCustomTemplate('  Spaced Out  ', DEFAULT_OPTIONS);
    expect(listCustomTemplates()[0]?.name).toBe('Spaced Out');
  });

  it('strips the album text content, since a template is about design, not one poster', () => {
    const options = {
      ...DEFAULT_OPTIONS,
      titleOverride: 'My Test Poster',
      artistOverride: 'Test Artist',
      customNote: 'printed at the bottom',
    };
    saveCustomTemplate('Design Only', options);
    expect(listCustomTemplates()[0]?.options).toMatchObject({
      titleOverride: '',
      artistOverride: '',
      customNote: '',
    });
  });

  it('keeps every other option exactly as edited', () => {
    const options = {
      ...DEFAULT_OPTIONS,
      template: 'duotone' as const,
      fontPair: 'impact' as const,
      background: '#111111',
      layoutOverrides: { title: { dx: 20, dy: -10, scale: 1.2 } },
    };
    saveCustomTemplate('Custom Look', options);
    expect(listCustomTemplates()[0]?.options).toMatchObject({
      template: 'duotone',
      fontPair: 'impact',
      background: '#111111',
      layoutOverrides: { title: { dx: 20, dy: -10, scale: 1.2 } },
    });
  });

  it('adds new saves to the front without touching earlier ones', () => {
    saveCustomTemplate('First', DEFAULT_OPTIONS);
    saveCustomTemplate('Second', DEFAULT_OPTIONS);
    expect(listCustomTemplates().map((t) => t.name)).toEqual(['Second', 'First']);
  });
});

describe('renameCustomTemplate', () => {
  it('renames only the matching template', () => {
    const a = saveCustomTemplate('A', DEFAULT_OPTIONS);
    saveCustomTemplate('B', DEFAULT_OPTIONS);
    renameCustomTemplate(a.id, 'A Renamed');
    const names = listCustomTemplates().map((t) => t.name);
    expect(names).toContain('A Renamed');
    expect(names).toContain('B');
    expect(names).not.toContain('A');
  });
});

describe('removeCustomTemplate', () => {
  it('removes only the matching template', () => {
    const a = saveCustomTemplate('A', DEFAULT_OPTIONS);
    saveCustomTemplate('B', DEFAULT_OPTIONS);
    removeCustomTemplate(a.id);
    expect(listCustomTemplates().map((t) => t.name)).toEqual(['B']);
  });

  it('is a no-op for an id that is not in the list', () => {
    saveCustomTemplate('A', DEFAULT_OPTIONS);
    removeCustomTemplate('missing');
    expect(listCustomTemplates()).toHaveLength(1);
  });
});

describe('applyCustomTemplate', () => {
  it('replaces design options with the template’s own', () => {
    const template = saveCustomTemplate('Look', {
      ...DEFAULT_OPTIONS,
      template: 'split',
      fontPair: 'literary',
      background: '#222222',
    });
    const current = { ...DEFAULT_OPTIONS, template: 'classic' as const, fontPair: 'mono' as const };
    const result = applyCustomTemplate(current, template);
    expect(result).toMatchObject({
      template: 'split',
      fontPair: 'literary',
      background: '#222222',
    });
  });

  it('keeps the current poster’s own text content, not the template’s (blanked) content', () => {
    const template = saveCustomTemplate('Look', {
      ...DEFAULT_OPTIONS,
      titleOverride: 'Whatever it was when saved',
    });
    const current = {
      ...DEFAULT_OPTIONS,
      titleOverride: 'This Album',
      artistOverride: 'This Artist',
      customNote: 'This note',
    };
    const result = applyCustomTemplate(current, template);
    expect(result).toMatchObject({
      titleOverride: 'This Album',
      artistOverride: 'This Artist',
      customNote: 'This note',
    });
  });

  it('carries the template’s layout overrides across', () => {
    const template = saveCustomTemplate('Look', {
      ...DEFAULT_OPTIONS,
      layoutOverrides: { cover: { dx: 5, dy: 5, scale: 1.1 } },
    });
    const result = applyCustomTemplate(DEFAULT_OPTIONS, template);
    expect(result.layoutOverrides).toEqual({ cover: { dx: 5, dy: 5, scale: 1.1 } });
  });
});
