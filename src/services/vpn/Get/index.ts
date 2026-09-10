import { readStateDocument } from '../../_core';

export function getVpnSnapshot() {
  const document = readStateDocument();
  if (!document) return null;

  return {
    certificates: document.certificates,
    ipsecSas: document.ipsecSas,
    sslVpnProfiles: document.sslVpnProfiles,
  };
}

export function getIpsecSasByLink(linkId: string) {
  const document = readStateDocument();
  if (!document) return [];

  return document.ipsecSas.filter((item) => item.linkId === linkId);
}
