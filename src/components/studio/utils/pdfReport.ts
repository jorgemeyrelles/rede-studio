import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';
import type {
  LinkItem,
  NodeItem,
  RouteRow,
  Site,
  SiteVlan,
} from '../../../features/network/types';
import type { StudioLanguage } from '../types';
import { NODE_VISUALS } from '../constants';
import { getPdfReportCopy, getRouteFirewallCopy } from './i18n';
import { getSiteOtherIps } from './routeFirewall';
import { formatCompactRange } from './siteVlan';

type FirewallRuleRow = {
  id: string;
  acao: string;
  origem: string;
  destino: string;
  servico: string;
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
  diagramImageData?: string | null;
  dashboardElement: HTMLElement | null;
  targetWindow: Window | null;
};

const PAGE_WIDTH = 297;
const PAGE_HEIGHT = 210;
const MARGIN_X = 4;
const HEADER_TOP = 10;
const CONTENT_TOP = 22;
const CONTENT_BOTTOM = 199;
const FOOTER_Y = 205;

function mapLocale(language: StudioLanguage) {
  if (language === 'en') return 'en-US';
  if (language === 'es') return 'es-ES';
  return 'pt-BR';
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
  };
  return labels[tipo] ?? tipo;
}

function resolveCategoryLabel(category: NodeItem['category']) {
  return (
    NODE_VISUALS.find((item) => item.category === category)?.label ?? category
  );
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
  } = params;
  const copy = getPdfReportCopy(language);
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

