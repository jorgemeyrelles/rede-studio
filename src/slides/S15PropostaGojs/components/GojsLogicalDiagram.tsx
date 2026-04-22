import * as go from 'gojs';
import { useEffect, useRef, useState } from 'react';
import { ACL_RULES, ACTION_LABEL } from '../../S11Firewall/constants';
import {
  FIREWALL_DEDICATED_ITEMS,
  VPN_CRYPTO_ITEMS,
} from '../../S12Seguranca/constants';
import {
  DIAGRAM_LINK_DATA,
  DIAGRAM_NODE_DATA,
  ICON_KEYS_BY_LAYER,
  LAYER1_HEIGHT,
  LAYER1_Y,
  LAYER2_Y,
  LAYER3_Y,
  LAYER4_Y,
  LAYER_COMMON_HEIGHT,
  LAYER_WIDTH,
  MAIN_CONTAINER_MAX_HEIGHT,
  MAIN_CONTAINER_MIN_HEIGHT,
  MAIN_CONTAINER_WIDTH,
  PLACEHOLDER_PADDING,
} from '../constants';
import type { TooltipData } from '../types';
import { calculateTooltipPosition } from '../utils';

type GojsLogicalDiagramProps = {
  cardTitle: string;
  cardSubtitle: string;
  ariaLabel?: string;
  tooltipWidth?: number;
  tooltipHeight?: number;
};

function summarizeAclRule(rule: (typeof ACL_RULES)[number]) {
  return `${rule.source} -> ${rule.destination} (${rule.port})`;
}

function getSecurityTooltipData(nodeKey: string) {
  if (nodeKey === 'sp-fw' || nodeKey === 'cwb-fw') {
    return {
      firewallChecklist: FIREWALL_DEDICATED_ITEMS,
      aclHighlights: ACL_RULES.map((rule) => ({
        id: rule.id,
        action: ACTION_LABEL[rule.action],
        summary: summarizeAclRule(rule),
      })),
    };
  }

  if (nodeKey === 'vpn-sts' || nodeKey === 'vpn-ssl') {
    const aclVpn = ACL_RULES.filter(
      (rule) =>
        rule.source.includes('VPN') ||
        rule.destination.includes('10.10.1.0/28') ||
        rule.description.includes('VPN'),
    );

    return {
      vpnCryptoChecklist: VPN_CRYPTO_ITEMS,
      aclHighlights: aclVpn.map((rule) => ({
        id: rule.id,
        action: ACTION_LABEL[rule.action],
        summary: summarizeAclRule(rule),
      })),
    };
  }

  return {};
}

