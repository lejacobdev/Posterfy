import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { PosterSpec, TemplateId } from '@/lib/types';
import { useI18n } from '@/i18n';
import { usePoster } from '@/lib/store/poster';
import { demoAlbum } from '@/lib/demo/demoAlbums';
import { DEFAULT_OPTIONS, STYLE_PRESETS, TEMPLATE_META } from '@/lib/poster/defaults';
import { useStaggeredReveal } from '@/hooks/useReveal';
import { Seo } from '@/components/ui/Seo';
import { Icon } from '@/components/ui/Icon';
import { PosterCanvas } from '@/components/poster/PosterCanvas';
import './GalleryPage.css';

interface GalleryEntry {
  id: string;
  name: string;
  description: string;
  template: TemplateId;
  spec: PosterSpec;
}

export default function GalleryPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { setOptions } = usePoster();
  const gridRef = useStaggeredReveal<HTMLDivElement>(60);

  // Every template, plus every style preset, on the same demo record.
  const entries = useMemo<GalleryEntry[]>(() => {
    const templates: GalleryEntry[] = TEMPLATE_META.map((template, index) => ({
      id: `template-${template.id}`,
      name: template.name,
      description: template.description,
      template: template.id,
      spec: {
        album: demoAlbum(index),
        options: { ...DEFAULT_OPTIONS, template: template.id, palette: [], autoColors: true },
      },
    }));

    const presets: GalleryEntry[] = STYLE_PRESETS.map((preset, index) => ({
      id: `preset-${preset.id}`,
      name: preset.name,
      description: preset.description,
      template: (preset.options.template ?? 'classic') as TemplateId,
      spec: {
        album: demoAlbum(index + 1),
        options: { ...DEFAULT_OPTIONS, ...preset.options, palette: [] },
      },
    }));

    return [...templates, ...presets];
  }, []);

  const use = (entry: GalleryEntry) => {
    setOptions({ ...entry.spec.options, palette: [] });
    navigate('/editor');
  };

  return (
    <>
      <Seo title={t('gallery.title')} description={t('gallery.subtitle')} />

      <div className="container container--wide">
        <header className="page-header">
          <span className="badge page-header__eyebrow">
            <Icon name="grid" size={14} />
            {t('nav.gallery')}
          </span>
          <h1 className="page-header__title">{t('gallery.title')}</h1>
          <p className="page-header__subtitle">{t('gallery.subtitle')}</p>
        </header>

        <div className="gallery-grid reveal" ref={gridRef}>
          {entries.map((entry) => (
            <article className="gallery-card reveal" key={entry.id}>
              <div className="gallery-card__poster">
                <PosterCanvas spec={entry.spec} maxRenderWidth={700} />
              </div>
              <div className="gallery-card__body">
                <h2 className="gallery-card__name">{entry.name}</h2>
                <p className="gallery-card__desc">{entry.description}</p>
                <button
                  type="button"
                  className="btn btn--outline btn--sm"
                  onClick={() => use(entry)}
                >
                  <Icon name="wand" size={15} />
                  {t('gallery.useTemplate')}
                </button>
              </div>
            </article>
          ))}
        </div>

        <p className="gallery-note">
          <Icon name="info" size={15} />
          {t('gallery.demoNotice')}
        </p>
      </div>
    </>
  );
}
