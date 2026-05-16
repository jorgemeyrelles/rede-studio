import { mutateStateDocument } from '../../_core';

export function deleteCertificate(id: string) {
  return mutateStateDocument((document) => {
    document.certificates = document.certificates.filter((item) => item.id !== id);
    document.sslVpnProfiles = document.sslVpnProfiles.map((item) =>
      item.serverCertId === id ? { ...item, serverCertId: undefined } : item,
    );
    return { id };
  });
}

export function deleteIpsecSa(id: string) {
  return mutateStateDocument((document) => {
    document.ipsecSas = document.ipsecSas.filter((item) => item.id !== id);
    return { id };
  });
}

export function deleteSslVpnProfile(id: string) {
  return mutateStateDocument((document) => {
    document.sslVpnProfiles = document.sslVpnProfiles.filter(
      (item) => item.id !== id,
    );
    return { id };
  });
}
