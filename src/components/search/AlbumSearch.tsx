/**
 * Live album search.
 *
 * Types-as-you-go with a debounce, cancels in-flight requests, supports full
 * keyboard navigation, and understands a pasted Spotify or MusicBrainz link.
 */

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { Album, AlbumSummary, ProviderId } from '@/lib/types';
import { getAlbum, getAlbumFromLink, looksLikeAlbumLink, searchAlbums } from '@/lib/api/provider';
import { rankAlbums } from '@/lib/search/fuzzy';
import { isAbortError } from '@/lib/api/client';
import { detectMarket } from '@/i18n/detect';
import { useI18n } from '@/i18n';
import { useOnlineStatus } from '@/hooks/useMediaQuery';
import { releaseYear } from '@/lib/utils/format';
import { cn } from '@/lib/utils/misc';
import { Icon } from '@/components/ui/Icon';
import './AlbumSearch.css';

export interface AlbumSearchProps {
  onSelect: (album: Album) => void;
  onManual?: () => void;
  autoFocus?: boolean;
  placeholder?: string;
}

const DEBOUNCE_MS = 320;
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

  const abortRef = useRef<AbortController | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const market = useRef<string | undefined>(detectMarket());

  const isLink = looksLikeAlbumLink(query);

  // Debounced search. Every run cancels the previous request.
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < MIN_QUERY || isLink) {
      setResults([]);
      setLoading(false);
      return undefined;
    }

    const timer = setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setLoading(true);
      setError(null);
      try {
        const response = await searchAlbums(trimmed, {
          signal: controller.signal,
          // Over-fetch so the ranker has something to choose from: the record
          // the user means is often outside the provider's own top few.
          limit: FETCH_LIMIT,
          market: market.current,
        });
        setResults(rankAlbums(trimmed, response.items, { limit: SHOWN_LIMIT }));
        setProvider(response.provider);
        setActiveIndex(-1);
        setOpen(true);
      } catch (searchError) {
        if (isAbortError(searchError)) return;
        setError(online ? t('errors.searchFailed') : t('errors.offline'));
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [query, isLink, online, t]);

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
      setLoadingId(summary.id);
      setError(null);
      try {
        const album = await getAlbum(summary, { market: market.current });
        onSelect(album);
        setOpen(false);
        setQuery('');
        setResults([]);
      } catch {
        setError(t('errors.albumFailed'));
      } finally {
        setLoadingId(null);
      }
    },
    [onSelect, t],
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

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      if (isLink) {
        void loadLink();
        return;
      }
      const target = results[activeIndex] ?? results[0];
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
      <div className={cn('album-search__field glass', showResults && 'is-open')}>
        <Icon name="search" size={20} className="album-search__icon" />
        <input
          ref={inputRef}
          type="search"
          className="album-search__input"
          value={query}
          placeholder={placeholder ?? t('editor.searchPlaceholder')}
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
                  <img src={result.coverUrl} alt="" loading="lazy" decoding="async" />
                ) : (
                  <Icon name="disc" size={20} />
                )}
              </span>
              <span className="album-result__text">
                <span className="album-result__title">{result.title}</span>
                <span className="album-result__meta">
                  {result.artist}
                  {result.releaseDate && ` · ${releaseYear(result.releaseDate)}`}
                  {result.totalTracks > 0 && ` · ${result.totalTracks}`}
                </span>
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
              <p>{t('editor.noResults')}</p>
              {onManual && (
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
