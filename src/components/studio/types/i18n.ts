export type StudioLanguage = 'pt' | 'en' | 'es';

export type LanguageOption = {
  value: StudioLanguage;
  label: string;
  flag: string;
};

export type StudioToolbarCopy = {
  newSite: string;
  total: string;
  relationsTitle: string;
  active: string;
  searchPlaceholder: string;
  addRelationSite: string;
};

export type StudioAppCopy = {
  headerTitle: string;
  slides: string;
  studio: string;
  languageAriaLabel: string;
};

export type StudioPageCopy = {
  proposalTitle: string;
  diagramTitle: string;
  infoHint: string;
  dashboardTitle: string;
  localPersistence: string;
  lastSave: string;
  notSavedYet: string;
  warning: string;
  resetData: string;
  confirmReset: string;
  resetQuestion: string;
  cancel: string;
  confirm: string;
};

export type LegendPanelCopy = {
  title: string;
  relationBetweenSites: string;
  delete: string;
  emptySites: string;
  addLayer: string;
  addIcon: string;
  addComponentLayer: string;
  last: string;
  searchTypePlaceholder: string;
  default: string;
  noComponents: string;
};

export type SiteVlanPanelCopy = {
  title: string;
  createSiteFirst: string;
  vlanPlaceholder: string;
  vlanNamePlaceholder: string;
  addVlan: string;
  noVlanSite: string;
  diagramModeOn: string;
  selectDiagram: string;
  remove: string;
  elementsSelected: string;
  noElementsSite: string;
  vlanTableBySite: string;
  item: string;
  ipRange: string;
  type: string;
  connections: string;
  noElementsInVlan: string;
  footer: string;
};

export type RouteFirewallCopy = {
  routeTableTitle: string;
  type: string;
  destinationNetwork: string;
  gateway: string;
  interface: string;
  emptyRoutes: string;
  otherIps: string;
  firewallTitle: string;
  action: string;
  source: string;
  destination: string;
  portService: string;
  emptyRules: string;
  routeGatewayByType: string;
  routeTypeDirect: string;
  routeTypeDefault: string;
  routeTypeVpn: string;
  routeTypeStatic: string;
  routeHelpDirect: string;
  routeHelpDefault: string;
  routeHelpVpn: string;
  routeHelpStatic: string;
  interfaceDynamicNumbering: string;
  interfaceHelpLine1: string;
  interfaceHelpLine2: string;
  interfaceHelpLine3: string;
};

export type NetworkDiagramCopy = {
  close: string;
  id: string;
  name: string;
  vlans: string;
  noVlanAssigned: string;
  wanNoLocalIp: string;
  info: string;
  validations: string;
  technicalProfile: string;
  yes: string;
  no: string;
  siteDetails: string;
  octet: string;
};