function buildLogicalDiagram(container: HTMLDivElement) {
  const $ = go.GraphObject.make;

  const existingDiagram = go.Diagram.fromDiv(container);
  if (existingDiagram) {
    existingDiagram.div = null;
  }

  const diagram = $(go.Diagram, container, {
    'commandHandler.archetypeGroupData': { isGroup: true, text: 'Subnet' },
    'undoManager.isEnabled': true,
    isReadOnly: false,
    initialAutoScale: go.AutoScale.Uniform,
    contentAlignment: go.Spot.Center,
    padding: 14,
  });

  diagram.toolManager.linkingTool.isEnabled = false;
  diagram.toolManager.relinkingTool.isEnabled = false;

  diagram.nodeTemplateMap.add(
    'layerbox',
    $(
      go.Node,
      'Auto',
      {
        movable: false,
        selectable: false,
        avoidable: false,
        layerName: 'Background',
        locationSpot: go.Spot.TopLeft,
      },
      new go.Binding('location', 'loc', go.Point.parse),
      $(
        go.Shape,
        'RoundedRectangle',
        {
          fill: 'rgba(12, 18, 34, 0.35)',
          stroke: '#37537a',
          strokeWidth: 1,
          parameter1: 8,
        },
        new go.Binding('stroke', 'stroke'),
        new go.Binding('fill', 'fill'),
        new go.Binding('desiredSize', 'size', go.Size.parse),
      ),
      $(
        go.TextBlock,
        {
          alignment: go.Spot.TopLeft,
          margin: 6,
          stroke: '#9dc1e5',
          font: '700 12px Barlow',
        },
        new go.Binding('text', 'text'),
      ),
    ),
  );

  diagram.nodeTemplate = $(
    go.Node,
    'Auto',
    {
      locationSpot: go.Spot.Center,
      movable: true,
    },
    new go.Binding('location', 'loc', go.Point.parse),
    $(go.Shape, 'RoundedRectangle', {
      fill: '#060d19',
      stroke: '#1d3353',
      strokeWidth: 1,
      parameter1: 6,
    }),
    $(
      go.Panel,
      'Vertical',
      {
        margin: 4,
        defaultAlignment: go.Spot.Center,
      },
      $(
        go.Panel,
        'Spot',
        { margin: new go.Margin(2, 2, 0, 2) },
        $(
          go.Picture,
          {
            name: 'BODY',
            width: 48,
            height: 48,
            portId: '',
            fromLinkable: false,
            toLinkable: false,
            cursor: 'move',
            mouseEnter: (_e, obj) => {
              const node = obj.part as go.Node | null;
              if (!node) return;
              node.findLinksConnected().each((link) => {
                link.isHighlighted = true;
              });
            },
            mouseLeave: (_e, obj) => {
              const node = obj.part as go.Node | null;
              if (!node) return;
              node.findLinksConnected().each((link) => {
                link.isHighlighted = false;
              });
            },
          },
          new go.Binding(
            'source',
            'type',
            (t) => `/images/network/${String(t).toLowerCase()}.svg`,
          ),
        ),
        $(
          go.Panel,
          'Auto',
          {
            alignment: go.Spot.TopRight,
            alignmentFocus: go.Spot.Center,
            width: 16,
            height: 16,
            cursor: 'pointer',
            name: 'INFOBTN',
          },
          $(go.Shape, 'Circle', {
            fill: '#5a9fd4',
            stroke: '#2a6ba6',
            strokeWidth: 1,
          }),
          $(go.TextBlock, {
            text: 'i',
            font: 'bold 10px sans-serif',
            stroke: '#fff',
            textAlign: 'center',
            verticalAlignment: go.Spot.Center,
          }),
        ),
      ),
      $(
        go.TextBlock,
        {
          stroke: '#d8e7fb',
          font: '700 11px Barlow',
          textAlign: 'center',
          maxSize: new go.Size(110, NaN),
          margin: new go.Margin(2, 4, 2, 4),
        },
        new go.Binding('text', 'text'),
      ),
    ),
  );

  diagram.groupTemplate = $(
    go.Group,
    'Vertical',
    {
      locationSpot: go.Spot.TopLeft,
      computesBoundsAfterDrag: true,
      movable: false,
    },
    new go.Binding('location', 'loc', go.Point.parse),
    $(
      go.TextBlock,
      {
        alignment: go.Spot.Left,
        font: '700 12px Barlow',
        stroke: '#cfe5ff',
        margin: new go.Margin(0, 0, 5, 2),
      },
      new go.Binding('text', 'text'),
    ),
    $(
      go.Panel,
      'Auto',
      $(
        go.Shape,
        'RoundedRectangle',
        {
          strokeDashArray: [3, 6],
          strokeWidth: 1.5,
          stroke: '#335a86',
          fill: 'rgba(9, 20, 38, 0.45)',
          minSize: new go.Size(NaN, MAIN_CONTAINER_MIN_HEIGHT),
          maxSize: new go.Size(NaN, MAIN_CONTAINER_MAX_HEIGHT),
        },
        new go.Binding('stroke', 'stroke'),
        new go.Binding('fill', 'fill'),
      ),
      $(go.Placeholder, { padding: PLACEHOLDER_PADDING }),
    ),
  );

  diagram.linkTemplate = $(
    go.Link,
    {
      routing: go.Routing.AvoidsNodes,
      curve: go.Curve.JumpGap,
      corner: 8,
      layerName: 'Background',
      adjusting: go.LinkAdjusting.End,
      fromEndSegmentLength: 14,
      toEndSegmentLength: 14,
      fromSpot: go.Spot.AllSides,
      toSpot: go.Spot.AllSides,
    },
    new go.Binding('layerName', 'isHighlighted', (h) =>
      h ? 'Foreground' : 'Background',
    ).ofObject(),
    new go.Binding('routing', 'routing'),
    new go.Binding('curve', 'curve'),
    new go.Binding('corner', 'corner'),
    new go.Binding('fromSpot', 'fromSpot', (s) =>
      typeof s === 'string' ? go.Spot.parse(s) : s,
    ),
    new go.Binding('toSpot', 'toSpot', (s) =>
      typeof s === 'string' ? go.Spot.parse(s) : s,
    ),
    new go.Binding('fromEndSegmentLength', 'fromEndSegmentLength'),
    new go.Binding('toEndSegmentLength', 'toEndSegmentLength'),
    $(
      go.Shape,
      {
        isPanelMain: true,
        strokeWidth: 0,
        stroke: 'rgba(145, 210, 255, 0.85)',
        opacity: 0,
      },
      new go.Binding('strokeDashArray', 'dash'),
      new go.Binding('strokeWidth', 'isHighlighted', (h) =>
        h ? 9 : 0,
      ).ofObject(),
      new go.Binding('opacity', 'isHighlighted', (h) =>
        h ? 0.32 : 0,
      ).ofObject(),
    ),
    $(
      go.Shape,
      {
        isPanelMain: true,
        strokeWidth: 1.5,
        stroke: '#76a5dc',
      },
      new go.Binding('stroke', 'stroke'),
      new go.Binding('strokeDashArray', 'dash'),
      new go.Binding('strokeWidth', 'isHighlighted', (h) =>
        h ? 3.8 : 1.5,
      ).ofObject(),
    ),
    $(
      go.Shape,
      { strokeWidth: 0, fill: '#76a5dc', scale: 0.7, fromArrow: 'Circle' },
      new go.Binding('fill', 'stroke'),
      new go.Binding('scale', 'isHighlighted', (h) =>
        h ? 0.9 : 0.7,
      ).ofObject(),
    ),
    $(
      go.Shape,
      { strokeWidth: 0, fill: '#76a5dc', scale: 0.7, toArrow: 'Circle' },
      new go.Binding('fill', 'stroke'),
      new go.Binding('scale', 'isHighlighted', (h) =>
        h ? 0.9 : 0.7,
      ).ofObject(),
    ),
    $(
      go.Panel,
      'Auto',
      { segmentFraction: 0.5 },
      $(go.Shape, 'RoundedRectangle', {
        fill: '#060d19',
        stroke: '#1d3353',
      }),
      $(
        go.TextBlock,
        {
          margin: new go.Margin(2, 5, 2, 5),
          stroke: '#b9d6f6',
          font: '700 7px "Share Tech Mono"',
        },
        new go.Binding('text', 'label'),
        new go.Binding('font', 'isHighlighted', (h) =>
          h ? '700 14px "Share Tech Mono"' : '700 7px "Share Tech Mono"',
        ).ofObject(),
      ),
    ),
  );

  diagram.model = new go.GraphLinksModel(DIAGRAM_NODE_DATA, DIAGRAM_LINK_DATA);

  const model = diagram.model as go.GraphLinksModel;
  const nodeDataArray = model.nodeDataArray as Array<{
    key: string;
    loc?: string;
    size?: string;
  }>;
  const byKey = new Map(nodeDataArray.map((d) => [String(d.key), d]));

  const setLoc = (key: string, x: number, y: number) => {
    const data = byKey.get(key);
    if (!data) return;
    model.setDataProperty(data, 'loc', `${Math.round(x)} ${Math.round(y)}`);
  };

  const setSize = (key: string, w: number, h: number) => {
    const data = byKey.get(key);
    if (!data) return;
    model.setDataProperty(data, 'size', `${Math.round(w)} ${Math.round(h)}`);
  };

  const layer2CenterY = LAYER2_Y + LAYER_COMMON_HEIGHT / 2;
  const layer3CenterY = LAYER3_Y + LAYER_COMMON_HEIGHT / 2;
  const layer4CenterY = LAYER4_Y + LAYER_COMMON_HEIGHT / 2;
  const layer1RouterY = LAYER1_Y + 56;
  const layer1FirewallY = LAYER1_Y + 188;

  const siteHalfGap = 140;
  const spLayerX = -(MAIN_CONTAINER_WIDTH + siteHalfGap);
  setLoc('sp-layer-core', spLayerX, LAYER1_Y);
  setSize('sp-layer-core', LAYER_WIDTH, LAYER1_HEIGHT);
  setLoc('sp-layer-dist', spLayerX, LAYER2_Y);
  setSize('sp-layer-dist', LAYER_WIDTH, LAYER_COMMON_HEIGHT);
  setLoc('sp-layer-acc', spLayerX, LAYER3_Y);
  setSize('sp-layer-acc', LAYER_WIDTH, LAYER_COMMON_HEIGHT);
  setLoc('sp-layer-end', spLayerX, LAYER4_Y);
  setSize('sp-layer-end', LAYER_WIDTH, LAYER_COMMON_HEIGHT);

  const cwbLayerX = siteHalfGap;
  setLoc('cwb-layer-core', cwbLayerX, LAYER1_Y);
  setSize('cwb-layer-core', LAYER_WIDTH, LAYER1_HEIGHT);
  setLoc('cwb-layer-dist', cwbLayerX, LAYER2_Y);
  setSize('cwb-layer-dist', LAYER_WIDTH, LAYER_COMMON_HEIGHT);
  setLoc('cwb-layer-acc', cwbLayerX, LAYER3_Y);
  setSize('cwb-layer-acc', LAYER_WIDTH, LAYER_COMMON_HEIGHT);
  setLoc('cwb-layer-end', cwbLayerX, LAYER4_Y);
  setSize('cwb-layer-end', LAYER_WIDTH, LAYER_COMMON_HEIGHT);

  const distributeHorizontally = (
    keys: string[],
    layerX: number,
    layerWidth: number,
    y: number,
    sidePadding: number = 36,
  ) => {
    if (keys.length === 0) return;
    const startX = layerX + sidePadding;
    const endX = layerX + layerWidth - sidePadding;
    if (keys.length === 1) {
      setLoc(keys[0], (startX + endX) / 2, y);
      return;
    }
    const step = (endX - startX) / (keys.length - 1);
    keys.forEach((key, index) => setLoc(key, startX + step * index, y));
  };

  const spLayerCenter = spLayerX + LAYER_WIDTH / 2;
  const cwbLayerCenter = cwbLayerX + LAYER_WIDTH / 2;

  setLoc('sp-rtr', spLayerCenter, layer1RouterY);
  setLoc('sp-fw', spLayerCenter, layer1FirewallY);
  setLoc('cwb-rtr', cwbLayerCenter, layer1RouterY);
  setLoc('cwb-fw', cwbLayerCenter, layer1FirewallY);

  setLoc('sp-sw', spLayerCenter, layer2CenterY);
  setLoc('cwb-sw', cwbLayerCenter, layer2CenterY);

  const layer3SidePadding = 132;
  distributeHorizontally(
    ['sp-srv', 'sp-ap'],
    spLayerX,
    LAYER_WIDTH,
    layer3CenterY,
    layer3SidePadding,
  );
  distributeHorizontally(
    ['cwb-srv', 'cwb-ap'],
    cwbLayerX,
    LAYER_WIDTH,
    layer3CenterY,
    layer3SidePadding,
  );

  const spLayer4Keys = ICON_KEYS_BY_LAYER.layer4.map(
    (suffix) => `sp-${suffix}`,
  );
  const cwbLayer4Keys = ICON_KEYS_BY_LAYER.layer4.map(
    (suffix) => `cwb-${suffix}`,
  );
  const layer4SidePadding = 68;
  distributeHorizontally(
    spLayer4Keys,
    spLayerX,
    LAYER_WIDTH,
    layer4CenterY,
    layer4SidePadding,
  );
  distributeHorizontally(
    cwbLayer4Keys,
    cwbLayerX,
    LAYER_WIDTH,
    layer4CenterY,
    layer4SidePadding,
  );

  return diagram;
}

