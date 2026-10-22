import { readIdList } from '../engines/addressing';
import {
  COGNITO_TYPE,
  INTERFACE_ENDPOINT_TYPE,
  INTERFACE_SERVICES,
  KMS_TYPE,
  PARAMETER_TYPE,
  SECRET_TYPE,
  securityIssues,
} from '../engines/secrets';
import { parsePorts, readSgRules } from '../engines/security';
import { azCountOf, subnetsPerAz, VPC_TYPE } from '../network';
import type { CloudResource } from '../types';
import type { CloudCatalogEntry, CloudField, LocalizedText } from './types';

/**
 * Segurança e segredos (F7 onda 7B — `sprint-cloud-f7b-seguranca.md`):
 * endpoint de interface, KMS, Secrets Manager, Parameter Store e Cognito.
 * Os campos que os outros recursos usam para se ligar a eles (`kmsKeyId`,
 * `secretIds`, `sessionManager`, `cognitoUserPoolId`) saem daqui.
 */

const same = (text: string): LocalizedText => ({
  pt: text,
  en: text,
  es: text,
});

// ── Campos de associação (usados por EC2, ASG, RDS, S3, ALB...) ──────────
export const kmsKeyField = (
  visibleWhen?: CloudField['visibleWhen'],
): CloudField => ({
  key: 'kmsKeyId',
  section: 'config',
  type: 'select',
  optionsSource: 'kmsKeys',
  visibleWhen,
  label: { pt: 'Chave KMS', en: 'KMS key', es: 'Clave KMS' },
  help: {
    pt: 'Vazio = chave gerenciada pela AWS. Só chaves da mesma Região.',
    en: 'Empty = AWS managed key. Only keys from the same Region.',
    es: 'Vacío = clave administrada por AWS. Solo claves de la misma Región.',
  },
});

export const instanceAccessFields: CloudField[] = [
  {
    key: 'sessionManager',
    section: 'config',
    type: 'boolean',
    label: {
      pt: 'Acesso pelo Session Manager',
      en: 'Access through Session Manager',
      es: 'Acceso por Session Manager',
    },
    help: {
      pt: 'Terminal pelo console da AWS, sem porta 22 nem IP público. Precisa de NAT ou dos endpoints ssm, ssmmessages e ec2messages.',
      en: 'Shell through the AWS console, without port 22 or a public IP. Needs a NAT or the ssm, ssmmessages and ec2messages endpoints.',
      es: 'Terminal por la consola de AWS, sin puerto 22 ni IP pública. Necesita NAT o los endpoints ssm, ssmmessages y ec2messages.',
    },
  },
  {
    key: 'secretIds',
    section: 'config',
    type: 'refs',
    source: 'regionSecrets',
    label: {
      pt: 'Segredos e parâmetros que lê',
      en: 'Secrets and parameters it reads',
      es: 'Secretos y parámetros que lee',
    },
    help: {
      pt: 'A role da instância ganha leitura só nestes (e decrypt nas chaves KMS deles).',
      en: 'The instance role gets read access only to these (and decrypt on their KMS keys).',
      es: 'El rol de la instancia obtiene lectura solo en estos (y decrypt en sus claves KMS).',
    },
  },
];

/** Login pelo Cognito: no ALB, só com listener HTTPS; na API, sempre. */
export const cognitoAuthField = (
  visibleWhen?: CloudField['visibleWhen'],
): CloudField => ({
  ...cognitoField,
  visibleWhen,
  help: {
    pt: 'Exige um token JWT do user pool (autorizador da rota).',
    en: 'Requires a JWT from the user pool (route authorizer).',
    es: 'Exige un token JWT del user pool (autorizador de la ruta).',
  },
});

export const cognitoField: CloudField = {
  key: 'cognitoUserPoolId',
  section: 'config',
  type: 'select',
  optionsSource: 'cognitoPools',
  visibleWhen: (config) => config.listenerProtocol === 'HTTPS',
  label: {
    pt: 'Login (Cognito)',
    en: 'Sign-in (Cognito)',
    es: 'Inicio de sesión (Cognito)',
  },
  help: {
    pt: 'O ALB exige login no user pool antes de encaminhar.',
    en: 'The ALB requires sign-in to the user pool before forwarding.',
    es: 'El ALB exige iniciar sesión en el user pool antes de reenviar.',
  },
};

