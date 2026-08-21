import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { SettingsProvider, useSettings } from './settings';

const wrapper = ({ children }: { children: ReactNode }) => (
  <SettingsProvider>{children}</SettingsProvider>
);

describe('editor mode setting', () => {
  it('defaults to easy', () => {
    const { result } = renderHook(() => useSettings(), { wrapper });
    expect(result.current.editorMode).toBe('easy');
  });

  it('switches to advanced and back', () => {
    const { result } = renderHook(() => useSettings(), { wrapper });
    act(() => result.current.setEditorMode('advanced'));
    expect(result.current.editorMode).toBe('advanced');
    act(() => result.current.setEditorMode('easy'));
    expect(result.current.editorMode).toBe('easy');
  });

  it('persists across a remount, the way theme and locale already do', () => {
    const first = renderHook(() => useSettings(), { wrapper });
    act(() => first.result.current.setEditorMode('advanced'));

    const second = renderHook(() => useSettings(), { wrapper });
    expect(second.result.current.editorMode).toBe('advanced');
  });

  it('resetAll returns it to easy', () => {
    const { result } = renderHook(() => useSettings(), { wrapper });
    act(() => result.current.setEditorMode('advanced'));
    act(() => result.current.resetAll());
    expect(result.current.editorMode).toBe('easy');
  });
});
