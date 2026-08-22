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

export interface RevealSegments {
  leadRevealed: string;
  leadHidden: string;
  accentRevealed: string;
  accentHidden: string;
  /** Which run the caret currently sits at the end of. */
  caretAt: 'lead' | 'space' | 'accent';
}

/**
 * Splits a tagline into revealed/hidden runs for a given character count —
 * both halves of `lead` (and of `accent`) are meant to render together,
 * always, so the line's layout is driven by the tagline's *full* text at
 * every frame. Only a run's opacity should change between revealed and
 * hidden, never whether it's in the DOM: if the hidden run were left out of
 * the render instead, the line would re-wrap and re-center as it grows,
 * dragging already-typed letters out of the position they're going to end
 * up in.
 */
export function revealSegments(tagline: TypewriterTagline, count: number): RevealSegments {
  const leadLen = tagline.lead.length;
  const leadRevealedLen = Math.max(0, Math.min(count, leadLen));
  const leadRevealed = tagline.lead.slice(0, leadRevealedLen);
  const leadHidden = tagline.lead.slice(leadRevealedLen);

  const afterLead = count - leadLen;
  const accentRevealedLen = Math.max(0, Math.min(tagline.accent.length, afterLead - 1));
  const accentRevealed = tagline.accent.slice(0, accentRevealedLen);
  const accentHidden = tagline.accent.slice(accentRevealedLen);

  const caretAt: RevealSegments['caretAt'] =
    count <= leadLen ? 'lead' : count === leadLen + 1 ? 'space' : 'accent';

  return { leadRevealed, leadHidden, accentRevealed, accentHidden, caretAt };
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
