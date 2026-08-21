import { describe, expect, it } from 'vitest';
import { proxiedUrl, thumbnailUrl } from './cover';

describe('proxiedUrl', () => {
  it('routes a remote image through the API', () => {
    expect(proxiedUrl('https://i.scdn.co/image/abc')).toBe(
      '/api/image?url=https%3A%2F%2Fi.scdn.co%2Fimage%2Fabc',
    );
  });

  it('leaves data, blob and same-origin URLs alone', () => {
    expect(proxiedUrl('data:image/png;base64,AA')).toBe('data:image/png;base64,AA');
    expect(proxiedUrl('blob:http://x/y')).toBe('blob:http://x/y');
    expect(proxiedUrl('/local.png')).toBe('/local.png');
  });
});

describe('thumbnailUrl', () => {
  it('goes straight to Spotify, which is fast and preconnected', () => {
    const url = 'https://i.scdn.co/image/ab67616d00004851abc';
    expect(thumbnailUrl(url)).toBe(url);
  });

  it('covers every Spotify image host', () => {
    for (const host of ['i.scdn.co', 'mosaic.scdn.co', 'open.spotifycdn.com']) {
      const url = `https://${host}/image/abc`;
      expect(thumbnailUrl(url), host).toBe(url);
    }
  });

  it('proxies the Cover Art Archive, which redirects to another host', () => {
    expect(thumbnailUrl('https://coverartarchive.org/release-group/x/front-250')).toContain(
      '/api/image?url=',
    );
  });

  it('leaves local sources alone', () => {
    expect(thumbnailUrl('data:image/png;base64,AA')).toBe('data:image/png;base64,AA');
    expect(thumbnailUrl('/local.png')).toBe('/local.png');
  });

  it('passes through anything it cannot parse', () => {
    expect(thumbnailUrl('not a url')).toBe('not a url');
  });

  it('does not treat a lookalike host as Spotify', () => {
    // "notscdn.co" must not match the "scdn.co" suffix rule.
    const url = 'https://notscdn.co/image/abc';
    expect(thumbnailUrl(url)).toContain('/api/image?url=');
  });
});
