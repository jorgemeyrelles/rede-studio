import type { NodeCategory } from './types';

export type TechValue = string | number | boolean;

export type NodeTechProfile = {
  kind: string;
  version: number;
  fields: Record<string, TechValue>;
};

export type TechFieldSchema = {
  key: string;
  label: string;
  type: 'text' | 'number' | 'boolean' | 'select';
  options?: string[];
  min?: number;
  max?: number;
  visibleWhen?: Partial<Record<string, TechValue | TechValue[]>>;
};

export type TechProfileContext = {
  category: NodeCategory;
  layerOrder: number;
  shouldBeGateway: boolean;
  siteNodeCount?: number;
};

type TechKind =
  | 'router'
  | 'firewall'
  | 'vpn'
  | 'ids'
  | 'access-point'
  | 'printer'
  | 'generic';

const TECH_PROFILE_VERSION = 1;

const TECH_SCHEMA: Record<TechKind, TechFieldSchema[]> = {
  router: [
    { key: 'gatewayDefault', label: 'Gateway Padrao', type: 'boolean' },
    {
      key: 'routingMode',
      label: 'Roteamento',
      type: 'select',
      options: ['static', 'ospf', 'bgp', 'mixed'],
    },
    {
      key: 'natMode',
      label: 'NAT',
      type: 'select',
      options: ['none', 'snat', 'dnat', 'pat', 'hybrid'],
    },
    {
      key: 'stateMode',
      label: 'Estado',
      type: 'select',
      options: ['stateful', 'stateless', 'n-a'],
    },
    { key: 'wanUplink', label: 'Uplink WAN', type: 'text' },
  ],
  firewall: [
    { key: 'gatewayDefault', label: 'Gateway Padrao', type: 'boolean' },
    {
      key: 'natMode',
      label: 'NAT',
      type: 'select',
      options: ['none', 'snat', 'dnat', 'pat', 'hybrid'],
    },
    {
      key: 'stateMode',
      label: 'Modo de Inspecao',
      type: 'select',
      options: ['stateful', 'stateless'],
    },
    {
      key: 'defaultPolicy',
      label: 'Politica Padrao',
      type: 'select',
      options: ['deny', 'allow'],
    },
    {
      key: 'idsIpsIntegration',
      label: 'Integracao IDS/IPS',
      type: 'select',
      options: ['none', 'ids', 'ips', 'both'],
    },
  ],
  vpn: [
    {
      key: 'tunnelType',
      label: 'Tipo de Tunel',
      type: 'select',
      options: [
        'ipsec-site-to-site',
        'ssl-remote',
        'wireguard',
        'sdwan',
        'mpls',
        'gre',
      ],
    },
    { key: 'encryptionSuite', label: 'Criptografia', type: 'text' },
    {
      key: 'authMethod',
      label: 'Autenticacao',
      type: 'select',
      options: ['psk', 'certificate', 'eap', 'keypair', 'none'],
    },
    {
      key: 'ikeVersion',
      label: 'IKE',
      type: 'select',
      options: ['ikev1', 'ikev2', 'n-a'],
    },
    { key: 'remotePeer', label: 'Peer Remoto', type: 'text' },
    { key: 'dpdKeepalive', label: 'DPD/Keepalive', type: 'boolean' },
    {
      key: 'failoverPolicy',
      label: 'Failover',
      type: 'select',
      options: ['manual', 'active-passive', 'active-active'],
    },
  ],
  ids: [
    {
      key: 'inspectionMode',
      label: 'Modo',
      type: 'select',
      options: ['ids', 'ips'],
    },
    {
      key: 'signatureProfile',
      label: 'Perfil de Assinatura',
      type: 'select',
      options: ['balanced', 'strict', 'custom'],
    },
    {
      key: 'anomalyDetection',
      label: 'Deteccao de Anomalia',
      type: 'boolean',
    },
    {
      key: 'responseAction',
      label: 'Acao',
      type: 'select',
      options: ['alert', 'drop', 'quarantine'],
    },
    {
      key: 'feedUpdate',
      label: 'Atualizacao de Feed',
      type: 'select',
      options: ['auto', 'manual'],
    },
  ],
  'access-point': [
    { key: 'ssid', label: 'SSID', type: 'text' },
    {
      key: 'band',
      label: 'Banda',
      type: 'select',
      options: ['2.4GHz', '5GHz', '6GHz', 'dual-band'],
    },
    {
      key: 'channelWidth',
      label: 'Largura de Canal',
      type: 'select',
      options: ['20MHz', '40MHz', '80MHz', '160MHz'],
    },
    {
      key: 'wirelessSecurity',
      label: 'Seguranca',
      type: 'select',
      options: ['wpa2-psk', 'wpa3-psk', 'wpa2-enterprise', 'wpa3-enterprise'],
    },
    {
      key: 'authServer',
      label: 'Servidor AAA',
      type: 'text',
      visibleWhen: {
        wirelessSecurity: ['wpa2-enterprise', 'wpa3-enterprise'],
      },
    },
    { key: 'vlanMapping', label: 'Mapeamento VLAN', type: 'text' },
    {
      key: 'controllerMode',
      label: 'Modo de Controle',
      type: 'select',
      options: ['standalone', 'managed'],
    },
    { key: 'guestIsolation', label: 'Isolamento Cliente', type: 'boolean' },
  ],
  printer: [
    {
      key: 'printerProtocol',
      label: 'Protocolo',
      type: 'select',
      options: ['tcp-ip', 'ipp', 'lpr'],
    },
    { key: 'queueName', label: 'Fila', type: 'text' },
    { key: 'dhcpReserved', label: 'DHCP Reservado', type: 'boolean' },
    { key: 'snmpEnabled', label: 'SNMP', type: 'boolean' },
  ],
  generic: [{ key: 'role', label: 'Funcao', type: 'text' }],
};

