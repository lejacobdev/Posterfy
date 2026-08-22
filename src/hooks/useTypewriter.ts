import { useEffect, useMemo, useState } from 'react';

export interface TypewriterTagline {
  lead: string;
  accent: string;
}

export interface TypewriterState {
  leadShown: string;
  spaceShown: boolean;
  accentShown: string;
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

function splitAt(tagline: TypewriterTagline, count: number) {
  const leadLen = tagline.lead.length;
  const leadShown = tagline.lead.slice(0, Math.min(count, leadLen));
  const afterLead = count - leadLen;
  const spaceShown = afterLead >= 1;
  const accentShown = afterLead >= 1 ? tagline.accent.slice(0, afterLead - 1) : '';
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

  const { leadShown, spaceShown, accentShown } = useMemo(
    () => splitAt(tagline ?? { lead: '', accent: '' }, count),
    [tagline, count],
  );

  return { leadShown, spaceShown, accentShown, showCaret: canAnimate };
}
