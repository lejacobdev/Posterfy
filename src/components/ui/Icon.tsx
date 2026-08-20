/**
 * Inline SVG icon set.
 *
 * Everything is drawn on a 24×24 grid with `currentColor` strokes, so icons
 * inherit text colour and scale with font size. Keeping them inline avoids an
 * icon-font dependency and an extra network request.
 */

import type { SVGProps } from 'react';

export type IconName =
  | 'search'
  | 'close'
  | 'menu'
  | 'chevronDown'
  | 'chevronUp'
  | 'chevronLeft'
  | 'chevronRight'
  | 'arrowRight'
  | 'arrowUp'
  | 'download'
  | 'share'
  | 'copy'
  | 'edit'
  | 'check'
  | 'checkCircle'
  | 'undo'
  | 'redo'
  | 'image'
  | 'upload'
  | 'trash'
  | 'settings'
  | 'sliders'
  | 'sun'
  | 'moon'
  | 'monitor'
  | 'globe'
  | 'sparkles'
  | 'palette'
  | 'type'
  | 'layout'
  | 'grid'
  | 'layers'
  | 'music'
  | 'disc'
  | 'spotify'
  | 'externalLink'
  | 'info'
  | 'alert'
  | 'plus'
  | 'minus'
  | 'github'
  | 'heart'
  | 'star'
  | 'zoomIn'
  | 'zoomOut'
  | 'maximize'
  | 'eye'
  | 'eyeOff'
  | 'refresh'
  | 'printer'
  | 'frame'
  | 'wand'
  | 'calendar'
  | 'clock'
  | 'tag'
  | 'smartphone'
  | 'lock'
  | 'code'
  | 'list'
  | 'droplet'
  | 'crop'
  | 'shield';