// ── Endpoint de interface ────────────────────────────────────────────────
const SERVICE_LABELS: Record<(typeof INTERFACE_SERVICES)[number], string> = {
  secretsmanager: 'Secrets Manager',
  ssm: 'Systems Manager (ssm)',
  ssmmessages: 'Session Manager (ssmmessages)',
  ec2messages: 'Session Manager (ec2messages)',
  kms: 'KMS',
  sts: 'STS',
  logs: 'CloudWatch Logs',
  'ecr.api': 'ECR (api)',
  'ecr.dkr': 'ECR (docker)',
  ec2: 'EC2 (API)',
  eks: 'EKS (API)',
  'eks-auth': 'EKS Pod Identity (eks-auth)',
  sqs: 'SQS',
  sns: 'SNS',
};

/** Algum SG do endpoint aceita TCP 443? */
const sgsAllow443 = (resource: CloudResource, resources: CloudResource[]) =>
  readIdList(resource.config.securityGroupIds).some((id) => {
    const sg = resources.find((r) => r.id === id);
    return (
      sg !== undefined &&
      readSgRules(sg).some((rule) => {
        if (rule.direction !== 'ingress') return false;
        if (rule.protocol === 'all') return true;
        const range = rule.protocol === 'tcp' ? parsePorts(rule.ports) : null;
        return range !== null && range[0] <= 443 && 443 <= range[1];
      })
    );
  });

const interfaceEndpoint: CloudCatalogEntry = {
  type: INTERFACE_ENDPOINT_TYPE,
  layer: 3,
  kind: 'node',
  category: 'network',
  optional: true,
  label: {
    pt: 'Endpoint de interface',
    en: 'Interface endpoint',
    es: 'Endpoint de interfaz',
  },
  summary: {
    pt: 'Serviço da AWS (Secrets Manager, SSM, KMS…) dentro da VPC, sem NAT.',
    en: 'AWS service (Secrets Manager, SSM, KMS…) inside the VPC, without NAT.',
    es: 'Servicio de AWS (Secrets Manager, SSM, KMS…) dentro de la VPC, sin NAT.',
  },
  namePrefix: { pt: 'vpce', en: 'vpce', es: 'vpce' },
  parents: [VPC_TYPE],
  defaults: {
    securityGroupIds: [],
    privateDns: true,
    dataProcessedGbMonth: 10,
  },
  derive: ({ state, parent }) => {
    const used = new Set(
      state.resources
        .filter(
          (r) =>
            r.type === INTERFACE_ENDPOINT_TYPE && r.parentId === parent?.id,
        )
        .map((r) => r.config.service),
    );
    return {
      service: INTERFACE_SERVICES.find((s) => !used.has(s)) ?? 'secretsmanager',
      subnetIds: parent
        ? subnetsPerAz(state.resources, parent.id, ['private', 'isolated'])
        : [],
    };
  },
  validate: (resource, resources) => {
    const issues: Record<string, LocalizedText> = {};
    if (
      resources.some(
        (r) =>
          r.type === INTERFACE_ENDPOINT_TYPE &&
          r.id !== resource.id &&
          r.parentId === resource.parentId &&
          r.config.service === resource.config.service,
      )
    ) {
      issues.service = {
        pt: 'Já existe um endpoint deste serviço na VPC.',
        en: 'This VPC already has an endpoint for this service.',
        es: 'Ya existe un endpoint de este servicio en la VPC.',
      };
    }
    const subnets = readIdList(resource.config.subnetIds);
    if (subnets.length === 0) {
      issues.subnetIds = {
        pt: 'Escolha ao menos uma subnet (uma por AZ).',
        en: 'Pick at least one subnet (one per AZ).',
        es: 'Elige al menos una subnet (una por AZ).',
      };
    } else if (azCountOf(resources, subnets) !== subnets.length) {
      issues.subnetIds = {
        pt: 'No máximo uma subnet por AZ.',
        en: 'At most one subnet per AZ.',
        es: 'Como máximo una subnet por AZ.',
      };
    }
    if (!sgsAllow443(resource, resources)) {
      issues['*'] = {
        pt: 'O SG do endpoint precisa liberar TCP 443 vindo da VPC (aba Segurança, preset HTTPS).',
        en: 'The endpoint SG must allow TCP 443 from the VPC (Security tab, HTTPS preset).',
        es: 'El SG del endpoint debe permitir TCP 443 desde la VPC (pestaña Seguridad, preset HTTPS).',
      };
    }
    return issues;
  },
  fields: [
    {
      key: 'service',
      section: 'config',
      type: 'select',
      label: { pt: 'Serviço', en: 'Service', es: 'Servicio' },
      options: INTERFACE_SERVICES.map((value) => ({
        value,
        label: same(SERVICE_LABELS[value]),
      })),
    },
    {
      key: 'subnetIds',
      section: 'config',
      type: 'refs',
      source: 'vpcSubnets',
      label: { pt: 'Subnets', en: 'Subnets', es: 'Subnets' },
      help: {
        pt: 'Uma por AZ: cada uma ganha uma interface de rede (e uma hora cobrada).',
        en: 'One per AZ: each gets a network interface (and a billed hour).',
        es: 'Una por AZ: cada una recibe una interfaz de red (y una hora cobrada).',
      },
    },
    {
      key: 'securityGroupIds',
      section: 'config',
      type: 'refs',
      source: 'vpcSecurityGroups',
      label: {
        pt: 'Security groups',
        en: 'Security groups',
        es: 'Security groups',
      },
    },
    {
      key: 'privateDns',
      section: 'config',
      type: 'boolean',
      label: {
        pt: 'DNS privado (o nome público do serviço resolve aqui)',
        en: 'Private DNS (the service public name resolves here)',
        es: 'DNS privado (el nombre público del servicio resuelve aquí)',
      },
    },
    {
      key: 'dataProcessedGbMonth',
      section: 'operation',
      type: 'number',
      min: 0,
      step: 1,
      unit: 'GB',
      label: {
        pt: 'Dados processados por mês',
        en: 'Data processed per month',
        es: 'Datos procesados por mes',
      },
    },
  ],
};

