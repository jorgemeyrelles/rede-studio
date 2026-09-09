/** Troca só o segmento `:lang` (posição 1) de um pathname, preservando o resto. */
export function replaceLangSegment(pathname: string, lang: string): string {
  const segments = pathname.split('/');
  segments[1] = lang;
  return segments.join('/');
}
