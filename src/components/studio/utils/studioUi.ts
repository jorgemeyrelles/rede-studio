import { servicesRoutes } from '../../../services';
import type { StudioLanguage } from '../types';

/**
 * Textos de UI internos do Studio (inspetores, tabelas, flags, diagrama).
 * Muitos desses componentes são subcomponentes profundos que não recebem
 * `language` por prop; `ui()` resolve o idioma pela rota atual
 * (`/#/:lang/...`, HashRouter) com fallback na preferência salva. A troca
 * de idioma navega e re-renderiza a árvore do Studio, então o texto acompanha.
 */
export type StudioUiCopy = {
  addLevel: string;
  addLevelDisabled: string;
  newLogicalNetwork: string;
  networkInfo: string;
  connectionInspector: string;
  forceStateful: string;
  forceStateless: string;
  bidirectionalLinkHint: string;
  linkDescriptionPlaceholder: string;
  wanLinkProfile: string;
  vpnTunnel: string;
  preserveDscp: string;
  derivedRouteMeta: string;
  siteOwner: string;
  inferredGateway: string;
  inferredDestination: string;
  derivedAclSummary: string;
  noManagedAcl: string;
  effectiveSource: string;
  effectiveDestination: string;
  defaultService: string;
  returnExceptionNo: string;
  selectOption: string;
  noItems: string;
  fitDiagram: string;
  centerDiagram: string;
  originSite: string;
  notDefinedOption: string;
  deviceName: string;
  noVlanAssigned: string;
  noVlanAssignedToObject: string;
  cryptoProfile: string;
  maxSessions: string;
  notDefined: string;
  noPolicies: string;
  noNatRules: string;
  multipleStrictQueues: string;
  noQueues: string;
  simulateSession: string;
  noActiveSessions: string;
  addBestEffortQueue: string;
  selectNode: string;
  anyService: string;
  noSite: string;
  otherIp: string;
  noPeers: string;
  editNeighbors: string;
  staticRoutesHint: string;
  notConfigured: string;
  initialSuggestionApplied: string;
  prefixListHint: string;
  bgpMd5Auth: string;
  natPat: string;
  natSnat: string;
  natDnat: string;
  natHybrid: string;
  flagStateless: string;
  flagBidirectional: string;
  flagPassthrough: string;
  flagConflict: string;
  flagNatExempt: string;
  flagManaged: string;
  flagReturnException: string;
  flagMissingReturn: string;
  qosTitle: string;
  bidirectionalOn: string;
  bidirectionalOff: string;
  removeRule: string;
  applySuggestion: string;
  trafficClass: string;
  defaultOption: string;
  clearFilters: string;
  manualExceptions: string;
  noManualRules: string;
  noTopologyRules: string;
  toggleExceptionsPosition: string;
  exceptionsBefore: string;
  exceptionsAfter: string;
  cancel: string;
  newRule: string;
  newManualRule: string;
  sourceNode: string;
  destinationNode: string;
  priorityHint: string;
  routingProtocolsTab: string;
  noIke: string;
  infoAbout: string;
  zoom: string;
  halfDuplex: string;
  fullDuplex: string;
  addSelected: string;
  networkColumn: string;
  zoneColumn: string;
  rowActions: string;
  newLan: string;
  newLanTitle: string;
  deleteSite: string;
  deleteLan: string;
  deleteTier: string;
  deleteComponent: string;
  addComponent: string;
  addTierNamed: string;
  otherTier: string;
  tierFree: string;
  remoteToggle: string;
  familyPerimeter: string;
  familySwitching: string;
  familyServices: string;
  familyEndpoints: string;
  familyTunnels: string;
  components: string;
  ungroupedLayers: string;
  networkBlock: string;
  networkFamily: string;
  networkHosts: string;
  networkLayers: string;
  networkVlans: string;
  purposePrincipal: string;
  purposeDmz: string;
  purposeGestao: string;
  purposeCliente: string;
  purposeBackup: string;
  purposeCustom: string;
  familyLegacy: string;
  familyPrivate: string;
  noTypeMatch: string;
  lastUsed: string;
  structureHint: string;
  lanName: string;
};

