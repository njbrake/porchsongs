import type { ParseResult } from '@/types';

export interface SampleSong {
  title: string;
  artist: string;
  content: string;
}

export const SAMPLE_SONGS: SampleSong[] = [
  {
    title: 'When the Saints Go Marching In',
    artist: 'Traditional',
    content: `When the Saints Go Marching In
Traditional / Public Domain

Key: G | Tempo: 120 BPM | Time: 4/4

Chords used:
G - 320003
G7 - 320001
C - x32010
D - xx0232
D7 - xx0212

[Verse 1]
G
Oh when the saints go marching in,
                              D
Oh when the saints go marching in,
G                    G7           C
Oh Lord I want to be in that number,
G            D7          G
When the saints go marching in.

[Verse 2]
G
Oh when the sun refuse to shine,
                              D
Oh when the sun refuse to shine,
G                    G7           C
Oh Lord I want to be in that number,
G            D7            G
When the sun refuse to shine.

[Verse 3]
G
Oh when the trumpet sounds its call,
                                  D
Oh when the trumpet sounds its call,
G                    G7           C
Oh Lord I want to be in that number,
G              D7                G
When the trumpet sounds its call.

[Verse 4]
G
Oh when the new world is revealed,
                                  D
Oh when the new world is revealed,
G                    G7           C
Oh Lord I want to be in that number,
G              D7                G
When the new world is revealed.

[Verse 5]
G
Oh when the saints go marching in,
                              D
Oh when the saints go marching in,
G                    G7           C
Oh Lord I want to be in that number,
G            D7          G
When the saints go marching in.`,
  },
];

/** Convert a SampleSong into a ParseResult to skip the parse step. */
export function sampleToParseResult(sample: SampleSong): ParseResult {
  return {
    original_content: sample.content,
    title: sample.title,
    artist: sample.artist,
    reasoning: null,
    usage: null,
  };
}
