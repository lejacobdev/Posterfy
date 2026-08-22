/** Content controls: artwork, text overrides, visible elements and tracklist. */

import { usePoster } from '@/lib/store/poster';
import { useI18n } from '@/i18n';
import { PanelSection, SegmentedControl, TextField, Toggle } from '@/components/ui/Controls';
import { ArtworkField } from './ArtworkField';
import { TracklistEditor } from './TracklistEditor';

export function ContentPanel() {
  const { t } = useI18n();
  const { album, options, setOption } = usePoster();

  return (
    <div className="editor-panel">
      <PanelSection title={t('editor.sectionArtwork')} icon="image">
        <ArtworkField />
      </PanelSection>

      <PanelSection title={t('editor.sectionDetails')} icon="type">
        <TextField
          label={t('editor.titleOverride')}
          value={options.titleOverride}
          placeholder={album.title || '—'}
          maxLength={90}
          onChange={(value) => setOption('titleOverride', value)}
        />
        <TextField
          label={t('editor.artistOverride')}
          value={options.artistOverride}
          placeholder={album.artist || '—'}
          maxLength={60}
          onChange={(value) => setOption('artistOverride', value)}
        />
        <TextField
          label={t('editor.customNote')}
          value={options.customNote}
          placeholder={t('editor.customNotePlaceholder')}
          maxLength={80}
          onChange={(value) => setOption('customNote', value)}
        />
      </PanelSection>

      <PanelSection title={t('editor.sectionElements')} icon="eye">
        <Toggle
          checked={options.showTracklist}
          onChange={(value) => setOption('showTracklist', value)}
          label={t('editor.showTracklist')}
          icon="list"
        />
        <Toggle
          checked={options.showTrackNumbers}
          onChange={(value) => setOption('showTrackNumbers', value)}
          label={t('editor.showTrackNumbers')}
          disabled={!options.showTracklist}
        />
        <SegmentedControl<'auto' | '1' | '2' | '3'>
          label={t('editor.tracklistColumns')}
          value={
            options.tracklistColumns === 'auto'
              ? 'auto'
              : (String(options.tracklistColumns) as '1' | '2' | '3')
          }
          options={[
            { value: 'auto', label: t('editor.columnsAuto') },
            { value: '1', label: '1' },
            { value: '2', label: '2' },
            { value: '3', label: '3' },
          ]}
          onChange={(value) =>
            setOption('tracklistColumns', value === 'auto' ? 'auto' : (Number(value) as 1 | 2 | 3))
          }
        />
        <hr className="divider" />
        <Toggle
          checked={options.showReleaseDate}
          onChange={(value) => setOption('showReleaseDate', value)}
          label={t('editor.showReleaseDate')}
          icon="calendar"
        />
        <Toggle
          checked={options.showDuration}
          onChange={(value) => setOption('showDuration', value)}
          label={t('editor.showDuration')}
          icon="clock"
        />
        <Toggle
          checked={options.showGenres}
          onChange={(value) => setOption('showGenres', value)}
          label={t('editor.showGenres')}
          icon="tag"
        />
        <Toggle
          checked={options.showLabel}
          onChange={(value) => setOption('showLabel', value)}
          label={t('editor.showLabel')}
          icon="disc"
        />
        <Toggle
          checked={options.showScanCode}
          onChange={(value) => setOption('showScanCode', value)}
          label={t('editor.showScanCode')}
          icon="spotify"
        />
      </PanelSection>

      <PanelSection
        title={t('editor.sectionTracks')}
        icon="list"
        defaultOpen={false}
        badge={t('editor.tracksCount', { count: album.tracks.length })}
      >
        <TracklistEditor />
      </PanelSection>
    </div>
  );
}
