import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { SettingsProvider } from '@/lib/store/settings';
import { I18nProvider } from '@/i18n';
import { PlaylistPublicGuide } from './PlaylistPublicGuide';

function Providers({ children }: { children: ReactNode }) {
  return (
    <SettingsProvider>
      <I18nProvider>{children}</I18nProvider>
    </SettingsProvider>
  );
}

describe('PlaylistPublicGuide', () => {
  it('starts collapsed, with the panel not in the document', () => {
    render(<PlaylistPublicGuide />, { wrapper: Providers });
    expect(screen.getByRole('button', { expanded: false })).toBeInTheDocument();
    expect(screen.queryByText(/tap the/i)).not.toBeInTheDocument();
  });

  it('expands to show the three steps and collapses again on a second click', async () => {
    const user = userEvent.setup();
    render(<PlaylistPublicGuide />, { wrapper: Providers });

    await user.click(screen.getByRole('button'));
    expect(screen.getByRole('button', { expanded: true })).toBeInTheDocument();
    const steps = screen.getAllByRole('listitem');
    expect(steps).toHaveLength(3);
    expect(steps[0]?.textContent).toMatch(/•••/);

    await user.click(screen.getByRole('button'));
    expect(screen.getByRole('button', { expanded: false })).toBeInTheDocument();
  });

  it('marks the decorative mock as hidden from assistive tech', async () => {
    const user = userEvent.setup();
    const { container } = render(<PlaylistPublicGuide />, { wrapper: Providers });
    await user.click(screen.getByRole('button'));

    const mock = container.querySelector('.playlist-guide__mock');
    expect(mock).toHaveAttribute('aria-hidden', 'true');
  });
});
