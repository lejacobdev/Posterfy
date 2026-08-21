import { describe, expect, it } from 'vitest';
import type { AlbumSummary } from '@/lib/types';
import { editDistance, normalize, rankAlbums, scoreCandidate, tokenize } from './fuzzy';

function album(title: string, artist: string, extra: Partial<AlbumSummary> = {}): AlbumSummary {
  return {
    id: `${title}-${artist}`,
    source: 'musicbrainz',
    title,
    artist,
    releaseDate: '2000-01-01',
    coverUrl: null,
    totalTracks: 10,
    ...extra,
  };
}

describe('normalize', () => {
  it('casefolds and strips punctuation', () => {
    expect(normalize('A.M.')).toBe('a m');
    expect(normalize('  Brothers   In   Arms!  ')).toBe('brothers in arms');
  });

  it('strips accents so unaccented typing still matches', () => {
    expect(normalize('Beyoncé')).toBe('beyonce');
    expect(normalize('Sigur Rós')).toBe('sigur ros');
  });

  it('spells out an ampersand', () => {
    expect(normalize('Rock & Roll')).toBe('rock and roll');
  });

  it('drops apostrophes rather than splitting on them', () => {
    expect(normalize("Sgt. Pepper's")).toBe('sgt peppers');
  });

  it('returns no tokens for punctuation alone', () => {
    expect(tokenize('!!!')).toEqual([]);
  });
});

describe('editDistance', () => {
  it('counts single-character edits', () => {
    expect(editDistance('kitten', 'sitting', 3)).toBe(3);
    expect(editDistance('abc', 'abc', 2)).toBe(0);
  });

  it('gives up past the budget instead of computing the true distance', () => {
    // Only the "over budget" fact matters, so any value above max is correct.
    expect(editDistance('abcdefgh', 'zzzzzzzz', 2)).toBeGreaterThan(2);
  });

  it('handles an empty side', () => {
    expect(editDistance('', 'abc', 5)).toBe(3);
    expect(editDistance('abc', '', 5)).toBe(3);
  });
});

describe('scoreCandidate', () => {
  it('scores an exact title above a partial one', () => {
    const exact = scoreCandidate('brothers in arms', {
      title: 'Brothers in Arms',
      artist: 'Dire Straits',
    });
    const extended = scoreCandidate('brothers in arms', {
      title: 'Brothers in Arms: The Videosingles',
      artist: 'Dire Straits',
    });
    expect(exact).toBeGreaterThan(extended);
  });

  it('forgives a typo in a long word', () => {
    expect(
      scoreCandidate('radiohaed', { title: 'OK Computer', artist: 'Radiohead' }),
    ).toBeGreaterThan(0);
  });

  it('does not forgive a typo in a very short word', () => {
    // Otherwise every three-letter word matches every other one.
    expect(scoreCandidate('cat', { title: 'Bat', artist: 'Someone' })).toBe(0);
  });

  it('matches a prefix while the user is still typing', () => {
    expect(
      scoreCandidate('brot', { title: 'Brothers in Arms', artist: 'Dire Straits' }),
    ).toBeGreaterThan(0);
  });

  it('scores nothing for an unrelated record', () => {
    expect(
      scoreCandidate('brothers in arms', { title: 'Thriller', artist: 'Michael Jackson' }),
    ).toBe(0);
  });

  it('rewards a query that names both the artist and the album', () => {
    const both = scoreCandidate('dire straits - brothers in arms', {
      title: 'Brothers in Arms',
      artist: 'Dire Straits',
    });
    const wrongArtist = scoreCandidate('dire straits - brothers in arms', {
      title: 'Brothers in Arms',
      artist: 'Joan Baez',
    });
    expect(both).toBeGreaterThan(wrongArtist);
  });

  it('scores a matched track title even when the album title is unrelated', () => {
    // A song search surfaces the album that contains it, whose own title
    // usually shares no words with the query at all.
    const noTrack = scoreCandidate('walk of life', {
      title: 'Brothers in Arms',
      artist: 'Dire Straits',
    });
    const withTrack = scoreCandidate('walk of life', {
      title: 'Brothers in Arms',
      artist: 'Dire Straits',
      matchedTrack: 'Walk of Life',
    });
    expect(noTrack).toBe(0);
    expect(withTrack).toBeGreaterThan(0);
  });

  it('reads the pair in either order', () => {
    const titleFirst = scoreCandidate('brothers in arms - dire straits', {
      title: 'Brothers in Arms',
      artist: 'Dire Straits',
    });
    expect(titleFirst).toBeGreaterThan(1);
  });
});

describe('noise markers', () => {
  it('demotes a karaoke backing track below the record it imitates', () => {
    const real = scoreCandidate('brothers in arms', {
      title: 'Brothers in Arms',
      artist: 'Dire Straits',
    });
    const karaoke = scoreCandidate('brothers in arms', {
      title: 'Brothers In Arms : Originally Performed By Dire Straits Karaoke Verison',
      artist: '\uCF54\uCF00',
    });
    expect(karaoke).toBeLessThan(real);
  });

  it('stops penalising once the user asks for karaoke', () => {
    const fields = { title: 'Brothers In Arms (Karaoke Version)', artist: 'Some Label' };
    expect(scoreCandidate('brothers in arms karaoke', fields)).toBeGreaterThan(
      scoreCandidate('brothers in arms', fields),
    );
  });

  it('leaves an ordinary record untouched', () => {
    // The penalty must not fire on words that merely look adjacent.
    expect(
      scoreCandidate('in rainbows', { title: 'In Rainbows', artist: 'Radiohead' }),
    ).toBeGreaterThan(1);
  });
});

