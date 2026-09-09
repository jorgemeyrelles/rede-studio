import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type {
    LinkItem,
    NodeItem,
    RouteRow,
    Site,
    SiteVlan,
} from '../../../features/network/types';
import { ipToNumber, numberToIp } from '../../../features/network/utils/ip';
import { NODE_VISUALS } from '../constants';
import type { StudioLanguage } from '../types';
import { getPdfReportCopy, getRouteFirewallCopy } from './i18n';
import { getSiteOtherIps } from './routeFirewall';
import { formatCompactRange } from './siteVlan';

type FirewallRuleRow = {
  id: string;
  acao: string;
  origem: string;
  destino: string;
  servico: string;
  source?: 'topology' | 'manual';
  enabled?: boolean;
  managed?: boolean;
  stateful?: boolean;
  bidirectional?: boolean;
  duplexMode?: 'full' | 'half';
  protocol?: string;
  hasConflict?: boolean;
  missingReturn?: boolean;
  natExempt?: boolean;
  fwNatMode?: 'pat' | 'snat' | 'dnat' | 'hybrid' | 'none';
  ipsecAuthBadge?: 'PSK' | 'PKI' | 'EAP' | 'keypair' | '⚠ sem IKE';
};

type GenerateStudioPdfParams = {
  language: StudioLanguage;
  projectName: string;
  sites: Site[];
  nodes: NodeItem[];
  links: LinkItem[];
  siteVlans: SiteVlan[];
  routes: RouteRow[];
  firewallRules: FirewallRuleRow[];
  documentVersion?: string;
  lastSavedAt?: string | null;
  diagramImageData?: string | null;
  dashboardElement: HTMLElement | null;
  targetWindow: Window | null;
};

const PAGE_WIDTH = 297;
const MARGIN_X = 4;
const CONTENT_TOP = 22;
const CONTENT_BOTTOM = 199;
const FOOTER_Y = 205;

const STUDIO_BRAND_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
  <rect width="64" height="64" rx="12" fill="#0f172a"/>
  <line x1="32" y1="14" x2="12" y2="38" stroke="#38bdf8" stroke-width="2" stroke-linecap="round" opacity="0.7"/>
  <line x1="32" y1="14" x2="52" y2="38" stroke="#38bdf8" stroke-width="2" stroke-linecap="round" opacity="0.7"/>
  <line x1="12" y1="38" x2="32" y2="52" stroke="#38bdf8" stroke-width="2" stroke-linecap="round" opacity="0.7"/>
  <line x1="52" y1="38" x2="32" y2="52" stroke="#38bdf8" stroke-width="2" stroke-linecap="round" opacity="0.7"/>
  <line x1="12" y1="38" x2="52" y2="38" stroke="#64748b" stroke-width="1.5" stroke-linecap="round" opacity="0.5"/>
  <circle cx="32" cy="14" r="6" fill="#0ea5e9" stroke="#7dd3fc" stroke-width="1.5"/>
  <circle cx="12" cy="38" r="5" fill="#6366f1" stroke="#a5b4fc" stroke-width="1.5"/>
  <circle cx="52" cy="38" r="5" fill="#6366f1" stroke="#a5b4fc" stroke-width="1.5"/>
  <circle cx="32" cy="52" r="4" fill="#10b981" stroke="#6ee7b7" stroke-width="1.5"/>
</svg>`;

let cachedBrandIconDataUrl: string | null | undefined;

async function getStudioBrandIconDataUrl(): Promise<string | null> {
  if (cachedBrandIconDataUrl !== undefined) return cachedBrandIconDataUrl;

  try {
    const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(STUDIO_BRAND_ICON_SVG)}`;
    const iconDataUrl = await new Promise<string>((resolve, reject) => {
      const image = new Image();
      image.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 96;
        canvas.height = 96;
        const context = canvas.getContext('2d');
        if (!context) {
          reject(new Error('Canvas context unavailable'));
          return;
        }

        context.clearRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/png'));
      };
      image.onerror = () => reject(new Error('Unable to render brand icon'));
      image.src = dataUrl;
    });

    cachedBrandIconDataUrl = iconDataUrl;
    return iconDataUrl;
  } catch {
    cachedBrandIconDataUrl = null;
    return null;
  }
}

function mapLocale(language: StudioLanguage) {
  if (language === 'en') return 'en-US';
  if (language === 'es') return 'es-ES';
  return 'pt-BR';
}

function getProjectModelCopy(language: StudioLanguage) {
  if (language === 'en') {
    return {
      tocTitle: 'Table of Contents',
      revisionTitle: 'Revision Control',
      revisionVersion: 'Version',
      revisionDate: 'Date',
      revisionAuthor: 'Author',
      revisionStatus: 'Status',
      revisionChanges: 'Change Summary',
      scopeTitle: 'Scope, Assumptions and Constraints',
      scopeSummary: 'Project scope summary',
      assumptionsTitle: 'Assumptions',
      constraintsTitle: 'Constraints',
      implementationTitle: 'Implementation Plan',
      testsTitle: 'Test and Acceptance Plan',
      risksTitle: 'Risk Matrix',
      risk: 'Risk',
      impact: 'Impact',
      probability: 'Probability',
      mitigation: 'Mitigation',
      owner: 'Owner',
      direction: 'Direction',
      duplex: 'Duplex',
      acl: 'ACL',
      sessionMode: 'Session Mode',
      sourceType: 'Source',
      networkName: 'Network',
      zone: 'Zone',
    };
  }

  if (language === 'es') {
    return {
      tocTitle: 'Indice',
      revisionTitle: 'Control de Revisiones',
      revisionVersion: 'Version',
      revisionDate: 'Fecha',
      revisionAuthor: 'Autor',
      revisionStatus: 'Estado',
      revisionChanges: 'Resumen de Cambios',
      scopeTitle: 'Alcance, Supuestos y Restricciones',
      scopeSummary: 'Resumen de alcance del proyecto',
      assumptionsTitle: 'Supuestos',
      constraintsTitle: 'Restricciones',
      implementationTitle: 'Plan de Implementacion',
      testsTitle: 'Plan de Pruebas y Aceptacion',
      risksTitle: 'Matriz de Riesgos',
      risk: 'Riesgo',
      impact: 'Impacto',
      probability: 'Probabilidad',
      mitigation: 'Mitigacion',
      owner: 'Responsable',
      direction: 'Direccion',
      duplex: 'Duplex',
      acl: 'ACL',
      sessionMode: 'Modo de Sesion',
      sourceType: 'Origen',
      networkName: 'Red',
      zone: 'Zona',
    };
  }

  return {
    tocTitle: 'Sumario',
    revisionTitle: 'Controle de Revisoes',
    revisionVersion: 'Versao',
    revisionDate: 'Data',
    revisionAuthor: 'Autor',
    revisionStatus: 'Status',
    revisionChanges: 'Resumo de Alteracoes',
    scopeTitle: 'Escopo, Premissas e Restricoes',
    scopeSummary: 'Resumo de escopo do projeto',
    assumptionsTitle: 'Premissas',
    constraintsTitle: 'Restricoes',
    implementationTitle: 'Plano de Implantacao',
    testsTitle: 'Plano de Testes e Aceite',
    risksTitle: 'Matriz de Riscos',
    risk: 'Risco',
    impact: 'Impacto',
    probability: 'Probabilidade',
    mitigation: 'Mitigacao',
    owner: 'Responsavel',
    direction: 'Direcao',
    duplex: 'Duplex',
    acl: 'ACL',
    sessionMode: 'Modo de Sessao',
    sourceType: 'Origem',
    networkName: 'Rede',
    zone: 'Zona',
  };
}

function setSectionTitle(pageSections: string[], doc: jsPDF, title: string) {
  const pageNumber = doc.getCurrentPageInfo().pageNumber;
  pageSections[pageNumber - 1] = title;
}

function buildSiteScope(sites: Site[], allSitesLabel: string) {
  if (sites.length === 0) return allSitesLabel;
  if (sites.length <= 2) return sites.map((site) => site.name).join(' | ');
  return `${allSitesLabel} (${sites.length})`;
}

function resolveRouteTypeLabel(
  tipo: RouteRow['tipo'],
  language: StudioLanguage,
) {
  const routeCopy = getRouteFirewallCopy(language);
  const labels: Record<RouteRow['tipo'], string> = {
    Direta: routeCopy.routeTypeDirect,
    Estática: routeCopy.routeTypeStatic,
    Default: routeCopy.routeTypeDefault,
    VPN: routeCopy.routeTypeVpn,
    BGP: 'BGP',
  };
  return labels[tipo] ?? tipo;
}

function resolveCategoryLabel(category: NodeItem['category']) {
  return (
    NODE_VISUALS.find((item) => item.category === category)?.label ?? category
  );
}

function getHeaderMinWidth(doc: jsPDF, label: string, fontSize = 9.2) {
  const prevFontSize = doc.getFontSize();
  doc.setFontSize(fontSize);
  const width = doc.getTextWidth(label) + 4.6;
  doc.setFontSize(prevFontSize);
  return width;
}

function getNodeIpRangeText(node: Pick<NodeItem, 'ip' | 'hostCount'>) {
  const count = Math.max(1, Math.trunc(Number(node.hostCount ?? 1) || 1));
  if (count <= 1) return null;

  const start = ipToNumber(node.ip);
  if (start === null) return null;

  const end = start + count - 1;
  return `${numberToIp(start)} - ${numberToIp(end)}`;
}

