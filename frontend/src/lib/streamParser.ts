/**
 * Character-by-character stream parser that separates <content> content
 * from chat text across arbitrary token boundaries.
 *
 * Phases: before → content → after
 *  - before: accumulate into chatText until <content> detected
 *  - content: accumulate into contentText until </content> detected
 *  - after:  accumulate into chatText
 */

const OPEN_TAG = '<content>';
const CLOSE_TAG = '</content>';

export type Phase = 'before' | 'content' | 'after';

export interface TokenResult {
  chatDelta: string;
  contentDelta: string;
}

export class StreamParser {
  phase: Phase = 'before';
  contentText = '';
  chatText = '';

  private tagBuffer = '';
  private strippedLeadingNewline = false;

  processToken(token: string): TokenResult {
    let chatDelta = '';
    let contentDelta = '';

    for (const ch of token) {
      const result = this.processChar(ch);
      chatDelta += result.chatDelta;
      contentDelta += result.contentDelta;
    }

    return { chatDelta, contentDelta };
  }

  private processChar(ch: string): TokenResult {
    if (this.phase === 'before') {
      return this.processBefore(ch);
    } else if (this.phase === 'content') {
      return this.processContent(ch);
    } else {
      return this.processAfter(ch);
    }
  }

  private processBefore(ch: string): TokenResult {
    this.tagBuffer += ch;

    // Check if buffer matches start of open tag
    if (OPEN_TAG.startsWith(this.tagBuffer)) {
      if (this.tagBuffer === OPEN_TAG) {
        // Full tag matched — transition to content phase
        this.tagBuffer = '';
        this.phase = 'content';
        this.strippedLeadingNewline = false;
      }
      return { chatDelta: '', contentDelta: '' };
    }

    // Buffer doesn't match — flush buffer to chat
    const flushed = this.tagBuffer;
    this.tagBuffer = '';

    // The last char might start a new potential tag match
    // Re-process each character to check
    let chatDelta = '';
    for (const c of flushed) {
      this.tagBuffer += c;
      if (OPEN_TAG.startsWith(this.tagBuffer)) {
        if (this.tagBuffer === OPEN_TAG) {
          this.tagBuffer = '';
          this.phase = 'content';
          this.strippedLeadingNewline = false;
          // Any remaining chars would be in content phase, but we
          // already consumed the full buffer
          break;
        }
        // Still a partial match, keep buffering
      } else {
        // No match, flush this char to chat
        chatDelta += this.tagBuffer;
        this.tagBuffer = '';
      }
    }

    this.chatText += chatDelta;
    return { chatDelta, contentDelta: '' };
  }

  private processContent(ch: string): TokenResult {
    // Strip leading \n after <content> tag
    if (!this.strippedLeadingNewline) {
      this.strippedLeadingNewline = true;
      if (ch === '\n') {
        return { chatDelta: '', contentDelta: '' };
      }
    }

    this.tagBuffer += ch;

    // Check if buffer matches start of close tag
    if (CLOSE_TAG.startsWith(this.tagBuffer)) {
      if (this.tagBuffer === CLOSE_TAG) {
        // Full close tag — transition to after phase
        this.tagBuffer = '';
        this.phase = 'after';
      }
      return { chatDelta: '', contentDelta: '' };
    }

    // Buffer doesn't match close tag — flush to content
    const flushed = this.tagBuffer;
    this.tagBuffer = '';

    let contentDelta = '';
    for (const c of flushed) {
      this.tagBuffer += c;
      if (CLOSE_TAG.startsWith(this.tagBuffer)) {
        if (this.tagBuffer === CLOSE_TAG) {
          this.tagBuffer = '';
          this.phase = 'after';
          break;
        }
      } else {
        contentDelta += this.tagBuffer;
        this.tagBuffer = '';
      }
    }

    this.contentText += contentDelta;
    return { chatDelta: '', contentDelta };
  }

  private processAfter(ch: string): TokenResult {
    this.chatText += ch;
    return { chatDelta: ch, contentDelta: '' };
  }
}