describe('rankAlbums', () => {
  /**
   * What production actually returned for this query, in the order it came
   * back: MusicBrainz put the Dire Straits record eighth of twelve.
   */
  const LIVE_RESULTS: AlbumSummary[] = [
    album('Brothers in Arms', 'De/Vision', { releaseDate: '2014-03-13', totalTracks: 0 }),
    album('Brothers In Arms', 'Mulligan (MI)', { releaseDate: '2023-11-17', totalTracks: 0 }),
    album('Brothers in Arms', 'Joan Baez', { releaseDate: '1991-09', totalTracks: 0 }),
    album('Brothers in Arms', 'Your Demise', { releaseDate: '2012-03-19', totalTracks: 0 }),
    album('Brothers In Arms', 'Brian Tarquin', { releaseDate: '2023-02-03', totalTracks: 0 }),
    album('Brothers in Arms', 'Sunstorm', { releaseDate: '2022-08-05', totalTracks: 0 }),
    album('Brothers In Arms', 'Devil In Me', { releaseDate: '2007', totalTracks: 0 }),
    album('Brothers in Arms', 'Dire Straits', { releaseDate: '1985-05-15', totalTracks: 0 }),
    album('Brothers in Arms', 'Dreamfield', { releaseDate: '2025-04-23', totalTracks: 0 }),
    album('Brothers In Arms E.P.', 'Axel Karakasis', { releaseDate: '2007-06', totalTracks: 0 }),
    album('Brothers in Arms: The Videosingles', 'Dire Straits', {
      releaseDate: '1986',
      totalTracks: 0,
    }),
    album('Brothers in Arms: Rock Classics', 'Various Artists', {
      releaseDate: '2020-05-01',
      totalTracks: 0,
    }),
  ];

  it('drops the reissues and compilations below the exact titles', () => {
    const ranked = rankAlbums('brothers in arms', LIVE_RESULTS);
    const titles = ranked.map((item) => item.title);
    expect(titles.indexOf('Brothers in Arms')).toBeLessThan(
      titles.indexOf('Brothers in Arms: The Videosingles'),
    );
    expect(titles.indexOf('Brothers in Arms')).toBeLessThan(
      titles.indexOf('Brothers in Arms: Rock Classics'),
    );
  });

  it('puts the record the artist name points at first', () => {
    const ranked = rankAlbums('dire straits brothers in arms', LIVE_RESULTS);
    expect(ranked[0]?.artist).toBe('Dire Straits');
    expect(ranked[0]?.title).toBe('Brothers in Arms');
  });

  it('prefers the earliest release when everything else ties', () => {
    const ranked = rankAlbums('brothers in arms', LIVE_RESULTS);
    // Same title, same track count: the 1985 pressing outranks the 2025 one.
    const years = ranked
      .filter((item) => item.title === 'Brothers in Arms')
      .map((item) => item.releaseDate.slice(0, 4));
    expect(years[0]).toBe('1985');
  });

  it('prefers a full album over a single', () => {
    const ranked = rankAlbums('kid a', [
      album('Kid A', 'Radiohead', { id: 'single', totalTracks: 2 }),
      album('Kid A', 'Radiohead', { id: 'album', totalTracks: 10 }),
    ]);
    expect(ranked[0]?.id).toBe('album');
  });

  it('demotes a compilation even when the query also names the artist', () => {
    // The compilation's title is as long as the query, so a penalty measured
    // against query length would have scored the two identically.
    const ranked = rankAlbums('dire straits brothers in arms', LIVE_RESULTS);
    const titles = ranked.map((item) => item.title);
    expect(titles.indexOf('Brothers in Arms')).toBeLessThan(
      titles.indexOf('Brothers in Arms: The Videosingles'),
    );
  });

  it('honours the limit', () => {
    expect(rankAlbums('brothers in arms', LIVE_RESULTS, { limit: 3 })).toHaveLength(3);
  });

  it('survives a typo', () => {
    const ranked = rankAlbums('brothrs in arms', LIVE_RESULTS);
    expect(ranked.length).toBeGreaterThan(0);
  });

  it('falls back to provider order when it can rank nothing', () => {
    // The provider matched on something the scorer cannot see (an alias, a
    // track name); showing its results beats showing an empty list.
    const results = [album('Thriller', 'Michael Jackson'), album('Bad', 'Michael Jackson')];
    expect(rankAlbums('zzzzzzzzzz', results)).toHaveLength(2);
  });

  it('leaves an empty query alone', () => {
    expect(rankAlbums('   ', LIVE_RESULTS)).toHaveLength(LIVE_RESULTS.length);
  });

  it('returns nothing for no results', () => {
    expect(rankAlbums('anything', [])).toEqual([]);
  });

  it('keeps a song match even under strict mode, where nothing else would save it', () => {
    // Strict mode returns [] rather than falling back to provider order, so
    // this only passes if the track match itself clears the score floor —
    // not because of the "show something anyway" safety net.
    const ranked = rankAlbums(
      'walk of life',
      [album('Brothers in Arms', 'Dire Straits', { matchedTrack: 'Walk of Life' })],
      { strict: true },
    );
    expect(ranked).toHaveLength(1);
  });
});
