import { lyricsPreview } from './LibraryTab';

describe('lyricsPreview', () => {
  it('returns first two content lines joined by bullet', () => {
    const content = 'First line of lyrics\nSecond line of lyrics\nThird line';
    expect(lyricsPreview(content)).toBe('First line of lyrics \u2022 Second line of lyrics');
  });

  it('skips section headers in brackets', () => {
    const content = '[Verse 1]\nFirst verse line\n[Chorus]\nChorus line';
    expect(lyricsPreview(content)).toBe('First verse line \u2022 Chorus line');
  });

  it('skips blank lines', () => {
    const content = '\n\nActual lyrics\n\nMore lyrics';
    expect(lyricsPreview(content)).toBe('Actual lyrics \u2022 More lyrics');
  });

  it('truncates long previews at 100 chars', () => {
    const longLine = 'A'.repeat(80);
    const content = `${longLine}\n${longLine}`;
    const result = lyricsPreview(content);
    expect(result.length).toBe(101); // 100 chars + ellipsis
    expect(result.endsWith('\u2026')).toBe(true);
  });

  it('returns empty string for empty content', () => {
    expect(lyricsPreview('')).toBe('');
  });

  it('handles single line', () => {
    expect(lyricsPreview('Just one line')).toBe('Just one line');
  });
});
