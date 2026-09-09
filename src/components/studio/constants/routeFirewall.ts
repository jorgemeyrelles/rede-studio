export const ROUTE_TYPE_CLASS: Record<string, string> = {
  Direta: 'text-emerald-400',
  Estática: 'text-amber-300',
  Default: 'text-orange-400',
  VPN: 'text-cyan-300',
  BGP: 'text-violet-400',
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
