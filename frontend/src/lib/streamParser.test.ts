import { StreamParser } from '@/lib/streamParser';

describe('StreamParser', () => {
  it('routes everything to chat when no tags present', () => {
    const parser = new StreamParser();
    const r1 = parser.processToken('Hello ');
    const r2 = parser.processToken('world');
    expect(r1.chatDelta).toBe('Hello ');
    expect(r1.contentDelta).toBe('');
    expect(r2.chatDelta).toBe('world');
    expect(r2.contentDelta).toBe('');
    expect(parser.chatText).toBe('Hello world');
    expect(parser.contentText).toBe('');
    expect(parser.phase).toBe('before');
  });

  it('detects tags within a single token', () => {
    const parser = new StreamParser();
    const r = parser.processToken('<content>\nVerse 1\nLine 2\n</content>Here is the summary');
    expect(r.contentDelta).toBe('Verse 1\nLine 2\n');
    expect(r.chatDelta).toBe('Here is the summary');
    expect(parser.contentText).toBe('Verse 1\nLine 2\n');
    expect(parser.chatText).toBe('Here is the summary');
    expect(parser.phase).toBe('after');
  });

  it('handles open tag split across tokens', () => {
    const parser = new StreamParser();
    const r1 = parser.processToken('<con');
    expect(r1.chatDelta).toBe('');
    expect(r1.contentDelta).toBe('');

    const r2 = parser.processToken('tent>');
    expect(r2.chatDelta).toBe('');
    expect(r2.contentDelta).toBe('');
    expect(parser.phase).toBe('content');
  });

  it('handles close tag split across tokens', () => {
    const parser = new StreamParser();
    parser.processToken('<content>\n');
    expect(parser.phase).toBe('content');

    const r1 = parser.processToken('My content</con');
    expect(r1.contentDelta).toBe('My content');

    const r2 = parser.processToken('tent>');
    expect(r2.contentDelta).toBe('');
    expect(parser.phase).toBe('after');

    const r3 = parser.processToken('Summary');
    expect(r3.chatDelta).toBe('Summary');
  });

  it('strips leading newline after <content> tag', () => {
    const parser = new StreamParser();
    parser.processToken('<content>');
    const r = parser.processToken('\nFirst line');
    expect(r.contentDelta).toBe('First line');
    expect(parser.contentText).toBe('First line');
  });

  it('does not strip non-newline character after <content>', () => {
    const parser = new StreamParser();
    parser.processToken('<content>');
    const r = parser.processToken('First line');
    expect(r.contentDelta).toBe('First line');
    expect(parser.contentText).toBe('First line');
  });

  it('handles text before <content> tag going to chat', () => {
    const parser = new StreamParser();
    const r1 = parser.processToken("Sure, here's the rewrite:\n");
    expect(r1.chatDelta).toBe("Sure, here's the rewrite:\n");

    const r2 = parser.processToken('<content>\nNew verse</content>Done');
    expect(r2.contentDelta).toBe('New verse');
    expect(r2.chatDelta).toBe('Done');
    expect(parser.chatText).toBe("Sure, here's the rewrite:\nDone");
  });

  it('accumulates content across many small tokens', () => {
    const parser = new StreamParser();
    parser.processToken('<content>\n');

    const words = ['Hello', ' ', 'world', '\n', 'Second', ' ', 'line'];
    let allContent = '';
    for (const w of words) {
      const r = parser.processToken(w);
      allContent += r.contentDelta;
    }
    expect(allContent).toBe('Hello world\nSecond line');
    expect(parser.contentText).toBe('Hello world\nSecond line');
  });

  it('handles character-by-character streaming', () => {
    const parser = new StreamParser();
    const full = '<content>\nABC</content>XY';
    let content = '';
    let chat = '';
    for (const ch of full) {
      const r = parser.processToken(ch);
      content += r.contentDelta;
      chat += r.chatDelta;
    }
    expect(content).toBe('ABC');
    expect(chat).toBe('XY');
    expect(parser.phase).toBe('after');
  });

  it('flushes partial tag match that turns out not to be a tag', () => {
    const parser = new StreamParser();
    // "<co" looks like a tag start but "x" breaks it
    const r = parser.processToken('<cox not a tag');
    expect(r.chatDelta).toBe('<cox not a tag');
    expect(parser.phase).toBe('before');
  });

  it('handles < that is not part of a tag in content phase', () => {
    const parser = new StreamParser();
    parser.processToken('<content>\n');

    const r = parser.processToken('A < B');
    expect(r.contentDelta).toBe('A < B');
    expect(parser.contentText).toBe('A < B');
    expect(parser.phase).toBe('content');
  });
});