type PdfLocaleTerms = {
  versionLabel: string;
  lastSaveLabel: string;
  revisionStatusBaseline: string;
  revisionStatusDraft: string;
  revisionChangeSummary: string;
  scopeCountSites: string;
  scopeCountNodes: string;
  scopeCountLinks: string;
  scopeCountVlans: string;
  serviceHeader: string;
  protocolHeader: string;
  sourceManual: string;
  sourceTopology: string;
  statefulLabel: string;
  statelessLabel: string;
  inheritedLabel: string;
  yesLabel: string;
  noLabel: string;
  headerSubtitle: string;
  unassignedSiteLabel: string;
  quantityLabel: string;
  ipRangeLabel: string;
};

function getPdfLocaleTerms(language: StudioLanguage): PdfLocaleTerms {
  if (language === 'en') {
    return {
      versionLabel: 'Version',
      lastSaveLabel: 'Last save',
      revisionStatusBaseline: 'Baseline',
      revisionStatusDraft: 'Draft',
      revisionChangeSummary:
        'Project model export generated from current topology baseline.',
      scopeCountSites: 'sites',
      scopeCountNodes: 'nodes',
      scopeCountLinks: 'links',
      scopeCountVlans: 'VLANs',
      serviceHeader: 'Service',
      protocolHeader: 'Protocol',
      sourceManual: 'Manual',
      sourceTopology: 'Topology',
      statefulLabel: 'Stateful',
      statelessLabel: 'Stateless',
      inheritedLabel: 'Inherited',
      yesLabel: 'YES',
      noLabel: 'NO',
      headerSubtitle: 'Rede Studio - Technical Project Model',
      unassignedSiteLabel: 'Unassigned site',
      quantityLabel: 'Quantity',
      ipRangeLabel: 'IP Range',
    };
  }

  if (language === 'es') {
    return {
      versionLabel: 'Version',
      lastSaveLabel: 'Ultimo guardado',
      revisionStatusBaseline: 'Base',
      revisionStatusDraft: 'Borrador',
      revisionChangeSummary:
        'Exportacion del modelo de proyecto generada desde la linea base de topologia actual.',
      scopeCountSites: 'sitios',
      scopeCountNodes: 'nodos',
      scopeCountLinks: 'enlaces',
      scopeCountVlans: 'VLANs',
      serviceHeader: 'Servicio',
      protocolHeader: 'Protocolo',
      sourceManual: 'Manual',
      sourceTopology: 'Topologia',
      statefulLabel: 'Com estado',
      statelessLabel: 'Sem estado',
      inheritedLabel: 'Heredado',
      yesLabel: 'SI',
      noLabel: 'NO',
      headerSubtitle: 'Rede Studio - Modelo Tecnico de Proyecto',
      unassignedSiteLabel: 'Sitio no asignado',
      quantityLabel: 'Cantidad',
      ipRangeLabel: 'Rango IP',
    };
  }

  return {
    versionLabel: 'Versao',
    lastSaveLabel: 'Ultimo salvamento',
    revisionStatusBaseline: 'Baseline',
    revisionStatusDraft: 'Rascunho',
    revisionChangeSummary:
      'Exportacao de modelo de projeto gerada a partir da baseline atual de topologia.',
    scopeCountSites: 'sites',
    scopeCountNodes: 'nos',
    scopeCountLinks: 'links',
    scopeCountVlans: 'VLANs',
    serviceHeader: 'Servico',
    protocolHeader: 'Protocolo',
    sourceManual: 'Manual',
    sourceTopology: 'Topologia',
    statefulLabel: 'Com estado',
    statelessLabel: 'Sem estado',
    inheritedLabel: 'Herdado',
    yesLabel: 'SIM',
    noLabel: 'NAO',
    headerSubtitle: 'Rede Studio - Modelo Tecnico de Projeto',
    unassignedSiteLabel: 'Site nao atribuido',
    quantityLabel: 'Quantidade',
    ipRangeLabel: 'Faixa IP',
  };
}

type ScopeDynamicContent = {
  assumptions: string[];
  constraints: string[];
  implementationRows: string[][];
  testRows: string[][];
};

