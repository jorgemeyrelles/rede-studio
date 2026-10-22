import type { AppLanguage } from '../../../types/i18n';
import type { CostService } from '../../../features/cloud/engines/cost';

/** Textos de `cost` no Studio Cloud (parte de `cloudCopy.ts`). */
export type CostCopy = {
  tab: string;
  currency: string;
  assumptions: string;
  hours: string;
  egress: string;
  interAz: string;
  /** Premissa: franquia de saída para a internet. */
  freeTier: string;
  columns: {
    resource: string;
    region: string;
    service: string;
    item: string;
    unit: string;
    quantity: string;
    unitPrice: string;
    monthly: string;
  };
  services: Record<CostService, string>;
  byService: string;
  byRegion: string;
  byLayer: string;
  transferLayer: string;
  total: string;
  perMonth: string;
  unpriced: string;
  unpricedWarning: (count: number) => string;
  free: string;
  exportCsv: string;
  footerPrices: (date: string, regions: string) => string;
  footerFx: (rate: string, date: string) => string;
  notIncluded: string;
  loading: string;
  failed: string;
  empty: string;
  itemCost: string;
  itemFree: string;
  itemNone: string;
  shared: string;
  itemTotal: string;
  headerEstimate: string;
};

export const costCopy: Record<AppLanguage, CostCopy> = {
  pt: {
    tab: 'Custo estimado',
    currency: 'Moeda',
    assumptions: 'Premissas',
    hours: 'Horas por mês (NAT, LB, IPs)',
    egress: 'Saída para a internet (GB/mês)',
    interAz: 'Entre AZs, extra (GB/mês)',
    freeTier:
      'Descontar franquias gratuitas (100 GB de saída; CloudFront: 1 TB e 10 mi de requisições)',
    columns: {
      resource: 'Recurso',
      region: 'Região',
      service: 'Serviço',
      item: 'SKU / tipo',
      unit: 'Unidade',
      quantity: 'Qtd/mês',
      unitPrice: 'Preço unitário',
      monthly: 'Mensal',
    },
    services: {
      ec2: 'EC2',
      ebs: 'EBS',
      rds: 'RDS / Aurora',
      elb: 'Load balancing',
      vpc: 'VPC (NAT, IPv4)',
      s3: 'S3',
      cloudfront: 'CloudFront',
      route53: 'Route 53',
      waf: 'WAF',
      shield: 'Shield Advanced',
      kms: 'KMS',
      secrets: 'Secrets Manager',
      ssm: 'Systems Manager',
      cognito: 'Cognito',
      lambda: 'Lambda',
      apigw: 'API Gateway',
      fargate: 'Fargate (ECS)',
      eks: 'EKS',
      ecr: 'ECR',
      elasticache: 'ElastiCache',
      dynamodb: 'DynamoDB',
      sqs: 'SQS',
      sns: 'SNS',
      efs: 'EFS',
      cloudwatch: 'CloudWatch',
      cloudtrail: 'CloudTrail',
      backup: 'AWS Backup',
      guardduty: 'GuardDuty',
      securityhub: 'Security Hub',
      config: 'AWS Config',
      transfer: 'Transferência',
    },
    byService: 'Por serviço',
    byRegion: 'Por região',
    byLayer: 'Por camada',
    transferLayer: 'Transferências',
    total: 'Total mensal estimado',
    perMonth: '/mês',
    unpriced: 'sem preço',
    unpricedWarning: (count) =>
      count === 1
        ? '1 item sem preço na região: fora do total.'
        : `${count} itens sem preço na região: fora do total.`,
    free: 'Sem custo próprio',
    exportCsv: 'Exportar CSV',
    footerPrices: (date, regions) =>
      `Preços AWS On-Demand de ${date} (${regions}).`,
    footerFx: (rate, date) => `US$ 1 = R$ ${rate}, PTAX de ${date}.`,
    notIncluded:
      'Não incluídos: monitoramento detalhado do CloudWatch, VPC Flow Logs, backups do RDS além do gratuito e snapshots.',
    loading: 'Carregando preços…',
    failed: 'Não foi possível carregar os preços de alguma região.',
    empty: 'Crie recursos para ver o custo estimado.',
    itemCost: 'Custo do item',
    itemFree: 'Este elemento não tem custo próprio na AWS.',
    itemNone: 'Sem linhas de custo.',
    shared: 'Transferências e premissas globais',
    itemTotal: 'Total do item',
    headerEstimate: 'Estimativa',
  },
  en: {
    tab: 'Cost estimate',
    currency: 'Currency',
    assumptions: 'Assumptions',
    hours: 'Hours per month (NAT, LB, IPs)',
    egress: 'Internet egress (GB/month)',
    interAz: 'Inter-AZ, extra (GB/month)',
    freeTier:
      'Deduct free tiers (100 GB of egress; CloudFront: 1 TB and 10M requests)',
    columns: {
      resource: 'Resource',
      region: 'Region',
      service: 'Service',
      item: 'SKU / type',
      unit: 'Unit',
      quantity: 'Qty/month',
      unitPrice: 'Unit price',
      monthly: 'Monthly',
    },
    services: {
      ec2: 'EC2',
      ebs: 'EBS',
      rds: 'RDS / Aurora',
      elb: 'Load balancing',
      vpc: 'VPC (NAT, IPv4)',
      s3: 'S3',
      cloudfront: 'CloudFront',
      route53: 'Route 53',
      waf: 'WAF',
      shield: 'Shield Advanced',
      kms: 'KMS',
      secrets: 'Secrets Manager',
      ssm: 'Systems Manager',
      cognito: 'Cognito',
      lambda: 'Lambda',
      apigw: 'API Gateway',
      fargate: 'Fargate (ECS)',
      eks: 'EKS',
      ecr: 'ECR',
      elasticache: 'ElastiCache',
      dynamodb: 'DynamoDB',
      sqs: 'SQS',
      sns: 'SNS',
      efs: 'EFS',
      cloudwatch: 'CloudWatch',
      cloudtrail: 'CloudTrail',
      backup: 'AWS Backup',
      guardduty: 'GuardDuty',
      securityhub: 'Security Hub',
      config: 'AWS Config',
      transfer: 'Data transfer',
    },
    byService: 'By service',
    byRegion: 'By region',
    byLayer: 'By layer',
    transferLayer: 'Data transfer',
    total: 'Estimated monthly total',
    perMonth: '/mo',
    unpriced: 'no price',
    unpricedWarning: (count) =>
      count === 1
        ? '1 item has no price in the region: left out of the total.'
        : `${count} items have no price in the region: left out of the total.`,
    free: 'No cost of their own',
    exportCsv: 'Export CSV',
    footerPrices: (date, regions) =>
      `AWS On-Demand prices from ${date} (${regions}).`,
    footerFx: (rate, date) => `US$ 1 = R$ ${rate}, PTAX of ${date}.`,
    notIncluded:
      'Not included: CloudWatch detailed monitoring, VPC Flow Logs, RDS backups beyond the free tier and snapshots.',
    loading: 'Loading prices…',
    failed: 'Could not load the prices of some region.',
    empty: 'Create resources to see the cost estimate.',
    itemCost: 'Item cost',
    itemFree: 'This element has no cost of its own on AWS.',
    itemNone: 'No cost lines.',
    shared: 'Transfers and global assumptions',
    itemTotal: 'Item total',
    headerEstimate: 'Estimate',
  },
  es: {
    tab: 'Costo estimado',
    currency: 'Moneda',
    assumptions: 'Premisas',
    hours: 'Horas por mes (NAT, LB, IP)',
    egress: 'Salida a internet (GB/mes)',
    interAz: 'Entre AZ, extra (GB/mes)',
    freeTier:
      'Descontar franquicias gratuitas (100 GB de salida; CloudFront: 1 TB y 10 M de solicitudes)',
    columns: {
      resource: 'Recurso',
      region: 'Región',
      service: 'Servicio',
      item: 'SKU / tipo',
      unit: 'Unidad',
      quantity: 'Cant./mes',
      unitPrice: 'Precio unitario',
      monthly: 'Mensual',
    },
    services: {
      ec2: 'EC2',
      ebs: 'EBS',
      rds: 'RDS / Aurora',
      elb: 'Load balancing',
      vpc: 'VPC (NAT, IPv4)',
      s3: 'S3',
      cloudfront: 'CloudFront',
      route53: 'Route 53',
      waf: 'WAF',
      shield: 'Shield Advanced',
      kms: 'KMS',
      secrets: 'Secrets Manager',
      ssm: 'Systems Manager',
      cognito: 'Cognito',
      lambda: 'Lambda',
      apigw: 'API Gateway',
      fargate: 'Fargate (ECS)',
      eks: 'EKS',
      ecr: 'ECR',
      elasticache: 'ElastiCache',
      dynamodb: 'DynamoDB',
      sqs: 'SQS',
      sns: 'SNS',
      efs: 'EFS',
      cloudwatch: 'CloudWatch',
      cloudtrail: 'CloudTrail',
      backup: 'AWS Backup',
      guardduty: 'GuardDuty',
      securityhub: 'Security Hub',
      config: 'AWS Config',
      transfer: 'Transferencia',
    },
    byService: 'Por servicio',
    byRegion: 'Por región',
    byLayer: 'Por capa',
    transferLayer: 'Transferencias',
    total: 'Total mensual estimado',
    perMonth: '/mes',
    unpriced: 'sin precio',
    unpricedWarning: (count) =>
      count === 1
        ? '1 ítem sin precio en la región: fuera del total.'
        : `${count} ítems sin precio en la región: fuera del total.`,
    free: 'Sin costo propio',
    exportCsv: 'Exportar CSV',
    footerPrices: (date, regions) =>
      `Precios AWS On-Demand del ${date} (${regions}).`,
    footerFx: (rate, date) => `US$ 1 = R$ ${rate}, PTAX del ${date}.`,
    notIncluded:
      'No incluidos: monitoreo detallado de CloudWatch, VPC Flow Logs, backups de RDS más allá del gratuito y snapshots.',
    loading: 'Cargando precios…',
    failed: 'No se pudieron cargar los precios de alguna región.',
    empty: 'Crea recursos para ver el costo estimado.',
    itemCost: 'Costo del ítem',
    itemFree: 'Este elemento no tiene costo propio en AWS.',
    itemNone: 'Sin líneas de costo.',
    shared: 'Transferencias y premisas globales',
    itemTotal: 'Total del ítem',
    headerEstimate: 'Estimación',
  },
};
