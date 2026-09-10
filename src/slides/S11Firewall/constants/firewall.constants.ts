import type { AclRuleEx, ExtendedAction } from '../types'

export const ACTION_CLASS: Record<ExtendedAction, string> = {
  ALLOW: 'fw-allow',
  DENY: 'fw-deny',
  LOG: 'fw-log',
}

export const ACTION_LABEL: Record<ExtendedAction, string> = {
  ALLOW: '✅ ALLOW',
  DENY: '🚫 DENY',
  LOG: '📋 LOG',
}

export const ACL_RULES: AclRuleEx[] = [
  {
    id: 1,
    source: '10.10.0.0/16 (Matriz)',
    destination: 'VLAN Servidores Filial (/28)',
    port: 'TCP 443/445/22',
    action: 'ALLOW',
    description: 'Acesso controlado Matriz -> servidores da Filial para operacao corporativa',
  },
  {
    id: 2,
    source: 'Sub-redes autorizadas da Filial',
    destination: '10.10.10.0/24 (Srv Matriz)',
    port: 'TCP 443/80',
    action: 'ALLOW',
    description: 'Apenas grupos autorizados da Filial acessam servicos publicados da Matriz',
  },
  {
    id: 3,
    source: 'Sub-redes nao autorizadas da Filial',
    destination: '10.10.10.0/24 (Srv Matriz)',
    port: 'Qualquer',
    action: 'DENY',
    description: 'Bloqueio explicito para demais origens da Filial (least privilege)',
  },
  {
    id: 4,
    source: '10.10.1.0/28 (VPN SSL)',
    destination: 'Bastion TI + servicos publicados',
    port: 'TCP 443',
    action: 'ALLOW',
    description: 'Acesso remoto somente a recursos publicados e perfilados',
  },
  {
    id: 5,
    source: '10.10.1.0/28 (VPN SSL)',
    destination: 'Demais redes internas Matriz/Filial',
    port: 'Qualquer',
    action: 'DENY',
    description: 'Bloqueio de lateralizacao para clientes SSL-VPN fora do escopo permitido',
  },
  {
    id: 6,
    source: '0.0.0.0/0 (Internet)',
    destination: 'Redes internas Matriz/Filial',
    port: 'Qualquer',
    action: 'DENY',
    description: 'Default deny de entrada na borda',
  },
  {
    id: 7,
    source: 'LANs internas',
    destination: '0.0.0.0/0 (Internet)',
    port: 'TCP 80/443',
    action: 'ALLOW',
    description: 'Saída HTTP/HTTPS liberada via NAT',
  },
  {
    id: 8,
    source: 'VLAN 80 (Wi-Fi Visitantes)',
    destination: '10.10.0.0/16 + VLANs internas da Filial',
    port: 'Qualquer',
    action: 'DENY',
    description: 'Visitantes totalmente isolados da rede corporativa',
  },
  {
    id: 9,
    source: 'VLAN 30 (TI/Infra) + rede TI Filial',
    destination: 'VLAN 99 + rede de gerencia da Filial',
    port: 'TCP 22/443 + UDP 161',
    action: 'ALLOW',
    description: 'Gerencia de equipamentos restrita a equipe de TI',
  },
  {
    id: 10,
    source: 'Demais VLANs internas',
    destination: 'VLAN 99 + rede de gerencia da Filial',
    port: 'Qualquer',
    action: 'DENY',
    description: 'Bloqueio de acesso administrativo para nao-TI',
  },
  {
    id: 11,
    source: 'Gateways/FWs monitorados',
    destination: 'Gateways/FWs monitorados',
    port: 'ICMP',
    action: 'LOG',
    description: 'ICMP permitido apenas para monitoramento e troubleshooting auditavel',
  },
]
