/** Sample raw lyrics input (before parsing). */
export const RAW_LYRICS = `Amazing Grace
by John Newton

Amazing grace how sweet the sound
That saved a wretch like me
I once was lost but now am found
Was blind but now I see`;

/** Title extracted by "parse". */
export const PARSED_TITLE = 'Amazing Grace';

/** Artist extracted by "parse". */
export const PARSED_ARTIST = 'John Newton';

/** Content after parse (with chord annotations). */
export const PARSED_CONTENT = `[G]Amazing grace how [C]sweet the sound
That [G]saved a wretch like [Em]me
I [G]once was lost but [C]now am found
Was [D]blind but now I [G]see`;

/** Rewritten content after a chat edit. */
export const REWRITTEN_CONTENT = `[G]Amazing grace how [C]sweet the sound
That [G]saved a soul like [Em]me
I [G]once was lost but [C]now I'm found
Was [D]blind but now I [G]see`;

/** Changes summary from the chat edit. */
export const CHANGES_SUMMARY = 'Changed "wretch" to "soul" and "but now am" to "but now I\'m"';

/** A song object suitable for creating via the API. */
export function makeSongCreatePayload(profileId: number) {
  return {
    profile_id: profileId,
    title: PARSED_TITLE,
    artist: PARSED_ARTIST,
    original_content: PARSED_CONTENT,
    rewritten_content: PARSED_CONTENT,
    changes_summary: null,
    llm_provider: 'openai',
    llm_model: 'gpt-4',
  };
}

/** Second song for library list tests. */
export function makeSecondSongPayload(profileId: number) {
  return {
    profile_id: profileId,
    title: 'Hallelujah',
    artist: 'Leonard Cohen',
    original_content: 'I heard there was a secret chord...',
    rewritten_content: '[C]I heard there was a [Am]secret chord...',
    changes_summary: null,
  };
}