export function resolveTechKind(category: NodeCategory): TechKind {
  if (category === 'router') return 'router';
  if (category === 'firewall') return 'firewall';
  if (
    category === 'vpn' ||
    category === 'ipsec' ||
    category === 'wireguard' ||
    category === 'sdwan' ||
    category === 'mpls' ||
    category === 'gre'
  ) {
    return 'vpn';
  }
  if (category === 'ids' || category === 'ips') return 'ids';
  if (category === 'access-point') return 'access-point';
  if (category === 'printer') return 'printer';
  return 'generic';
}

export function getTechSchema(kind: string): TechFieldSchema[] {
  return TECH_SCHEMA[(kind as TechKind) ?? 'generic'] ?? TECH_SCHEMA.generic;
}

export function getVisibleTechSchema(
  kind: string,
  fields: Record<string, TechValue>,
): TechFieldSchema[] {
  return getTechSchema(kind).filter((field) => {
    if (!field.visibleWhen) return true;
    return Object.entries(field.visibleWhen).every(([depKey, depValue]) => {
      const current = fields[depKey];
      if (Array.isArray(depValue)) {
        return depValue.includes(current);
      }
      return current === depValue;
    });
  });
}

function getDefaultFieldsByKind(
  kind: TechKind,
  context: TechProfileContext,
): Record<string, TechValue> {
  if (kind === 'router') {
    return {
      gatewayDefault: context.shouldBeGateway,
      routingMode: context.layerOrder === 1 ? 'ospf' : 'static',
      natMode: context.layerOrder === 1 ? 'pat' : 'none',
      stateMode: 'stateful',
      wanUplink: 'ethernet-1g',
    };
  }

  if (kind === 'firewall') {
    return {
      gatewayDefault: context.shouldBeGateway,
      natMode: 'pat',
      stateMode: 'stateful',
      defaultPolicy: 'deny',
      idsIpsIntegration: 'none',
    };
  }

  if (kind === 'vpn') {
    const tunnelTypeMap: Partial<Record<NodeCategory, string>> = {
      vpn: 'ipsec-site-to-site',
      ipsec: 'ipsec-site-to-site',
      wireguard: 'wireguard',
      sdwan: 'sdwan',
      mpls: 'mpls',
      gre: 'gre',
    };
    return {
      tunnelType: tunnelTypeMap[context.category] ?? 'ipsec-site-to-site',
      encryptionSuite: 'aes-256-gcm',
      authMethod: 'psk',
      ikeVersion:
        context.category === 'gre' || context.category === 'mpls'
          ? 'n-a'
          : 'ikev2',
      remotePeer: 'peer.example.net',
      dpdKeepalive: true,
      failoverPolicy: 'active-passive',
    };
  }

  if (kind === 'ids') {
    return {
      inspectionMode: context.category === 'ips' ? 'ips' : 'ids',
      signatureProfile: 'balanced',
      anomalyDetection: true,
      responseAction: context.category === 'ips' ? 'drop' : 'alert',
      feedUpdate: 'auto',
    };
  }

  if (kind === 'access-point') {
    return {
      ssid: 'CorpWiFi',
      band: 'dual-band',
      channelWidth: '40MHz',
      wirelessSecurity: 'wpa2-enterprise',
      authServer: 'radius.site.local',
      vlanMapping: '40',
      controllerMode: 'managed',
      guestIsolation: true,
    };
  }

  if (kind === 'printer') {
    return {
      printerProtocol: 'tcp-ip',
      queueName: 'PRN-CORP',
      dhcpReserved: true,
      snmpEnabled: true,
    };
  }

  return {
    role: context.category,
  };
}

