/**
 * Valores padrão derivados da sessão do Rede Studio para o rascunho cloud
 * (usuário IAM, responsável, centro de custo).
 */

/** Conjunto aceito pelo IAM em nomes de usuário/grupo/role. */
const IAM_NAME_ALLOWED = /[^a-z0-9+=,.@_-]/g;
const IAM_NAME_MAX = 64;

/** Sem acentos, sem espaços (tudo junto), minúsculo e só o que o IAM aceita. */
export function toIamName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(IAM_NAME_ALLOWED, '')
    .slice(0, IAM_NAME_MAX);
}

/**
 * Usuário IAM padrão da conta: o nome de usuário do Rede Studio
 * normalizado ("Jorge Meyrelles" → `jorgemeyrelles`); se não sobrar nada,
 * a parte do e-mail antes do `@` (`email.silva@email.com` → `email.silva`).
 */
export function defaultIamUserName(user: {
  name?: string | null;
  email?: string | null;
}): string {
  const fromName = toIamName(user.name ?? '');
  if (fromName) return fromName;
  return toIamName((user.email ?? '').split('@')[0] ?? '');
}

/** Slug para tags (`Plataforma AWS SP` → `plataforma-aws-sp`). */
export function toTagSlug(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}