export function GojsLogicalDiagram({
  cardTitle,
  cardSubtitle,
  ariaLabel = 'Diagrama logico com GoJS',
  tooltipWidth = 300,
  tooltipHeight = 170,
}: GojsLogicalDiagramProps) {
  const logicalRef = useRef<HTMLDivElement | null>(null);
  const [tooltip, setTooltip] = useState<TooltipData>(null);

  useEffect(() => {
    if (!logicalRef.current) {
      return;
    }

    const diagram = buildLogicalDiagram(logicalRef.current);

    diagram.addDiagramListener('ObjectSingleClicked', (e) => {
      const part = e.subject.part;
      if (
        !(part instanceof go.Node) ||
        part.category === 'layerbox' ||
        part instanceof go.Group
      ) {
        setTooltip(null);
        return;
      }

      let obj: any = e.subject;
      let infoBtnClicked = false;
      let infoBtnObj: go.GraphObject | null = null;
      while (obj) {
        if (obj.name === 'INFOBTN') {
          infoBtnClicked = true;
          infoBtnObj = obj as go.GraphObject;
          break;
        }
        obj = obj.panel;
      }

      if (!infoBtnClicked) {
        setTooltip(null);
        return;
      }

      const nodeData = part.data;
      const securityData = getSecurityTooltipData(String(nodeData.key));
      const btnDocPt = infoBtnObj
        ? infoBtnObj.getDocumentPoint(go.Spot.TopLeft)
        : part.location;
      const viewPt = diagram.transformDocToView(btnDocPt);
      const isWAN = nodeData.key === 'wan';
      setTooltip({
        key: nodeData.key,
        site: nodeData.site || '-',
        ip: nodeData.ip || '-',
        vlan: nodeData.vlan || '-',
        vlanInfo: nodeData.vlanInfo || '-',
        title: nodeData.text || 'Ativo de Rede',
        iconSrc: `/images/network/${String(nodeData.type || 'router').toLowerCase()}.svg`,
        x: viewPt.x,
        y: viewPt.y,
        preferredPlacement: isWAN ? 'bottom' : undefined,
        ...securityData,
      });
    });

    diagram.addDiagramListener('BackgroundSingleClicked', () => {
      setTooltip(null);
    });

    return () => {
      if (diagram.div) {
        diagram.div = null;
      }
    };
  }, []);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setTooltip(null);
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  return (
    <section className="gojs-card">
      <div className="gojs-card-title">{cardTitle}</div>
      <div className="gojs-card-sub">{cardSubtitle}</div>
      <div className="gojs-diagram-wrap">
        <div ref={logicalRef} className="gojs-host" aria-label={ariaLabel} />
        {tooltip &&
          logicalRef.current &&
          (() => {
            const containerRect = logicalRef.current!.getBoundingClientRect();
            const { left: tooltipLeft, top: tooltipTop } =
              calculateTooltipPosition({
                iconX: tooltip.x,
                iconY: tooltip.y,
                containerWidth: containerRect.width,
                containerHeight: containerRect.height,
                tooltipWidth,
                tooltipHeight,
                preferredPlacement: tooltip.preferredPlacement,
              });
            return (
              <div
                className="gojs-tooltip-modal"
                style={{
                  position: 'absolute',
                  left: `${tooltipLeft}px`,
                  top: `${tooltipTop}px`,
                  zIndex: 1000,
                }}
              >
                <div className="gojs-tooltip-header">
                  <div className="gojs-tooltip-head-main">
                    <img
                      src={tooltip.iconSrc}
                      alt=""
                      className="gojs-tooltip-icon"
                      aria-hidden="true"
                    />
                    <div className="gojs-tooltip-title">{tooltip.title}</div>
                  </div>
                  <button
                    className="gojs-tooltip-close-btn"
                    onClick={() => setTooltip(null)}
                    aria-label="Fechar"
                  >
                    ✕
                  </button>
                </div>
                <div className="gojs-tooltip-body">
                  <div className="gojs-tooltip-row">
                    <span className="gojs-tooltip-label">Site:</span>
                    <span className="gojs-tooltip-value">{tooltip.site}</span>
                  </div>
                  <div className="gojs-tooltip-row">
                    <span className="gojs-tooltip-label">IP:</span>
                    <span className="gojs-tooltip-value">{tooltip.ip}</span>
                  </div>
                  <div className="gojs-tooltip-row">
                    <span className="gojs-tooltip-label">VLAN:</span>
                    <span className="gojs-tooltip-value">{tooltip.vlan}</span>
                  </div>
                  <div className="gojs-tooltip-row">
                    <span className="gojs-tooltip-label">Info:</span>
                    <span className="gojs-tooltip-value">
                      {tooltip.vlanInfo}
                    </span>
                  </div>

                  {tooltip.firewallChecklist &&
                    tooltip.firewallChecklist.length > 0 && (
                      <div className="gojs-tooltip-section">
                        <div className="gojs-tooltip-label">
                          Firewall (S12):
                        </div>
                        <ul className="gojs-tooltip-checklist">
                          {tooltip.firewallChecklist.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                  {tooltip.vpnCryptoChecklist &&
                    tooltip.vpnCryptoChecklist.length > 0 && (
                      <div className="gojs-tooltip-section">
                        <div className="gojs-tooltip-label">
                          VPN/Cripto (S12):
                        </div>
                        <ul className="gojs-tooltip-checklist">
                          {tooltip.vpnCryptoChecklist.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                  {tooltip.aclHighlights &&
                    tooltip.aclHighlights.length > 0 && (
                      <div className="gojs-tooltip-section">
                        <div className="gojs-tooltip-label">ACL (S11):</div>
                        <div className="gojs-tooltip-acl-list">
                          {tooltip.aclHighlights.map((item) => (
                            <div
                              key={item.id}
                              className="gojs-tooltip-acl-item"
                            >
                              <strong>#{item.id}</strong> {item.action} -{' '}
                              {item.summary}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                </div>
              </div>
            );
          })()}
      </div>
    </section>
  );
}