const STUDIO_UI_COPY: Record<StudioLanguage, StudioUiCopy> = {
  pt: {
    addLevel: 'Adicionar nível',
    addLevelDisabled:
      'Adicionar nível manualmente está desabilitado — use a barra de ferramentas',
    newLogicalNetwork: 'Nova rede lógica',
    networkInfo: 'Informações da rede',
    connectionInspector: 'Inspetor de conexão',
    forceStateful: 'Forçar stateful',
    forceStateless: 'Forçar stateless',
    bidirectionalLinkHint:
      'Ligado: 1 linha de ida cobre os dois sentidos. Desligado: cria uma linha de exceção de retorno na seção manual da tabela de firewall (apagá-la religa o bidirecional).',
    linkDescriptionPlaceholder: 'Descrição do link…',
    wanLinkProfile: 'Perfil WAN do link',
    vpnTunnel: 'Túnel VPN/IPsec',
    preserveDscp: 'Preservar DSCP no túnel',
    derivedRouteMeta: 'Metadados de rota (derivados)',
    siteOwner: 'Site responsável',
    inferredGateway: 'Gateway inferido',
    inferredDestination: 'Destino inferido',
    derivedAclSummary: 'Resumo ACL derivado',
    noManagedAcl: 'Nenhuma regra ACL gerenciada encontrada para este link.',
    effectiveSource: 'Origem efetiva',
    effectiveDestination: 'Destino efetivo',
    defaultService: 'Serviço padrão',
    returnExceptionNo: 'Não — exceção de retorno na seção manual',
    selectOption: 'Selecionar opção…',
    noItems: 'Sem itens.',
    fitDiagram: 'Enquadrar diagrama',
    centerDiagram: 'Centralizar diagrama',
    originSite: 'Site de origem:',
    notDefinedOption: '— não definido —',
    deviceName: 'Nome do dispositivo',
    noVlanAssigned: 'Sem VLAN atribuída',
    noVlanAssignedToObject: 'Sem VLAN atribuída ao objeto.',
    cryptoProfile: 'Perfil criptográfico',
    maxSessions: 'Máx. sessões',
    notDefined: 'não definido',
    noPolicies: 'Nenhuma política configurada.',
    noNatRules: 'Nenhuma regra NAT.',
    multipleStrictQueues: 'Mais de uma fila strict — apenas uma é recomendada.',
    noQueues: 'Nenhuma fila configurada.',
    simulateSession: 'Simular sessão',
    noActiveSessions: 'Nenhuma sessão ativa.',
    addBestEffortQueue: 'Adicione uma fila best-effort como fallback.',
    selectNode: 'Selecionar nó…',
    anyService: 'Qualquer (ANY)',
    noSite: 'Sem site',
    otherIp: 'Outro IP…',
    noPeers: 'Sem peers adicionados.',
    editNeighbors: 'Editar neighbors',
    staticRoutesHint: 'Rotas configuradas manualmente — sem protocolo dinâmico',
    notConfigured: '(não configurados)',
    initialSuggestionApplied: 'Sugestão inicial aplicada automaticamente.',
    prefixListHint:
      'Prefix-list é opcional e aceita edição livre por lista CSV.',
    bgpMd5Auth: 'BGP — autenticação MD5',
    natPat: 'Destino verá o IP do firewall (PAT)',
    natSnat: 'Origem aparece como IP mapeado (SNAT)',
    natDnat: 'Destino é IP público → privado (DNAT)',
    natHybrid: 'Modo híbrido NAT + DNAT',
    flagStateless: 'Stateless — sem rastreamento de conexão',
    flagBidirectional: 'Bidirecional — regra de retorno gerada automaticamente',
    flagPassthrough: 'Passthrough — sem firewall ou roteador no caminho',
    flagConflict: 'Conflito: regra DENY manual sobrescreve ALLOW de topologia',
    flagNatExempt: 'NAT Exempt — bypass de NAT para tráfego IPsec',
    flagManaged: 'Gerenciada automaticamente pela topologia — não editável',
    flagReturnException:
      'Exceção de retorno — criada ao desligar o bidirecional da linha de ida. Remover esta linha religa o bidirecional.',
    flagMissingReturn:
      'Stateless sem regra de retorno — tráfego de resposta pode ser bloqueado',
    qosTitle: 'QoS — qualidade de serviço',
    bidirectionalOn:
      'Bidirecional — 1 linha cobre ida e volta. Desligar cria uma linha de exceção para a volta na seção manual.',
    bidirectionalOff:
      'Direcional — existe uma linha de exceção de retorno na seção manual. Clique para religar o bidirecional e removê-la.',
    removeRule: 'Remover regra',
    applySuggestion: 'Aplicar sugestão',
    trafficClass: 'Classe de tráfego',
    defaultOption: '— padrão —',
    clearFilters: 'Limpar filtros',
    manualExceptions: 'Exceções manuais (zona B)',
    noManualRules: 'Nenhuma regra manual. Adicione com "Nova regra" acima.',
    noTopologyRules: 'Nenhuma regra de topologia gerada ainda.',
    toggleExceptionsPosition: 'Alternar posição das exceções manuais',
    exceptionsBefore: 'exceções: antes',
    exceptionsAfter: 'exceções: depois',
    cancel: 'Cancelar',
    newRule: 'Nova regra',
    newManualRule: 'Nova regra manual',
    sourceNode: 'Origem (nó)',
    destinationNode: 'Destino (nó)',
    priorityHint: 'Prioridade — menor valor = avaliado primeiro',
    routingProtocolsTab: 'Protocolos (OSPF/BGP)',
    noIke: '⚠ sem IKE',
    infoAbout: 'Informações sobre',
    zoom: 'Zoom',
    halfDuplex: 'Half-duplex — transmite e recebe em turnos alternados.',
    fullDuplex: 'Full-duplex — transmite e recebe simultaneamente.',
    addSelected: 'Adicionar selecionado',
    networkColumn: 'Rede',
    zoneColumn: 'Zona',
    rowActions: 'Ações',
    newLan: 'Nova LAN',
    newLanTitle: 'Nova rede lógica (LAN)',
    deleteSite: 'Excluir site',
    deleteLan: 'Excluir LAN',
    deleteTier: 'Excluir camada',
    deleteComponent: 'Excluir componente',
    addComponent: 'Adicionar componente',
    addTierNamed: 'Adicionar',
    otherTier: 'Outra camada',
    tierFree: 'Livre',
    remoteToggle: 'Endpoint remoto (fora do site)',
    familyPerimeter: 'Perímetro',
    familySwitching: 'Comutação e acesso',
    familyServices: 'Serviços',
    familyEndpoints: 'Endpoints',
    familyTunnels: 'Túneis e WAN',
    components: 'componentes',
    ungroupedLayers: 'Camadas sem LAN',
    networkBlock: 'Bloco',
    networkFamily: 'Família',
    networkHosts: 'Hosts',
    networkLayers: 'Camadas',
    networkVlans: 'VLANs',
    purposePrincipal: 'Principal',
    purposeDmz: 'DMZ',
    purposeGestao: 'Gerência',
    purposeCliente: 'Cliente',
    purposeBackup: 'Backup',
    purposeCustom: 'Livre',
    familyLegacy: '200.x (legado)',
    familyPrivate: 'privado',
    noTypeMatch: 'Nenhum tipo encontrado.',
    lastUsed: 'último usado',
    structureHint: 'Clique num componente para localizá-lo no diagrama.',
    lanName: 'Nome da LAN',
  },
  en: {
    addLevel: 'Add level',
    addLevelDisabled: 'Adding levels manually is disabled — use the toolbar',
    newLogicalNetwork: 'New logical network',
    networkInfo: 'Network information',
    connectionInspector: 'Connection inspector',
    forceStateful: 'Force stateful',
    forceStateless: 'Force stateless',
    bidirectionalLinkHint:
      'On: one forward row covers both directions. Off: creates a return exception row in the manual section of the firewall table (deleting it turns bidirectional back on).',
    linkDescriptionPlaceholder: 'Link description…',
    wanLinkProfile: 'Link WAN profile',
    vpnTunnel: 'VPN/IPsec tunnel',
    preserveDscp: 'Preserve DSCP in tunnel',
    derivedRouteMeta: 'Route metadata (derived)',
    siteOwner: 'Owner site',
    inferredGateway: 'Inferred gateway',
    inferredDestination: 'Inferred destination',
    derivedAclSummary: 'Derived ACL summary',
    noManagedAcl: 'No managed ACL rule found for this link.',
    effectiveSource: 'Effective source',
    effectiveDestination: 'Effective destination',
    defaultService: 'Default service',
    returnExceptionNo: 'No — return exception in the manual section',
    selectOption: 'Select an option…',
    noItems: 'No items.',
    fitDiagram: 'Fit diagram',
    centerDiagram: 'Center diagram',
    originSite: 'Origin site:',
    notDefinedOption: '— not set —',
    deviceName: 'Device name',
    noVlanAssigned: 'No VLAN assigned',
    noVlanAssignedToObject: 'No VLAN assigned to this object.',
    cryptoProfile: 'Crypto profile',
    maxSessions: 'Max. sessions',
    notDefined: 'not set',
    noPolicies: 'No policies configured.',
    noNatRules: 'No NAT rules.',
    multipleStrictQueues:
      'More than one strict queue — only one is recommended.',
    noQueues: 'No queues configured.',
    simulateSession: 'Simulate session',
    noActiveSessions: 'No active sessions.',
    addBestEffortQueue: 'Add a best-effort queue as a fallback.',
    selectNode: 'Select node…',
    anyService: 'Any (ANY)',
    noSite: 'No site',
    otherIp: 'Other IP…',
    noPeers: 'No peers added.',
    editNeighbors: 'Edit neighbors',
    staticRoutesHint: 'Manually configured routes — no dynamic protocol',
    notConfigured: '(not configured)',
    initialSuggestionApplied: 'Initial suggestion applied automatically.',
    prefixListHint:
      'Prefix-list is optional and accepts free editing as a CSV list.',
    bgpMd5Auth: 'BGP — MD5 authentication',
    natPat: 'Destination sees the firewall IP (PAT)',
    natSnat: 'Source appears as mapped IP (SNAT)',
    natDnat: 'Destination is public → private IP (DNAT)',
    natHybrid: 'Hybrid NAT + DNAT mode',
    flagStateless: 'Stateless — no connection tracking',
    flagBidirectional: 'Bidirectional — return rule generated automatically',
    flagPassthrough: 'Passthrough — no firewall or router in the path',
    flagConflict: 'Conflict: manual DENY rule overrides topology ALLOW',
    flagNatExempt: 'NAT exempt — NAT bypass for IPsec traffic',
    flagManaged: 'Managed automatically by the topology — not editable',
    flagReturnException:
      'Return exception — created when bidirectional is turned off on the forward row. Removing this row turns bidirectional back on.',
    flagMissingReturn:
      'Stateless without return rule — reply traffic may be blocked',
    qosTitle: 'QoS — quality of service',
    bidirectionalOn:
      'Bidirectional — one row covers both ways. Turning it off creates a return exception row in the manual section.',
    bidirectionalOff:
      'Directional — a return exception row exists in the manual section. Click to turn bidirectional back on and remove it.',
    removeRule: 'Remove rule',
    applySuggestion: 'Apply suggestion',
    trafficClass: 'Traffic class',
    defaultOption: '— default —',
    clearFilters: 'Clear filters',
    manualExceptions: 'Manual exceptions (zone B)',
    noManualRules: 'No manual rules. Add one with "New rule" above.',
    noTopologyRules: 'No topology rules generated yet.',
    toggleExceptionsPosition: 'Toggle manual exceptions position',
    exceptionsBefore: 'exceptions: before',
    exceptionsAfter: 'exceptions: after',
    cancel: 'Cancel',
    newRule: 'New rule',
    newManualRule: 'New manual rule',
    sourceNode: 'Source (node)',
    destinationNode: 'Destination (node)',
    priorityHint: 'Priority — lower value is evaluated first',
    routingProtocolsTab: 'Protocols (OSPF/BGP)',
    noIke: '⚠ no IKE',
    infoAbout: 'Information about',
    zoom: 'Zoom',
    halfDuplex: 'Half-duplex — sends and receives in alternating turns.',
    fullDuplex: 'Full-duplex — sends and receives simultaneously.',
    addSelected: 'Add selected',
    networkColumn: 'Network',
    zoneColumn: 'Zone',
    rowActions: 'Actions',
    newLan: 'New LAN',
    newLanTitle: 'New logical network (LAN)',
    deleteSite: 'Delete site',
    deleteLan: 'Delete LAN',
    deleteTier: 'Delete layer',
    deleteComponent: 'Delete component',
    addComponent: 'Add component',
    addTierNamed: 'Add',
    otherTier: 'Another layer',
    tierFree: 'Free',
    remoteToggle: 'Remote endpoint (outside the site)',
    familyPerimeter: 'Perimeter',
    familySwitching: 'Switching and access',
    familyServices: 'Services',
    familyEndpoints: 'Endpoints',
    familyTunnels: 'Tunnels and WAN',
    components: 'components',
    ungroupedLayers: 'Layers without LAN',
    networkBlock: 'Block',
    networkFamily: 'Family',
    networkHosts: 'Hosts',
    networkLayers: 'Layers',
    networkVlans: 'VLANs',
    purposePrincipal: 'Main',
    purposeDmz: 'DMZ',
    purposeGestao: 'Management',
    purposeCliente: 'Client',
    purposeBackup: 'Backup',
    purposeCustom: 'Free',
    familyLegacy: '200.x (legacy)',
    familyPrivate: 'private',
    noTypeMatch: 'No type found.',
    lastUsed: 'last used',
    structureHint: 'Click a component to locate it in the diagram.',
    lanName: 'LAN name',
  },
  es: {
    addLevel: 'Agregar nivel',
    addLevelDisabled:
      'Agregar niveles manualmente está deshabilitado — usa la barra de herramientas',
    newLogicalNetwork: 'Nueva red lógica',
    networkInfo: 'Información de la red',
    connectionInspector: 'Inspector de conexión',
    forceStateful: 'Forzar stateful',
    forceStateless: 'Forzar stateless',
    bidirectionalLinkHint:
      'Activado: 1 fila de ida cubre ambos sentidos. Desactivado: crea una fila de excepción de retorno en la sección manual de la tabla de firewall (borrarla reactiva el bidireccional).',
    linkDescriptionPlaceholder: 'Descripción del enlace…',
    wanLinkProfile: 'Perfil WAN del enlace',
    vpnTunnel: 'Túnel VPN/IPsec',
    preserveDscp: 'Preservar DSCP en el túnel',
    derivedRouteMeta: 'Metadatos de ruta (derivados)',
    siteOwner: 'Sitio responsable',
    inferredGateway: 'Gateway inferido',
    inferredDestination: 'Destino inferido',
    derivedAclSummary: 'Resumen ACL derivado',
    noManagedAcl:
      'No se encontró ninguna regla ACL gestionada para este enlace.',
    effectiveSource: 'Origen efectivo',
    effectiveDestination: 'Destino efectivo',
    defaultService: 'Servicio predeterminado',
    returnExceptionNo: 'No — excepción de retorno en la sección manual',
    selectOption: 'Seleccionar opción…',
    noItems: 'Sin elementos.',
    fitDiagram: 'Encuadrar diagrama',
    centerDiagram: 'Centrar diagrama',
    originSite: 'Sitio de origen:',
    notDefinedOption: '— no definido —',
    deviceName: 'Nombre del dispositivo',
    noVlanAssigned: 'Sin VLAN asignada',
    noVlanAssignedToObject: 'Sin VLAN asignada al objeto.',
    cryptoProfile: 'Perfil criptográfico',
    maxSessions: 'Máx. sesiones',
    notDefined: 'no definido',
    noPolicies: 'Ninguna política configurada.',
    noNatRules: 'Ninguna regla NAT.',
    multipleStrictQueues: 'Más de una cola strict — solo se recomienda una.',
    noQueues: 'Ninguna cola configurada.',
    simulateSession: 'Simular sesión',
    noActiveSessions: 'Ninguna sesión activa.',
    addBestEffortQueue: 'Agrega una cola best-effort como respaldo.',
    selectNode: 'Seleccionar nodo…',
    anyService: 'Cualquiera (ANY)',
    noSite: 'Sin sitio',
    otherIp: 'Otra IP…',
    noPeers: 'Sin peers agregados.',
    editNeighbors: 'Editar neighbors',
    staticRoutesHint: 'Rutas configuradas manualmente — sin protocolo dinámico',
    notConfigured: '(no configurados)',
    initialSuggestionApplied: 'Sugerencia inicial aplicada automáticamente.',
    prefixListHint:
      'Prefix-list es opcional y acepta edición libre como lista CSV.',
    bgpMd5Auth: 'BGP — autenticación MD5',
    natPat: 'El destino verá la IP del firewall (PAT)',
    natSnat: 'El origen aparece como IP mapeada (SNAT)',
    natDnat: 'El destino es IP pública → privada (DNAT)',
    natHybrid: 'Modo híbrido NAT + DNAT',
    flagStateless: 'Stateless — sin seguimiento de conexión',
    flagBidirectional:
      'Bidireccional — regla de retorno generada automáticamente',
    flagPassthrough: 'Passthrough — sin firewall ni router en el camino',
    flagConflict: 'Conflicto: regla DENY manual sobrescribe ALLOW de topología',
    flagNatExempt: 'NAT exempt — bypass de NAT para tráfico IPsec',
    flagManaged: 'Gestionada automáticamente por la topología — no editable',
    flagReturnException:
      'Excepción de retorno — creada al desactivar el bidireccional de la fila de ida. Eliminar esta fila reactiva el bidireccional.',
    flagMissingReturn:
      'Stateless sin regla de retorno — el tráfico de respuesta puede bloquearse',
    qosTitle: 'QoS — calidad de servicio',
    bidirectionalOn:
      'Bidireccional — 1 fila cubre ida y vuelta. Desactivarlo crea una fila de excepción para la vuelta en la sección manual.',
    bidirectionalOff:
      'Direccional — existe una fila de excepción de retorno en la sección manual. Haz clic para reactivar el bidireccional y eliminarla.',
    removeRule: 'Eliminar regla',
    applySuggestion: 'Aplicar sugerencia',
    trafficClass: 'Clase de tráfico',
    defaultOption: '— predeterminado —',
    clearFilters: 'Limpiar filtros',
    manualExceptions: 'Excepciones manuales (zona B)',
    noManualRules: 'Ninguna regla manual. Agrega una con "Nueva regla" arriba.',
    noTopologyRules: 'Aún no se generaron reglas de topología.',
    toggleExceptionsPosition: 'Alternar posición de las excepciones manuales',
    exceptionsBefore: 'excepciones: antes',
    exceptionsAfter: 'excepciones: después',
    cancel: 'Cancelar',
    newRule: 'Nueva regla',
    newManualRule: 'Nueva regla manual',
    sourceNode: 'Origen (nodo)',
    destinationNode: 'Destino (nodo)',
    priorityHint: 'Prioridad — menor valor se evalúa primero',
    routingProtocolsTab: 'Protocolos (OSPF/BGP)',
    noIke: '⚠ sin IKE',
    infoAbout: 'Información sobre',
    zoom: 'Zoom',
    halfDuplex: 'Half-duplex — transmite y recibe en turnos alternados.',
    fullDuplex: 'Full-duplex — transmite y recibe simultáneamente.',
    addSelected: 'Agregar seleccionado',
    networkColumn: 'Red',
    zoneColumn: 'Zona',
    rowActions: 'Acciones',
    newLan: 'Nueva LAN',
    newLanTitle: 'Nueva red lógica (LAN)',
    deleteSite: 'Eliminar sitio',
    deleteLan: 'Eliminar LAN',
    deleteTier: 'Eliminar capa',
    deleteComponent: 'Eliminar componente',
    addComponent: 'Agregar componente',
    addTierNamed: 'Agregar',
    otherTier: 'Otra capa',
    tierFree: 'Libre',
    remoteToggle: 'Endpoint remoto (fuera del sitio)',
    familyPerimeter: 'Perímetro',
    familySwitching: 'Conmutación y acceso',
    familyServices: 'Servicios',
    familyEndpoints: 'Endpoints',
    familyTunnels: 'Túneles y WAN',
    components: 'componentes',
    ungroupedLayers: 'Capas sin LAN',
    networkBlock: 'Bloque',
    networkFamily: 'Familia',
    networkHosts: 'Hosts',
    networkLayers: 'Capas',
    networkVlans: 'VLANs',
    purposePrincipal: 'Principal',
    purposeDmz: 'DMZ',
    purposeGestao: 'Gestión',
    purposeCliente: 'Cliente',
    purposeBackup: 'Backup',
    purposeCustom: 'Libre',
    familyLegacy: '200.x (legado)',
    familyPrivate: 'privado',
    noTypeMatch: 'Ningún tipo encontrado.',
    lastUsed: 'último usado',
    structureHint: 'Haz clic en un componente para ubicarlo en el diagrama.',
    lanName: 'Nombre de la LAN',
  },
};

const LANGS: StudioLanguage[] = ['pt', 'en', 'es'];

function currentLanguage(): StudioLanguage {
  if (typeof window !== 'undefined') {
    const segment = window.location.hash.replace(/^#\/?/, '').split('/')[0];
    if (LANGS.includes(segment as StudioLanguage))
      return segment as StudioLanguage;
  }
  const stored = servicesRoutes.language.getStoredLanguage();
  return stored && LANGS.includes(stored) ? stored : 'pt';
}

export function ui(): StudioUiCopy {
  return STUDIO_UI_COPY[currentLanguage()];
}
