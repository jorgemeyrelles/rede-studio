import {
  LEGEND_PANEL_COPY,
  NETWORK_DIAGRAM_COPY,
  PDF_REPORT_COPY,
  ROUTE_FIREWALL_COPY,
  SITE_VLAN_COPY,
  STUDIO_APP_COPY,
  STUDIO_PAGE_COPY,
  STUDIO_TOOLBAR_COPY,
} from '../constants';
import type { StudioLanguage } from '../types';

export function getStudioToolbarCopy(language: StudioLanguage) {
  return STUDIO_TOOLBAR_COPY[language];
}

export function getStudioAppCopy(language: StudioLanguage) {
  return STUDIO_APP_COPY[language];
}

export function getStudioPageCopy(language: StudioLanguage) {
  return STUDIO_PAGE_COPY[language];
}

export function getLegendPanelCopy(language: StudioLanguage) {
  return LEGEND_PANEL_COPY[language];
}

export function getSiteVlanCopy(language: StudioLanguage) {
  return SITE_VLAN_COPY[language];
}

export function getRouteFirewallCopy(language: StudioLanguage) {
  return ROUTE_FIREWALL_COPY[language];
}

export function getNetworkDiagramCopy(language: StudioLanguage) {
  return NETWORK_DIAGRAM_COPY[language];
}

export function getPdfReportCopy(language: StudioLanguage) {
  return PDF_REPORT_COPY[language];
}

export function getNextStudioLanguage(
  language: StudioLanguage,
): StudioLanguage {
  if (language === 'pt') return 'en';
  if (language === 'en') return 'es';
  return 'pt';
}
