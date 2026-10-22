/**
 * Motor de identificadores do Studio Cloud, agrupado por família de
 * provedor — cada família declara os geradores dos IDs que ela usa.
 * Sprint Cloud 1 só tem AWS; Azure (subscription GUID), GCP (project id) e
 * OCI (tenancy OCID) entram aqui nas próximas sprints.
 *
 * Os campos do catálogo apontam para um gerador por nome (`generator`), e
 * o valor gerado é gravado na configuração: aparece no campo e é editável.
 */

/** IDs de exemplo da documentação da AWS — nunca gerados (confundem com exemplo). */
const AWS_DOC_ACCOUNT_IDS = new Set([
  '123456789012',
  '111122223333',
  '444455556666',
  '777788889999',
  '012345678901',
]);

function randomDigits(count: number): string {
  const bytes = new Uint8Array(count);
  crypto.getRandomValues(bytes);
  // Rejeição de 250–255 evita viés de módulo no `% 10`.
  let out = '';
  let i = 0;
  while (out.length < count) {
    if (i >= bytes.length) {
      crypto.getRandomValues(bytes);
      i = 0;
    }
    const byte = bytes[i++];
    if (byte < 250) out += String(byte % 10);
  }
  return out;
}

/** ID de conta AWS: 12 dígitos, sem os exemplos da documentação nem dígitos todos iguais. */
export function generateAwsAccountId(): string {
  for (;;) {
    const id = randomDigits(12);
    if (!AWS_DOC_ACCOUNT_IDS.has(id) && !/^(\d)\1{11}$/.test(id)) return id;
  }
}

export const ID_ENGINES = {
  AWS: {
    accountId: generateAwsAccountId,
  },
} as const;

/** Nome de gerador usado no schema do catálogo: `<família>.<id>`. */
export type CloudIdGenerator = 'aws.accountId';

const GENERATORS: Record<CloudIdGenerator, () => string> = {
  'aws.accountId': ID_ENGINES.AWS.accountId,
};

export function runIdGenerator(generator: CloudIdGenerator): string {
  return GENERATORS[generator]();
}
