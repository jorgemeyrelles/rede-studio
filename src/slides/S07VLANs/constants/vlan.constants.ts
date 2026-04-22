import type { VlanCard } from '../../../types/network'

export const VLANS: VlanCard[] = [
  {
    id: 10,
    name: 'VLAN Dados',
    range: 'SP: 10.0.1.10–.55 · CWB: 10.0.2.10–.43',
    description:
      'PCs administrativos e impressoras de rede. Tráfego de dados corporativos. Acesso à internet via NAT.',
  },
  {
    id: 20,
    name: 'VLAN Voz (VoIP)',
    range: 'SP: 10.0.1.50–.55 · CWB: 10.0.2.50–.57',
    description:
      'Telefones IP SIP. Tráfego QoS prioritário (DSCP EF). Isolado do tráfego de dados para garantir qualidade de chamada.',
  },
  {
    id: 30,
    name: 'VLAN Servidores',
    range: 'SP: 10.0.1.200–.202 · CWB: 10.0.2.200–.201',
    description:
      'Servidores de arquivos, AD/DNS e aplicações. Acesso controlado por ACL no firewall. Acesso assimétrico entre sites.',
  },
  {
    id: 40,
    name: 'VLAN Wi-Fi',
    range: 'CWB: 10.0.2.70–.85 (pool DHCP)',
    description:
      'Dispositivos sem fio. APs em modo trunk, clientes em VLAN segregada. Autenticação WPA3-Enterprise via RADIUS.',
  },
  {
    id: 50,
    name: 'VLAN Gerência',
    range: 'SP: 10.0.1.2 · CWB: 10.0.2.2 (infra)',
    description:
      'Switches, roteadores, firewalls e APs. Acesso SSH/HTTPS exclusivo para administradores. Bloqueado para usuários finais.',
  },
  {
    id: 99,
    name: 'VLAN Nativa (Native)',
    range: 'Portas trunk entre switches e roteadores',
    description:
      'VLAN nativa configurada como VLAN 99 (não VLAN 1) por segurança. Tráfego untagged isolado para evitar ataques de VLAN hopping.',
  },
]