/** Path data only — the wrapper supplies size, stroke and accessibility. */
const PATHS: Record<IconName, string> = {
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14ZM20 20l-4-4',
  close: 'M6 6l12 12M18 6 6 18',
  menu: 'M4 7h16M4 12h16M4 17h16',
  chevronDown: 'm6 9 6 6 6-6',
  chevronUp: 'm6 15 6-6 6 6',
  chevronLeft: 'm15 6-6 6 6 6',
  chevronRight: 'm9 6 6 6-6 6',
  arrowRight: 'M4 12h16m-6-6 6 6-6 6',
  arrowUp: 'M12 20V4m-6 6 6-6 6 6',
  download: 'M12 3v12m-5-5 5 5 5-5M4 20h16',
  share: 'M12 3v12M8 7l4-4 4 4M5 13v6a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-6',
  copy: 'M9 9h10v10H9zM5 15H4V4h11v1',
  edit: 'M4 20h4l10-10-4-4L4 16v4Zm10.5-13.5 3 3M14 20h6',
  check: 'm5 13 4 4L19 7',
  checkCircle: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm-4 9 3 3 5-6',
  undo: 'M4 9h11a5 5 0 0 1 0 10h-6M4 9l4-4M4 9l4 4',
  redo: 'M20 9H9a5 5 0 0 0 0 10h6m5-10-4-4m4 4-4 4',
  image: 'M4 5h16v14H4zM4 15l4.5-4.5L14 16m1.5-4L20 16M15 9h.01',
  upload: 'M12 20V8m-5 5 5-5 5 5M4 4h16',
  trash: 'M4 7h16M9 7V5h6v2m-8 0 1 13h8l1-13M10 11v5m4-5v5',
  settings:
    'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm8-3a8 8 0 0 0-.2-1.7l2-1.5-2-3.4-2.3 1a8 8 0 0 0-2.9-1.7L14.2 2H9.8l-.4 2.7a8 8 0 0 0-3 1.7l-2.2-1-2 3.4 2 1.5a8 8 0 0 0 0 3.4l-2 1.5 2 3.4 2.3-1a8 8 0 0 0 2.9 1.7l.4 2.7h4.4l.4-2.7a8 8 0 0 0 2.9-1.7l2.3 1 2-3.4-2-1.5c.1-.6.2-1.1.2-1.7Z',
  sliders: 'M4 8h10m4 0h2M4 16h4m4 0h8M15 5v6M9 13v6',
  sun: 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10ZM12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  moon: 'M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z',
  monitor: 'M4 5h16v11H4zM9 20h6m-3-4v4',
  globe:
    'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 0c-3 3-3 15 0 18m0-18c3 3 3 15 0 18M3.5 9h17m-17 6h17',
  sparkles:
    'm12 3 1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8L12 3ZM18.5 15l.9 2.3 2.3.9-2.3.9-.9 2.3-.9-2.3-2.3-.9 2.3-.9.9-2.3Z',
  palette:
    'M12 3a9 9 0 0 0 0 18c1.1 0 2-.9 2-2 0-.5-.2-1-.6-1.4-.3-.4-.4-.8-.4-1.1 0-.8.7-1.5 1.5-1.5H16a5 5 0 0 0 5-5c0-3.9-4-7-9-7Zm-4.5 8a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm3-3.5a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm5 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z',
  type: 'M4 6V4h16v2M12 4v16M9 20h6',
  layout: 'M4 5h16v14H4zM4 10h16M10 10v9',
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  layers: 'm12 3 8 4.5-8 4.5-8-4.5L12 3Zm8 9-8 4.5L4 12m16 4.5L12 21l-8-4.5',
  music: 'M9 18V6l11-2v12M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm11-2a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
  disc: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 6a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z',
  spotify:
    'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm4.2 13a.7.7 0 0 1-1 .2c-2.6-1.6-5.9-2-9.8-1.1a.7.7 0 1 1-.3-1.4c4.2-1 7.9-.5 10.8 1.3.3.2.4.7.3 1Zm1.3-2.9a.9.9 0 0 1-1.2.3c-3-1.8-7.5-2.3-11-1.3a.9.9 0 1 1-.5-1.7c4-1.2 9-.6 12.4 1.5.4.2.6.8.3 1.2Zm.1-3c-3.6-2.1-9.5-2.3-12.9-1.3a1 1 0 1 1-.6-2c3.9-1.2 10.4-1 14.5 1.5a1 1 0 1 1-1 1.8Z',
  externalLink: 'M14 4h6v6M20 4l-8 8M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5',
  info: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 5h.01M11 12h1v5h1',
  alert: 'M12 4 2.5 20h19L12 4Zm0 6v5m0 3h.01',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  github:
    'M9 19c-4.3 1.3-4.3-2.2-6-2.6m12 5v-3.5c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.3 4.3 0 0 0-.1-3.2s-1.1-.3-3.5 1.3a12 12 0 0 0-6.2 0C6.5 3.2 5.4 3.5 5.4 3.5a4.3 4.3 0 0 0-.1 3.2A4.6 4.6 0 0 0 4 9.9c0 4.6 2.7 5.7 5.5 6-.6.6-.6 1.2-.5 2V21',
  heart: 'M12 20s-7-4.4-7-9a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 4.6-7 9-7 9Z',
  star: 'm12 3 2.7 5.6 6.3.9-4.5 4.3 1 6.2-5.5-2.9-5.5 2.9 1-6.2L3 9.5l6.3-.9L12 3Z',
  zoomIn: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14ZM20 20l-4-4M8 11h6m-3-3v6',
  zoomOut: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14ZM20 20l-4-4M8 11h6',
  maximize: 'M4 9V4h5M20 9V4h-5M4 15v5h5m11-5v5h-5',
  eye: 'M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Zm10 2.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
  eyeOff:
    'M4 4l16 16M9.9 5.3A9.6 9.6 0 0 1 12 5c6.5 0 10 6 10 6a15 15 0 0 1-3.3 3.9M6.3 8.1A15 15 0 0 0 2 11s3.5 6 10 6c1 0 1.9-.1 2.7-.4M10.5 10a2.5 2.5 0 0 0 3.3 3.4',
  refresh: 'M20 11a8 8 0 1 0-.7 4.5M20 5v6h-6',
  printer:
    'M7 9V4h10v5M7 19H5a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-2M7 15h10v5H7z',
  frame: 'M4 8h16M4 16h16M8 4v16M16 4v16',
  wand: 'm4 20 10-10M15 5l1 2 2 1-2 1-1 2-1-2-2-1 2-1 1-2Zm5 6 .6 1.4L22 13l-1.4.6L20 15l-.6-1.4L18 13l1.4-.6L20 11Z',
  calendar: 'M4 6h16v14H4zM4 10h16M9 3v4m6-4v4',
  clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 4v5l3 2',
  tag: 'M4 4h7l9 9-7 7-9-9V4Zm3.5 4a.5.5 0 1 0 0-1 .5.5 0 0 0 0 1Z',
  smartphone: 'M7 3h10v18H7zM11 18h2',
  lock: 'M5 11h14v9H5zM8 11V8a4 4 0 0 1 8 0v3',
  code: 'm9 8-5 4 5 4m6-8 5 4-5 4M13 4l-2 16',
  list: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
  droplet: 'M12 3s6 6.2 6 10a6 6 0 0 1-12 0c0-3.8 6-10 6-10Z',
  crop: 'M6 2v14a2 2 0 0 0 2 2h14M2 6h14a2 2 0 0 1 2 2v14',
  shield: 'M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6l-8-3Z',
};

/** Icons that read better filled than stroked. */
const FILLED: ReadonlySet<IconName> = new Set(['spotify', 'sparkles', 'palette', 'settings']);

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: IconName;
  size?: number | string;
  /** Provide a label to expose the icon to assistive tech. */
  label?: string;
}

export function Icon({ name, size = 20, label, ...props }: IconProps) {
  const path = PATHS[name];
  const filled = FILLED.has(name);

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill={filled ? 'currentColor' : 'none'}
      stroke={filled ? 'none' : 'currentColor'}
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
      {...props}
    >
      <path d={path} />
    </svg>
  );
}

export const ICON_NAMES = Object.keys(PATHS) as IconName[];
