/**
 * Cor por tipo de rota (badge Fase 4 do redesign Planta — ver
 * .claude/plans/redesign-planta-e-sessao-jwt.md). Tokens fixos, não
 * dependem da variante de acento escolhida — são semântica de rede, não
 * identidade de marca.
 */
export const ROUTE_TYPE_CLASS: Record<string, string> = {
  Direta: 'text-route-direct',
  Estática: 'text-route-static',
  Default: 'text-route-default',
  VPN: 'text-route-vpn',
  BGP: 'text-route-bgp',
};

export const SERVICE_CATALOG = [
  {
    group: 'Web',
    items: [
      { label: 'HTTP', value: 'tcp/80' },
      { label: 'HTTPS', value: 'tcp/443' },
      { label: 'HTTP + HTTPS', value: 'tcp/80, tcp/443' },
    ],
  },
  {
    group: 'Gerência',
    items: [
      { label: 'SSH', value: 'tcp/22' },
      { label: 'RDP', value: 'tcp/3389' },
      { label: 'SNMP', value: 'udp/161' },
      { label: 'ICMP echo', value: 'icmp' },
      { label: 'Gerência completa', value: 'tcp/22, tcp/3389, udp/161, icmp' },
    ],
  },
  {
    group: 'VoIP',
    items: [
      { label: 'SIP', value: 'udp/5060' },
      { label: 'RTP', value: 'udp/10000-20000' },
      { label: 'VoIP completo', value: 'udp/5060, udp/10000-20000' },
    ],
  },
  {
    group: 'VPN / Túnel',
    items: [
      { label: 'IKE', value: 'udp/500' },
      { label: 'IPsec NAT-T', value: 'udp/4500' },
      { label: 'ESP', value: 'esp' },
      { label: 'OpenVPN', value: 'udp/1194' },
      { label: 'IPsec completo', value: 'udp/500, udp/4500, esp' },
    ],
  },
  {
    group: 'Banco de dados',
    items: [
      { label: 'MySQL', value: 'tcp/3306' },
      { label: 'PostgreSQL', value: 'tcp/5432' },
      { label: 'MSSQL', value: 'tcp/1433' },
      { label: 'Oracle', value: 'tcp/1521' },
    ],
  },
  {
    group: 'Arquivo',
    items: [
      { label: 'SMB / CIFS', value: 'tcp/445' },
      { label: 'NFS', value: 'tcp/2049' },
      { label: 'FTP', value: 'tcp/20-21' },
    ],
  },
] as const;