// ── KMS ──────────────────────────────────────────────────────────────────
const kms: CloudCatalogEntry = {
  type: KMS_TYPE,
  layer: 5,
  kind: 'node',
  category: 'security',
  optional: true,
  label: { pt: 'Chave KMS', en: 'KMS key', es: 'Clave KMS' },
  summary: {
    pt: 'Chave sua para cifrar S3, RDS, discos, segredos e parâmetros.',
    en: 'Your own key to encrypt S3, RDS, disks, secrets and parameters.',
    es: 'Clave propia para cifrar S3, RDS, discos, secretos y parámetros.',
  },
  namePrefix: { pt: 'chave', en: 'key', es: 'clave' },
  parents: ['aws.region'],
  inspectorHint: {
    pt: 'Para usar, escolha esta chave no campo "Chave KMS" do recurso.',
    en: 'To use it, pick this key in the resource’s "KMS key" field.',
    es: 'Para usarla, elige esta clave en el campo "Clave KMS" del recurso.',
  },
  defaults: {
    rotation: true,
    deletionWindowDays: 30,
    requestsPerMonth: 100000,
  },
  validate: (resource, resources) =>
    resources.some((r) => r.config.kmsKeyId === resource.id)
      ? {}
      : {
          '*': {
            pt: 'Ninguém usa esta chave ainda (e ela já é cobrada).',
            en: 'Nothing uses this key yet (and it is already billed).',
            es: 'Nada usa esta clave todavía (y ya se cobra).',
          },
        },
  fields: [
    {
      key: 'rotation',
      section: 'config',
      type: 'boolean',
      label: {
        pt: 'Rotação automática anual',
        en: 'Automatic yearly rotation',
        es: 'Rotación automática anual',
      },
    },
    {
      key: 'deletionWindowDays',
      section: 'config',
      type: 'number',
      min: 7,
      max: 30,
      step: 1,
      unit: 'd',
      label: {
        pt: 'Espera antes de apagar',
        en: 'Waiting period before deletion',
        es: 'Espera antes de borrar',
      },
    },
    {
      key: 'requestsPerMonth',
      section: 'operation',
      type: 'number',
      min: 0,
      step: 10000,
      label: {
        pt: 'Requisições por mês',
        en: 'Requests per month',
        es: 'Solicitudes por mes',
      },
      help: {
        pt: 'As 20 mil primeiras do mês são grátis (franquia).',
        en: 'The first 20 thousand of the month are free (free tier).',
        es: 'Las primeras 20 mil del mes son gratis (franquicia).',
      },
    },
  ],
};

