import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { revealSegments, useTypewriterTagline } from './useTypewriter';

const TAGLINES = [
  { lead: 'Turn any album into a', accent: 'poster worth framing' },
  { lead: 'Cover art, reimagined as', accent: 'wall art' },
];

/**
 * Advances fake time in single steps rather than one large jump. Each
 * character tick reschedules its own follow-up setTimeout from inside a
 * React effect — collapsing many steps into one vi.advanceTimersByTimeAsync
 * call lets React batch past intermediate re-renders, so the effect that
 * would queue the *next* timer never runs and the chain stalls after one
 * hop. One step per call sidesteps that.
 */
async function tick(stepMs: number, steps: number) {
  for (let i = 0; i < steps; i += 1) {
    await act(() => vi.advanceTimersByTimeAsync(stepMs));
  }
}

describe('useTypewriterTagline', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows the first tagline fully formed immediately, with no typing-in', () => {
    const { result } = renderHook(() =>
      useTypewriterTagline(TAGLINES, { holdMs: 1000, deleteMs: 10, typeMs: 10 }),
    );
    expect(result.current.tagline).toEqual(TAGLINES[0]);
    expect(result.current.count).toBe(TAGLINES[0]!.lead.length + 1 + TAGLINES[0]!.accent.length);
  });

  it('counts down character by character after the hold', async () => {
    const { result } = renderHook(() =>
      useTypewriterTagline(TAGLINES, { holdMs: 1000, deleteMs: 10, typeMs: 10 }),
    );
    const fullCount = result.current.count;

    await tick(1000, 1); // hold elapses, deleting begins
    await tick(10, 1); // one character deleted
    expect(result.current.count).toBe(fullCount - 1);

    await tick(10, fullCount - 1); // the rest, down to nothing
    expect(result.current.count).toBe(0);
    expect(result.current.tagline).toEqual(TAGLINES[0]);
  });

  it('finishes deleting, then types the next tagline in from nothing', async () => {
    const { result } = renderHook(() =>
      useTypewriterTagline(TAGLINES, { holdMs: 1000, deleteMs: 10, typeMs: 10 }),
    );

    const firstLength = TAGLINES[0]!.lead.length + 1 + TAGLINES[0]!.accent.length;
    await tick(1000, 1);
    await tick(10, firstLength);
    expect(result.current.count).toBe(0);

    // The gap before typing starts, then the next tagline typed in fully.
    await tick(250, 1);
    const secondLength = TAGLINES[1]!.lead.length + 1 + TAGLINES[1]!.accent.length;
    await tick(10, secondLength);
    expect(result.current.tagline).toEqual(TAGLINES[1]);
    expect(result.current.count).toBe(secondLength);
  });

  it('does not animate or advance with a single tagline', () => {
    const { result } = renderHook(() =>
      useTypewriterTagline([TAGLINES[0]!], { holdMs: 10, deleteMs: 1, typeMs: 1 }),
    );
    act(() => vi.advanceTimersByTime(10_000));
    expect(result.current.tagline).toEqual(TAGLINES[0]);
    expect(result.current.count).toBe(TAGLINES[0]!.lead.length + 1 + TAGLINES[0]!.accent.length);
    expect(result.current.showCaret).toBe(false);
  });

  it('does not animate or advance when disabled (reduced motion)', () => {
    const { result } = renderHook(() =>
      useTypewriterTagline(TAGLINES, { holdMs: 10, deleteMs: 1, typeMs: 1, enabled: false }),
    );
    act(() => vi.advanceTimersByTime(10_000));
    expect(result.current.tagline).toEqual(TAGLINES[0]);
    expect(result.current.count).toBe(TAGLINES[0]!.lead.length + 1 + TAGLINES[0]!.accent.length);
    expect(result.current.showCaret).toBe(false);
  });

  it('shows the caret while animating with multiple taglines enabled', () => {
    const { result } = renderHook(() => useTypewriterTagline(TAGLINES));
    expect(result.current.showCaret).toBe(true);
  });
});

describe('revealSegments', () => {
  const tagline = { lead: 'Turn any album into a', accent: 'poster worth framing' };
  const leadLen = tagline.lead.length; // 22
  const accentLen = tagline.accent.length; // 21
  const total = leadLen + 1 + accentLen;

  it('reveals nothing at count 0, with the full text present but hidden', () => {
    const segments = revealSegments(tagline, 0);
    expect(segments.leadRevealed).toBe('');
    expect(segments.leadHidden).toBe(tagline.lead);
    expect(segments.accentRevealed).toBe('');
    expect(segments.accentHidden).toBe(tagline.accent);
    expect(segments.caretAt).toBe('lead');
  });

  it('reveals partway through the lead, keeping the rest as a hidden (not absent) run', () => {
    const segments = revealSegments(tagline, 4);
    expect(segments.leadRevealed).toBe('Turn');
    expect(segments.leadHidden).toBe(tagline.lead.slice(4));
    // The full lead is always the concatenation of both runs — nothing is
    // ever dropped from the DOM, only hidden, so the line never re-wraps.
    expect(segments.leadRevealed + segments.leadHidden).toBe(tagline.lead);
    expect(segments.accentRevealed).toBe('');
    expect(segments.caretAt).toBe('lead');
  });

  it('reveals the full lead and stops at the space boundary', () => {
    const segments = revealSegments(tagline, leadLen);
    expect(segments.leadRevealed).toBe(tagline.lead);
    expect(segments.leadHidden).toBe('');
    expect(segments.accentRevealed).toBe('');
    expect(segments.caretAt).toBe('lead');
  });

  it('puts the caret at the space exactly when the space is the newest reveal', () => {
    const segments = revealSegments(tagline, leadLen + 1);
    expect(segments.accentRevealed).toBe('');
    expect(segments.accentHidden).toBe(tagline.accent);
    expect(segments.caretAt).toBe('space');
  });

  it('reveals partway through the accent, keeping the rest hidden but present', () => {
    const segments = revealSegments(tagline, leadLen + 1 + 6);
    expect(segments.leadRevealed).toBe(tagline.lead);
    expect(segments.accentRevealed).toBe('poster');
    expect(segments.accentHidden).toBe(tagline.accent.slice(6));
    expect(segments.accentRevealed + segments.accentHidden).toBe(tagline.accent);
    expect(segments.caretAt).toBe('accent');
  });

  it('reveals everything at the full count', () => {
    const segments = revealSegments(tagline, total);
    expect(segments.leadRevealed).toBe(tagline.lead);
    expect(segments.leadHidden).toBe('');
    expect(segments.accentRevealed).toBe(tagline.accent);
    expect(segments.accentHidden).toBe('');
    expect(segments.caretAt).toBe('accent');
  });

  it('clamps a count past the end instead of slicing past the string', () => {
    const segments = revealSegments(tagline, total + 50);
    expect(segments.accentRevealed).toBe(tagline.accent);
    expect(segments.accentHidden).toBe('');
  });

  it('clamps a negative count to nothing revealed', () => {
    const segments = revealSegments(tagline, -5);
    expect(segments.leadRevealed).toBe('');
    expect(segments.leadHidden).toBe(tagline.lead);
  });
});
