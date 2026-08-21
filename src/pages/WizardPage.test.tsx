/**
 * Wizard flow tests.
 *
 * The poster canvas is stubbed out: jsdom has no 2D context, and none of what
 * is asserted here depends on pixels — only on which step is showing and what
 * each choice writes into the poster store.
 */

import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { SettingsProvider } from '@/lib/store/settings';
import { PosterProvider } from '@/lib/store/poster';
import { I18nProvider } from '@/i18n';
import { ToastProvider } from '@/components/ui/Toast';
import { STORAGE_KEYS } from '@/lib/store/storage';
import { createEmptyAlbum, DEFAULT_OPTIONS, STYLE_PRESETS } from '@/lib/poster/defaults';
import WizardPage from './WizardPage';

vi.mock('@/components/poster/PosterCanvas', () => ({
  PosterCanvas: () => <div data-testid="poster-canvas" />,
}));

function Providers({ children }: { children: ReactNode }) {
  return (
    <MemoryRouter initialEntries={['/create']}>
      <SettingsProvider>
        <I18nProvider>
          <ToastProvider>
            <PosterProvider>{children}</PosterProvider>
          </ToastProvider>
        </I18nProvider>
      </SettingsProvider>
    </MemoryRouter>
  );
}

/** Seeds the store the way a previous session would have left it. */
function seedAlbum() {
  localStorage.setItem(
    STORAGE_KEYS.poster,
    JSON.stringify({
      album: {
        ...createEmptyAlbum(),
        id: 'seed',
        title: 'Northern Signal',
        artist: 'Halden Frost',
        tracks: [{ position: 1, title: 'One', durationMs: 120_000 }],
      },
      options: DEFAULT_OPTIONS,
      started: true,
    }),
  );
}

function readOptions() {
  return JSON.parse(localStorage.getItem(STORAGE_KEYS.poster) ?? '{}').options;
}

function renderWizard() {
  return render(
    <Providers>
      <WizardPage />
    </Providers>,
  );
}

const next = () => screen.getByRole('button', { name: /continue/i });

describe('poster wizard', () => {
  it('opens on the album step', () => {
    renderWizard();
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(/which record/i);
    expect(screen.getByText('Step 1 of 5')).toBeInTheDocument();
  });

  it('will not advance until a record is chosen', () => {
    renderWizard();
    expect(next()).toBeDisabled();
  });

  it('advances once an album is already in the store', async () => {
    const user = userEvent.setup();
    seedAlbum();
    renderWizard();

    expect(next()).toBeEnabled();
    await user.click(next());
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(/pick a look/i);
  });

  it('starting from scratch skips straight to the look step', async () => {
    const user = userEvent.setup();
    renderWizard();

    await user.click(screen.getByRole('button', { name: /start from scratch/i }));
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(/pick a look/i);
  });

  it('applies the chosen preset to the poster', async () => {
    const user = userEvent.setup();
    seedAlbum();
    renderWizard();
    await user.click(next());

    const preset = STYLE_PRESETS[1];
    if (!preset) throw new Error('expected a second style preset');
    const card = screen.getByRole('button', { name: new RegExp(preset.name, 'i') });
    await user.click(card);

    expect(card).toHaveAttribute('aria-pressed', 'true');
    expect(readOptions().template).toBe(preset.options.template);
  });

  it('applies the chosen format', async () => {
    const user = userEvent.setup();
    seedAlbum();
    renderWizard();
    await user.click(next());
    await user.click(next());

    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(/choose the size/i);
    await user.click(screen.getByRole('button', { name: /square/i }));
    expect(readOptions().format).toBe('square');
  });

  it('writes the content toggles through to the poster', async () => {
    const user = userEvent.setup();
    seedAlbum();
    renderWizard();
    await user.click(next());
    await user.click(next());
    await user.click(next());

    const genres = screen.getByRole('switch', { name: 'Genres' });
    expect(genres).toHaveAttribute('aria-checked', String(DEFAULT_OPTIONS.showGenres));
    await user.click(genres);
    expect(readOptions().showGenres).toBe(!DEFAULT_OPTIONS.showGenres);
  });

  it('ends on a summary with both hand-offs', async () => {
    const user = userEvent.setup();
    seedAlbum();
    renderWizard();
    for (let step = 0; step < 4; step += 1) await user.click(next());

    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(/ready/i);
    expect(screen.getByRole('button', { name: /open in the editor/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /download now/i })).toBeInTheDocument();
    // No Continue past the last step.
    expect(screen.queryByRole('button', { name: /continue/i })).not.toBeInTheDocument();
  });

  it('locks steps the user has not reached and unlocks the ones behind them', async () => {
    const user = userEvent.setup();
    seedAlbum();
    renderWizard();

    const rail = screen.getByRole('list');
    expect(within(rail).getByRole('button', { name: /size/i })).toBeDisabled();

    await user.click(next());
    await user.click(next());

    // Two steps on, the first is navigable again and the last still is not.
    expect(within(rail).getByRole('button', { name: /record/i })).toBeEnabled();
    expect(within(rail).getByRole('button', { name: /finish/i })).toBeDisabled();

    await user.click(within(rail).getByRole('button', { name: /record/i }));
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(/which record/i);
  });
});
