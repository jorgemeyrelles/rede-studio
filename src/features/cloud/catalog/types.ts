import type { AppLanguage } from '../../../types/i18n';
import type { CloudIdGenerator } from '../engines/ids';
import type {
  CloudConnection,
  CloudResource,
  CloudSize,
  CloudState,
} from '../types';

/**
 * Catálogo declarativo do Studio Cloud (F-D5 do plano sprint-cloud-aws):
 * cada produto é uma entrada — camada, pais permitidos,
 * pré-requisitos, campos de configuração/operação. Os motores (layout,
 * IP, Terraform, custo, validação) leem o catálogo; adicionar um produto
 * é adicionar uma entrada (e o ícone em `components/cloud/awsIcons.ts` —
 * fica fora daqui para os motores rodarem sem bundler, em scripts `jiti`).
 */

export type LocalizedText = Record<AppLanguage, string>;

/** Ordem de crescimento da arquitetura (L0 conta → L5 recursos). */
export type CloudLayer = 0 | 1 | 2 | 3 | 4 | 5;

/** Cor de grupo do guia AWS (tokens `--aws-*`). */
export type CloudGroupColor =
  | 'account'
  | 'region'
  | 'vpc'
  | 'az'
  | 'subnet-public'
  | 'subnet-private'
  | 'asg'
  | 'global';

/** Seção da paleta (a camada continua definindo a ordem de crescimento). */
export type CloudCategory =
  | 'foundation'
  | 'network'
  | 'edge'
  | 'compute'
  | 'data'
  | 'security';

export const CLOUD_CATEGORIES: CloudCategory[] = [
  'foundation',
  'network',
  'edge',
  'compute',
  'data',
  'security',
];

export type CloudFieldOption = { value: string; label: LocalizedText };

type FieldBase = {
  key: string;
  label: LocalizedText;
  help?: LocalizedText;
  /** `config` = como o elemento é; `operation` = como ele roda (volume, horas, retenção). */
  section: 'config' | 'operation';
  /** Mostra o campo só quando a condição vale para a configuração atual. */
  visibleWhen?: (config: Record<string, unknown>) => boolean;
};

export type CloudField = FieldBase &
  (
    | {
        type: 'text';
        placeholder?: string;
        pattern?: RegExp;
        mono?: boolean;
        /** Valor gerado na criação (motor de IDs) e regenerável no inspetor. */
        generator?: CloudIdGenerator;
        /** Sugestões (datalist) para uma tag herdável. */
        suggest?: 'Owner' | 'CostCenter';
        /** Botão "Sugerir": valor calculado do rascunho (ex.: próximo CIDR livre). */
        autofill?: (
          resources: CloudResource[],
          resource: CloudResource,
        ) => string | null;
        /** Mostra a capacidade do bloco (IPs utilizáveis e faixa) abaixo do campo. */
        capacity?: boolean;
      }
    | {
        type: 'number';
        min?: number;
        max?: number;
        step?: number;
        unit?: string;
      }
    | { type: 'boolean' }
    | {
        type: 'select';
        options?: CloudFieldOption[];
        /**
         * Opções vindas de fora do catálogo: regiões (com aviso de preço),
         * letras de AZ da região do elemento, NACLs da VPC do elemento ou
         * tipos de instância/classes do catálogo de preços da região.
         */
        optionsSource?:
          | 'awsRegions'
          | 'awsZones'
          | 'vpcNacls'
          | 'ec2InstanceTypes'
          | 'rdsInstanceClasses'
          | 'auroraInstanceClasses'
          | 'cacheNodeTypes'
          | 'route53Zones'
          | 'acmCertificates'
          | 'wafAcls'
          | 'kmsKeys'
          | 'cognitoPools'
          | 'clusters'
          | 'ecrRepositories'
          | 'sqsQueues'
          | 'logGroups'
          | 'snsTopics'
          | 'projectBuckets';
      }
    | {
        /** Múltipla escolha de elementos da VPC (lista de ids em `config`). */
        type: 'refs';
        source:
          | 'vpcSecurityGroups'
          | 'vpcSubnets'
          | 'projectVpcs'
          | 'regionSecrets'
          | 'backupTargets';
      }
    | {
        /** Múltipla escolha entre opções fixas (lista de valores em `config`). */
        type: 'multi';
        options: CloudFieldOption[];
      }
    | { type: 'list'; itemPlaceholder: LocalizedText }
    | {
        /** Grupos/roles do catálogo IAM (múltipla escolha + políticas por seleção). */
        type: 'iamTemplates';
        kind: 'GROUP' | 'ROLE';
      }
  );

export type CloudCatalogContext = {
  state: CloudState;
  parent: CloudResource | null;
};

export type CloudCatalogEntry = {
  type: string;
  layer: CloudLayer;
  /** `container` agrupa filhos (vira sub-flow); `node` é folha. */
  kind: 'container' | 'node';
  category: CloudCategory;
  /** Fora do caminho principal: a paleta nunca sugere como "próximo passo". */
  optional?: boolean;
  /** Na raiz do canvas, nasce à esquerda da conta (Internet / usuários). */
  rootPlacement?: 'left';
  groupColor?: CloudGroupColor;
  /** Borda tracejada (AZ, Auto Scaling) ou contínua. */
  dashed?: boolean;
  label: LocalizedText;
  /** Uma linha: o que é, pra paleta. */
  summary: LocalizedText;
  /** Prefixo do nome padrão ("Conta 1", "Região 1"...). */
  namePrefix: LocalizedText;
  /** Tipos de pai aceitos; vazio = raiz do canvas. */
  parents: string[];
  /** Máximo de instâncias por pai (ou na raiz). */
  maxPerParent?: number;
  /** Pré-requisito além do pai — devolve o motivo do bloqueio ou `null`. */
  requires?: (context: CloudCatalogContext) => LocalizedText | null;
  defaultSize?: CloudSize;
  /** Containers filhos lado a lado (`row`, padrão) ou empilhados (`column`). */
  childLayout?: 'row' | 'column';
  /** Nós folha numa faixa acima dos containers filhos (IGW e endpoints na VPC). */
  nodeBand?: 'top';
  fields: CloudField[];
  defaults: Record<string, unknown>;
  /** Configuração inicial que depende do rascunho (CIDR livre, letra da AZ...). Pura. */
  derive?: (context: CloudCatalogContext) => Record<string, unknown>;
  /** Tipos criados junto, dentro do novo elemento (ex.: as AZs da VPC). */
  autoChildren?: (context: {
    state: CloudState;
    resource: CloudResource;
  }) => string[];
  /**
   * `false`: item de configuração da VPC (security group, NACL) — não vira
   * nó no canvas nem entra na paleta; é criado e editado nas abas.
   */
  canvas?: false;
  /** Linha de orientação no topo do inspetor (ex.: "regras na aba Segurança"). */
  inspectorHint?: LocalizedText;
  /**
   * Problemas por campo (chave → mensagem) para o inspetor e as tabelas;
   * a chave `*` é um problema do elemento inteiro (topo do inspetor, ⚠ no canvas).
   */
  validate?: (
    resource: CloudResource,
    resources: CloudResource[],
    /** Conexões do rascunho, quando quem chama tem (regras que dependem do tráfego). */
    connections?: CloudConnection[],
  ) => Partial<Record<string, LocalizedText>>;
};