function buildScopeDynamicContent(
  params: Pick<
    GenerateStudioPdfParams,
    'language' | 'sites' | 'nodes' | 'links' | 'siteVlans'
  >,
): ScopeDynamicContent {
  const { language, sites, nodes, links, siteVlans } = params;

  const hasDmz = nodes.some(
    (node) => (node.zone ?? '').trim().toLowerCase() === 'dmz',
  );
  const halfDuplexCount = links.filter(
    (link) => (link.duplexMode ?? 'full') === 'half',
  ).length;
  const aclDisabledCount = links.filter(
    (link) => link.generateAcl === false,
  ).length;
  const unidirectionalCount = links.filter(
    (link) => (link.bidirectional ?? true) === false,
  ).length;
  const sitesWithoutVlan = sites.filter(
    (site) => !siteVlans.some((vlan) => vlan.siteId === site.id),
  ).length;
  const isLargeDeployment =
    sites.length >= 6 || nodes.length >= 60 || links.length >= 120;
  const waveSize = isLargeDeployment ? 3 : 6;
  const waveCount = Math.max(1, Math.ceil(Math.max(sites.length, 1) / waveSize));

  if (language === 'en') {
    const assumptions: string[] = [
      `Baseline reflects ${sites.length} site(s), ${nodes.length} node(s) and ${links.length} modeled link(s).`,
      hasDmz
        ? 'A DMZ zone is present and published flows are expected to follow dedicated controls.'
        : 'No explicit DMZ is modeled; edge protection remains concentrated on internal security layers.',
      halfDuplexCount > 0
        ? `${halfDuplexCount} link(s) are marked as half-duplex and must be considered in capacity planning.`
        : 'Links are predominantly full-duplex for lower contention.',
      aclDisabledCount > 0
        ? `${aclDisabledCount} link(s) have ACL generation disabled and are handled as controlled exceptions.`
        : 'ACL generation remains enabled by default for eligible links.',
    ];

    const constraints: string[] = [
      'Values without runtime telemetry remain planning references.',
      hasDmz
        ? 'DMZ publication depends on port-by-port validation and hardening before go-live.'
        : 'Perimeter exposure assumptions must be validated during implementation.',
      aclDisabledCount > 0
        ? 'Links with disabled ACL automation require compensating controls outside automatic policy generation.'
        : 'Policy consistency relies on preserving ACL automation for modeled links.',
      halfDuplexCount > 0
        ? 'Half-duplex segments may reduce effective throughput during peak usage.'
        : 'WAN provider latency and SLA remain external constraints to the model.',
      sitesWithoutVlan > 0
        ? `${sitesWithoutVlan} site(s) still need VLAN detailing before final cutover.`
        : 'Acceptance depends on test execution within the approved change window.',
    ];

    return {
      assumptions: assumptions.slice(0, 4),
      constraints: constraints.slice(0, 4),
      implementationRows: [
        [
          'Phase 1 - Validation',
          `Consolidate baseline zoning (${hasDmz ? 'with DMZ' : 'without explicit DMZ'}) and naming governance.`,
          `Approved logical design and exception matrix (${aclDisabledCount} ACL exception(s)).`,
          hasDmz ? 'Architecture + Security' : 'Architecture Team',
        ],
        [
          'Phase 2 - Build',
          `Implement routes, ACLs, VLANs and infrastructure settings${aclDisabledCount > 0 ? ' with controlled exceptions' : ''}.`,
          `Configured environment with ${halfDuplexCount} half-duplex link(s) tracked.`,
          'Network Team',
        ],
        [
          'Phase 3 - Cutover',
          `Execute cutover in ${waveCount} wave(s) with rollback checkpoints.`,
          `${isLargeDeployment ? 'Phased' : 'Single-window'} service transition with acceptance evidence.`,
          sites.length > 1 ? 'Operations + NOC' : 'Operations',
        ],
      ],
      testRows: [
        [
          'Routing validation',
          'Confirm end-to-end reachability and expected traffic symmetry.',
          `100% expected routes validated${unidirectionalCount > 0 ? `, including ${unidirectionalCount} unidirectional flow(s)` : ''}.`,
        ],
        [
          'Security policy validation',
          'Verify ACL and firewall behavior by scenario.',
          aclDisabledCount > 0
            ? `No critical conflict and ${aclDisabledCount} ACL exception(s) documented with compensating control.`
            : 'No critical conflict and expected allow/deny behavior.',
        ],
        [
          'Service continuity',
          `Evaluate key applications after cutover${halfDuplexCount > 0 ? ' with focus on constrained links' : ''}.`,
          `Critical services healthy within agreed SLA after ${waveCount} wave(s).`,
        ],
      ],
    };
  }

  if (language === 'es') {
    const assumptions: string[] = [
      `La linea base contempla ${sites.length} sitio(s), ${nodes.length} nodo(s) y ${links.length} enlace(s) modelado(s).`,
      hasDmz
        ? 'Existe zona DMZ y los flujos publicados deben seguir controles dedicados.'
        : 'No hay DMZ explicita en el modelo; la proteccion perimetral queda concentrada en capas internas.',
      halfDuplexCount > 0
        ? `${halfDuplexCount} enlace(s) estan en half-duplex y requieren consideracion de capacidad.`
        : 'Los enlaces estan mayormente en full-duplex para reducir contencion.',
      aclDisabledCount > 0
        ? `${aclDisabledCount} enlace(s) con ACL desactivada se tratan como excepciones controladas.`
        : 'La generacion de ACL permanece habilitada por defecto en enlaces elegibles.',
    ];

    const constraints: string[] = [
      'Los valores sin telemetria operativa son referencia de planificacion.',
      hasDmz
        ? 'La publicacion hacia DMZ depende de validacion de puertos y hardening antes de produccion.'
        : 'Los supuestos de exposicion perimetral deben validarse durante la implantacion.',
      aclDisabledCount > 0
        ? 'Enlaces con ACL desactivada requieren controles compensatorios fuera de la automatizacion.'
        : 'La consistencia de politicas depende de mantener ACL automatica en enlaces modelados.',
      halfDuplexCount > 0
        ? 'Segmentos half-duplex pueden reducir throughput efectivo en picos de trafico.'
        : 'La latencia y SLA del proveedor WAN siguen siendo restriccion externa.',
      sitesWithoutVlan > 0
        ? `${sitesWithoutVlan} sitio(s) aun requieren detalle de VLAN antes del cutover final.`
        : 'La aceptacion depende de ejecutar pruebas en ventana de cambio aprobada.',
    ];

    return {
      assumptions: assumptions.slice(0, 4),
      constraints: constraints.slice(0, 4),
      implementationRows: [
        [
          'Fase 1 - Validacion',
          `Consolidar zonificacion baseline (${hasDmz ? 'con DMZ' : 'sin DMZ explicita'}) y gobernanza de nombres.`,
          `Diseno logico aprobado y matriz de excepciones (${aclDisabledCount} excepcion(es) ACL).`,
          hasDmz ? 'Arquitectura + Seguridad' : 'Equipo de Arquitectura',
        ],
        [
          'Fase 2 - Construccion',
          `Implementar rutas, ACL, VLAN y ajustes de infraestructura${aclDisabledCount > 0 ? ' con excepciones controladas' : ''}.`,
          `Entorno configurado con ${halfDuplexCount} enlace(s) half-duplex identificado(s).`,
          'Equipo de Red',
        ],
        [
          'Fase 3 - Cutover',
          `Ejecutar cutover en ${waveCount} ola(s) con checkpoints de rollback.`,
          `${isLargeDeployment ? 'Transicion por fases' : 'Transicion en ventana unica'} con evidencia de aceptacion.`,
          sites.length > 1 ? 'Operaciones + NOC' : 'Operaciones',
        ],
      ],
      testRows: [
        [
          'Validacion de ruteo',
          'Confirmar conectividad extremo a extremo y simetria esperada.',
          `100% de rutas esperadas validadas${unidirectionalCount > 0 ? `, incluyendo ${unidirectionalCount} flujo(s) unidireccional(es)` : ''}.`,
        ],
        [
          'Validacion de seguridad',
          'Verificar comportamiento ACL y firewall por escenario.',
          aclDisabledCount > 0
            ? `Sin conflicto critico y ${aclDisabledCount} excepcion(es) ACL documentada(s) con control compensatorio.`
            : 'Sin conflicto critico y comportamiento allow/deny esperado.',
        ],
        [
          'Continuidad del servicio',
          `Evaluar aplicaciones clave tras el cutover${halfDuplexCount > 0 ? ' con foco en enlaces restringidos' : ''}.`,
          `Servicios criticos saludables dentro del SLA tras ${waveCount} ola(s).`,
        ],
      ],
    };
  }

  const assumptions: string[] = [
    `A baseline contempla ${sites.length} site(s), ${nodes.length} no(s) e ${links.length} enlace(s) modelado(s).`,
    hasDmz
      ? 'Existe zona DMZ no desenho e os fluxos publicados devem seguir controles dedicados.'
      : 'Nao ha DMZ explicita no desenho; a protecao de borda fica concentrada nas camadas internas.',
    halfDuplexCount > 0
      ? `${halfDuplexCount} enlace(s) estao em half-duplex e exigem planejamento de capacidade.`
      : 'Os enlaces estao majoritariamente em full-duplex para reduzir contencao.',
    aclDisabledCount > 0
      ? `${aclDisabledCount} enlace(s) com ACL desativada sao tratados como excecoes controladas.`
      : 'A geracao de ACL permanece habilitada por padrao nos enlaces elegiveis.',
  ];

  const constraints: string[] = [
    'Valores sem telemetria operacional sao referencia de planejamento.',
    hasDmz
      ? 'Publicacoes para DMZ dependem de validacao de portas e hardening antes do go-live.'
      : 'Premissas de exposicao de borda devem ser validadas durante a implantacao.',
    aclDisabledCount > 0
      ? 'Enlaces com ACL desativada exigem controles compensatorios fora da automacao de politica.'
      : 'A consistencia de politica depende de manter ACL automatica nos enlaces modelados.',
    halfDuplexCount > 0
      ? 'Segmentos half-duplex podem reduzir o throughput efetivo em picos de trafego.'
      : 'Latencia e SLA do provedor WAN continuam como restricao externa ao modelo.',
    sitesWithoutVlan > 0
      ? `${sitesWithoutVlan} site(s) ainda precisam de detalhamento de VLAN antes do cutover final.`
      : 'O aceite depende da execucao dos testes na janela de mudanca aprovada.',
  ];

  return {
    assumptions: assumptions.slice(0, 4),
    constraints: constraints.slice(0, 4),
    implementationRows: [
      [
        'Fase 1 - Validacao',
        `Consolidar zoneamento baseline (${hasDmz ? 'com DMZ' : 'sem DMZ explicita'}) e governanca de nomenclatura.`,
        `Desenho logico aprovado e matriz de excecoes (${aclDisabledCount} excecao(oes) ACL).`,
        hasDmz ? 'Arquitetura + Seguranca' : 'Time de Arquitetura',
      ],
      [
        'Fase 2 - Build',
        `Implementar rotas, ACLs, VLANs e ajustes de infraestrutura${aclDisabledCount > 0 ? ' com excecoes controladas' : ''}.`,
        `Ambiente configurado com ${halfDuplexCount} enlace(s) half-duplex mapeado(s).`,
        'Time de Redes',
      ],
      [
        'Fase 3 - Cutover',
        `Executar cutover em ${waveCount} onda(s) com checkpoints de rollback.`,
        `${isLargeDeployment ? 'Transicao faseada' : 'Transicao em janela unica'} com evidencias de aceite.`,
        sites.length > 1 ? 'Operacoes + NOC' : 'Operacoes',
      ],
    ],
    testRows: [
      [
        'Validacao de roteamento',
        'Confirmar alcancabilidade fim a fim e simetria esperada de trafego.',
        `100% das rotas esperadas validadas${unidirectionalCount > 0 ? `, incluindo ${unidirectionalCount} fluxo(s) unidirecional(is)` : ''}.`,
      ],
      [
        'Validacao de seguranca',
        'Verificar comportamento de ACL e firewall por cenario.',
        aclDisabledCount > 0
          ? `Sem conflito critico e ${aclDisabledCount} excecao(oes) ACL documentada(s) com controle compensatorio.`
          : 'Sem conflito critico e comportamento allow/deny esperado.',
      ],
      [
        'Continuidade de servico',
        `Avaliar aplicacoes criticas apos o cutover${halfDuplexCount > 0 ? ' com foco em enlaces restritos' : ''}.`,
        `Servicos criticos saudaveis dentro do SLA apos ${waveCount} onda(s).`,
      ],
    ],
  };
}

