import { readStateDocument } from '../../_core';

export function getCatalogSnapshot() {
  const document = readStateDocument();
  if (!document) return null;

  return {
    customServices: document.customServices,
    certificates: document.certificates,
  };
}

export function getCustomServices() {
  const document = readStateDocument();
  if (!document) return [];
  return document.customServices;
}

export function getCertificates() {
  const document = readStateDocument();
  if (!document) return [];
  return document.certificates;
}
