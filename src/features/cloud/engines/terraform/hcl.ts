/**
 * Escritor HCL mínimo do motor Terraform, com a saída já no formato do
 * `terraform fmt` (2 espaços; `=` alinhado nos atributos consecutivos de
 * uma linha; linha em branco antes de valores de várias linhas e de blocos
 * aninhados). Puro.
 */

/** Expressão crua (referência, função): sai sem aspas. */
export class Raw {
  constructor(readonly expr: string) {}
}

export const raw = (expr: string) => new Raw(expr);

export type HclValue =
  | string
  | number
  | boolean
  | Raw
  | HclValue[]
  | { [key: string]: HclValue };

export type HclEntry =
  | { kind: 'attr'; key: string; value: HclValue }
  | { kind: 'block'; type: string; labels: string[]; body: HclEntry[] }
  | { kind: 'comment'; text: string };

export const attr = (
  key: string,
  value: HclValue | undefined | null,
): HclEntry[] =>
  value === undefined || value === null ? [] : [{ kind: 'attr', key, value }];

export const block = (
  type: string,
  labels: string[],
  body: HclEntry[],
): HclEntry => ({
  kind: 'block',
  type,
  labels,
  body,
});

export const comment = (text: string): HclEntry => ({ kind: 'comment', text });

const IDENT = /^[A-Za-z_][A-Za-z0-9_-]*$/;

export function quote(text: string): string {
  return `"${text.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\$\{/g, '$${').replace(/%\{/g, '%%{').replace(/\n/g, '\\n')}"`;
}

const isObject = (value: HclValue): value is { [key: string]: HclValue } =>
  typeof value === 'object' && !(value instanceof Raw) && !Array.isArray(value);

/** Valor que cabe numa linha (escalares e listas de escalares). */
function inline(value: HclValue): string | null {
  if (value instanceof Raw) return value.expr;
  if (typeof value === 'string') return quote(value);
  if (typeof value === 'number' || typeof value === 'boolean')
    return String(value);
  if (Array.isArray(value)) {
    const parts = value.map(inline);
    return parts.every((p): p is string => p !== null)
      ? `[${parts.join(', ')}]`
      : null;
  }
  if (isObject(value) && Object.keys(value).length === 0) return '{}';
  return null;
}

function renderObject(
  value: { [key: string]: HclValue },
  indent: string,
): string[] {
  const keys = Object.keys(value);
  const shown = keys.map((key) => (IDENT.test(key) ? key : quote(key)));
  const width = Math.max(...shown.map((k) => k.length));
  const lines = ['{'];
  keys.forEach((key, i) => {
    const text = inline(value[key]);
    if (text === null)
      throw new Error(`valor aninhado não suportado em ${key}`);
    lines.push(`${indent}  ${shown[i].padEnd(width)} = ${text}`);
  });
  lines.push(`${indent}}`);
  return lines;
}

function renderBody(entries: HclEntry[], indent: string): string[] {
  const out: string[] = [];
  let group: { key: string; text: string }[] = [];
  const flush = () => {
    const width = Math.max(0, ...group.map((g) => g.key.length));
    for (const g of group)
      out.push(`${indent}${g.key.padEnd(width)} = ${g.text}`);
    group = [];
  };
  const blank = () => {
    if (out.length && out[out.length - 1] !== '') out.push('');
  };
  for (const entry of entries) {
    if (entry.kind === 'attr') {
      const text = inline(entry.value);
      if (text !== null && !text.includes('\n')) {
        group.push({ key: entry.key, text });
        continue;
      }
      flush();
      blank();
      // Expressão crua de várias linhas (ex.: `for_each = { for … }`): as
      // linhas seguintes já vêm indentadas em relação ao atributo.
      const lines =
        text !== null
          ? text.split('\n').map((line, i) => (i === 0 ? line : indent + line))
          : isObject(entry.value)
            ? renderObject(entry.value, indent)
            : [];
      out.push(`${indent}${entry.key} = ${lines[0]}`, ...lines.slice(1));
      out.push('');
    } else if (entry.kind === 'block') {
      flush();
      blank();
      out.push(...renderBlock(entry, indent));
      out.push('');
    } else {
      flush();
      out.push(`${indent}# ${entry.text}`);
    }
  }
  flush();
  while (out.length && out[out.length - 1] === '') out.pop();
  return out;
}

export function renderBlock(
  entry: Extract<HclEntry, { kind: 'block' }>,
  indent = '',
): string[] {
  const head = [entry.type, ...entry.labels.map(quote)].join(' ');
  // Bloco vazio fica numa linha, como o `terraform fmt` (`allow {}`).
  if (entry.body.length === 0) return [`${indent}${head} {}`];
  const body = renderBody(entry.body, `${indent}  `);
  return [`${head} {`, ...body, `${indent}}`].map((line, i) =>
    i === 0 ? `${indent}${line}` : line,
  );
}

/** Texto de um bloco de topo (ou de comentários soltos). */
export function renderTop(entries: HclEntry[]): string {
  return entries
    .map((entry) =>
      entry.kind === 'block'
        ? renderBlock(entry).join('\n')
        : renderBody([entry], '').join('\n'),
    )
    .join('\n');
}