// ── Secrets Manager ──────────────────────────────────────────────────────
const secret: CloudCatalogEntry = {
  type: SECRET_TYPE,
  layer: 5,
  kind: 'node',
  category: 'security',
  optional: true,
  label: { pt: 'Segredo', en: 'Secret', es: 'Secreto' },
  summary: {
    pt: 'Senha, token ou chave de API no Secrets Manager.',
    en: 'Password, token or API key in Secrets Manager.',
    es: 'Contraseña, token o clave de API en Secrets Manager.',
  },
  namePrefix: { pt: 'segredo', en: 'secret', es: 'secreto' },
  parents: ['aws.region'],
  inspectorHint: {
    pt: 'O valor nunca vai para o Terraform: grave-o depois pelo console ou CLI. Quem lê: campo "Segredos e parâmetros que lê" da EC2/ASG.',
    en: 'The value never goes into Terraform: set it afterwards through the console or CLI. Who reads it: the EC2/ASG "Secrets and parameters it reads" field.',
    es: 'El valor nunca va a Terraform: grábalo después por la consola o CLI. Quién lo lee: el campo "Secretos y parámetros que lee" de la EC2/ASG.',
  },
  defaults: {
    description: '',
    kmsKeyId: '',
    rotation: false,
    rotationDays: 30,
    apiCallsPerMonth: 10000,
  },
  validate: (resource, resources) => securityIssues(resources, resource),
  fields: [
    {
      key: 'description',
      section: 'config',
      type: 'text',
      label: { pt: 'Descrição', en: 'Description', es: 'Descripción' },
    },
    kmsKeyField(),
    {
      key: 'rotation',
      section: 'config',
      type: 'boolean',
      label: {
        pt: 'Rotação automática',
        en: 'Automatic rotation',
        es: 'Rotación automática',
      },
      help: {
        pt: 'Precisa de uma função Lambda de rotação (chega na onda 7C): por enquanto vira TODO no Terraform.',
        en: 'Needs a rotation Lambda function (comes in wave 7C): for now it becomes a Terraform TODO.',
        es: 'Necesita una función Lambda de rotación (llega en la ola 7C): por ahora es un TODO en Terraform.',
      },
    },
    {
      key: 'rotationDays',
      section: 'config',
      type: 'number',
      min: 1,
      max: 1000,
      step: 1,
      unit: 'd',
      visibleWhen: (config) => config.rotation === true,
      label: { pt: 'A cada', en: 'Every', es: 'Cada' },
    },
    {
      key: 'apiCallsPerMonth',
      section: 'operation',
      type: 'number',
      min: 0,
      step: 1000,
      label: {
        pt: 'Leituras por mês',
        en: 'Reads per month',
        es: 'Lecturas por mes',
      },
    },
  ],
};

// ── Parameter Store ──────────────────────────────────────────────────────
const parameter: CloudCatalogEntry = {
  type: PARAMETER_TYPE,
  layer: 5,
  kind: 'node',
  category: 'security',
  optional: true,
  label: {
    pt: 'Parâmetro SSM',
    en: 'SSM parameter',
    es: 'Parámetro SSM',
  },
  summary: {
    pt: 'Configuração da aplicação no Parameter Store (SecureString cifra com KMS).',
    en: 'Application configuration in Parameter Store (SecureString encrypts with KMS).',
    es: 'Configuración de la aplicación en Parameter Store (SecureString cifra con KMS).',
  },
  namePrefix: { pt: 'param', en: 'param', es: 'param' },
  parents: ['aws.region'],
  defaults: {
    path: '/app/config',
    valueType: 'String',
    tier: 'Standard',
    kmsKeyId: '',
  },
  validate: (resource, resources) => {
    const issues = securityIssues(resources, resource);
    if (
      !/^\/[A-Za-z0-9_.\-/]{1,1010}$/.test(String(resource.config.path ?? ''))
    )
      issues.path = {
        pt: 'Caminho começa com / e usa letras, números, _ . - /.',
        en: 'The path starts with / and uses letters, digits, _ . - /.',
        es: 'La ruta empieza con / y usa letras, números, _ . - /.',
      };
    return issues;
  },
  fields: [
    {
      key: 'path',
      section: 'config',
      type: 'text',
      mono: true,
      placeholder: '/app/config',
      label: { pt: 'Caminho', en: 'Path', es: 'Ruta' },
    },
    {
      key: 'valueType',
      section: 'config',
      type: 'select',
      label: { pt: 'Tipo', en: 'Type', es: 'Tipo' },
      options: [
        { value: 'String', label: same('String') },
        { value: 'StringList', label: same('StringList') },
        {
          value: 'SecureString',
          label: {
            pt: 'SecureString (cifrado)',
            en: 'SecureString (encrypted)',
            es: 'SecureString (cifrado)',
          },
        },
      ],
    },
    kmsKeyField((config) => config.valueType === 'SecureString'),
    {
      key: 'tier',
      section: 'config',
      type: 'select',
      label: { pt: 'Camada', en: 'Tier', es: 'Nivel' },
      options: [
        {
          value: 'Standard',
          label: {
            pt: 'Standard (grátis, até 4 KB)',
            en: 'Standard (free, up to 4 KB)',
            es: 'Standard (gratis, hasta 4 KB)',
          },
        },
        {
          value: 'Advanced',
          label: {
            pt: 'Advanced (cobrado, até 8 KB)',
            en: 'Advanced (billed, up to 8 KB)',
            es: 'Advanced (cobrado, hasta 8 KB)',
          },
        },
      ],
    },
  ],
};

