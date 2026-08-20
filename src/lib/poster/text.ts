/** Canvas text measurement and layout helpers used by every poster template. */

export interface FontSpec {
  family: string;
  size: number;
  weight?: number | string;
  style?: 'normal' | 'italic';
  /** Extra tracking in pixels (can be negative). */
  letterSpacing?: number;
}

/** `letterSpacing` is not in every lib.dom yet, so it is accessed structurally. */
type Ctx2D = CanvasRenderingContext2D & { letterSpacing: string };

function supportsLetterSpacing(ctx: CanvasRenderingContext2D): boolean {
  return 'letterSpacing' in ctx;
}

export function applyFont(ctx: CanvasRenderingContext2D, font: FontSpec): void {
  const weight = font.weight ?? 400;
  const style = font.style ?? 'normal';
  ctx.font = `${style} ${weight} ${font.size}px ${font.family}`;
  const typed = ctx as Ctx2D;
  if (supportsLetterSpacing(ctx)) {
    typed.letterSpacing = `${font.letterSpacing ?? 0}px`;
  }
}

export function resetLetterSpacing(ctx: CanvasRenderingContext2D): void {
  const typed = ctx as Ctx2D;
  if (supportsLetterSpacing(ctx)) typed.letterSpacing = '0px';
}

export function measure(ctx: CanvasRenderingContext2D, text: string, font: FontSpec): number {
  applyFont(ctx, font);
  const width = ctx.measureText(text).width;
  if (supportsLetterSpacing(ctx)) return width;
  // Manual fallback: browsers without ctx.letterSpacing need the tracking added back.
  return width + (font.letterSpacing ?? 0) * Math.max(0, text.length - 1);
}

/**
 * Draws text, emulating letter spacing per glyph when the browser lacks
 * `ctx.letterSpacing`, so posters look identical everywhere.
 */
export function drawText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  font: FontSpec,
): number {
  const spacing = font.letterSpacing ?? 0;
  applyFont(ctx, font);

  if (spacing === 0 || supportsLetterSpacing(ctx)) {
    ctx.fillText(text, x, y);
    return measure(ctx, text, font);
  }

  const align = ctx.textAlign;
  const total = measure(ctx, text, font);
  let cursor = x;
  if (align === 'center') cursor = x - total / 2;
  else if (align === 'right' || align === 'end') cursor = x - total;

  ctx.textAlign = 'left';
  for (const char of text) {
    ctx.fillText(char, cursor, y);
    cursor += ctx.measureText(char).width + spacing;
  }
  ctx.textAlign = align;
  return total;
}

/** Largest font size (<= `maxSize`) at which `text` fits inside `maxWidth`. */
export function fitFontSize(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  font: FontSpec,
  minSize = 8,
): number {
  if (!text) return font.size;
  let low = minSize;
  let high = font.size;
  let best = minSize;
  for (let i = 0; i < 24 && high - low > 0.25; i += 1) {
    const mid = (low + high) / 2;
    const width = measure(ctx, text, {
      ...font,
      size: mid,
      letterSpacing: scaleSpacing(font, mid),
    });
    if (width <= maxWidth) {
      best = mid;
      low = mid;
    } else {
      high = mid;
    }
  }
  return best;
}

/** Letter spacing is authored relative to the font size, so it scales with it. */
function scaleSpacing(font: FontSpec, newSize: number): number {
  const spacing = font.letterSpacing ?? 0;
  if (spacing === 0 || font.size === 0) return 0;
  return (spacing / font.size) * newSize;
}

export function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  font: FontSpec,
  maxLines = Infinity,
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (measure(ctx, candidate, font) <= maxWidth || !current) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
      if (lines.length === maxLines - 1) break;
    }
  }
  if (current && lines.length < maxLines) lines.push(current);

  if (lines.length === maxLines && words.length > 0) {
    const lastIndex = lines.length - 1;
    const consumed = lines.join(' ').split(/\s+/).length;
    if (consumed < words.length) {
      lines[lastIndex] = truncate(ctx, `${lines[lastIndex] ?? ''}…`, maxWidth, font);
    }
  }
  return lines;
}

export function truncate(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  font: FontSpec,
): string {
  if (measure(ctx, text, font) <= maxWidth) return text;
  let low = 0;
  let high = text.length;
  let best = '';
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const candidate = `${text.slice(0, mid).trimEnd()}…`;
    if (measure(ctx, candidate, font) <= maxWidth) {
      best = candidate;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return best || '…';
}

export interface ColumnLayout<T> {
  columns: T[][];
  /** Rows in the tallest column. */
  rows: number;
}

/** Splits items into balanced columns, filling top-to-bottom then left-to-right. */
export function splitIntoColumns<T>(items: T[], columnCount: number): ColumnLayout<T> {
  const count = Math.max(1, Math.min(columnCount, items.length || 1));
  const perColumn = Math.ceil(items.length / count);
  const columns: T[][] = [];
  for (let i = 0; i < count; i += 1) {
    columns.push(items.slice(i * perColumn, (i + 1) * perColumn));
  }
  return { columns: columns.filter((column) => column.length > 0), rows: perColumn };
}

/**
 * Chooses a column count that keeps a tracklist readable: long lists go wide,
 * short ones stay in a single elegant column.
 */
export function autoColumnCount(trackCount: number, available: 1 | 2 | 3 = 3): number {
  if (trackCount <= 12) return 1;
  if (trackCount <= 26 || available < 3) return Math.min(2, available);
  return Math.min(3, available);
}
