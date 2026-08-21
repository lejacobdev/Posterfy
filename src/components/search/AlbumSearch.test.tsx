/**
 * Live search behaviour.
 *
 * The interesting cases are all timing: what is on screen while a request is
 * in flight, and what happens when a response lands after the user has moved
 * on. The provider is stubbed with controllable promises so each response can
 * be resolved at a chosen moment.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import type { Album, AlbumSummary } from '@/lib/types';
import { SettingsProvider } from '@/lib/store/settings';
import { I18nProvider } from '@/i18n';
import { searchCache } from '@/lib/search/cache';
import { AlbumSearch } from './AlbumSearch';

const searchAlbums = vi.hoisted(() => vi.fn());
const getAlbum = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api/provider', () => ({
  searchAlbums,
  getAlbum,
  getAlbumFromLink: vi.fn(),
  looksLikeAlbumLink: () => false,
  prefetchProviders: vi.fn(),
}));

function summary(title: string, id = title, artist = 'Dire Straits'): AlbumSummary {
  return {
    id,
    source: 'spotify',
    title,
    artist,
    releaseDate: '1985-05-13',
    coverUrl: null,
    totalTracks: 9,
  };
}

/** The visible result rows, in the order they are rendered. */
function rowTitles(): string[] {
  return screen
    .queryAllByRole('option')
    .map((row) => row.querySelector('.album-result__title')?.textContent ?? '');
}

