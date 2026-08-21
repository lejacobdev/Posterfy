/**
 * Custom templates: a user's own saved starting point, built by editing one
 * of the built-in templates (colours, type, layout overrides, everything)
 * and keeping the result around to reuse on a different album.
 *
 * Deliberately its own module, parallel to `recent.ts`: this is a small,
 * user-curated list, distinct from both the single poster the editor holds
 * and the large recent-posters history.
 */

import type { PosterOptions, TemplateId } from '@/lib/types';
import { readStorage, STORAGE_KEYS, writeStorage } from './storage';

export interface CustomTemplate {
  id: string;
  name: string;
  /** The built-in template this was built from — shown as the template's icon/hint. */
  baseTemplate: TemplateId;
  createdAt: number;
  updatedAt: number;
  options: PosterOptions;
}

/** Comfortably more than anyone curates distinct templates for. */
const CUSTOM_TEMPLATE_LIMIT = 60;

/**
 * A template is about design, not this one poster's words — saving or
 * applying one leaves the album's own title, artist and note alone.
 */
const CONTENT_KEYS: Array<keyof PosterOptions> = ['titleOverride', 'artistOverride', 'customNote'];

function generateId(): string {
  return `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function listCustomTemplates(): CustomTemplate[] {
  return readStorage<CustomTemplate[]>(STORAGE_KEYS.customTemplates, []);
}

export function saveCustomTemplate(name: string, options: PosterOptions): CustomTemplate {
  const snapshot: PosterOptions = { ...options };
  for (const key of CONTENT_KEYS) Object.assign(snapshot, { [key]: '' });

  const now = Date.now();
  const template: CustomTemplate = {
    id: generateId(),
    name: name.trim(),
    baseTemplate: options.template,
    createdAt: now,
    updatedAt: now,
    options: snapshot,
  };

  const next = [template, ...listCustomTemplates()].slice(0, CUSTOM_TEMPLATE_LIMIT);
  writeStorage(STORAGE_KEYS.customTemplates, next);
  return template;
}

export function renameCustomTemplate(id: string, name: string): void {
  writeStorage(
    STORAGE_KEYS.customTemplates,
    listCustomTemplates().map((template) =>
      template.id === id ? { ...template, name: name.trim(), updatedAt: Date.now() } : template,
    ),
  );
}

export function removeCustomTemplate(id: string): void {
  writeStorage(
    STORAGE_KEYS.customTemplates,
    listCustomTemplates().filter((template) => template.id !== id),
  );
}

/**
 * Applies a saved custom template as a full starting point — replacing every
 * design option with the template's own — while keeping the current poster's
 * text content exactly as it stands.
 */
export function applyCustomTemplate(
  options: PosterOptions,
  template: CustomTemplate,
): PosterOptions {
  const next: PosterOptions = { ...template.options };
  for (const key of CONTENT_KEYS) Object.assign(next, { [key]: options[key] });
  return next;
}