export function buildDefaultTechProfile(
  category: NodeCategory,
  context: Omit<TechProfileContext, 'category'>,
): NodeTechProfile {
  const kind = resolveTechKind(category);
  return {
    kind,
    version: TECH_PROFILE_VERSION,
    fields: getDefaultFieldsByKind(kind, {
      category,
      layerOrder: context.layerOrder,
      shouldBeGateway: context.shouldBeGateway,
      siteNodeCount: context.siteNodeCount,
    }),
  };
}

export function ensureTechProfile(
  category: NodeCategory,
  profile: NodeTechProfile | undefined,
  context: Omit<TechProfileContext, 'category'>,
): NodeTechProfile {
  const defaultProfile = buildDefaultTechProfile(category, context);
  if (!profile) return defaultProfile;
  if (!profile.kind) return defaultProfile;

  return {
    ...defaultProfile,
    ...profile,
    fields: {
      ...defaultProfile.fields,
      ...profile.fields,
    },
  };
}

export function normalizeTechProfile(
  category: NodeCategory,
  profile: NodeTechProfile,
  context: Omit<TechProfileContext, 'category'>,
): NodeTechProfile {
  const ensured = ensureTechProfile(category, profile, context);
  const nextFields = { ...ensured.fields };

  if (ensured.kind === 'vpn') {
    const tunnelType = String(nextFields.tunnelType ?? 'ipsec-site-to-site');
    if (tunnelType === 'gre' || tunnelType === 'mpls') {
      nextFields.ikeVersion = 'n-a';
      nextFields.authMethod = 'none';
      nextFields.encryptionSuite = 'n-a';
      nextFields.dpdKeepalive = false;
    } else if (tunnelType === 'wireguard') {
      nextFields.ikeVersion = 'n-a';
      nextFields.authMethod = 'keypair';
    } else {
      if (nextFields.ikeVersion === 'n-a') nextFields.ikeVersion = 'ikev2';
      if (nextFields.authMethod === 'none') nextFields.authMethod = 'psk';
      if (nextFields.encryptionSuite === 'n-a') {
        nextFields.encryptionSuite = 'aes-256-gcm';
      }
    }
  }

  if (ensured.kind === 'ids') {
    const inspectionMode = String(nextFields.inspectionMode ?? 'ids');
    if (inspectionMode === 'ids' && nextFields.responseAction === 'drop') {
      nextFields.responseAction = 'alert';
    }
    if (inspectionMode === 'ips' && nextFields.responseAction === 'alert') {
      nextFields.responseAction = 'drop';
    }
  }

  if (ensured.kind === 'access-point') {
    const security = String(nextFields.wirelessSecurity ?? 'wpa2-enterprise');
    const isEnterprise =
      security === 'wpa2-enterprise' || security === 'wpa3-enterprise';
    if (!isEnterprise) {
      nextFields.authServer = '';
    } else if (!String(nextFields.authServer ?? '').trim()) {
      nextFields.authServer = 'radius.site.local';
    }
  }

  if (ensured.kind === 'printer') {
    const protocol = String(nextFields.printerProtocol ?? 'tcp-ip');
    if (!String(nextFields.queueName ?? '').trim()) {
      nextFields.queueName =
        protocol === 'tcp-ip' ? 'RAW-9100' : 'printer-queue';
    }
  }

  return {
    ...ensured,
    fields: nextFields,
  };
}