// ── Cognito ──────────────────────────────────────────────────────────────
const cognito: CloudCatalogEntry = {
  type: COGNITO_TYPE,
  layer: 5,
  kind: 'node',
  category: 'security',
  optional: true,
  label: {
    pt: 'Cognito — user pool',
    en: 'Cognito — user pool',
    es: 'Cognito — user pool',
  },
  summary: {
    pt: 'Cadastro e login de usuários. O ALB pode exigir login antes de encaminhar.',
    en: 'User sign-up and sign-in. The ALB can require sign-in before forwarding.',
    es: 'Registro e inicio de sesión de usuarios. El ALB puede exigir login antes de reenviar.',
  },
  namePrefix: { pt: 'usuarios', en: 'users', es: 'usuarios' },
  parents: ['aws.region'],
  defaults: { plan: 'ESSENTIALS', mfa: 'OPTIONAL', monthlyActiveUsers: 1000 },
  validate: (resource, resources) =>
    resources.some((r) => r.config.cognitoUserPoolId === resource.id)
      ? {}
      : {
          '*': {
            pt: 'Nenhum ALB usa este user pool: escolha-o no campo "Login (Cognito)" de um ALB HTTPS.',
            en: 'No ALB uses this user pool: pick it in the "Sign-in (Cognito)" field of an HTTPS ALB.',
            es: 'Ningún ALB usa este user pool: elígelo en el campo "Inicio de sesión (Cognito)" de un ALB HTTPS.',
          },
        },
  fields: [
    {
      key: 'plan',
      section: 'config',
      type: 'select',
      label: { pt: 'Plano', en: 'Plan', es: 'Plan' },
      options: [
        { value: 'LITE', label: same('Lite') },
        { value: 'ESSENTIALS', label: same('Essentials') },
        { value: 'PLUS', label: same('Plus') },
      ],
      help: {
        pt: 'Lite e Essentials têm 10 mil usuários ativos grátis por mês; Plus não.',
        en: 'Lite and Essentials include 10 thousand free monthly active users; Plus does not.',
        es: 'Lite y Essentials incluyen 10 mil usuarios activos gratis al mes; Plus no.',
      },
    },
    {
      key: 'mfa',
      section: 'config',
      type: 'select',
      label: { pt: 'MFA', en: 'MFA', es: 'MFA' },
      options: [
        { value: 'OFF', label: { pt: 'Desligado', en: 'Off', es: 'Apagado' } },
        {
          value: 'OPTIONAL',
          label: { pt: 'Opcional', en: 'Optional', es: 'Opcional' },
        },
        {
          value: 'ON',
          label: { pt: 'Obrigatório', en: 'Required', es: 'Obligatorio' },
        },
      ],
    },
    {
      key: 'monthlyActiveUsers',
      section: 'operation',
      type: 'number',
      min: 0,
      step: 100,
      label: {
        pt: 'Usuários ativos por mês',
        en: 'Monthly active users',
        es: 'Usuarios activos por mes',
      },
    },
  ],
};

export const AWS_SECURITY: CloudCatalogEntry[] = [
  interfaceEndpoint,
  kms,
  secret,
  parameter,
  cognito,
];