function drawRoutesSection(
  doc: jsPDF,
  pageSections: string[],
  params: GenerateStudioPdfParams,
) {
  const { language, routes, sites } = params;
  const copy = getPdfReportCopy(language);
  const routeCopy = getRouteFirewallCopy(language);

  doc.addPage();
  setSectionTitle(pageSections, doc, copy.routesTitle);

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
    bodyRows.push([{ content: siteName, colSpan: 6 }]);
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
      ]);
      rowKinds.push('route');
      rowGroups.push(groupIndex);
    }

    bodyRows.push([
      {
        content: `${routeCopy.otherIps}: ${getSiteOtherIps(siteId, siteRoutes, sites)}`,
        colSpan: 6,
      },
    ]);
    rowKinds.push('other-ips');
    rowGroups.push(groupIndex);

    groupIndex += 1;
  }

  autoTable(doc, {
    startY: CONTENT_TOP,
    head: [[copy.site, copy.type, 'VLAN', 'CIDR', 'Gateway', 'Interface']],
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
    margin: { left: MARGIN_X, right: MARGIN_X, bottom: 18 },
    didDrawPage: () => {
      setSectionTitle(pageSections, doc, copy.routesTitle);
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
  doc.addPage();
  setSectionTitle(pageSections, doc, copy.firewallTitle);

  autoTable(doc, {
    startY: CONTENT_TOP,
    head: [['ID', copy.type, copy.source, copy.destination, 'Service']],
    body: firewallRules.map((rule) => [
      rule.id,
      rule.acao,
      rule.origem,
      rule.destino,
      rule.servico,
    ]),
    styles: {
      fontSize: 10.4,
      cellPadding: 2.4,
      minCellHeight: 7.2,
      overflow: 'linebreak',
      textColor: [15, 23, 42],
      valign: 'middle',
    },
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [241, 245, 249],
      fontSize: 11.2,
      minCellHeight: 8,
    },
    margin: { left: MARGIN_X, right: MARGIN_X, bottom: 18 },
    didDrawPage: () => {
      setSectionTitle(pageSections, doc, copy.firewallTitle);
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

    bodyRows.push([{ content: `Site: ${site.name}`, colSpan: 4 }]);
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

  doc.addPage();
  setSectionTitle(pageSections, doc, copy.componentsTitle);

  const sortedNodes = [...nodes].sort((a, b) => {
    const siteA = sites.find((site) => site.id === a.siteId)?.name ?? '';
    const siteB = sites.find((site) => site.id === b.siteId)?.name ?? '';
    return `${siteA}-${a.label}`.localeCompare(`${siteB}-${b.label}`);
  });

  const gap = 4;
  const cardWidth = (PAGE_WIDTH - MARGIN_X * 2 - gap) / 2;
  const cardHeight = 40;
  let x = MARGIN_X;
  let y = CONTENT_TOP;
  let col = 0;

  for (const node of sortedNodes) {
    if (y + cardHeight > CONTENT_BOTTOM) {
      doc.addPage();
      setSectionTitle(pageSections, doc, copy.componentsTitle);
      x = MARGIN_X;
      y = CONTENT_TOP;
      col = 0;
    }

    const siteName =
      sites.find((site) => site.id === node.siteId)?.name ?? copy.notAvailable;
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
    doc.text(desc.slice(0, 2), x + 2.5, y + 31.2);

    const profileText = doc.splitTextToSize(
      `${copy.techProfile}: ${profile}`,
      cardWidth - 5,
    );
    doc.text(profileText.slice(0, 1), x + 2.5, y + 38.2);

    if (col === 0) {
      col = 1;
      x = MARGIN_X + cardWidth + gap;
    } else {
      col = 0;
      x = MARGIN_X;
      y += cardHeight + 4;
    }
  }
}

function drawLinksInventorySection(
  doc: jsPDF,
  pageSections: string[],
  params: GenerateStudioPdfParams,
) {
  const { language, links, nodes } = params;
  const copy = getPdfReportCopy(language);

  doc.addPage();
  setSectionTitle(pageSections, doc, copy.linksInventoryTitle);

  autoTable(doc, {
    startY: CONTENT_TOP,
    head: [
      [copy.source, copy.destination, copy.kind, copy.latency, copy.notes],
    ],
    body: links.map((link) => {
      const from = nodes.find((item) => item.id === link.from);
      const to = nodes.find((item) => item.id === link.to);
      return [
        `${from?.label ?? link.from} (${from?.ip ?? copy.notAvailable})`,
        `${to?.label ?? link.to} (${to?.ip ?? copy.notAvailable})`,
        link.kind.toUpperCase(),
        copy.notAvailable,
        copy.notAvailable,
      ];
    }),
    styles: {
      fontSize: 9.2,
      cellPadding: 2,
      overflow: 'linebreak',
      textColor: [15, 23, 42],
    },
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [241, 245, 249],
      fontSize: 10,
    },
    margin: { left: MARGIN_X, right: MARGIN_X, bottom: 18 },
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

  let y = doc.lastAutoTable.finalY + 8;
  if (y > CONTENT_BOTTOM - 8) y = CONTENT_BOTTOM - 8;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(copy.category, MARGIN_X, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.6);
  let x = MARGIN_X;
  let rowY = y + 5;
  const colWidth = (PAGE_WIDTH - MARGIN_X * 2) / 3;
  for (let i = 0; i < NODE_VISUALS.length; i += 1) {
    const visual = NODE_VISUALS[i];
    doc.text(`${visual.short} - ${visual.label}`, x, rowY);
    rowY += 4.5;
    if (rowY > CONTENT_BOTTOM - 3) {
      rowY = y + 5;
      x += colWidth;
    }
  }
}

function drawHeaderAndFooter(
  doc: jsPDF,
  pageSections: string[],
  params: GenerateStudioPdfParams,
) {
  const { language, projectName, sites } = params;
  const copy = getPdfReportCopy(language);
  const locale = mapLocale(language);
  const generatedAt = new Date().toLocaleString(locale);
  const totalPages = doc.getNumberOfPages();
  const siteScope = buildSiteScope(sites, copy.allSites);

  for (let page = 1; page <= totalPages; page += 1) {
    doc.setPage(page);
    const section = pageSections[page - 1] ?? copy.documentTitle;

    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, PAGE_WIDTH, 20, 'F');
    doc.setDrawColor(148, 163, 184);
    doc.line(MARGIN_X, 20, PAGE_WIDTH - MARGIN_X, 20);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12.4);
    doc.setTextColor(241, 245, 249);
    doc.text(copy.documentTitle, PAGE_WIDTH / 2, 7, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.4);
    doc.text(`${copy.project}: ${projectName}`, MARGIN_X, 12.5);
    doc.text(`${copy.siteScope}: ${siteScope}`, PAGE_WIDTH / 2, 12.5, {
      align: 'center',
    });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11.2);
    doc.text(section, PAGE_WIDTH - MARGIN_X, 17.5, { align: 'right' });

    doc.setDrawColor(203, 213, 225);
    doc.line(MARGIN_X, FOOTER_Y - 5, PAGE_WIDTH - MARGIN_X, FOOTER_Y - 5);
    doc.setFontSize(9.2);
    doc.setTextColor(71, 85, 105);
    doc.text(`${copy.generatedAt}: ${generatedAt}`, MARGIN_X, FOOTER_Y - 1.2);
    doc.text(copy.rightsReserved, PAGE_WIDTH / 2, FOOTER_Y - 1.2, {
      align: 'center',
    });
    doc.text(
      `${copy.page} ${page}/${totalPages}`,
      PAGE_WIDTH - MARGIN_X,
      FOOTER_Y - 1.2,
      {
        align: 'right',
      },
    );
  }
}

export async function generateStudioPdfReport(params: GenerateStudioPdfParams) {
  const { language, targetWindow } = params;
  const copy = getPdfReportCopy(language);
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
    compress: true,
    putOnlyUsedFonts: true,
  });
  const pageSections: string[] = [];

  drawCoverPage(doc, pageSections, params);
  await drawDashboardPage(doc, pageSections, params);
  drawRoutesSection(doc, pageSections, params);
  drawFirewallSection(doc, pageSections, params);
  drawVlansSection(doc, pageSections, params);
  drawComponentsSection(doc, pageSections, params);
  drawLinksInventorySection(doc, pageSections, params);
  drawTechnicalAnnexSection(doc, pageSections, params);
  drawHeaderAndFooter(doc, pageSections, params);

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