function drawCoverPage(
  doc: jsPDF,
  pageSections: string[],
  params: GenerateStudioPdfParams,
) {
  const {
    language,
    projectName,
    sites,
    nodes,
    links,
    siteVlans,
    firewallRules,
    documentVersion,
    lastSavedAt,
  } = params;
  const copy = getPdfReportCopy(language);
  const localeTerms = getPdfLocaleTerms(language);
  const locale = mapLocale(language);
  setSectionTitle(pageSections, doc, copy.executiveCoverTitle);

  doc.setFillColor(15, 23, 42);
  doc.rect(MARGIN_X, 34, PAGE_WIDTH - MARGIN_X * 2, 34, 'F');
  doc.setTextColor(226, 232, 240);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text(copy.documentTitle, MARGIN_X + 6, 48);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(`${copy.project}: ${projectName}`, MARGIN_X + 6, 58);
  doc.setFontSize(9.2);
  doc.text(
    `${localeTerms.versionLabel}: ${documentVersion ?? 'v1.0'} | ${localeTerms.lastSaveLabel}: ${lastSavedAt ? new Date(lastSavedAt).toLocaleString(locale) : copy.notAvailable}`,
    MARGIN_X + 6,
    64,
  );

  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(copy.executiveSummary, MARGIN_X, 78);

  const cards = [
    [copy.totalSites, String(sites.length)],
    [copy.totalNodes, String(nodes.length)],
    [copy.totalLinks, String(links.length)],
    [copy.totalVlans, String(siteVlans.length)],
    [copy.totalAclRules, String(firewallRules.length)],
  ];

  let cardY = 88;
  for (const [label, value] of cards) {
    doc.setDrawColor(148, 163, 184);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(MARGIN_X, cardY, PAGE_WIDTH - MARGIN_X * 2, 16, 2, 2, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(30, 41, 59);
    doc.text(label, MARGIN_X + 4, cardY + 6.5);
    doc.setFontSize(12);
    doc.text(value, PAGE_WIDTH - MARGIN_X - 4, cardY + 6.5, { align: 'right' });
    cardY += 19;
  }
}

async function drawDashboardPage(
  doc: jsPDF,
  pageSections: string[],
  params: GenerateStudioPdfParams,
) {
  const { language, dashboardElement, diagramImageData } = params;
  const copy = getPdfReportCopy(language);

  doc.addPage();
  setSectionTitle(pageSections, doc, copy.dashboardTitle);

  if (!dashboardElement && !diagramImageData) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(71, 85, 105);
    doc.text(copy.notAvailable, MARGIN_X, CONTENT_TOP + 12);
    return;
  }

  let imageData: string;
  let sourceWidth: number;
  let sourceHeight: number;

  if (diagramImageData) {
    imageData = diagramImageData;
    const dimensions = await new Promise<{ width: number; height: number }>(
      (resolve) => {
        const img = new Image();
        img.onload = () => resolve({ width: img.width, height: img.height });
        img.onerror = () => resolve({ width: 1600, height: 1000 });
        img.src = diagramImageData;
      },
    );
    sourceWidth = dimensions.width;
    sourceHeight = dimensions.height;
  } else {
    const canvas = await html2canvas(dashboardElement!, {
      backgroundColor: '#0b172a',
      scale: 1.2,
      useCORS: true,
    });
    imageData = canvas.toDataURL('image/jpeg', 0.72);
    sourceWidth = canvas.width;
    sourceHeight = canvas.height;
  }

  const dashboardMarginX = 2;
  const availableWidth = PAGE_WIDTH - dashboardMarginX * 2;
  const availableHeight = CONTENT_BOTTOM - CONTENT_TOP;
  const ratio = Math.min(
    availableWidth / sourceWidth,
    availableHeight / sourceHeight,
  );
  const renderWidth = sourceWidth * ratio;
  const renderHeight = sourceHeight * ratio;
  const offsetX = dashboardMarginX + (availableWidth - renderWidth) / 2;
  const offsetY = CONTENT_TOP + (availableHeight - renderHeight) / 2;

  doc.addImage(
    imageData,
    'PNG',
    offsetX,
    offsetY,
    renderWidth,
    renderHeight,
    undefined,
    'FAST',
  );
}

function drawTableOfContentsSection(
  doc: jsPDF,
  pageSections: string[],
  params: GenerateStudioPdfParams,
) {
  const modelCopy = getProjectModelCopy(params.language);

  doc.addPage();
  setSectionTitle(pageSections, doc, modelCopy.tocTitle);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(15, 23, 42);
  doc.text(modelCopy.tocTitle, MARGIN_X, CONTENT_TOP + 4);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  doc.text(
    params.language === 'en'
      ? 'The final section/page list is generated from the exported model content.'
      : params.language === 'es'
        ? 'La lista final de secciones/paginas se genera desde el contenido exportado del modelo.'
        : 'A lista final de secoes/paginas e gerada a partir do conteudo exportado do modelo.',
    MARGIN_X,
    CONTENT_TOP + 12,
  );
}

function drawRevisionControlSection(
  doc: jsPDF,
  pageSections: string[],
  params: GenerateStudioPdfParams,
) {
  const modelCopy = getProjectModelCopy(params.language);
  const localeTerms = getPdfLocaleTerms(params.language);
  const locale = mapLocale(params.language);
  const generatedAt = new Date().toLocaleString(locale);

  doc.addPage();
  setSectionTitle(pageSections, doc, modelCopy.revisionTitle);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  doc.text(modelCopy.revisionTitle, MARGIN_X, CONTENT_TOP + 4);

  autoTable(doc, {
    startY: CONTENT_TOP + 10,
    head: [[
      modelCopy.revisionVersion,
      modelCopy.revisionDate,
      modelCopy.revisionAuthor,
      modelCopy.revisionStatus,
      modelCopy.revisionChanges,
    ]],
    body: [[
      params.documentVersion ?? 'v1.0',
      generatedAt,
      'Studio',
      params.lastSavedAt
        ? localeTerms.revisionStatusBaseline
        : localeTerms.revisionStatusDraft,
      localeTerms.revisionChangeSummary,
    ]],
    styles: {
      fontSize: 9.4,
      cellPadding: 2.2,
      textColor: [15, 23, 42],
      overflow: 'linebreak',
    },
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [241, 245, 249],
      fontSize: 10,
    },
    margin: { left: MARGIN_X, right: MARGIN_X, bottom: 18 },
    didDrawPage: () => {
      setSectionTitle(pageSections, doc, modelCopy.revisionTitle);
    },
  });
}

function drawScopePlanningSection(
  doc: jsPDF,
  pageSections: string[],
  params: GenerateStudioPdfParams,
) {
  const { language, sites, nodes, links, siteVlans } = params;
  const modelCopy = getProjectModelCopy(language);
  const localeTerms = getPdfLocaleTerms(language);
  const dynamicScope = buildScopeDynamicContent({
    language,
    sites,
    nodes,
    links,
    siteVlans,
  });

  doc.addPage();
  setSectionTitle(pageSections, doc, modelCopy.scopeTitle);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  doc.text(modelCopy.scopeTitle, MARGIN_X, CONTENT_TOP + 4);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.8);
  doc.text(modelCopy.scopeSummary, MARGIN_X, CONTENT_TOP + 12);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.4);
  doc.text(
    `${sites.length} ${localeTerms.scopeCountSites} | ${nodes.length} ${localeTerms.scopeCountNodes} | ${links.length} ${localeTerms.scopeCountLinks} | ${siteVlans.length} ${localeTerms.scopeCountVlans}`,
    MARGIN_X,
    CONTENT_TOP + 17,
  );

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.2);
  doc.text(modelCopy.assumptionsTitle, MARGIN_X, CONTENT_TOP + 24);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.2);
  dynamicScope.assumptions.forEach((item, index) => {
    doc.text(`- ${item}`, MARGIN_X, CONTENT_TOP + 29 + index * 4.2);
  });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.2);
  doc.text(modelCopy.constraintsTitle, MARGIN_X + 142, CONTENT_TOP + 24);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.2);
  dynamicScope.constraints.forEach((item, index) => {
    doc.text(`- ${item}`, MARGIN_X + 142, CONTENT_TOP + 29 + index * 4.2);
  });

  autoTable(doc, {
    startY: CONTENT_TOP + 45,
    head: [[
      modelCopy.implementationTitle,
      language === 'en' ? 'Objective' : language === 'es' ? 'Objetivo' : 'Objetivo',
      language === 'en' ? 'Expected Output' : language === 'es' ? 'Salida Esperada' : 'Saida Esperada',
      modelCopy.owner,
    ]],
    body: dynamicScope.implementationRows,
    styles: {
      fontSize: 8.8,
      cellPadding: 2,
      textColor: [15, 23, 42],
      overflow: 'linebreak',
    },
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [241, 245, 249],
      fontSize: 9.3,
    },
    margin: { left: MARGIN_X, right: MARGIN_X, bottom: 18 },
    didDrawPage: () => {
      setSectionTitle(pageSections, doc, modelCopy.scopeTitle);
    },
  });

  const autoTableState = doc as jsPDF & {
    lastAutoTable?: { finalY?: number };
  };
  const nextY = (autoTableState.lastAutoTable?.finalY ?? CONTENT_TOP + 45) + 6;

  autoTable(doc, {
    startY: nextY,
    head: [[
      modelCopy.testsTitle,
      language === 'en' ? 'Goal' : language === 'es' ? 'Meta' : 'Meta',
      language === 'en' ? 'Acceptance Criterion' : language === 'es' ? 'Criterio de Aceptacion' : 'Criterio de Aceite',
    ]],
    body: dynamicScope.testRows,
    styles: {
      fontSize: 8.8,
      cellPadding: 2,
      textColor: [15, 23, 42],
      overflow: 'linebreak',
    },
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [241, 245, 249],
      fontSize: 9.2,
    },
    margin: { left: MARGIN_X, right: MARGIN_X, bottom: 18 },
    didDrawPage: () => {
      setSectionTitle(pageSections, doc, modelCopy.scopeTitle);
    },
  });
}

