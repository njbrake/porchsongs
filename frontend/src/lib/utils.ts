import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** Copy text to clipboard with Clipboard API → execCommand fallback. */
export function copyToClipboard(text: string): boolean {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).catch(() => {
      execCommandCopy(text);
    });
    return true;
  }
  return execCommandCopy(text);
}

function execCommandCopy(text: string): boolean {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  const ok = document.execCommand('copy');
  document.body.removeChild(textarea);
  return ok;
}
