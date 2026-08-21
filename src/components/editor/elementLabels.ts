/** Shared between AdvancedPanel and EditorPage's overlay, so kept out of either component. */

import type { ElementId } from '@/lib/types';

const ELEMENT_LABEL_KEYS: Record<ElementId, string> = {
  cover: 'editor.elementCover',
  title: 'editor.elementTitle',
  artist: 'editor.elementArtist',
  meta: 'editor.elementMeta',
  tracklist: 'editor.elementTracklist',
  palette: 'editor.elementPalette',
  scanCode: 'editor.elementScanCode',
  customNote: 'editor.elementCustomNote',
};

export function elementLabel(t: (key: string) => string, id: ElementId): string {
  return t(ELEMENT_LABEL_KEYS[id]);
}
