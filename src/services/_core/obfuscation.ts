/**
 * Ofuscação leve (NÃO é criptografia) do que vai pro localStorage —
 * `projectsPersistence.ts`/`authPersistence.ts`. Só evita que o conteúdo
 * apareça em texto plano ao abrir o DevTools/exportar o storage; a "chave"
 * (o próprio algoritmo, fixo no bundle JS público) não é secreta, então
 * isso é reversível por qualquer um com acesso ao código-fonte publicado.
 * Ver `.claude/plans/grid-e-camada-de-dados.md` (Fase 5 / "Fora de escopo")
 * pra por que criptografia real não se aplica aqui.
 */

const XOR_KEY = 0x5a;

function xorBytes(bytes: Uint8Array): Uint8Array {
  const out = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i += 1) {
    out[i] = bytes[i] ^ XOR_KEY;
  }
  return out;
}

/** JSON → ofuscado (XOR + Base64) pra gravar em localStorage. */
export function encodeForStorage(value: unknown): string {
  const json = JSON.stringify(value);
  const bytes = new TextEncoder().encode(json);
  const obfuscated = xorBytes(bytes);
  return btoa(String.fromCharCode(...obfuscated));
}

/**
 * Ofuscado → valor original. Lança se `raw` não decodificar como o
 * formato desta função (chamador decide o fallback — ver nota de migração
 * em `projectsPersistence.ts`/`authPersistence.ts`).
 */
export function decodeFromStorage<T>(raw: string): T {
  const obfuscated = Uint8Array.from(atob(raw), (char) => char.charCodeAt(0));
  const bytes = xorBytes(obfuscated);
  const json = new TextDecoder().decode(bytes);
  return JSON.parse(json) as T;
}
