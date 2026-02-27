import { cn, stripXmlTags } from '@/lib/utils';

describe('cn', () => {
  it('merges class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('handles conditional classes', () => {
    const isHidden = false;
    expect(cn('base', isHidden && 'hidden', 'extra')).toBe('base extra');
  });

  it('deduplicates conflicting tailwind classes', () => {
    expect(cn('px-4', 'px-2')).toBe('px-2');
  });

  it('handles undefined and null', () => {
    expect(cn('base', undefined, null, 'end')).toBe('base end');
  });

  it('handles empty call', () => {
    expect(cn()).toBe('');
  });
});

describe('stripXmlTags', () => {
  it('removes <content> blocks', () => {
    expect(stripXmlTags('before <content>lyrics here</content> after')).toBe('before  after');
  });

  it('removes <original_song> blocks', () => {
    expect(stripXmlTags('before <original_song>original</original_song> after')).toBe('before  after');
  });

  it('removes multiline XML blocks', () => {
    const input = 'summary\n<content>\nline1\nline2\n</content>';
    expect(stripXmlTags(input)).toBe('summary');
  });

  it('returns text unchanged when no XML tags present', () => {
    expect(stripXmlTags('plain text')).toBe('plain text');
  });

  it('handles empty string', () => {
    expect(stripXmlTags('')).toBe('');
  });
});
