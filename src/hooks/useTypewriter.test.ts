import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useTypewriterTagline } from './useTypewriter';

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
    expect(result.current.leadShown).toBe('Turn any album into a');
    expect(result.current.spaceShown).toBe(true);
    expect(result.current.accentShown).toBe('poster worth framing');
  });

  it('deletes the held line character by character after the hold', async () => {
    const { result } = renderHook(() =>
      useTypewriterTagline(TAGLINES, { holdMs: 1000, deleteMs: 10, typeMs: 10 }),
    );

    await tick(1000, 1); // hold elapses, deleting begins
    await tick(10, 1); // one character deleted
    expect(result.current.accentShown).toBe('poster worth framin');

    await tick(10, 19); // the rest of the accent
    expect(result.current.accentShown).toBe('');
    expect(result.current.spaceShown).toBe(true);
    expect(result.current.leadShown).toBe('Turn any album into a');
  });

  it('finishes deleting, then types the next tagline in from nothing', async () => {
    const { result } = renderHook(() =>
      useTypewriterTagline(TAGLINES, { holdMs: 1000, deleteMs: 10, typeMs: 10 }),
    );

    // Hold, then delete every character of the first tagline's full text.
    await tick(1000, 1);
    const firstLength = TAGLINES[0]!.lead.length + 1 + TAGLINES[0]!.accent.length;
    await tick(10, firstLength);
    expect(result.current.leadShown).toBe('');
    expect(result.current.spaceShown).toBe(false);
    expect(result.current.accentShown).toBe('');

    // The gap before typing starts, then the first few characters typed in.
    await tick(250, 1);
    await tick(10, 5);
    expect(result.current.leadShown).toBe('Cover');

    // Type out the rest of the second tagline.
    const secondLength = TAGLINES[1]!.lead.length + 1 + TAGLINES[1]!.accent.length;
    await tick(10, secondLength - 5);
    expect(result.current.leadShown).toBe('Cover art, reimagined as');
    expect(result.current.accentShown).toBe('wall art');
  });

  it('does not animate or advance with a single tagline', () => {
    const { result } = renderHook(() =>
      useTypewriterTagline([TAGLINES[0]!], { holdMs: 10, deleteMs: 1, typeMs: 1 }),
    );
    act(() => vi.advanceTimersByTime(10_000));
    expect(result.current.leadShown).toBe('Turn any album into a');
    expect(result.current.accentShown).toBe('poster worth framing');
    expect(result.current.showCaret).toBe(false);
  });

  it('does not animate or advance when disabled (reduced motion)', () => {
    const { result } = renderHook(() =>
      useTypewriterTagline(TAGLINES, { holdMs: 10, deleteMs: 1, typeMs: 1, enabled: false }),
    );
    act(() => vi.advanceTimersByTime(10_000));
    expect(result.current.leadShown).toBe('Turn any album into a');
    expect(result.current.accentShown).toBe('poster worth framing');
    expect(result.current.showCaret).toBe(false);
  });

  it('shows the caret while animating with multiple taglines enabled', () => {
    const { result } = renderHook(() => useTypewriterTagline(TAGLINES));
    expect(result.current.showCaret).toBe(true);
  });
});