function drawRiskMatrixSection(
  doc: jsPDF,
  pageSections: string[],
  params: GenerateStudioPdfParams,
) {
  const { language, links, nodes, firewallRules, siteVlans, sites } = params;
  const modelCopy = getProjectModelCopy(language);

  const statelessMissingReturn = firewallRules.filter(
    (rule) => rule.stateful === false && rule.missingReturn,
  ).length;
  const aclConflictCount = firewallRules.filter((rule) => rule.hasConflict)
    .length;
  const halfDuplexCount = links.filter((link) => link.duplexMode === 'half')
    .length;
  const noAclLinks = links.filter((link) => link.generateAcl === false).length;
  const sitesWithoutVlan = sites.filter(
    (site) => !siteVlans.some((vlan) => vlan.siteId === site.id),
  ).length;
  const dmzBidirectional = links.filter((link) => {
    const fromNode = nodes.find((node) => node.id === link.from);
    const toNode = nodes.find((node) => node.id === link.to);
    const hasDmzEdge = [fromNode, toNode].some(
      (node) => (node?.zone ?? '').toLowerCase() === 'dmz',
    );
    return hasDmzEdge && (link.bidirectional ?? true);
  }).length;

  const scoreToProbability = (value: number) => {
    if (value <= 0) return 'Low';
    if (value <= 2) return 'Medium';
    return 'High';
  };

  const scoreToImpact = (value: number) => {
    if (value <= 0) return 'Low';
    if (value <= 3) return 'Medium';
    return 'High';
  };

  doc.addPage();
  setSectionTitle(pageSections, doc, modelCopy.risksTitle);

  autoTable(doc, {
    startY: CONTENT_TOP,
    head: [[
      modelCopy.risk,
      modelCopy.impact,
      modelCopy.probability,
      modelCopy.mitigation,
      modelCopy.owner,
    ]],
    body: [
      [
        language === 'en'
          ? `Stateless rules without return (${statelessMissingReturn})`
          : language === 'es'
            ? `Reglas stateless sin retorno (${statelessMissingReturn})`
            : `Regras stateless sem retorno (${statelessMissingReturn})`,
        scoreToImpact(statelessMissingReturn),
        scoreToProbability(statelessMissingReturn),
        language === 'en'
          ? 'Enable return path or mark bidirectional where required.'
          : language === 'es'
            ? 'Habilitar retorno o marcar bidireccional donde sea necesario.'
            : 'Habilitar caminho de retorno ou marcar bidirecional onde necessario.',
        language === 'en' ? 'Security Team' : language === 'es' ? 'Equipo de Seguridad' : 'Time de Seguranca',
      ],
      [
        language === 'en'
          ? `ACL conflicts detected (${aclConflictCount})`
          : language === 'es'
            ? `Conflictos ACL detectados (${aclConflictCount})`
            : `Conflitos de ACL detectados (${aclConflictCount})`,
        scoreToImpact(aclConflictCount),
        scoreToProbability(aclConflictCount),
        language === 'en'
          ? 'Review priority and deny/allow overlaps before go-live.'
          : language === 'es'
            ? 'Revisar prioridad y superposiciones deny/allow antes del go-live.'
            : 'Revisar prioridade e sobreposicao deny/allow antes do go-live.',
        language === 'en' ? 'Security Team' : language === 'es' ? 'Equipo de Seguridad' : 'Time de Seguranca',
      ],
      [
        language === 'en'
          ? `Half-duplex links in design (${halfDuplexCount})`
          : language === 'es'
            ? `Enlaces half-duplex en el diseno (${halfDuplexCount})`
            : `Links half-duplex no desenho (${halfDuplexCount})`,
        scoreToImpact(halfDuplexCount),
        scoreToProbability(halfDuplexCount),
        language === 'en'
          ? 'Validate wireless/radio capacity with peak traffic simulation.'
          : language === 'es'
            ? 'Validar capacidad wireless/radio con simulacion de trafico pico.'
            : 'Validar capacidade wireless/radio com simulacao de trafego de pico.',
        language === 'en' ? 'Network Team' : language === 'es' ? 'Equipo de Red' : 'Time de Redes',
      ],
      [
        language === 'en'
          ? `Links without ACL generation (${noAclLinks})`
          : language === 'es'
            ? `Enlaces sin generacion de ACL (${noAclLinks})`
            : `Links sem geracao de ACL (${noAclLinks})`,
        scoreToImpact(noAclLinks),
        scoreToProbability(noAclLinks),
        language === 'en'
          ? 'Document exceptions and validate compensating controls.'
          : language === 'es'
            ? 'Documentar excepciones y validar controles compensatorios.'
            : 'Documentar excecoes e validar controles compensatorios.',
        language === 'en' ? 'Architecture Team' : language === 'es' ? 'Equipo de Arquitectura' : 'Time de Arquitetura',
      ],
      [
        language === 'en'
          ? `DMZ links marked bidirectional (${dmzBidirectional})`
          : language === 'es'
            ? `Enlaces DMZ marcados como bidireccionales (${dmzBidirectional})`
            : `Links de DMZ marcados como bidirecionais (${dmzBidirectional})`,
        scoreToImpact(dmzBidirectional),
        scoreToProbability(dmzBidirectional),
        language === 'en'
          ? 'Keep directional by default and open reverse only with justification.'
          : language === 'es'
            ? 'Mantener direccional por defecto y abrir retorno solo con justificacion.'
            : 'Manter direcional por padrao e abrir retorno apenas com justificativa.',
        language === 'en' ? 'Security Team' : language === 'es' ? 'Equipo de Seguridad' : 'Time de Seguranca',
      ],
      [
        language === 'en'
          ? `Sites without VLAN definition (${sitesWithoutVlan})`
          : language === 'es'
            ? `Sitios sin definicion de VLAN (${sitesWithoutVlan})`
            : `Sites sem definicao de VLAN (${sitesWithoutVlan})`,
        scoreToImpact(sitesWithoutVlan),
        scoreToProbability(sitesWithoutVlan),
        language === 'en'
          ? 'Complete addressing baseline before deployment window.'
          : language === 'es'
            ? 'Completar baseline de direccionamiento antes de la ventana de despliegue.'
            : 'Completar baseline de enderecamento antes da janela de deploy.',
        language === 'en' ? 'Architecture Team' : language === 'es' ? 'Equipo de Arquitectura' : 'Time de Arquitetura',
      ],
    ],
    styles: {
      fontSize: 8.9,
      cellPadding: 2,
      overflow: 'linebreak',
      textColor: [15, 23, 42],
    },
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [241, 245, 249],
      fontSize: 9.3,
    },
    margin: { left: MARGIN_X, right: MARGIN_X, bottom: 18 },
    didDrawPage: () => {
      setSectionTitle(pageSections, doc, modelCopy.risksTitle);
    },
  });
}

function fillTableOfContentsPage(
  doc: jsPDF,
  pageSections: string[],
  params: GenerateStudioPdfParams,
) {
  if (doc.getNumberOfPages() < 2) return;

  const modelCopy = getProjectModelCopy(params.language);
  doc.setPage(2);

  doc.setFillColor(255, 255, 255);
  doc.rect(MARGIN_X, CONTENT_TOP - 2, PAGE_WIDTH - MARGIN_X * 2, CONTENT_BOTTOM - CONTENT_TOP + 4, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(15, 23, 42);
  doc.text(modelCopy.tocTitle, MARGIN_X, CONTENT_TOP + 4);

  const firstPageBySection = new Map<string, number>();
  pageSections.forEach((section, index) => {
    if (!section || section === modelCopy.tocTitle) return;
    if (!firstPageBySection.has(section)) {
      firstPageBySection.set(section, index + 1);
    }
  });

  let y = CONTENT_TOP + 12;
  let index = 1;
  firstPageBySection.forEach((pageNumber, section) => {
    if (y > CONTENT_BOTTOM - 4) return;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59);
    doc.text(`${index}. ${section}`, MARGIN_X, y);
    doc.text(String(pageNumber), PAGE_WIDTH - MARGIN_X, y, { align: 'right' });
    doc.setDrawColor(203, 213, 225);
    doc.line(MARGIN_X, y + 1, PAGE_WIDTH - MARGIN_X, y + 1);
    y += 6;
    index += 1;
  });
}

