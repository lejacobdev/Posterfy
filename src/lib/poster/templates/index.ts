import type { RenderContext, TemplateId } from '@/lib/types';
import { renderClassic } from './classic';
import { renderEditorial } from './editorial';
import { renderMinimal } from './minimal';
import { renderVinyl } from './vinyl';
import { renderSplit } from './split';
import { renderDuotone } from './duotone';

export type TemplateRenderer = (rc: RenderContext, locale: string) => void;

export const TEMPLATE_RENDERERS: Record<TemplateId, TemplateRenderer> = {
  classic: renderClassic,
  editorial: renderEditorial,
  minimal: renderMinimal,
  vinyl: renderVinyl,
  split: renderSplit,
  duotone: renderDuotone,
};

export function getTemplateRenderer(id: TemplateId): TemplateRenderer {
  return TEMPLATE_RENDERERS[id] ?? renderClassic;
}
