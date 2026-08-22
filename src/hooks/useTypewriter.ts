import { useEffect, useMemo, useState } from 'react';

export interface TypewriterTagline {
  lead: string;
  accent: string;
}

export interface TypewriterState {
  tagline: TypewriterTagline;
  /** How many characters of `${tagline.lead} ${tagline.accent}` are revealed. */
  count: number;
  /** Whether a blinking caret should render at all (off for reduced motion). */
  showCaret: boolean;
}

type Phase = 'hold' | 'deleting' | 'typing';

export interface TypewriterOptions {
  /** How long a fully-typed tagline stays up before it starts deleting. */
  holdMs?: number;
  /** Per-character delay while deleting. */
  deleteMs?: number;
  /** Per-character delay while typing. */
  typeMs?: number;
  /** Set false to freeze on the first tagline with no animation (reduced motion). */
  enabled?: boolean;
}

function fullLength(tagline?: TypewriterTagline): number {
  if (!tagline) return 0;
  // +1 for the space joining lead and accent.
  return tagline.lead.length + 1 + tagline.accent.length;
}

export interface RevealedTagline {
  leadShown: string;
  spaceShown: boolean;
  accentShown: string;
}

/**
 * Slices a tagline down to its first `count` characters (of
 * `${lead} ${accent}`) — a single, unbroken run of real text, exactly as
 * long as what's actually typed so far, nothing more.
 *
 * An earlier version rendered the *full* tagline at every frame (revealed
 * text plus a same-length, opacity:0 "hidden" remainder) so the line's wrap
 * points would never move as more got typed. In testing that traded one bug
 * for a worse one: splitting a wrapped, multi-line string across two DOM
 * text runs measurably perturbs the browser's own line-breaking — moving
 * *where* that split falls (which is exactly what changes on every
 * keystroke) could flip a borderline line back and forth between wrapping
 * to N vs N+1 lines, for text whose content never changed. Plain slicing
 * has no split at all, so it can't do that; growing into a new line is then
 * just the normal, expected shape of a typewriter effect. The one thing
 * slicing doesn't fix on its own — a centered line re-centering itself
 * sideways as it grows — is handled by keeping the live tagline left-aligned
 * regardless of viewport (see .hero__title-live in HomePage.css).
 */
export function revealText(tagline: TypewriterTagline, count: number): RevealedTagline {
  const leadLen = tagline.lead.length;
  const leadShown = tagline.lead.slice(0, Math.max(0, Math.min(count, leadLen)));
  const afterLead = count - leadLen;
  const spaceShown = afterLead >= 1;
  const accentShown = spaceShown ? tagline.accent.slice(0, Math.max(0, afterLead - 1)) : '';
  return { leadShown, spaceShown, accentShown };
}

/**
 * Cycles through a list of {lead, accent} taglines with an old-school
 * typewriter effect: hold the fully-typed line, backspace it out one
 * character at a time, then type the next one in the same way. The very
 * first tagline appears fully formed on mount — only the rotations that
 * follow animate.
 */
export function useTypewriterTagline(
  taglines: TypewriterTagline[],
  { holdMs = 2600, deleteMs = 22, typeMs = 45, enabled = true }: TypewriterOptions = {},
): TypewriterState {
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>('hold');
  const [count, setCount] = useState(() => fullLength(taglines[0]));

  const tagline = taglines[index] ?? taglines[0];
  const total = useMemo(() => fullLength(tagline), [tagline]);
  const canAnimate = enabled && taglines.length > 1;

  useEffect(() => {
    if (!canAnimate) return undefined;

    let delay: number;
    let advance: () => void;

    if (phase === 'hold') {
      delay = holdMs;
      advance = () => setPhase('deleting');
    } else if (phase === 'deleting') {
      if (count > 0) {
        delay = deleteMs;
        advance = () => setCount((current) => Math.max(0, current - 1));
      } else {
        delay = holdMs > 0 ? 250 : 0; // a beat between the old line vanishing and the new one starting
        advance = () => {
          setIndex((current) => (current + 1) % taglines.length);
          setPhase('typing');
        };
      }
    } else {
      if (count < total) {
        delay = typeMs;
        advance = () => setCount((current) => Math.min(total, current + 1));
      } else {
        delay = 0;
        advance = () => setPhase('hold');
      }
    }

    const id = setTimeout(advance, delay);
    return () => clearTimeout(id);
  }, [canAnimate, phase, count, total, taglines.length, holdMs, deleteMs, typeMs]);

  return {
    tagline: tagline ?? { lead: '', accent: '' },
    count,
    showCaret: canAnimate,
  };
}
