import { mutateStateDocument } from '../../_core';

export function deleteCustomService(id: string) {
  return mutateStateDocument((document) => {
    document.customServices = document.customServices.filter(
      (item) => item.id !== id,
    );
    return { id };
  });
}

export function deleteCertificate(id: string) {
  return mutateStateDocument((document) => {
    document.certificates = document.certificates.filter((item) => item.id !== id);
    document.sslVpnProfiles = document.sslVpnProfiles.map((item) =>
      item.serverCertId === id ? { ...item, serverCertId: undefined } : item,
    );
    return { id };
  });
}