export function getTechProfileWarnings(
  category: NodeCategory,
  profile: NodeTechProfile,
  context: Omit<TechProfileContext, 'category'>,
): string[] {
  const normalized = normalizeTechProfile(category, profile, context);
  const warnings: string[] = [];

  if (
    (category === 'router' || category === 'firewall') &&
    context.layerOrder !== 1 &&
    normalized.fields.gatewayDefault === true
  ) {
    warnings.push(
      'Gateway padrao fora da Camada 1 pode gerar roteamento inconsistente.',
    );
  }

  if (normalized.kind === 'vpn') {
    const tunnelType = String(normalized.fields.tunnelType ?? '');
    const remotePeer = String(normalized.fields.remotePeer ?? '').trim();
    if (tunnelType !== 'mpls' && !remotePeer) {
      warnings.push('Peer remoto deve ser informado para o tunel.');
    }
    if (
      (tunnelType === 'gre' || tunnelType === 'mpls') &&
      normalized.fields.ikeVersion !== 'n-a'
    ) {
      warnings.push(
        'GRE/MPLS nao utilizam IKE; o campo deve permanecer como n-a.',
      );
    }
  }

  if (normalized.kind === 'access-point') {
    const security = String(normalized.fields.wirelessSecurity ?? '');
    const authServer = String(normalized.fields.authServer ?? '').trim();
    const isEnterprise =
      security === 'wpa2-enterprise' || security === 'wpa3-enterprise';
    if (isEnterprise && !authServer) {
      warnings.push('Perfis enterprise exigem servidor AAA/RADIUS definido.');
    }
    if (context.layerOrder > 0 && context.layerOrder < 3) {
      warnings.push('Access Point normalmente fica da Camada 3 para baixo.');
    }
  }

  if (normalized.kind === 'printer') {
    const protocol = String(normalized.fields.printerProtocol ?? 'tcp-ip');
    const queueName = String(normalized.fields.queueName ?? '').trim();
    if ((protocol === 'ipp' || protocol === 'lpr') && !queueName) {
      warnings.push('IPP/LPR devem possuir fila configurada.');
    }
  }

  if (normalized.kind === 'ids') {
    const inspectionMode = String(normalized.fields.inspectionMode ?? 'ids');
    const responseAction = String(normalized.fields.responseAction ?? 'alert');
    if (inspectionMode === 'ids' && responseAction === 'drop') {
      warnings.push(
        'IDS normalmente apenas alerta; drop caracteriza comportamento de IPS.',
      );
    }
  }

  if (
    (category === 'router' || category === 'firewall') &&
    context.siteNodeCount === 1 &&
    normalized.fields.gatewayDefault !== true
  ) {
    warnings.push(
      'Primeiro elemento de borda do site normalmente deve ser o gateway padrao.',
    );
  }

  return warnings;
}