function drawRoutesSection(
  doc: jsPDF,
  pageSections: string[],
  params: GenerateStudioPdfParams,
) {
  const { language, routes, sites } = params;
  const copy = getPdfReportCopy(language);
  const routeCopy = getRouteFirewallCopy(language);
  const modelCopy = getProjectModelCopy(language);
  const tableTop = CONTENT_TOP + 7;

  doc.addPage();
  setSectionTitle(pageSections, doc, copy.routesTitle);

  const drawRoutesPageCaption = () => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.4);
    doc.setTextColor(51, 65, 85);
    doc.text(copy.routesTitle, MARGIN_X, CONTENT_TOP + 4);
  };

  drawRoutesPageCaption();

  const siteOrder = [
    ...sites.map((site) => site.id),
    ...routes
      .map((route) => route.siteId)
      .filter((siteId) => !sites.some((site) => site.id === siteId)),
  ];

  const rowsBySite = new Map<string, RouteRow[]>();
  for (const route of routes) {
    const current = rowsBySite.get(route.siteId) ?? [];
    current.push(route);
    rowsBySite.set(route.siteId, current);
  }

  const bodyRows: Array<Array<string | { content: string; colSpan: number }>> =
    [];
  const rowKinds: Array<'site-header' | 'route' | 'other-ips'> = [];
  const rowGroups: number[] = [];
  let groupIndex = 0;

  for (const siteId of siteOrder) {
    const siteRoutes = rowsBySite.get(siteId);
    if (!siteRoutes || siteRoutes.length === 0) continue;

    const siteName = siteRoutes[0].siteName;
    bodyRows.push([{ content: siteName, colSpan: 8 }]);
    rowKinds.push('site-header');
    rowGroups.push(groupIndex);

    for (const route of siteRoutes) {
      bodyRows.push([
        route.siteName,
        resolveRouteTypeLabel(route.tipo, language),
        route.vlan,
        route.redeDest,
        route.gateway,
        route.iface,
        route.zone,
        route.networkName,
      ]);
      rowKinds.push('route');
      rowGroups.push(groupIndex);
    }

    bodyRows.push([
      {
        content: `${routeCopy.otherIps}: ${getSiteOtherIps(siteId, siteRoutes, sites)}`,
        colSpan: 8,
      },
    ]);
    rowKinds.push('other-ips');
    rowGroups.push(groupIndex);

    groupIndex += 1;
  }

  autoTable(doc, {
    startY: tableTop,
    head: [[
      copy.site,
      copy.type,
      'VLAN',
      'CIDR',
      'Gateway',
      'Interface',
      modelCopy.zone,
      modelCopy.networkName,
    ]],
    body: bodyRows,
    styles: {
      fontSize: 9.4,
      cellPadding: 2,
      overflow: 'linebreak',
      textColor: [15, 23, 42],
    },
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [241, 245, 249],
      fontSize: 10,
    },
    didParseCell: (data) => {
      if (data.section !== 'body') return;

      const kind = rowKinds[data.row.index];
      const currentGroup = rowGroups[data.row.index] ?? 0;

      if (kind === 'site-header') {
        data.cell.styles.fillColor = [30, 58, 88];
        data.cell.styles.textColor = [224, 242, 254];
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fontSize = 10;
        data.cell.styles.halign = 'left';
        return;
      }

      if (kind === 'other-ips') {
        data.cell.styles.fillColor = [254, 249, 195];
        data.cell.styles.textColor = [82, 67, 16];
        data.cell.styles.fontStyle = 'italic';
        data.cell.styles.fontSize = 8.8;
        data.cell.styles.halign = 'left';
        return;
      }

      data.cell.styles.fillColor =
        currentGroup % 2 === 0 ? [236, 246, 255] : [224, 238, 252];
      if (data.column.index === 0) {
        data.cell.styles.fontStyle = 'bold';
      }
    },
    margin: {
      left: MARGIN_X,
      right: MARGIN_X,
      top: tableTop,
      bottom: 18,
    },
    didDrawPage: () => {
      setSectionTitle(pageSections, doc, copy.routesTitle);
      drawRoutesPageCaption();
    },
  });
}

function drawFirewallSection(
  doc: jsPDF,
  pageSections: string[],
  params: GenerateStudioPdfParams,
) {
  const { language, firewallRules } = params;
  if (firewallRules.length === 0) return;

  const copy = getPdfReportCopy(language);
  const localeTerms = getPdfLocaleTerms(language);
  const modelCopy = getProjectModelCopy(language);
  const sectionTitle =
    language === 'pt'
      ? 'Tabela de Firewall e Regras de Seguranca'
      : copy.firewallTitle;
  const directionWidth = Math.max(
    14,
    getHeaderMinWidth(doc, modelCopy.direction),
  );
  const tableAvailableWidth = PAGE_WIDTH - MARGIN_X * 2;
  const otherColumnsWidth =
    22 + 17 + 47 + 47 + 35 + 22 + directionWidth + 16 + 18;
  const idFitWidth = firewallRules.reduce(
    (maxWidth, rule) => Math.max(maxWidth, getHeaderMinWidth(doc, rule.id, 8.6)),
    getHeaderMinWidth(doc, 'ID', 9.2),
  );
  const idWidth = Math.max(
    24,
    Math.min(tableAvailableWidth - otherColumnsWidth, idFitWidth),
  );
  const tableTop = CONTENT_TOP + 7;

  doc.addPage();
  setSectionTitle(pageSections, doc, sectionTitle);

  const drawFirewallPageCaption = () => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.4);
    doc.setTextColor(51, 65, 85);
    doc.text(sectionTitle, MARGIN_X, CONTENT_TOP + 4);
  };

  drawFirewallPageCaption();

  autoTable(doc, {
    startY: tableTop,
    head: [[
      'ID',
      modelCopy.sourceType,
      copy.type,
      copy.source,
      copy.destination,
      localeTerms.serviceHeader,
      modelCopy.sessionMode,
      modelCopy.direction,
      modelCopy.duplex,
      localeTerms.protocolHeader,
    ]],
    body: firewallRules.map((rule) => [
      rule.id,
      rule.source === 'manual'
        ? localeTerms.sourceManual
        : localeTerms.sourceTopology,
      rule.acao,
      rule.origem,
      rule.destino,
      rule.servico,
      rule.stateful === false
        ? localeTerms.statelessLabel
        : localeTerms.statefulLabel,
      rule.bidirectional ? '<->' : '->',
      rule.duplexMode === 'half' ? 'HALF' : 'FULL',
      (rule.protocol ?? 'any').toUpperCase(),
    ]),
    styles: {
      fontSize: 8.6,
      cellPadding: 2,
      minCellHeight: 6.8,
      overflow: 'linebreak',
      textColor: [15, 23, 42],
      valign: 'middle',
    },
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [241, 245, 249],
      fontSize: 9.2,
      minCellHeight: 8,
      overflow: 'visible',
    },
    columnStyles: {
      0: { cellWidth: idWidth, overflow: 'visible' },
      1: { cellWidth: 22 },
      2: { cellWidth: 17 },
      3: { cellWidth: 47 },
      4: { cellWidth: 47 },
      5: { cellWidth: 35 },
      6: { cellWidth: 22 },
      7: { cellWidth: directionWidth },
      8: { cellWidth: 16 },
      9: { cellWidth: 18 },
    },
    margin: {
      left: MARGIN_X,
      right: MARGIN_X,
      top: tableTop,
      bottom: 18,
    },
    didDrawPage: () => {
      setSectionTitle(pageSections, doc, sectionTitle);
      drawFirewallPageCaption();
    },
  });
}

function drawVlansSection(
  doc: jsPDF,
  pageSections: string[],
  params: GenerateStudioPdfParams,
) {
  const { language, siteVlans, sites, nodes, links } = params;
  const copy = getPdfReportCopy(language);
  const locale = mapLocale(language);

  doc.addPage();
  setSectionTitle(pageSections, doc, copy.vlansTitle);

  const bodyRows: Array<Array<string | { content: string; colSpan: number }>> =
    [];
  const rowKinds: Array<'site-header' | 'vlan-header' | 'node' | 'empty'> = [];

  for (const site of sites) {
    const siteVlanItems = siteVlans
      .filter((item) => item.siteId === site.id)
      .sort((a, b) => a.vlanId - b.vlanId);

    if (siteVlanItems.length === 0) continue;

    bodyRows.push([{ content: `${copy.site}: ${site.name}`, colSpan: 4 }]);
    rowKinds.push('site-header');

    for (const vlan of siteVlanItems) {
      const vlanNodes = nodes.filter(
        (node) =>
          node.siteId === site.id &&
          node.category !== 'wan' &&
          (node.vlans ?? []).includes(vlan.vlanId),
      );
      const ipRange = formatCompactRange(vlan.startIp, vlan.endIp);

      bodyRows.push([
        `VLAN ${vlan.vlanId} - ${vlan.name || copy.notAvailable}`,
        ipRange,
        'VLAN',
        vlan.capacity.toLocaleString(locale),
      ]);
      rowKinds.push('vlan-header');

      if (vlanNodes.length > 0) {
        for (const node of vlanNodes) {
          const nodeConnectionCount = links.filter(
            (link) => link.from === node.id || link.to === node.id,
          ).length;

          bodyRows.push([
            `   ${node.label}`,
            node.ip || '-',
            resolveCategoryLabel(node.category),
            String(nodeConnectionCount),
          ]);
          rowKinds.push('node');
        }
      } else {
        bodyRows.push([{ content: copy.noElementsInVlan, colSpan: 4 }]);
        rowKinds.push('empty');
      }
    }
  }

  autoTable(doc, {
    startY: CONTENT_TOP,
    head: [[copy.item, copy.ipRange, copy.type, copy.connections]],
    body: bodyRows,
    styles: {
      fontSize: 10.2,
      cellPadding: 2.3,
      overflow: 'linebreak',
      textColor: [15, 23, 42],
      valign: 'middle',
    },
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [241, 245, 249],
      fontSize: 10,
      cellPadding: 1.8,
      overflow: 'linebreak',
      valign: 'middle',
    },
    columnStyles: {
      0: { cellWidth: 94 },
      1: { cellWidth: 84 },
      2: { cellWidth: 38 },
      3: { cellWidth: 48, halign: 'center' },
    },
    didParseCell: (data) => {
      if (data.section === 'body') {
        const rowKind = rowKinds[data.row.index];

        if (rowKind === 'site-header') {
          data.cell.styles.fillColor = [30, 58, 88];
          data.cell.styles.textColor = [224, 242, 254];
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fontSize = 10.6;
          return;
        }

        if (rowKind === 'vlan-header') {
          data.cell.styles.fillColor = [15, 23, 42];
          data.cell.styles.textColor = [125, 211, 252];
          if (data.column.index === 0) {
            data.cell.styles.fontStyle = 'bold';
          }
          return;
        }

        if (rowKind === 'empty') {
          data.cell.styles.fillColor = [248, 250, 252];
          data.cell.styles.textColor = [100, 116, 139];
          data.cell.styles.fontStyle = 'italic';
          return;
        }

        data.cell.styles.fillColor = [241, 245, 249];
        if (data.column.index === 0) {
          data.cell.styles.textColor = [30, 41, 59];
        }
      }
    },
    margin: { left: MARGIN_X, right: MARGIN_X, bottom: 18 },
    didDrawPage: () => {
      setSectionTitle(pageSections, doc, copy.vlansTitle);
    },
  });
}

