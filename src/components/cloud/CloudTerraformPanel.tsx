import { strToU8, zipSync } from 'fflate';
import { AlertTriangle, Check, Copy, Download, FileCode2 } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { selectCloudResource } from '../../features/cloud/cloudSlice';
import {
  dnsName,
  type TerraformFile,
} from '../../features/cloud/engines/terraform';
import { useCloudTerraform } from '../../features/cloud/useCloudTerraform';
import type { AppLanguage } from '../../types/i18n';
import { getCloudCopy } from './cloudCopy';

/** Realce HCL leve, por linha: comentário, string, número/booleano, palavra de bloco, chave, referência. */
const TOKEN =
  /(#.*$)|("(?:[^"\\]|\\.)*")|\b(true|false|-?\d+(?:\.\d+)?)\b|^(\s*)(resource|data|variable|output|provider|terraform|locals|module)\b|\b((?:aws_[a-z0-9_]+|var|local|data)\.[A-Za-z0-9_.]+)|^(\s*)([A-Za-z_][A-Za-z0-9_-]*)(\s*=)/g;

function highlight(line: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  TOKEN.lastIndex = 0;
  while ((match = TOKEN.exec(line))) {
    if (match.index > last) out.push(line.slice(last, match.index));
    const key = `${match.index}`;
    if (match[1])
      out.push(
        <span key={key} className="text-chalk-faint">
          {match[1]}
        </span>,
      );
    else if (match[2])
      out.push(
        <span key={key} className="text-signal-up">
          {match[2]}
        </span>,
      );
    else if (match[3])
      out.push(
        <span key={key} className="text-signal-warn">
          {match[3]}
        </span>,
      );
    else if (match[5])
      out.push(
        match[4],
        <span key={key} className="text-accent">
          {match[5]}
        </span>,
      );
    else if (match[6])
      out.push(
        <span key={key} className="text-aws-region">
          {match[6]}
        </span>,
      );
    else if (match[8])
      out.push(
        match[7],
        <span key={key} className="text-chalk">
          {match[8]}
        </span>,
        match[9],
      );
    last = TOKEN.lastIndex;
    if (match[0].length === 0) TOKEN.lastIndex++;
  }
  if (last < line.length) out.push(line.slice(last));
  return out;
}

/** Linhas visíveis: o arquivo inteiro ou só os blocos do elemento selecionado (com "…" entre eles). */
function visibleLines(file: TerraformFile, onlyId: string | null) {
  const lines = file.content.replace(/\n$/, '').split('\n');
  if (!onlyId) return lines.map((text, i) => ({ number: i + 1, text }));
  const ranges = file.blocks.filter((b) => b.resourceIds.includes(onlyId));
  return ranges.flatMap((range, i) => [
    ...(i > 0 ? [{ number: 0, text: '…' }] : []),
    ...lines
      .slice(range.startLine - 1, range.endLine)
      .map((text, j) => ({ number: range.startLine + j, text })),
  ]);
}

/**
 * Aba "Terraform" (substitui o PDF do on-prem): o código que o rascunho
 * gera (`engines/terraform`), arquivo por arquivo, com realce, números de
 * linha, copiar, `.zip` do conjunto, filtro pelo elemento selecionado e a
 * lista de TODOs (clicar seleciona o elemento no canvas).
 */
export default function CloudTerraformPanel({
  language,
}: {
  language: AppLanguage;
}) {
  const dispatch = useAppDispatch();
  const copy = getCloudCopy(language).terraform;
  const { resources, meta, ui } = useAppSelector((state) => state.cloud);
  const { output, iamCatalogFailed: isError } = useCloudTerraform(language);
  const [path, setPath] = useState<string>(output.files[0].path);
  const [onlySelected, setOnlySelected] = useState(false);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1500);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const file = output.files.find((f) => f.path === path) ?? output.files[0];
  const selectedId = ui.selectedResourceId;
  const filterId = onlySelected && selectedId ? selectedId : null;
  const lines = visibleLines(file, filterId);
  const name = (id: string | null) => resources.find((r) => r.id === id)?.name;
  const lineCount = (f: TerraformFile) => f.content.split('\n').length - 1;

  function download() {
    const entries: Record<string, Uint8Array> = {};
    for (const f of output.files) entries[f.path] = strToU8(f.content);
    if (output.todos.length) {
      entries['TODO.md'] = strToU8(
        `# TODO\n\n${output.todos.map((t) => `- ${name(t.resourceId) ?? '—'} (${t.file}): ${t.message[language]}`).join('\n')}\n`,
      );
    }
    const blob = new Blob([zipSync(entries) as Uint8Array<ArrayBuffer>], {
      type: 'application/zip',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${dnsName(meta.projectName || 'rede-studio')}-terraform.zip`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="grid gap-3 px-3 pt-2 lg:grid-cols-[220px_minmax(0,1fr)]">
      <div className="space-y-4">
        <nav aria-label={copy.files}>
          <h3 className="text-label mb-1.5 text-chalk-faint">{copy.files}</h3>
          <ul className="space-y-0.5">
            {output.files.map((f) => {
              const active = f.path === file.path;
              const marked =
                filterId !== null &&
                f.blocks.some((b) => b.resourceIds.includes(filterId));
              return (
                <li key={f.path}>
                  <button
                    type="button"
                    onClick={() => setPath(f.path)}
                    aria-current={active || undefined}
                    className={`flex w-full items-center gap-2 rounded-[2px] px-2 py-1 text-left font-mono text-xs ${
                      active
                        ? 'bg-ink-raised-2 text-chalk'
                        : 'text-chalk-dim hover:bg-ink-raised-2 hover:text-chalk'
                    }`}
                  >
                    <FileCode2
                      size={13}
                      aria-hidden="true"
                      className="shrink-0"
                    />
                    <span className="min-w-0 flex-1 truncate">{f.path}</span>
                    {marked && (
                      <span
                        aria-hidden="true"
                        className="h-1.5 w-1.5 rounded-full bg-accent"
                      />
                    )}
                    <span className="text-2xs tabular-nums text-chalk-faint">
                      {lineCount(f)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <section aria-label={copy.todos(output.todos.length)}>
          <h3 className="text-label mb-1.5 text-chalk-faint">
            {copy.todos(output.todos.length)}
          </h3>
          {output.todos.length === 0 ? (
            <p className="text-2xs leading-4 text-chalk-faint">
              {copy.todosEmpty}
            </p>
          ) : (
            <ul className="space-y-1">
              {output.todos.map((todo, i) => (
                <li key={`${todo.resourceId}-${i}`}>
                  <button
                    type="button"
                    onClick={() => {
                      if (todo.resourceId)
                        dispatch(selectCloudResource(todo.resourceId));
                      setPath(todo.file);
                    }}
                    className="flex w-full gap-1.5 rounded-[2px] px-1.5 py-1 text-left text-2xs leading-4 hover:bg-ink-raised-2"
                  >
                    <AlertTriangle
                      size={12}
                      aria-hidden="true"
                      className="mt-0.5 shrink-0 text-signal-warn"
                    />
                    <span>
                      <span className="text-chalk">
                        {name(todo.resourceId) ?? '—'}
                      </span>{' '}
                      <span className="text-chalk-dim">
                        {todo.message[language]}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {isError && (
            <p className="mt-2 text-2xs text-signal-warn">
              {copy.catalogMissing}
            </p>
          )}
        </section>
      </div>

      <div className="min-w-0 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs text-chalk">{file.path}</span>
          <label
            className={`flex items-center gap-1.5 text-2xs ${selectedId ? 'cursor-pointer text-chalk-dim' : 'text-chalk-faint'}`}
          >
            <input
              type="checkbox"
              checked={onlySelected && Boolean(selectedId)}
              disabled={!selectedId}
              onChange={(e) => setOnlySelected(e.target.checked)}
              className="h-3.5 w-3.5 accent-accent"
            />
            {copy.onlySelected}
            {selectedId && (
              <span className="text-chalk">({name(selectedId)})</span>
            )}
          </label>
          <span className="ml-auto flex gap-1.5">
            <button
              type="button"
              onClick={() =>
                navigator.clipboard
                  ?.writeText(file.content)
                  .then(() => setCopied(true))
              }
              className="btn btn-secondary btn-sm"
            >
              {copied ? (
                <Check size={13} aria-hidden="true" />
              ) : (
                <Copy size={13} aria-hidden="true" />
              )}
              <span aria-live="polite">{copied ? copy.copied : copy.copy}</span>
            </button>
            <button
              type="button"
              onClick={download}
              className="btn btn-primary btn-sm"
            >
              <Download size={13} aria-hidden="true" />
              {copy.download}
            </button>
          </span>
        </div>
        <p className="text-2xs text-chalk-faint">{copy.hint}</p>
        <div className="max-h-[520px] overflow-auto rounded-sm border border-line bg-ink">
          {lines.length === 0 ? (
            <p className="p-3 text-xs text-chalk-faint">{copy.noBlocks}</p>
          ) : (
            <pre className="py-2 font-mono text-xs leading-5 text-chalk-dim">
              <code>
                {lines.map((line, i) => (
                  <div key={`${line.number}-${i}`} className="flex">
                    <span
                      aria-hidden="true"
                      className="w-11 shrink-0 select-none pr-3 text-right tabular-nums text-chalk-faint"
                    >
                      {line.number || ''}
                    </span>
                    <span className="whitespace-pre pr-4">
                      {line.number ? highlight(line.text) : line.text}
                    </span>
                  </div>
                ))}
              </code>
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
