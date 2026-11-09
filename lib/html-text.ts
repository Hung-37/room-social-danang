import { decodeHTML } from 'entities';

const MOJIBAKE_MARKERS = /(?:[ÃÄÆð][\u0080-\u00bf]|á[º»])/;

function repairUtf8Mojibake(value: string): string {
  if (!MOJIBAKE_MARKERS.test(value)) return value;

  return value.replace(/[\u0000-\u00ff]+/g, (latin1Run) => {
    if (!MOJIBAKE_MARKERS.test(latin1Run)) return latin1Run;

    try {
      const bytes = Uint8Array.from(latin1Run, (character) => character.charCodeAt(0));
      return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch {
      return latin1Run;
    }
  });
}

/** Decode regular and repeatedly encoded HTML entities before text reaches the UI. */
export function decodeHtmlText(value: unknown): string {
  let text = String(value ?? '');

  for (let pass = 0; pass < 4; pass += 1) {
    const decoded = repairUtf8Mojibake(decodeHTML(text));
    if (decoded === text) break;
    text = decoded;
  }

  return text.replace(/\u00a0/g, ' ');
}