function drawComponentsSection(
  doc: jsPDF,
  pageSections: string[],
  params: GenerateStudioPdfParams,
) {
  const { language, nodes, sites } = params;
  const copy = getPdfReportCopy(language);
  const localeTerms = getPdfLocaleTerms(language);

  doc.addPage();
  setSectionTitle(pageSections, doc, copy.componentsTitle);

  const nodesBySite = new Map<string, NodeItem[]>();
  for (const node of nodes) {
    const key = node.siteId ?? '__unassigned__';
    const current = nodesBySite.get(key) ?? [];
    current.push(node);
    nodesBySite.set(key, current);
  }

  for (const siteNodes of nodesBySite.values()) {
    siteNodes.sort((a, b) => a.label.localeCompare(b.label));
  }

  const groupedSites: Array<{ siteName: string; siteNodes: NodeItem[] }> = [];
  for (const site of sites) {
    const siteNodes = nodesBySite.get(site.id);
    if (siteNodes && siteNodes.length > 0) {
      groupedSites.push({ siteName: site.name, siteNodes });
      nodesBySite.delete(site.id);
    }
  }

  const unassignedNodes = nodesBySite.get('__unassigned__');
  if (unassignedNodes && unassignedNodes.length > 0) {
    groupedSites.push({
      siteName: localeTerms.unassignedSiteLabel,
      siteNodes: unassignedNodes,
    });
    nodesBySite.delete('__unassigned__');
  }

  for (const [siteId, siteNodes] of nodesBySite.entries()) {
    groupedSites.push({ siteName: siteId, siteNodes });
  }

  const gap = 4;
  const cardWidth = (PAGE_WIDTH - MARGIN_X * 2 - gap) / 2;
  const cardHeight = 44;
  const groupHeaderHeight = 5.8;
  let x = MARGIN_X;
  let y = CONTENT_TOP;
  let col = 0;

  const resetGrid = () => {
    x = MARGIN_X;
    y = CONTENT_TOP;
    col = 0;
  };

  const startNewPage = () => {
    doc.addPage();
    setSectionTitle(pageSections, doc, copy.componentsTitle);
    resetGrid();
  };

  const drawSiteHeader = (siteName: string) => {
    doc.setFillColor(226, 232, 240);
    doc.setDrawColor(148, 163, 184);
    doc.roundedRect(
      MARGIN_X,
      y,
      PAGE_WIDTH - MARGIN_X * 2,
      groupHeaderHeight,
      1.2,
      1.2,
      'FD',
    );
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.1);
    doc.setTextColor(30, 41, 59);
    doc.text(`${copy.site}: ${siteName}`, MARGIN_X + 2.5, y + 3.9);
    y += groupHeaderHeight + 1.8;
  };

  for (const group of groupedSites) {
    if (col === 1) {
      col = 0;
      x = MARGIN_X;
      y += cardHeight + 4;
    }

    if (y + groupHeaderHeight + 1.8 > CONTENT_BOTTOM) {
      startNewPage();
    }
    drawSiteHeader(group.siteName);

    for (const node of group.siteNodes) {
      if (y + cardHeight > CONTENT_BOTTOM) {
        startNewPage();
        drawSiteHeader(group.siteName);
      }

      const siteName =
        sites.find((site) => site.id === node.siteId)?.name ?? group.siteName;
      const hostCount = Math.max(1, Math.trunc(Number(node.hostCount ?? 1) || 1));
      const nodeRangeText = hostCount > 1 ? getNodeIpRangeText(node) : null;
      const vlanText = node.vlans.length
        ? node.vlans.join(', ')
        : copy.notAvailable;
      const profile = node.techProfile
        ? Object.entries(node.techProfile.fields)
            .slice(0, 3)
            .map(([key, value]) => `${key}: ${String(value)}`)
            .join(' | ')
        : copy.noTechProfile;

      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(148, 163, 184);
      doc.roundedRect(x, y, cardWidth, cardHeight, 1.5, 1.5, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.2);
      doc.setTextColor(15, 23, 42);
      doc.text(`${copy.component}: ${node.label}`, x + 2.5, y + 5.5);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.8);
      doc.text(`${copy.site}: ${siteName}`, x + 2.5, y + 10);
      doc.text(
        `${copy.category}: ${resolveCategoryLabel(node.category)}`,
        x + 2.5,
        y + 15.2,
      );
      doc.text(`${copy.ipAddress}: ${node.ip}`, x + 2.5, y + 20.4);
      doc.text(
        `${copy.cidr}: /${node.cidr} | ${copy.vlanList}: ${vlanText}`,
        x + 2.5,
        y + 25.6,
      );
      const desc = doc.splitTextToSize(
        `${copy.description}: ${node.description || copy.notAvailable}`,
        cardWidth - 5,
      );
      doc.text(desc.slice(0, hostCount > 1 ? 1 : 2), x + 2.5, y + 31.2);

      const profileText = doc.splitTextToSize(
        `${copy.techProfile}: ${profile}`,
        cardWidth - 5,
      );
      if (hostCount > 1) {
        doc.text(profileText.slice(0, 1), x + 2.5, y + 36.3);
        const qtyRangeText = doc.splitTextToSize(
          `${localeTerms.quantityLabel}: ${hostCount} | ${localeTerms.ipRangeLabel}: ${nodeRangeText ?? copy.notAvailable}`,
          cardWidth - 5,
        );
        doc.text(qtyRangeText.slice(0, 1), x + 2.5, y + 40.8);
      } else {
        doc.text(profileText.slice(0, 1), x + 2.5, y + 40.8);
      }

      if (col === 0) {
        col = 1;
        x = MARGIN_X + cardWidth + gap;
      } else {
        col = 0;
        x = MARGIN_X;
        y += cardHeight + 4;
      }
    }

    if (col === 1) {
      col = 0;
      x = MARGIN_X;
      y += cardHeight + 4;
    }
    y += 2;
  }
}

function drawLinksInventorySection(
  doc: jsPDF,
  pageSections: string[],
  params: GenerateStudioPdfParams,
) {
  const { language, links, nodes } = params;
  const copy = getPdfReportCopy(language);
  const localeTerms = getPdfLocaleTerms(language);
  const modelCopy = getProjectModelCopy(language);
  const linksHeaders = [
    copy.source,
    copy.destination,
    copy.kind,
    modelCopy.direction,
    modelCopy.duplex,
    modelCopy.acl,
    modelCopy.sessionMode,
    copy.notes,
  ];
  const tableTop = CONTENT_TOP + 2.5;
  const baseWidths = [48, 48, 18, 16, 17, 12, 20, 105];
  const columnWidths = baseWidths.map((value, index) =>
    Math.max(value, getHeaderMinWidth(doc, linksHeaders[index], 10)),
  );

  doc.addPage();
  setSectionTitle(pageSections, doc, copy.linksInventoryTitle);

  autoTable(doc, {
    startY: tableTop,
    head: [
      linksHeaders,
    ],
    body: links.map((link) => {
      const from = nodes.find((item) => item.id === link.from);
      const to = nodes.find((item) => item.id === link.to);
      return [
        `${from?.label ?? link.from} (${from?.ip ?? copy.notAvailable})`,
        `${to?.label ?? link.to} (${to?.ip ?? copy.notAvailable})`,
        link.kind.toUpperCase(),
        link.bidirectional ?? true ? '<->' : '->',
        (link.duplexMode ?? 'full').toUpperCase(),
        link.generateAcl === false ? localeTerms.noLabel : localeTerms.yesLabel,
        link.statefulOverride === 'force-stateless'
          ? localeTerms.statelessLabel
          : link.statefulOverride === 'force-stateful'
            ? localeTerms.statefulLabel
            : localeTerms.inheritedLabel,
        link.description?.trim() || copy.notAvailable,
      ];
    }),
    styles: {
      fontSize: 8.7,
      cellPadding: 2,
      overflow: 'linebreak',
      textColor: [15, 23, 42],
    },
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [241, 245, 249],
      fontSize: 10,
      overflow: 'visible',
    },
    columnStyles: {
      0: { cellWidth: columnWidths[0] },
      1: { cellWidth: columnWidths[1] },
      2: { cellWidth: columnWidths[2] },
      3: { cellWidth: columnWidths[3] },
      4: { cellWidth: columnWidths[4] },
      5: { cellWidth: columnWidths[5] },
      6: { cellWidth: columnWidths[6] },
      7: { cellWidth: columnWidths[7] },
    },
    margin: {
      left: MARGIN_X,
      right: MARGIN_X,
      top: tableTop,
      bottom: 18,
    },
    didDrawPage: () => {
      setSectionTitle(pageSections, doc, copy.linksInventoryTitle);
    },
  });
}

