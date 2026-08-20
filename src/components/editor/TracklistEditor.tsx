/**
 * Manual tracklist editing: rename, reorder, retime, add and remove tracks.
 * Works for albums pulled from a provider as well as hand-built posters.
 */

import { usePoster } from '@/lib/store/poster';
import { useI18n } from '@/i18n';
import type { Track } from '@/lib/types';
import { formatTrackDuration } from '@/lib/utils/format';
import { Icon } from '@/components/ui/Icon';

/** Accepts `3:42`, `342`, `222` (seconds) — whatever the user types. */
function parseDuration(input: string): number {
  const value = input.trim();
  if (!value) return 0;
  const parts = value.split(':');
  if (parts.length === 2) {
    const minutes = Number(parts[0]) || 0;
    const seconds = Number(parts[1]) || 0;
    return (minutes * 60 + seconds) * 1000;
  }
  const seconds = Number(value);
  return Number.isFinite(seconds) ? seconds * 1000 : 0;
}

function renumber(tracks: Track[]): Track[] {
  return tracks.map((track, index) => ({ ...track, position: index + 1 }));
}

export function TracklistEditor() {
  const { t } = useI18n();
  const { album, setTracks } = usePoster();
  const tracks = album.tracks;

  const update = (index: number, patch: Partial<Track>) => {
    setTracks(tracks.map((track, i) => (i === index ? { ...track, ...patch } : track)));
  };

  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= tracks.length) return;
    const next = [...tracks];
    const [moved] = next.splice(index, 1);
    if (moved) next.splice(target, 0, moved);
    setTracks(renumber(next));
  };

  const remove = (index: number) => {
    setTracks(renumber(tracks.filter((_, i) => i !== index)));
  };

  const add = () => {
    setTracks(renumber([...tracks, { position: tracks.length + 1, title: '', durationMs: 0 }]));
  };

  return (
    <div className="tracklist-editor">
      {tracks.length === 0 && <p className="field__hint">{t('editor.noTracks')}</p>}

      <ol className="tracklist-editor__list">
        {tracks.map((track, index) => (
          <li className="track-row" key={`${index}-${track.position}`}>
            <span className="track-row__number">{index + 1}</span>
            <input
              type="text"
              className="input track-row__title"
              value={track.title}
              placeholder={t('editor.trackTitle')}
              aria-label={`${t('editor.trackTitle')} ${index + 1}`}
              onChange={(event) => update(index, { title: event.target.value })}
            />
            <input
              type="text"
              className="input track-row__duration"
              defaultValue={track.durationMs ? formatTrackDuration(track.durationMs) : ''}
              placeholder="0:00"
              inputMode="numeric"
              aria-label={`${t('editor.trackDuration')} ${index + 1}`}
              onBlur={(event) => update(index, { durationMs: parseDuration(event.target.value) })}
            />
            <span className="track-row__actions">
              <button
                type="button"
                className="icon-btn"
                aria-label={t('editor.moveUp')}
                disabled={index === 0}
                onClick={() => move(index, -1)}
              >
                <Icon name="chevronUp" size={16} />
              </button>
              <button
                type="button"
                className="icon-btn"
                aria-label={t('editor.moveDown')}
                disabled={index === tracks.length - 1}
                onClick={() => move(index, 1)}
              >
                <Icon name="chevronDown" size={16} />
              </button>
              <button
                type="button"
                className="icon-btn icon-btn--danger"
                aria-label={t('editor.removeTrack')}
                onClick={() => remove(index)}
              >
                <Icon name="trash" size={16} />
              </button>
            </span>
          </li>
        ))}
      </ol>

      <button type="button" className="btn btn--outline btn--block" onClick={add}>
        <Icon name="plus" size={16} />
        {t('editor.addTrack')}
      </button>
    </div>
  );
}
