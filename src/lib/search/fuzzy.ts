/**
 * Fuzzy matching and result ranking for album search.
 *
 * Neither provider ranks the way a person searching for a record expects.
 * Ask MusicBrainz for "brothers in arms" and the Dire Straits album — the one
 * everybody means — comes back eighth, behind six records that merely share
 * the title. Spotify is better but still puts karaoke covers and tribute
 * albums above originals.
 *
 * So the provider decides *which* records match and this module decides what
 * order they go in. It works on whatever both providers already return, needs
 * no index, and is fast enough to run on every keystroke: scoring twenty-four
 * results is a few hundred short string comparisons.
 */

import type { AlbumSummary } from '@/lib/types';

/**
 * Casefolds, strips accents and punctuation, and collapses whitespace.
 *
 * Diacritics go through NFD so "Beyoncé" matches "beyonce", and punctuation
 * is dropped so "AM" matches "A.M." and "Rock & Roll" matches "rock and roll"
 * once the ampersand is spelled out below.
 */
export function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[''`´]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function tokenize(value: string): string[] {
  const normalized = normalize(value);
  return normalized.length > 0 ? normalized.split(' ') : [];
}

/**
 * Optimal string alignment distance — Levenshtein plus transposition, so
 * "radiohaed" is one edit from "radiohead" rather than two. Transposing
 * adjacent letters is the typo people actually make, and charging it double
 * pushes real matches under the threshold.
 *
 * Abandoned as soon as it cannot come in at or under `max`. That bound is
 * what makes this cheap enough to run per keystroke: a 2-character budget
 * means most pairs bail after one row.
 */
export function editDistance(a: string, b: string, max: number): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  // Three rows, because a transposition reaches back two.
  let beforePrevious = new Array<number>(b.length + 1).fill(0);
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  let current = new Array<number>(b.length + 1).fill(0);

  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i;
    let rowBest = i;

    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let best = Math.min(
        (previous[j - 1] ?? 0) + cost, // substitute
        (previous[j] ?? 0) + 1, // delete
        (current[j - 1] ?? 0) + 1, // insert
      );

      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        best = Math.min(best, (beforePrevious[j - 2] ?? 0) + 1);
      }

      current[j] = best;
      if (best < rowBest) rowBest = best;
    }

    // Every later row is at least this large, so nothing can rescue the score.
    if (rowBest > max) return max + 1;

    const recycled = beforePrevious;
    beforePrevious = previous;
    previous = current;
    current = recycled;
  }

  return previous[b.length] ?? max + 1;
}

/** How much of a typo to forgive: none in short words, more as they grow. */
function distanceBudget(length: number): number {
  if (length <= 3) return 0;
  if (length <= 5) return 1;
  if (length <= 9) return 2;
  return 3;
}

/**
 * Scores one query token against one candidate token, 0 (no match) to 1
 * (identical), preferring exact matches, then prefixes, then near-misses.
 */
export function tokenScore(queryToken: string, candidate: string): number {
  if (queryToken === candidate) return 1;
  // A short query token is treated as something the user is still typing.
  if (candidate.startsWith(queryToken)) return 0.9;
  if (candidate.includes(queryToken) && queryToken.length >= 3) return 0.7;

  const budget = distanceBudget(Math.max(queryToken.length, candidate.length));
  if (budget === 0) return 0;

  const distance = editDistance(queryToken, candidate, budget);
  if (distance > budget) return 0;
  // One typo in a long word costs less than one typo in a short word.
  return Math.max(0, 0.85 - distance / (budget + 1));
}

/** Best score for a query token anywhere in a field. */
function fieldScore(queryToken: string, fieldTokens: string[]): number {
  let best = 0;
  for (const token of fieldTokens) {
    const score = tokenScore(queryToken, token);
    if (score > best) best = score;
    if (best === 1) break;
  }
  return best;
}

/** Splits "dire straits - brothers in arms" into its two halves, if written that way. */
function splitPair(query: string): [string, string] | null {
  const match = query.match(/^(.{2,})\s+(?:[-–—:|]|by)\s+(.{2,})$/i);
  if (!match?.[1] || !match[2]) return null;
  return [match[1].trim(), match[2].trim()];
}

/**
 * Records that answer the query textually but are not what anyone means by it.
 * Spotify's results for "dire straits brothers in arms" include a karaoke
 * backing track and a tribute band's covers album; word-overlap scoring rates
 * both highly, because textually they do match.
 *
 * Penalties, not filters — someone who genuinely wants the karaoke version
 * can still find it, and will have typed "karaoke", which cancels this out.
 */
const NOISE_MARKERS: Array<{ pattern: RegExp; penalty: number }> = [
  // Unambiguous: no original release describes itself this way.
  {
    pattern:
      /\b(originally performed by|made famous by|made popular by|in the style of|tribute to)\b/,
    penalty: 0.5,
  },
  { pattern: /\b(karaoke|backing track)\b/, penalty: 0.35 },
  { pattern: /\b(instrumental version|cover version|covers of)\b/, penalty: 0.2 },
];

function noisePenalty(normalizedTitle: string, normalizedQuery: string): number {
  let penalty = 0;
  for (const marker of NOISE_MARKERS) {
    // Asking for it cancels the penalty for it.
    if (marker.pattern.test(normalizedTitle) && !marker.pattern.test(normalizedQuery)) {
      penalty += marker.penalty;
    }
  }
  return penalty;
}

export interface ScoredResult<T> {
  item: T;
  score: number;
}

interface Fields {
  title: string;
  artist: string;
  /**
   * The song title that made this album match, when it wasn't the album's own
   * title — scored alongside it, since that's the text that actually answered
   * the query.
   */
  matchedTrack?: string;
}

/**
 * Scores one candidate, 0 to roughly 1.4.
 *
 * The signals, in rough order of weight: how much of the query is accounted
 * for, whether the whole query is the whole title, and how much extra title
 * there is beyond what was asked for — which is what demotes "Brothers in
 * Arms: The Videosingles" below "Brothers in Arms".
 */
export function scoreCandidate(query: string, fields: Fields): number {
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return 0;

  const titleTokens = tokenize(fields.title);
  const artistTokens = tokenize(fields.artist);
  const trackTokens = tokenize(fields.matchedTrack ?? '');
  if (titleTokens.length === 0 && artistTokens.length === 0 && trackTokens.length === 0) return 0;

  let titleHits = 0;
  let artistHits = 0;

  for (const token of queryTokens) {
    // Whichever of the album's own title or its matched song answers the
    // query best — a track-matched album's title is often unrelated text.
    const inTitle = Math.max(fieldScore(token, titleTokens), fieldScore(token, trackTokens));
    const inArtist = fieldScore(token, artistTokens);
    // The title carries the query; the artist confirms it.
    titleHits += inTitle;
    artistHits += Math.max(0, inArtist - inTitle);
  }

  const coverage = (titleHits + artistHits * 0.8) / queryTokens.length;
  if (coverage < 0.34) return 0;

  let score = coverage;

  const normalizedQuery = normalize(query);
  const normalizedTitle = normalize(fields.title);
  const normalizedTrack = normalize(fields.matchedTrack ?? '');

  // "brothers in arms" typed in full, and that is exactly the record's name —
  // or, for a track match, exactly the song that put this album in the list.
  if (
    normalizedTitle === normalizedQuery ||
    (normalizedTrack && normalizedTrack === normalizedQuery)
  ) {
    score += 0.35;
  } else if (
    normalizedTitle.startsWith(normalizedQuery) ||
    (normalizedTrack && normalizedTrack.startsWith(normalizedQuery))
  ) {
    score += 0.12;
  }

  // Words in the title that answer nothing in the query are noise: deluxe
  // editions, "(Remastered)", "The Videosingles". Counted against the title
  // rather than against the query length, because a query that also names the
  // artist is longer without the title being any less padded. Mild and
  // capped, so a long-titled record can still win on a strong match.
  let unmatchedTitleWords = 0;
  for (const token of titleTokens) {
    if (fieldScore(token, queryTokens) < 0.5) unmatchedTitleWords += 1;
  }
  score -= Math.min(0.3, unmatchedTitleWords * 0.06);
  score -= noisePenalty(normalizedTitle, normalizedQuery);

  // A query naming both halves ranks a record that satisfies both above one
  // that only matches the title.
  const pair = splitPair(query);
  if (pair) {
    const [left, right] = pair;
    const forward = matchesPair(left, right, titleTokens, artistTokens);
    const reverse = matchesPair(right, left, titleTokens, artistTokens);
    if (Math.max(forward, reverse) > 0.7) score += 0.3;
  } else if (artistHits > 0 && titleHits > 0) {
    score += 0.08;
  }

  return Math.max(0, score);
}

function matchesPair(
  artistPart: string,
  titlePart: string,
  titleTokens: string[],
  artistTokens: string[],
): number {
  const artistTokensQuery = tokenize(artistPart);
  const titleTokensQuery = tokenize(titlePart);
  if (artistTokensQuery.length === 0 || titleTokensQuery.length === 0) return 0;

  const artistScore =
    artistTokensQuery.reduce((sum, token) => sum + fieldScore(token, artistTokens), 0) /
    artistTokensQuery.length;
  const titleScore =
    titleTokensQuery.reduce((sum, token) => sum + fieldScore(token, titleTokens), 0) /
    titleTokensQuery.length;

  return Math.min(artistScore, titleScore);
}

/** Results scoring below this are noise and are dropped rather than shown last. */
const SCORE_FLOOR = 0.34;

export interface RankOptions {
  /** Cap on results returned. */
  limit?: number;
  /**
   * Return nothing rather than falling back to the given order when no result
   * scores. Set it when the input is a guess — cached results for a shorter
   * query, say — where nothing vouches for the list answering this query.
   * Leave it off for a provider response, which matched the query somehow even
   * if on an alias the scorer cannot see.
   */
  strict?: boolean;
}

/**
 * Re-ranks provider results by how well they answer the query.
 *
 * Ties are broken by track count then release date: given two records that
 * match equally well, the full album beats the two-track single, and the
 * original pressing beats a later reissue.
 */
export function rankAlbums(
  query: string,
  results: readonly AlbumSummary[],
  options: RankOptions = {},
): AlbumSummary[] {
  const trimmed = query.trim();
  if (trimmed.length === 0) return [...results];

  const scored: Array<ScoredResult<AlbumSummary> & { index: number }> = [];

  results.forEach((item, index) => {
    const score = scoreCandidate(trimmed, {
      title: item.title,
      artist: item.artist,
      matchedTrack: item.matchedTrack,
    });
    if (score >= SCORE_FLOOR) scored.push({ item, score, index });
  });

  // A query that matches nothing well is more likely our scoring being too
  // strict than the provider being wrong, so fall back to what it sent —
  // unless the caller says the list is only a guess.
  if (scored.length === 0) {
    if (options.strict) return [];
    return options.limit ? results.slice(0, options.limit) : [...results];
  }

  scored.sort((a, b) => {
    if (Math.abs(b.score - a.score) > 0.02) return b.score - a.score;
    if (b.item.totalTracks !== a.item.totalTracks) return b.item.totalTracks - a.item.totalTracks;
    const yearA = Number(a.item.releaseDate.slice(0, 4)) || Number.MAX_SAFE_INTEGER;
    const yearB = Number(b.item.releaseDate.slice(0, 4)) || Number.MAX_SAFE_INTEGER;
    if (yearA !== yearB) return yearA - yearB;
    // Provider order settles anything still level, so ranking stays stable.
    return a.index - b.index;
  });

  const ordered = scored.map((entry) => entry.item);
  return options.limit ? ordered.slice(0, options.limit) : ordered;
}