function drawTechnicalAnnexSection(
  doc: jsPDF,
  pageSections: string[],
  params: GenerateStudioPdfParams,
) {
  const { language, sites } = params;
  const copy = getPdfReportCopy(language);

  doc.addPage();
  setSectionTitle(pageSections, doc, copy.technicalAnnexTitle);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11.2);
  doc.setTextColor(30, 41, 59);
  doc.text(copy.addressingConventions, MARGIN_X, CONTENT_TOP + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(copy.addressingLine1, MARGIN_X, CONTENT_TOP + 12);
  doc.text(copy.addressingLine2, MARGIN_X, CONTENT_TOP + 17);
  doc.text(copy.addressingLine3, MARGIN_X, CONTENT_TOP + 22);

  autoTable(doc, {
    startY: CONTENT_TOP + 28,
    head: [[copy.site, 'Octet', 'CIDR']],
    body: sites.map((site) => [
      site.name,
      String(site.ipOctet),
      String(site.cidr),
    ]),
    styles: {
      fontSize: 9.2,
      cellPadding: 2,
      textColor: [15, 23, 42],
    },
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [241, 245, 249],
      fontSize: 10,
    },
    margin: { left: MARGIN_X, right: MARGIN_X, bottom: 18 },
    didDrawPage: () => {
      setSectionTitle(pageSections, doc, copy.technicalAnnexTitle);
    },
  });

  const autoTableState = doc as jsPDF & {
    lastAutoTable?: { finalY?: number };
  };
  let y = (autoTableState.lastAutoTable?.finalY ?? CONTENT_TOP + 28) + 8;
  if (y > CONTENT_BOTTOM - 8) y = CONTENT_BOTTOM - 8;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(copy.category, MARGIN_X, y);

  const availableWidth = PAGE_WIDTH - MARGIN_X * 2;
  const columnCenters = [
    MARGIN_X + availableWidth / 6,
    MARGIN_X + availableWidth / 2,
    MARGIN_X + (availableWidth * 5) / 6,
  ];

  const drawLegendHeader = () => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(30, 41, 59);
    doc.text(copy.category, MARGIN_X, y);
  };

  let rowY = y + 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.2);
  doc.setTextColor(51, 65, 85);

  for (let index = 0; index < NODE_VISUALS.length; index += 3) {
    if (rowY > CONTENT_BOTTOM - 3) {
      doc.addPage();
      setSectionTitle(pageSections, doc, copy.technicalAnnexTitle);
      y = CONTENT_TOP + 8;
      drawLegendHeader();
      rowY = y + 5;
    }

    const rowItems = NODE_VISUALS.slice(index, index + 3);
    rowItems.forEach((visual, col) => {
      doc.text(`${visual.short} - ${visual.label}`, columnCenters[col], rowY, {
        align: 'center',
      });
    });
    rowY += 4.8;
  }
}

function drawHeaderAndFooter(
  doc: jsPDF,
  pageSections: string[],
  params: GenerateStudioPdfParams,
  brandIconDataUrl?: string | null,
) {
  const { language, projectName, sites } = params;
  const copy = getPdfReportCopy(language);
  const localeTerms = getPdfLocaleTerms(language);
  const locale = mapLocale(language);
  const generatedAt = new Date().toLocaleString(locale);
  const version = params.documentVersion ?? 'v1.0';
  const totalPages = doc.getNumberOfPages();
  const siteScope = buildSiteScope(sites, copy.allSites);

  for (let page = 1; page <= totalPages; page += 1) {
    doc.setPage(page);
    const section = pageSections[page - 1] ?? copy.documentTitle;

    // Header background + accent bars
    doc.setFillColor(5, 11, 28);
    doc.rect(0, 0, PAGE_WIDTH, 21, 'F');
    doc.setFillColor(14, 165, 233);
    doc.rect(0, 0, PAGE_WIDTH, 1.5, 'F');
    doc.setFillColor(56, 189, 248);
    doc.rect(0, 20.2, PAGE_WIDTH, 0.8, 'F');

    // Icon badge
    const iconBoxX = MARGIN_X;
    const iconBoxY = 4.2;
    const iconBoxSize = 11.4;
    doc.setFillColor(15, 23, 42);
    doc.setDrawColor(125, 211, 252);
    doc.roundedRect(iconBoxX, iconBoxY, iconBoxSize, iconBoxSize, 1.8, 1.8, 'FD');
    if (brandIconDataUrl) {
      doc.addImage(
        brandIconDataUrl,
        'PNG',
        iconBoxX + 1.1,
        iconBoxY + 1.1,
        iconBoxSize - 2.2,
        iconBoxSize - 2.2,
        undefined,
        'FAST',
      );
    } else {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(125, 211, 252);
      doc.text('RS', iconBoxX + iconBoxSize / 2, iconBoxY + 7.5, {
        align: 'center',
      });
    }

    // Section pill
    const pillWidth = 83;
    const pillX = PAGE_WIDTH - MARGIN_X - pillWidth;
    doc.setFillColor(15, 23, 42);
    doc.setDrawColor(71, 85, 105);
    doc.roundedRect(pillX, 4.5, pillWidth, 7.2, 1.6, 1.6, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(241, 245, 249);
    doc.text(copy.documentTitle, iconBoxX + iconBoxSize + 3, 8.7);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.8);
    doc.setTextColor(148, 163, 184);
    doc.text(localeTerms.headerSubtitle, iconBoxX + iconBoxSize + 3, 13.2);

    doc.setFontSize(8.6);
    doc.setTextColor(203, 213, 225);
    doc.text(`${copy.project}: ${projectName}`, MARGIN_X, 18);
    doc.text(`${copy.siteScope}: ${siteScope}`, PAGE_WIDTH / 2, 18, {
      align: 'center',
    });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(224, 242, 254);
    doc.text(section, PAGE_WIDTH - MARGIN_X - 2.5, 9.5, { align: 'right' });

    // Footer
    doc.setFillColor(248, 250, 252);
    doc.rect(0, FOOTER_Y - 6.6, PAGE_WIDTH, 6.6, 'F');
    doc.setDrawColor(203, 213, 225);
    doc.line(MARGIN_X, FOOTER_Y - 5, PAGE_WIDTH - MARGIN_X, FOOTER_Y - 5);

    const pageBadgeWidth = 28;
    const pageBadgeX = PAGE_WIDTH - MARGIN_X - pageBadgeWidth;
    doc.setFillColor(15, 23, 42);
    doc.roundedRect(pageBadgeX, FOOTER_Y - 4.6, pageBadgeWidth, 3.4, 1.2, 1.2, 'F');

    doc.setFontSize(9.2);
    doc.setTextColor(71, 85, 105);
    doc.text(`${copy.generatedAt}: ${generatedAt}`, MARGIN_X, FOOTER_Y - 1.2);
    doc.text(`${copy.rightsReserved} | ${version}`, PAGE_WIDTH / 2, FOOTER_Y - 1.2, {
      align: 'center',
    });
    doc.setTextColor(241, 245, 249);
    doc.setFontSize(8.8);
    doc.text(
      `${copy.page} ${page}/${totalPages}`,
      PAGE_WIDTH - MARGIN_X - 1.7,
      FOOTER_Y - 2.15,
      {
        align: 'right',
      },
    );
  }
}

export async function generateStudioPdfReport(params: GenerateStudioPdfParams) {
  const { language, targetWindow } = params;
  const copy = getPdfReportCopy(language);
  const brandIconDataUrl = await getStudioBrandIconDataUrl();
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
    compress: true,
    putOnlyUsedFonts: true,
  });
  const pageSections: string[] = [];

  drawCoverPage(doc, pageSections, params);
  drawTableOfContentsSection(doc, pageSections, params);
  drawRevisionControlSection(doc, pageSections, params);
  await drawDashboardPage(doc, pageSections, params);
  drawScopePlanningSection(doc, pageSections, params);
  drawRoutesSection(doc, pageSections, params);
  drawFirewallSection(doc, pageSections, params);
  drawVlansSection(doc, pageSections, params);
  drawComponentsSection(doc, pageSections, params);
  drawLinksInventorySection(doc, pageSections, params);
  drawRiskMatrixSection(doc, pageSections, params);
  drawTechnicalAnnexSection(doc, pageSections, params);
  fillTableOfContentsPage(doc, pageSections, params);
  drawHeaderAndFooter(doc, pageSections, params, brandIconDataUrl);

  doc.setProperties({
    title: copy.documentTitle,
    subject: copy.executiveSummary,
    author: 'Studio',
  });

  const pdfBlob = doc.output('blob');
  const blobUrl = URL.createObjectURL(pdfBlob);

  window.setTimeout(() => {
    URL.revokeObjectURL(blobUrl);
  }, 120000);

  if (targetWindow && !targetWindow.closed) {
    try {
      targetWindow.document.open();
      targetWindow.document.write(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${copy.documentTitle}</title>
    <style>
      html, body { margin: 0; padding: 0; width: 100%; height: 100%; background: #0f172a; }
      iframe { border: 0; width: 100%; height: 100%; display: block; }
    </style>
  </head>
  <body>
    <iframe src="${blobUrl}" title="${copy.documentTitle}"></iframe>
  </body>
</html>`);
      targetWindow.document.close();
    } catch {
      targetWindow.location.replace(blobUrl);
    }
    return;
  }

  window.open(blobUrl, '_blank');
}
