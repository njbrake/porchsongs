/**
 * Character-by-character stream parser that separates <content> content,
 * <original_song> content, and chat text across arbitrary token boundaries.
 *
 * Phases: before → content → between → original_song → after
 *  - before: accumulate into chatText until <content> or <original_song> detected
 *  - content: accumulate into contentText until </content> detected
 *  - between: accumulate into chatText until <original_song> detected (or end)
 *  - original_song: accumulate into originalSongText until </original_song> detected
 *  - after:  accumulate into chatText
 */

const OPEN_TAG = '<content>';
const CLOSE_TAG = '</content>';
const ORIG_OPEN_TAG = '<original_song>';
const ORIG_CLOSE_TAG = '</original_song>';

export type Phase = 'before' | 'content' | 'between' | 'original_song' | 'after';

export interface TokenResult {
  chatDelta: string;
  contentDelta: string;
  originalSongDelta: string;
}

export class StreamParser {
  phase: Phase = 'before';
  contentText = '';
  chatText = '';
  originalSongText = '';

  private tagBuffer = '';
  private strippedLeadingNewline = false;

  processToken(token: string): TokenResult {
    let chatDelta = '';
    let contentDelta = '';
    let originalSongDelta = '';

    for (const ch of token) {
      const result = this.processChar(ch);
      chatDelta += result.chatDelta;
      contentDelta += result.contentDelta;
      originalSongDelta += result.originalSongDelta;
    }

    return { chatDelta, contentDelta, originalSongDelta };
  }

  private processChar(ch: string): TokenResult {
    switch (this.phase) {
      case 'before': return this.processBefore(ch);
      case 'content': return this.processContent(ch);
      case 'between': return this.processBetween(ch);
      case 'original_song': return this.processOriginalSong(ch);
      default: return this.processAfter(ch);
    }
  }

  private processBefore(ch: string): TokenResult {
    this.tagBuffer += ch;

    // Check if buffer matches start of either open tag
    if (OPEN_TAG.startsWith(this.tagBuffer)) {
      if (this.tagBuffer === OPEN_TAG) {
        this.tagBuffer = '';
        this.phase = 'content';
        this.strippedLeadingNewline = false;
      }
      return { chatDelta: '', contentDelta: '', originalSongDelta: '' };
    }

    if (ORIG_OPEN_TAG.startsWith(this.tagBuffer)) {
      if (this.tagBuffer === ORIG_OPEN_TAG) {
        this.tagBuffer = '';
        this.phase = 'original_song';
        this.strippedLeadingNewline = false;
      }
      return { chatDelta: '', contentDelta: '', originalSongDelta: '' };
    }

    // Buffer doesn't match — flush buffer to chat
    const flushed = this.tagBuffer;
    this.tagBuffer = '';

    let chatDelta = '';
    for (const c of flushed) {
      this.tagBuffer += c;
      if (OPEN_TAG.startsWith(this.tagBuffer)) {
        if (this.tagBuffer === OPEN_TAG) {
          this.tagBuffer = '';
          this.phase = 'content';
          this.strippedLeadingNewline = false;
          break;
        }
      } else if (ORIG_OPEN_TAG.startsWith(this.tagBuffer)) {
        if (this.tagBuffer === ORIG_OPEN_TAG) {
          this.tagBuffer = '';
          this.phase = 'original_song';
          this.strippedLeadingNewline = false;
          break;
        }
      } else {
        chatDelta += this.tagBuffer;
        this.tagBuffer = '';
      }
    }

    this.chatText += chatDelta;
    return { chatDelta, contentDelta: '', originalSongDelta: '' };
  }

  private processContent(ch: string): TokenResult {
    // Strip leading \n after <content> tag
    if (!this.strippedLeadingNewline) {
      this.strippedLeadingNewline = true;
      if (ch === '\n') {
        return { chatDelta: '', contentDelta: '', originalSongDelta: '' };
      }
    }

    this.tagBuffer += ch;

    if (CLOSE_TAG.startsWith(this.tagBuffer)) {
      if (this.tagBuffer === CLOSE_TAG) {
        this.tagBuffer = '';
        this.phase = 'between';
      }
      return { chatDelta: '', contentDelta: '', originalSongDelta: '' };
    }

    const flushed = this.tagBuffer;
    this.tagBuffer = '';

    let contentDelta = '';
    for (const c of flushed) {
      this.tagBuffer += c;
      if (CLOSE_TAG.startsWith(this.tagBuffer)) {
        if (this.tagBuffer === CLOSE_TAG) {
          this.tagBuffer = '';
          this.phase = 'between';
          break;
        }
      } else {
        contentDelta += this.tagBuffer;
        this.tagBuffer = '';
      }
    }

    this.contentText += contentDelta;
    return { chatDelta: '', contentDelta, originalSongDelta: '' };
  }

  /** Between </content> and a potential <original_song>, or just chat text. */
  private processBetween(ch: string): TokenResult {
    this.tagBuffer += ch;

    if (ORIG_OPEN_TAG.startsWith(this.tagBuffer)) {
      if (this.tagBuffer === ORIG_OPEN_TAG) {
        this.tagBuffer = '';
        this.phase = 'original_song';
        this.strippedLeadingNewline = false;
      }
      return { chatDelta: '', contentDelta: '', originalSongDelta: '' };
    }

    // Buffer doesn't match — flush to chat
    const flushed = this.tagBuffer;
    this.tagBuffer = '';

    let chatDelta = '';
    for (const c of flushed) {
      this.tagBuffer += c;
      if (ORIG_OPEN_TAG.startsWith(this.tagBuffer)) {
        if (this.tagBuffer === ORIG_OPEN_TAG) {
          this.tagBuffer = '';
          this.phase = 'original_song';
          this.strippedLeadingNewline = false;
          break;
        }
      } else {
        chatDelta += this.tagBuffer;
        this.tagBuffer = '';
      }
    }

    this.chatText += chatDelta;
    return { chatDelta, contentDelta: '', originalSongDelta: '' };
  }

  private processOriginalSong(ch: string): TokenResult {
    // Strip leading \n after <original_song> tag
    if (!this.strippedLeadingNewline) {
      this.strippedLeadingNewline = true;
      if (ch === '\n') {
        return { chatDelta: '', contentDelta: '', originalSongDelta: '' };
      }
    }

    this.tagBuffer += ch;

    if (ORIG_CLOSE_TAG.startsWith(this.tagBuffer)) {
      if (this.tagBuffer === ORIG_CLOSE_TAG) {
        this.tagBuffer = '';
        this.phase = 'after';
      }
      return { chatDelta: '', contentDelta: '', originalSongDelta: '' };
    }

    const flushed = this.tagBuffer;
    this.tagBuffer = '';

    let originalSongDelta = '';
    for (const c of flushed) {
      this.tagBuffer += c;
      if (ORIG_CLOSE_TAG.startsWith(this.tagBuffer)) {
        if (this.tagBuffer === ORIG_CLOSE_TAG) {
          this.tagBuffer = '';
          this.phase = 'after';
          break;
        }
      } else {
        originalSongDelta += this.tagBuffer;
        this.tagBuffer = '';
      }
    }

    this.originalSongText += originalSongDelta;
    return { chatDelta: '', contentDelta: '', originalSongDelta };
  }

  private processAfter(ch: string): TokenResult {
    this.chatText += ch;
    return { chatDelta: ch, contentDelta: '', originalSongDelta: '' };
  }
}
