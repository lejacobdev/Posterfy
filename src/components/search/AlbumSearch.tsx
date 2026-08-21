/**
 * Live album search.
 *
 * Types-as-you-go with a debounce, cancels in-flight requests, supports full
 * keyboard navigation, and understands a pasted Spotify or MusicBrainz link.
 */

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { Album, AlbumSummary, ProviderId, SubjectKind } from '@/lib/types';
import {
  getAlbum,
  getAlbumFromLink,
  looksLikeAlbumLink,
  prefetchProviders,
  searchAlbums,
  searchPlaylists,
} from '@/lib/api/provider';
import { getProviderConfig } from '@/lib/api/spotify';
import { rankAlbums } from '@/lib/search/fuzzy';
import { searchCache, SearchCache } from '@/lib/search/cache';
import { thumbnailUrl } from '@/lib/poster/cover';
import { isAbortError } from '@/lib/api/client';
import { detectMarket } from '@/i18n/detect';
import { useI18n } from '@/i18n';
import { useOnlineStatus } from '@/hooks/useMediaQuery';
import { releaseYear } from '@/lib/utils/format';
import { cn } from '@/lib/utils/misc';
import { Icon } from '@/components/ui/Icon';
import { SegmentedControl } from '@/components/ui/Controls';
import { PlaylistPublicGuide } from './PlaylistPublicGuide';
import './AlbumSearch.css';

export interface AlbumSearchProps {
  onSelect: (album: Album) => void;
  onManual?: () => void;
  autoFocus?: boolean;
  placeholder?: string;
}

/**
 * Kept separate from the album cache so a query typed in one mode never
 * answers the other from memory — "dire" searched as an album and as a
 * playlist are two entirely different result sets.
 */
const playlistSearchCache = new SearchCache();

/**
 * Short enough to feel live, long enough that an average typing burst is one
 * request. Cache hits skip it entirely and render on the same tick.
 */
const DEBOUNCE_MS = 180;
const MIN_QUERY = 2;
/** Asked of the provider; ranked locally down to SHOWN_LIMIT. */
const FETCH_LIMIT = 24;
const SHOWN_LIMIT = 12;

