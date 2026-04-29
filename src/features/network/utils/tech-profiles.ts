import {
  DEFAULT_TECH_FIELDS_BY_KIND,
  TECH_PROFILE_VERSION,
  TECH_SCHEMA,
} from '../constants';
import type {
  NodeCategory,
  NodeTechProfile,
  TechFieldSchema,
  TechKind,
  TechProfileContext,
  TechValue,
} from '../types';

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
  if (category === 'printer-3d') return 'printer';
  if (category === 'smartphone') return 'generic';
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
  return DEFAULT_TECH_FIELDS_BY_KIND[kind](context);
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

  if (ensured.kind === 'router') {
    const routingMode = String(nextFields.routingMode ?? 'static');

    // static — limpa campos ospf e bgp para não poluir a tabela
    if (routingMode === 'static') {
      nextFields.ospfArea = '0.0.0.0';
      nextFields.ospfHello = 10;
      nextFields.ospfDead = 40;
      nextFields.bgpAsn = '';
      nextFields.bgpNeighbors = '';
      nextFields.bgpPrefixListIn = '';
      nextFields.bgpPrefixListOut = '';
      nextFields.bgpMd5 = false;
    }

    // ospf — garante dead >= 4× hello
    if (routingMode === 'ospf' || routingMode === 'mixed') {
      const hello = Number(nextFields.ospfHello ?? 10);
      const dead = Number(nextFields.ospfDead ?? 40);
      if (dead < hello * 4) nextFields.ospfDead = hello * 4;
    }

    // bgp — garante que ASN não fique undefined
    if (routingMode === 'bgp' || routingMode === 'mixed') {
      if (!String(nextFields.bgpAsn ?? '').trim()) {
        nextFields.bgpAsn = '';
      }
    }
  }

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
      nextFields.encryptionSuite = 'chacha20-poly1305';
      nextFields.integrity = 'n-a';
    } else {
      if (nextFields.ikeVersion === 'n-a') nextFields.ikeVersion = 'ikev2';
      if (nextFields.authMethod === 'none') nextFields.authMethod = 'psk';
      if (nextFields.encryptionSuite === 'n-a') {
        nextFields.encryptionSuite = 'aes-256-gcm';
      }

      // IKEv1 não suporta cifras AEAD — forçar para AES-CBC
      const AEAD_CIPHERS = new Set([
        'aes-256-gcm',
        'aes-128-gcm',
        'chacha20-poly1305',
      ]);
      const cipher = String(nextFields.encryptionSuite ?? 'aes-256-gcm');
      const ikeVersion = String(nextFields.ikeVersion ?? 'ikev2');

      if (ikeVersion === 'ikev1' && AEAD_CIPHERS.has(cipher)) {
        nextFields.encryptionSuite = 'aes-256-cbc';
      }

      // Cifras AEAD já autenticam — integridade separada deve ser n-a
      // Cifras não-AEAD precisam de integridade explícita
      const resolvedCipher = String(nextFields.encryptionSuite ?? 'aes-256-gcm');
      if (AEAD_CIPHERS.has(resolvedCipher)) {
        nextFields.integrity = 'n-a';
      } else if (
        nextFields.integrity === 'n-a' ||
        nextFields.integrity === undefined
      ) {
        nextFields.integrity = 'sha-256';
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

  if (category === 'router') {
    const routingMode = String(normalized.fields.routingMode ?? 'static');
    if (
      (routingMode === 'bgp' || routingMode === 'mixed') &&
      !String(normalized.fields.bgpAsn ?? '').trim()
    ) {
      warnings.push('BGP configurado sem ASN local definido.');
    }
    if (
      (routingMode === 'bgp' || routingMode === 'mixed') &&
      !String(normalized.fields.bgpNeighbors ?? '').trim()
    ) {
      warnings.push('BGP sem vizinhos (neighbors) configurados.');
    }
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
