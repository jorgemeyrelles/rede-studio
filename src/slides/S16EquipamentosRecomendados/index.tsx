import { useEffect, useState } from 'react';
import { getSlidePagination } from '../pagination';
import {
  CISCO_ACCESS_POINTS,
  CISCO_ROUTERS,
  CISCO_SWITCHES,
  FORTINET_FIREWALLS,
  FORTINET_ROUTERS,
} from './constants';

export default function S16EquipamentosRecomendados() {
  const [activeEquipmentId, setActiveEquipmentId] = useState<string | null>(
    null,
  );
  const priceCheckDate = '22/04/2026';

  useEffect(() => {
    const handleClickAway = (event: MouseEvent) => {
      const target = event.target;

      if (!(target instanceof Element)) {
        return;
      }

      const clickedTooltip = target.closest('[data-equipment-tooltip]');
      const clickedRow = target.closest('[data-equipment-row]');

      if (!clickedTooltip && !clickedRow) {
        setActiveEquipmentId(null);
      }
    };

    document.addEventListener('mousedown', handleClickAway);

    return () => {
      document.removeEventListener('mousedown', handleClickAway);
    };
  }, []);

  // Seleção final: Cisco para infra, Fortinet para segurança/VPN
  // Roteador e Firewall separados em ambos os sites (filial com alto fluxo)
  const selectedRouterMatriz = CISCO_ROUTERS[0]; // Cisco C8300
  const selectedRouterFilial = FORTINET_ROUTERS[1]; // FortiGate 40F (roteador SD-WAN)
  const selectedFirewallMatriz = FORTINET_FIREWALLS[1]; // FortiGate 200F
  const selectedFirewallFilial = FORTINET_FIREWALLS[0]; // FortiGate 60F
  const selectedSwitch = CISCO_SWITCHES[0];
  const selectedAP = CISCO_ACCESS_POINTS[0];
  const selectedEquipments = [
    selectedRouterMatriz,
    selectedRouterFilial,
    selectedFirewallMatriz,
    selectedFirewallFilial,
    selectedSwitch,
    selectedAP,
  ];

  const getChoiceRationale = (
    id: string,
  ): { alternativa: string; razao: string } | null => {
    const rationales: Record<string, { alternativa: string; razao: string }> = {
      'cisco-router-matrix': {
        alternativa: 'FortiGate 100F',
        razao:
          'SD-WAN de 10 Gbps (3× superior), suporte nativo a MPLS/BGP e redundância dual. Melhor escolha para o alto throughput e escalabilidade da Matriz SP.',
      },
      'fortinet-router-filial': {
        alternativa: 'Cisco C8300',
        razao:
          'Custo otimizado para filial com IPsec VPN integrado e gerenciamento remoto via FortiManager. Throughput suficiente para o volume de acesso da Filial CWB.',
      },
      'fortinet-fw-matrix': {
        alternativa: 'Cisco Firepower 2100',
        razao:
          'Throughput 8× superior (20 Gbps vs 2.4 Gbps), IPS de 8 Gbps e Machine Learning integrado. Melhor custo-benefício para proteção NGFW com conformidade LGPD.',
      },
      'fortinet-fw-filial': {
        alternativa: 'Manter FortiGate 40F unificado',
        razao:
          'Firewall dedicado sepára responsabilidades do roteador, garantindo IPS 1.8 Gbps e inspeção profunda mesmo com alto fluxo de acessos na Filial CWB.',
      },
      'cisco-switch-matrix': {
        alternativa: 'FortiSwitch 248F',
        razao:
          'Roteamento L3 nativo e StackWise tornam o Catalyst 3650 mais adequado para agregar as VLANs 10/20/30/40. Ecossistema consolidado e menor custo.',
      },
      'cisco-ap-matrix': {
        alternativa: 'Concorrentes Wi-Fi 6',
        razao:
          'AP Wi-Fi 6E com cobertura de 180 m², WPA3 e gerenciamento centralizado via Cisco DNA Center. Integração nativa com o Catalyst 3650.',
      },
    };
    return rationales[id] ?? null;
  };

  const getFunctionLabel = (category: string) => {
    if (category === 'router') return 'Roteador';
    if (category === 'firewall') return 'Firewall';
    if (category === 'switch') return 'Switch';
    if (category === 'access-point') return 'Access Point';
    return 'Equipamento';
  };

  const getLocationQuantities = (
    equipmentId: string,
    site: string,
    quantity: number,
  ) => {
    // Quantidades da arquitetura final selecionada no S16.
    if (equipmentId === 'cisco-router-matrix') return { matriz: 1, filial: 0 };
    if (equipmentId === 'fortinet-router-filial')
      return { matriz: 0, filial: 1 };
    if (equipmentId === 'fortinet-fw-matrix') return { matriz: 1, filial: 0 };
    if (equipmentId === 'fortinet-fw-filial') return { matriz: 0, filial: 1 };
    if (equipmentId === 'cisco-switch-matrix') return { matriz: 1, filial: 1 };
    if (equipmentId === 'cisco-ap-matrix') return { matriz: 2, filial: 4 };

    if (site === 'matriz') return { matriz: quantity, filial: 0 };
    if (site === 'filial') return { matriz: 0, filial: quantity };
    if (site === 'both') return { matriz: quantity, filial: quantity };
    return { matriz: 0, filial: 0 };
  };

  const getPriceRange = (estimatedCost: string) => {
    const matches = estimatedCost.match(/\d{1,3}(?:\.\d{3})*/g) ?? [];
    const values = matches
      .map((value) => Number(value.replace(/\./g, '')))
      .filter(Boolean);

    if (values.length >= 2) {
      return {
        min: Math.min(values[0], values[1]),
        max: Math.max(values[0], values[1]),
      };
    }

    if (values.length === 1) {
      return { min: values[0], max: values[0] };
    }

    return { min: 0, max: 0 };
  };

  const formatBRL = (value: number) =>
    value.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      maximumFractionDigits: 0,
    });

  const getPriceAverage = (estimatedCost: string) => {
    const priceRange = getPriceRange(estimatedCost);
    return (priceRange.min + priceRange.max) / 2;
  };

  const projectTotalsBySite = selectedEquipments.reduce(
    (acc, equipment) => {
      const { matriz, filial } = getLocationQuantities(
        equipment.id,
        equipment.site,
        equipment.quantity,
      );
      const avgPrice = getPriceAverage(equipment.estimatedCost);

      return {
        matrizAvg: acc.matrizAvg + avgPrice * matriz,
        filialAvg: acc.filialAvg + avgPrice * filial,
      };
    },
    { matrizAvg: 0, filialAvg: 0 },
  );

  return (
    <div className="slide" id="s16">
      <div className="slide-bar red"></div>
      <div className="slide-number">{getSlidePagination('s16')}</div>
      <div className="slide-body">
        <div className="slide-tag">Proposta - Equipamentos Selecionados</div>
        <div className="slide-title">
          Equipamentos Recomendados <span>Cisco + Fortinet</span>
        </div>
        <div className="slide-subtitle">
          Melhor de cada fabricante: Cisco para infra de rede · Fortinet para
          segurança e VPN
        </div>

        <div
          style={{
            marginTop: '12px',
            display: 'grid',
            gridTemplateColumns: '1.55fr 1.45fr',
            gap: '10px',
            alignItems: 'start',
          }}
        >
          {/* Tabela de equipamentos selecionados */}
          <div
            className="notes"
            style={{
              borderLeft: '4px solid #2d7fff',
              paddingLeft: '8px',
            }}
          >
            <strong style={{ color: '#2d7fff', fontSize: '11px' }}>
              📦 Equipamentos Selecionados
            </strong>
            <div style={{ position: 'relative' }}>
              <table
                style={{
                  marginTop: '6px',
                  fontSize: '11.5px',
                  width: '100%',
                  borderCollapse: 'collapse',
                }}
              >
                <thead>
                  <tr style={{ borderBottom: '1px solid #1e2d4a' }}>
                    <th
                      style={{
                        textAlign: 'left',
                        paddingBottom: '5px',
                        width: '92px',
                      }}
                    >
                      Função
                    </th>
                    <th style={{ textAlign: 'left', paddingBottom: '5px' }}>
                      Nome
                    </th>
                    <th
                      style={{
                        textAlign: 'left',
                        paddingBottom: '5px',
                        width: '115px',
                      }}
                    >
                      Modelo
                    </th>
                    <th
                      style={{
                        textAlign: 'center',
                        paddingBottom: '5px',
                        width: '62px',
                      }}
                    >
                      Matriz
                    </th>
                    <th
                      style={{
                        textAlign: 'center',
                        paddingBottom: '5px',
                        width: '62px',
                      }}
                    >
                      Filial
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {selectedEquipments.map((equipment) => (
                    <tr
                      key={equipment.id}
                      data-equipment-row
                      style={{
                        borderBottom: '1px solid #0d1420',
                        cursor: 'pointer',
                        background:
                          activeEquipmentId === equipment.id
                            ? '#0b1324'
                            : 'transparent',
                      }}
                      onClick={() => setActiveEquipmentId(equipment.id)}
                    >
                      <td
                        style={{
                          padding: '6px 4px',
                          color: '#22d3ee',
                          fontWeight: '700',
                        }}
                      >
                        {getFunctionLabel(equipment.category)}
                      </td>
                      <td
                        style={{
                          padding: '6px 4px',
                          color: '#c8d8f0',
                          fontWeight: '700',
                        }}
                      >
                        <span
                          style={{
                            color:
                              equipment.vendor === 'cisco'
                                ? '#2d7fff'
                                : '#ff7b2d',
                            fontWeight: '700',
                            textTransform: 'capitalize',
                          }}
                        >
                          {equipment.vendor}
                        </span>
                        <span style={{ color: '#8a9aaa' }}> · </span>
                        {equipment.name.replace(/^Cisco\s+|^Fortinet\s+/i, '')}
                      </td>
                      <td style={{ padding: '6px 4px', color: '#9dc1e5' }}>
                        {equipment.model}
                      </td>
                      <td
                        style={{
                          padding: '6px 4px',
                          color: '#c8d8f0',
                          fontWeight: '700',
                          textAlign: 'center',
                        }}
                      >
                        {
                          getLocationQuantities(
                            equipment.id,
                            equipment.site,
                            equipment.quantity,
                          ).matriz
                        }
                      </td>
                      <td
                        style={{
                          padding: '6px 4px',
                          color: '#c8d8f0',
                          fontWeight: '700',
                          textAlign: 'center',
                        }}
                      >
                        {
                          getLocationQuantities(
                            equipment.id,
                            equipment.site,
                            equipment.quantity,
                          ).filial
                        }
                      </td>
                    </tr>
                  ))}
                  <tr
                    style={{
                      borderTop: '1px solid #1e2d4a',
                      background: '#0b1324',
                    }}
                  >
                    <td
                      colSpan={3}
                      style={{
                        padding: '7px 4px',
                        color: '#c8d8f0',
                        fontWeight: '700',
                      }}
                    >
                      Total estimado medio (por site)
                    </td>
                    <td
                      style={{
                        padding: '7px 4px',
                        color: '#5c5',
                        fontWeight: '700',
                        textAlign: 'center',
                      }}
                    >
                      ~{formatBRL(projectTotalsBySite.matrizAvg)}
                    </td>
                    <td
                      style={{
                        padding: '7px 4px',
                        color: '#5c5',
                        fontWeight: '700',
                        textAlign: 'center',
                      }}
                    >
                      ~{formatBRL(projectTotalsBySite.filialAvg)}
                    </td>
                  </tr>
                </tbody>
              </table>

              {activeEquipmentId && (
                <div
                  data-equipment-tooltip
                  style={{
                    position: 'absolute',
                    top: '8px',
                    right: '-6px',
                    width: '420px',
                    zIndex: 20,
                    background: '#0b1324',
                    border: '1px solid #1e2d4a',
                    borderRadius: '8px',
                    padding: '8px 10px',
                    boxShadow: '0 10px 20px rgba(0, 0, 0, 0.35)',
                    pointerEvents: 'auto',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setActiveEquipmentId(null)}
                    style={{
                      position: 'absolute',
                      top: '4px',
                      right: '6px',
                      border: 'none',
                      background: 'transparent',
                      color: '#8a9aaa',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: '700',
                      lineHeight: 1,
                      padding: 0,
                    }}
                    aria-label="Fechar detalhes"
                  >
                    x
                  </button>
                  {selectedEquipments
                    .filter((equipment) => equipment.id === activeEquipmentId)
                    .map((equipment) => (
                      <div
                        key={`${equipment.id}-tooltip`}
                        style={{ color: '#c8d8f0', fontSize: '12.5px' }}
                      >
                        <p style={{ marginBottom: '6px' }}>
                          <strong>Apresentação:</strong> {equipment.description}
                        </p>
                        <p style={{ marginBottom: '6px' }}>
                          <strong>Preço:</strong> {equipment.estimatedCost}
                          <span style={{ color: '#8a9aaa' }}>
                            {' '}
                            | Verificado em: {priceCheckDate}
                          </span>
                        </p>
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 1fr',
                            gap: '10px',
                            marginBottom: '6px',
                          }}
                        >
                          <div>
                            <p
                              style={{
                                marginBottom: '3px',
                                color: '#ffd166',
                                fontWeight: '700',
                              }}
                            >
                              Características
                            </p>
                            <ul
                              style={{
                                marginTop: 0,
                                marginBottom: 0,
                                paddingLeft: '16px',
                                fontSize: '11.5px',
                              }}
                            >
                              {equipment.keyFeatures
                                .slice(0, 4)
                                .map((feature) => (
                                  <li
                                    key={feature}
                                    style={{
                                      marginBottom: '2px',
                                      color: '#8a9aaa',
                                    }}
                                  >
                                    {feature}
                                  </li>
                                ))}
                            </ul>
                          </div>
                          <div>
                            <p
                              style={{
                                marginBottom: '3px',
                                color: '#22d3ee',
                                fontWeight: '700',
                              }}
                            >
                              Especificações
                            </p>
                            <ul
                              style={{
                                marginTop: 0,
                                marginBottom: 0,
                                paddingLeft: '16px',
                                fontSize: '11.5px',
                              }}
                            >
                              {equipment.specifications
                                .slice(0, 4)
                                .map((spec) => (
                                  <li
                                    key={`${spec.parameter}-${spec.value}`}
                                    style={{ marginBottom: '2px' }}
                                  >
                                    <span style={{ color: '#9dc1e5' }}>
                                      {spec.parameter}:
                                    </span>{' '}
                                    <span style={{ color: '#c8d8f0' }}>
                                      {spec.value}
                                    </span>
                                  </li>
                                ))}
                            </ul>
                          </div>
                        </div>
                        {(() => {
                          const rationale = getChoiceRationale(equipment.id);
                          if (!rationale) return null;
                          return (
                            <>
                              <p
                                style={{
                                  marginTop: '4px',
                                  marginBottom: '3px',
                                  color: '#a78bfa',
                                  fontWeight: '700',
                                }}
                              >
                                Por que este e não {rationale.alternativa}?
                              </p>
                              <p
                                style={{
                                  marginTop: 0,
                                  marginBottom: 0,
                                  color: '#c8d8f0',
                                  lineHeight: '1.4',
                                }}
                              >
                                {rationale.razao}
                              </p>
                            </>
                          );
                        })()}
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateRows: 'auto auto',
              gap: '10px',
            }}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '10px',
              }}
            >
              {/* Tabela Comparativa */}
              <div
                className="notes"
                style={{
                  borderLeft: '4px solid #10b981',
                  paddingLeft: '8px',
                }}
              >
                <strong style={{ color: '#10b981', fontSize: '11px' }}>
                  📊 Tabela de Comparação
                </strong>
                <table
                  style={{
                    marginTop: '6px',
                    fontSize: '11px',
                    width: '100%',
                    borderCollapse: 'collapse',
                  }}
                >
                  <thead>
                    <tr style={{ borderBottom: '1px solid #1e2d4a' }}>
                      <th
                        style={{
                          textAlign: 'left',
                          paddingBottom: '4px',
                          color: '#c8d8f0',
                        }}
                      >
                        Aspecto
                      </th>
                      <th
                        style={{
                          textAlign: 'center',
                          paddingBottom: '4px',
                          color: '#2d7fff',
                        }}
                      >
                        Cisco
                      </th>
                      <th
                        style={{
                          textAlign: 'center',
                          paddingBottom: '4px',
                          color: '#ff7b2d',
                        }}
                      >
                        Fort.
                      </th>
                      <th
                        style={{
                          textAlign: 'center',
                          paddingBottom: '4px',
                          color: '#00c97a',
                        }}
                      >
                        Sel.
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: '1px solid #0d1420' }}>
                      <td style={{ padding: '4px 0' }}>Firewall</td>
                      <td style={{ textAlign: 'center', color: '#2d7fff' }}>
                        2.4
                      </td>
                      <td style={{ textAlign: 'center', color: '#ff7b2d' }}>
                        20
                      </td>
                      <td
                        style={{
                          textAlign: 'center',
                          color: '#ff7b2d',
                          fontWeight: '700',
                        }}
                      >
                        Fort.
                      </td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #0d1420' }}>
                      <td style={{ padding: '4px 0' }}>VPN IPSec</td>
                      <td style={{ textAlign: 'center', color: '#2d7fff' }}>
                        0.8
                      </td>
                      <td style={{ textAlign: 'center', color: '#ff7b2d' }}>
                        2.6
                      </td>
                      <td
                        style={{
                          textAlign: 'center',
                          color: '#ff7b2d',
                          fontWeight: '700',
                        }}
                      >
                        Fort.
                      </td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #0d1420' }}>
                      <td style={{ padding: '4px 0' }}>Throughput IPS</td>
                      <td style={{ textAlign: 'center', color: '#2d7fff' }}>
                        0.75
                      </td>
                      <td style={{ textAlign: 'center', color: '#ff7b2d' }}>
                        8
                      </td>
                      <td
                        style={{
                          textAlign: 'center',
                          color: '#ff7b2d',
                          fontWeight: '700',
                        }}
                      >
                        Fort.
                      </td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #0d1420' }}>
                      <td style={{ padding: '4px 0' }}>SD-WAN</td>
                      <td style={{ textAlign: 'center', color: '#2d7fff' }}>
                        10
                      </td>
                      <td style={{ textAlign: 'center', color: '#ff7b2d' }}>
                        3.5
                      </td>
                      <td
                        style={{
                          textAlign: 'center',
                          color: '#2d7fff',
                          fontWeight: '700',
                        }}
                      >
                        Cisco
                      </td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #0d1420' }}>
                      <td style={{ padding: '4px 0' }}>Switch L3</td>
                      <td style={{ textAlign: 'center', color: '#2d7fff' }}>
                        130
                      </td>
                      <td style={{ textAlign: 'center', color: '#ff7b2d' }}>
                        176
                      </td>
                      <td
                        style={{
                          textAlign: 'center',
                          color: '#2d7fff',
                          fontWeight: '700',
                        }}
                      >
                        Cisco
                      </td>
                    </tr>
                    <tr>
                      <td style={{ padding: '4px 0' }}>Wi-Fi 6E</td>
                      <td style={{ textAlign: 'center', color: '#2d7fff' }}>
                        6.8
                      </td>
                      <td style={{ textAlign: 'center', color: '#4a6080' }}>
                        N/A
                      </td>
                      <td
                        style={{
                          textAlign: 'center',
                          color: '#2d7fff',
                          fontWeight: '700',
                        }}
                      >
                        Cisco
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Tabela Arquitetura Híbrida */}
              <div
                className="notes"
                style={{
                  borderLeft: '4px solid #fbbf24',
                  paddingLeft: '8px',
                }}
              >
                <strong style={{ color: '#fbbf24', fontSize: '11px' }}>
                  ⭐ Tabela Arquitetura Híbrida
                </strong>
                <table
                  style={{
                    marginTop: '6px',
                    fontSize: '11px',
                    width: '100%',
                    borderCollapse: 'collapse',
                  }}
                >
                  <thead>
                    <tr style={{ borderBottom: '1px solid #1e2d4a' }}>
                      <th style={{ textAlign: 'left', paddingBottom: '4px' }}>
                        Componente
                      </th>
                      <th style={{ textAlign: 'left', paddingBottom: '4px' }}>
                        Fabricante
                      </th>
                      <th style={{ textAlign: 'left', paddingBottom: '4px' }}>
                        Modelo
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: '1px solid #0d1420' }}>
                      <td style={{ padding: '4px 0' }}>Roteador Matriz</td>
                      <td style={{ color: '#2d7fff', fontWeight: '700' }}>
                        Cisco
                      </td>
                      <td style={{ color: '#9dc1e5' }}>C8300</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #0d1420' }}>
                      <td style={{ padding: '4px 0' }}>Roteador Filial</td>
                      <td style={{ color: '#ff7b2d', fontWeight: '700' }}>
                        Fortinet
                      </td>
                      <td style={{ color: '#9dc1e5' }}>FG40F</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #0d1420' }}>
                      <td style={{ padding: '4px 0' }}>Firewall Matriz</td>
                      <td style={{ color: '#ff7b2d', fontWeight: '700' }}>
                        Fortinet
                      </td>
                      <td style={{ color: '#9dc1e5' }}>FG200F</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #0d1420' }}>
                      <td style={{ padding: '4px 0' }}>Firewall Filial</td>
                      <td style={{ color: '#ff7b2d', fontWeight: '700' }}>
                        Fortinet
                      </td>
                      <td style={{ color: '#9dc1e5' }}>FG60F</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #0d1420' }}>
                      <td style={{ padding: '4px 0' }}>Switch L3</td>
                      <td style={{ color: '#2d7fff', fontWeight: '700' }}>
                        Cisco
                      </td>
                      <td style={{ color: '#9dc1e5' }}>C3650</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '4px 0' }}>Access Point</td>
                      <td style={{ color: '#2d7fff', fontWeight: '700' }}>
                        Cisco
                      </td>
                      <td style={{ color: '#9dc1e5' }}>C9120AXE</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Justificativa */}
            <div
              className="notes"
              style={{ borderLeft: '4px solid #22d3ee', paddingLeft: '10px' }}
            >
              <strong style={{ fontSize: '11px', color: '#22d3ee' }}>
                Critério de Seleção — Arquitetura Híbrida
              </strong>
              <p
                style={{
                  marginTop: '6px',
                  marginBottom: '6px',
                  fontSize: '10px',
                  color: '#c8d8f0',
                }}
              >
                A escolha combina o melhor de cada fabricante para a arquitetura
                SP ↔ CWB:
              </p>
              <ul
                style={{
                  marginLeft: '14px',
                  marginTop: '4px',
                  listStyle: 'none',
                  padding: 0,
                }}
              >
                <li style={{ marginBottom: '4px', fontSize: '10px' }}>
                  <span style={{ color: '#2d7fff' }}>●</span>{' '}
                  <strong>Cisco</strong> — líder em roteamento SD-WAN, switching
                  L3 e wireless Wi-Fi 6E
                </li>
                <li style={{ marginBottom: 0, fontSize: '10px' }}>
                  <span style={{ color: '#ff7b2d' }}>●</span>{' '}
                  <strong>Fortinet</strong> — superior em firewall NGFW, IPS (8
                  Gbps) e VPN IPSec (2.6 Gbps)
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