export function AlbumSearch({ onSelect, onManual, autoFocus, placeholder }: AlbumSearchProps) {
  const { t } = useI18n();
  const online = useOnlineStatus();
  const listId = useId();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<AlbumSummary[]>([]);
  const [provider, setProvider] = useState<ProviderId>('musicbrainz');
  const [loading, setLoading] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  // Playlists are Spotify-only, so the toggle to search them only appears
  // once we know Spotify is actually configured on this deployment.
  const [spotifyAvailable, setSpotifyAvailable] = useState(false);
  const [subjectKind, setSubjectKind] = useState<SubjectKind>('album');

  const abortRef = useRef<AbortController | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const market = useRef<string | undefined>(detectMarket());

  /**
   * Bumped whenever what is on screen should stop being driven by whatever is
   * in flight — a new search, a cleared box, an album chosen. A response whose
   * id is no longer current is dropped rather than painted, which is what
   * stopped results from reappearing under an empty search box.
   */
  const requestId = useRef(0);

  const isLink = looksLikeAlbumLink(query);

  /** The query the visible results answer, so Enter can never pick a stale row. */
  const [resultsQuery, setResultsQuery] = useState('');

  const supersede = useCallback(() => {
    requestId.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  // Warm the provider config now, so the first search is one round trip rather
  // than config-then-search.
  useEffect(() => {
    prefetchProviders();
    void getProviderConfig().then((config) => setSpotifyAvailable(config.spotify));
  }, []);

  // Falling back to album search if Spotify drops out from under a playlist
  // search in progress — there is no keyless playlist provider to degrade to.
  useEffect(() => {
    if (!spotifyAvailable && subjectKind === 'playlist') setSubjectKind('album');
  }, [spotifyAvailable, subjectKind]);

  useEffect(() => {
    const trimmed = query.trim();
    const isPlaylistMode = subjectKind === 'playlist';
    const cache = isPlaylistMode ? playlistSearchCache : searchCache;
    const search = isPlaylistMode ? searchPlaylists : searchAlbums;

    if (trimmed.length < MIN_QUERY || (isLink && !isPlaylistMode)) {
      supersede();
      setResults([]);
      setResultsQuery('');
      setLoading(false);
      return undefined;
    }

    // An exact repeat — a backspace and retype, or a query from a minute ago —
    // never touches the network.
    const cached = cache.get(trimmed);
    if (cached) {
      supersede();
      setResults(rankAlbums(trimmed, cached.items, { limit: SHOWN_LIMIT }));
      setResultsQuery(trimmed);
      setProvider(cached.provider);
      setActiveIndex(-1);
      setError(null);
      setLoading(false);
      return undefined;
    }

    // Nothing exact, but a shorter query we already fetched usually covers this
    // one. Rank those for the new query and show them while the real response
    // is on its way, so the list moves with every keystroke.
    const prefix = cache.findPrefix(trimmed);
    if (prefix) {
      // `strict`, because these were fetched for a different query: show them
      // only if they genuinely score against this one, never as a fallback.
      const provisional = rankAlbums(trimmed, prefix.items, { limit: SHOWN_LIMIT, strict: true });
      if (provisional.length > 0) {
        setResults(provisional);
        setResultsQuery(trimmed);
        setProvider(prefix.provider);
        setActiveIndex(-1);
      }
    }

    const timer = setTimeout(async () => {
      supersede();
      const id = requestId.current;
      const controller = new AbortController();
      abortRef.current = controller;

      setLoading(true);
      setError(null);
      try {
        const response = await search(trimmed, {
          signal: controller.signal,
          // Over-fetch so the ranker has something to choose from: the record
          // the user means is often outside the provider's own top few.
          limit: FETCH_LIMIT,
          market: market.current,
        });
        if (id !== requestId.current) return;

        cache.set(trimmed, { items: response.items, provider: response.provider });
        setResults(rankAlbums(trimmed, response.items, { limit: SHOWN_LIMIT }));
        setResultsQuery(trimmed);
        setProvider(response.provider);
        setActiveIndex(-1);
        setOpen(true);
      } catch (searchError) {
        if (isAbortError(searchError) || id !== requestId.current) return;
        setError(online ? t('errors.searchFailed') : t('errors.offline'));
        setResults([]);
        setResultsQuery('');
      } finally {
        // Only the newest request owns the spinner. Without this an aborted
        // request switched it off while its replacement was still running.
        if (id === requestId.current) setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [query, isLink, online, t, supersede, subjectKind]);

  useEffect(() => () => abortRef.current?.abort(), []);

  // Close the result list when focus moves elsewhere.
  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, []);

  const choose = useCallback(
    async (summary: AlbumSummary) => {
      // Nothing still in flight may reopen the list behind the chosen album.
      supersede();
      setLoadingId(summary.id);
      setError(null);
      try {
        const album = await getAlbum(summary, { market: market.current });
        onSelect(album);
        setOpen(false);
        setQuery('');
        setResults([]);
        setResultsQuery('');
      } catch {
        setError(t('errors.albumFailed'));
      } finally {
        setLoadingId(null);
      }
    },
    [onSelect, t, supersede],
  );

  const loadLink = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const album = await getAlbumFromLink(query);
      if (album) {
        onSelect(album);
        setQuery('');
      } else {
        setError(t('errors.albumFailed'));
      }
    } catch {
      setError(t('errors.albumFailed'));
    } finally {
      setLoading(false);
    }
  }, [query, onSelect, t]);

  /**
   * Whether the rows on screen answer what is currently typed. While a search
   * is in flight they can still belong to the previous query, and acting on
   * them would open an album the user never picked.
   */
  const resultsAreCurrent = resultsQuery === query.trim();

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      if (isLink) {
        void loadLink();
        return;
      }
      // Enter only opens a result the user explicitly navigated to with the
      // arrow keys. Without an active row it just closes the keyboard/leaves
      // the live results as they are, rather than guessing at the top one.
      if (!resultsAreCurrent || activeIndex < 0) return;
      const target = results[activeIndex];
      if (target) void choose(target);
      return;
    }
    if (event.key === 'Escape') {
      setOpen(false);
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (results.length === 0) return;
      event.preventDefault();
      setOpen(true);
      setActiveIndex((current) => {
        const delta = event.key === 'ArrowDown' ? 1 : -1;
        const next = current + delta;
        if (next < 0) return results.length - 1;
        if (next >= results.length) return 0;
        return next;
      });
    }
  };

  const showResults = open && (results.length > 0 || loading || Boolean(error));

  return (
    <div className="album-search" ref={containerRef}>
      {spotifyAvailable && (
        <SegmentedControl<SubjectKind>
          label={t('editor.searchMode')}
          value={subjectKind}
          onChange={setSubjectKind}
          options={[
            { value: 'album', label: t('editor.searchModeAlbums'), icon: 'disc' },
            { value: 'playlist', label: t('editor.searchModePlaylists'), icon: 'list' },
          ]}
        />
      )}
      {subjectKind === 'playlist' && <PlaylistPublicGuide />}
      <div className={cn('album-search__field glass', showResults && 'is-open')}>
        <Icon name="search" size={20} className="album-search__icon" />
        <input
          ref={inputRef}
          type="search"
          className="album-search__input"
          value={query}
          placeholder={
            placeholder ??
            (subjectKind === 'playlist'
              ? t('editor.searchPlaylistPlaceholder')
              : t('editor.searchPlaceholder'))
          }
          aria-label={t('editor.searchLabel')}
          aria-autocomplete="list"
          aria-controls={listId}
          aria-expanded={showResults}
          role="combobox"
          autoFocus={autoFocus}
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="search"
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
        />
        {loading && <span className="spinner album-search__spinner" aria-hidden="true" />}
        {query.length > 0 && !loading && (
          <button
            type="button"
            className="album-search__clear"
            aria-label={t('common.clear')}
            onClick={() => {
              setQuery('');
              setResults([]);
              inputRef.current?.focus();
            }}
          >
            <Icon name="close" size={16} />
          </button>
        )}
      </div>

      {isLink && (
        <button type="button" className="album-search__link-hint" onClick={() => void loadLink()}>
          <Icon name="externalLink" size={14} />
          {t('editor.linkDetected')}
        </button>
      )}

      {showResults && (
        <div className="album-search__results glass" id={listId} role="listbox">
          {error && (
            <p className="album-search__error">
              <Icon name="alert" size={16} />
              {error}
            </p>
          )}

          {loading && results.length === 0 && (
            <div className="album-search__skeletons" aria-hidden="true">
              {Array.from({ length: 4 }, (_, index) => (
                <div className="album-search__skeleton" key={index}>
                  <div className="skeleton album-search__skeleton-art" />
                  <div className="album-search__skeleton-lines">
                    <div className="skeleton" style={{ height: 12, width: '65%' }} />
                    <div className="skeleton" style={{ height: 10, width: '40%' }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {results.map((result, index) => (
            <button
              key={`${result.source}-${result.id}`}
              type="button"
              role="option"
              aria-selected={index === activeIndex}
              className={cn('album-result', index === activeIndex && 'is-active')}
              onClick={() => void choose(result)}
              onMouseEnter={() => setActiveIndex(index)}
            >
              <span className="album-result__art">
                {result.coverUrl ? (
                  <img
                    src={thumbnailUrl(result.coverUrl)}
                    alt=""
                    // Intrinsic size, so the row never reflows when it lands.
                    width={46}
                    height={46}
                    decoding="async"
                    // The first rows are on screen the moment the list opens;
                    // deferring them is what makes covers appear late.
                    loading={index < 6 ? 'eager' : 'lazy'}
                  />
                ) : (
                  <Icon name={result.kind === 'playlist' ? 'list' : 'disc'} size={20} />
                )}
              </span>
              <span className="album-result__text">
                <span className="album-result__title">{result.title}</span>
                <span className="album-result__meta">
                  {result.artist}
                  {result.releaseDate && ` · ${releaseYear(result.releaseDate)}`}
                  {result.totalTracks > 0 && ` · ${result.totalTracks}`}
                </span>
                {result.matchedTrack && (
                  <span className="album-result__track">
                    {t('editor.matchedTrack', { track: result.matchedTrack })}
                  </span>
                )}
              </span>
              {loadingId === result.id ? (
                <span className="spinner" aria-hidden="true" />
              ) : (
                <Icon name="arrowRight" size={16} className="album-result__go" />
              )}
            </button>
          ))}

          {!loading && results.length === 0 && !error && query.trim().length >= MIN_QUERY && (
            <div className="album-search__empty">
              <p>
                {subjectKind === 'playlist' ? t('editor.noPlaylistResults') : t('editor.noResults')}
              </p>
              {onManual && subjectKind === 'album' && (
                <button type="button" className="btn btn--outline btn--sm" onClick={onManual}>
                  <Icon name="edit" size={15} />
                  {t('editor.manualMode')}
                </button>
              )}
            </div>
          )}

          {results.length > 0 && (
            <p className="album-search__provider">
              {t('editor.resultsFrom')}{' '}
              <strong>{provider === 'spotify' ? 'Spotify' : 'MusicBrainz'}</strong>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