/** A promise plus the handle to settle it later. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function Providers({ children }: { children: ReactNode }) {
  return (
    <SettingsProvider>
      <I18nProvider>{children}</I18nProvider>
    </SettingsProvider>
  );
}

function renderSearch(onSelect = vi.fn()) {
  render(
    <Providers>
      <AlbumSearch onSelect={onSelect} />
    </Providers>,
  );
  return { onSelect, input: screen.getByRole('combobox') };
}

beforeEach(() => {
  searchCache.clear();
  searchAlbums.mockReset();
  getAlbum.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('AlbumSearch', () => {
  it('searches once the query is long enough', async () => {
    const user = userEvent.setup();
    searchAlbums.mockResolvedValue({ items: [summary('Brothers in Arms')], provider: 'spotify' });
    const { input } = renderSearch();

    await user.type(input, 'brothers');
    await waitFor(() => expect(screen.getByText('Brothers in Arms')).toBeInTheDocument());
  });

  it('does not search a query below the minimum length', async () => {
    const user = userEvent.setup();
    searchAlbums.mockResolvedValue({ items: [], provider: 'spotify' });
    const { input } = renderSearch();

    await user.type(input, 'b');
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(searchAlbums).not.toHaveBeenCalled();
  });

  it('does not show results for a query the user has erased', async () => {
    // The bug: clearing the box left an in-flight request running, and its
    // response repopulated the list under an empty search field.
    const user = userEvent.setup();
    const pending = deferred<{ items: AlbumSummary[]; provider: string }>();
    searchAlbums.mockReturnValue(pending.promise);

    const { input } = renderSearch();
    await user.type(input, 'brothers');
    await waitFor(() => expect(searchAlbums).toHaveBeenCalled());

    await user.clear(input);
    pending.resolve({ items: [summary('Brothers in Arms')], provider: 'spotify' });

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.queryByText('Brothers in Arms')).not.toBeInTheDocument();
  });

  it('ignores a response that a newer search has superseded', async () => {
    const user = userEvent.setup();
    const slow = deferred<{ items: AlbumSummary[]; provider: string }>();
    const fast = deferred<{ items: AlbumSummary[]; provider: string }>();
    searchAlbums.mockReturnValueOnce(slow.promise).mockReturnValueOnce(fast.promise);

    const { input } = renderSearch();
    await user.type(input, 'aaaa');
    await waitFor(() => expect(searchAlbums).toHaveBeenCalledTimes(1));

    await user.type(input, 'bbbb');
    await waitFor(() => expect(searchAlbums).toHaveBeenCalledTimes(2));

    // The newer request answers first, then the older one straggles in.
    fast.resolve({ items: [summary('Newer')], provider: 'spotify' });
    await waitFor(() => expect(screen.getByText('Newer')).toBeInTheDocument());

    slow.resolve({ items: [summary('Older')], provider: 'spotify' });
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(screen.getByText('Newer')).toBeInTheDocument();
    expect(screen.queryByText('Older')).not.toBeInTheDocument();
  });

  it('answers a repeated query from cache without asking again', async () => {
    const user = userEvent.setup();
    searchAlbums.mockResolvedValue({ items: [summary('Brothers in Arms')], provider: 'spotify' });

    const { input } = renderSearch();
    await user.type(input, 'brothers');
    await waitFor(() => expect(screen.getByText('Brothers in Arms')).toBeInTheDocument());
    expect(searchAlbums).toHaveBeenCalledTimes(1);

    // Backspace and retype the same thing.
    await user.type(input, '{backspace}');
    await user.type(input, 's');
    await waitFor(() => expect(screen.getByText('Brothers in Arms')).toBeInTheDocument());

    // "brother" is a new query and may be fetched; "brothers" must not be again.
    const queries = searchAlbums.mock.calls.map((call) => call[0]);
    expect(queries.filter((value) => value === 'brothers')).toHaveLength(1);
  });

  it('re-ranks a shorter cached query for the longer one while the real one loads', async () => {
    const user = userEvent.setup();
    // Two records whose order flips between the two queries: "Dire" is the
    // better answer to "dire", "Brothers in Arms" to "dire straits".
    searchAlbums.mockResolvedValueOnce({
      items: [
        summary('Dire', 'dire-ep', 'Various Artists'),
        summary('Brothers in Arms', 'bia', 'Dire Straits'),
      ],
      provider: 'spotify',
    });

    const { input } = renderSearch();
    await user.type(input, 'dire');
    await waitFor(() => expect(rowTitles()[0]).toBe('Dire'));

    // The next request never settles, so whatever is on screen came from the
    // cached prefix — and it must have been re-scored against the new query
    // rather than simply left over from the old one.
    searchAlbums.mockReturnValue(deferred<never>().promise);
    await user.type(input, ' straits');

    await waitFor(() => expect(rowTitles()[0]).toBe('Brothers in Arms'));
  });

  it('does not open an album from the previous query when Enter is pressed early', async () => {
    const user = userEvent.setup();
    searchAlbums.mockResolvedValueOnce({ items: [summary('Stale Pick')], provider: 'spotify' });

    const { input, onSelect } = renderSearch();
    await user.type(input, 'aaaa');
    await waitFor(() => expect(screen.getByText('Stale Pick')).toBeInTheDocument());

    // Type more; the new request never settles, so the visible row is stale.
    searchAlbums.mockReturnValue(deferred<never>().promise);
    await user.type(input, 'zzzz');
    await new Promise((resolve) => setTimeout(resolve, 250));

    await user.keyboard('{Enter}');
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('reports a failed search', async () => {
    const user = userEvent.setup();
    searchAlbums.mockRejectedValue(new Error('boom'));

    const { input } = renderSearch();
    await user.type(input, 'brothers');
    await waitFor(() => expect(screen.getByRole('listbox')).toHaveTextContent(/wrong|error|fail/i));
  });

  it('hands the chosen album to the caller', async () => {
    const user = userEvent.setup();
    searchAlbums.mockResolvedValue({ items: [summary('Brothers in Arms')], provider: 'spotify' });
    const album = { id: 'x', title: 'Brothers in Arms' } as Album;
    getAlbum.mockResolvedValue(album);

    const { input, onSelect } = renderSearch();
    await user.type(input, 'brothers');
    await waitFor(() => expect(screen.getByText('Brothers in Arms')).toBeInTheDocument());

    await user.click(screen.getByRole('option', { name: /Brothers in Arms/i }));
    await waitFor(() => expect(onSelect).toHaveBeenCalledWith(album));
  });

  it('does not reopen the list when a search lands after an album is chosen', async () => {
    const user = userEvent.setup();
    const pending = deferred<{ items: AlbumSummary[]; provider: string }>();
    searchAlbums
      .mockResolvedValueOnce({ items: [summary('Brothers in Arms')], provider: 'spotify' })
      .mockReturnValueOnce(pending.promise);
    getAlbum.mockResolvedValue({ id: 'x' } as Album);

    const { input } = renderSearch();
    await user.type(input, 'brothers');
    await waitFor(() => expect(screen.getByText('Brothers in Arms')).toBeInTheDocument());

    await user.type(input, ' in');
    await waitFor(() => expect(searchAlbums).toHaveBeenCalledTimes(2));

    await user.click(screen.getByRole('option', { name: /Brothers in Arms/i }));
    await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument());

    pending.resolve({ items: [summary('Late Arrival')], provider: 'spotify' });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.queryByText('Late Arrival')).not.toBeInTheDocument();
  });
});
