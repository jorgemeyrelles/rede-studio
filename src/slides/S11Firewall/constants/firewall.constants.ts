import type { AclRuleEx, ExtendedAction } from '../types'

export const ACTION_CLASS: Record<ExtendedAction, string> = {
  ALLOW: 'fw-allow',
  DENY: 'fw-deny',
  LOG: 'fw-log',
}

export const ACTION_LABEL: Record<ExtendedAction, string> = {
  ALLOW: '✅ ALLOW',
  DENY: '🚫 DENY',
  LOG: '📋 LOG+ALLOW',
}

export const ACL_RULES: AclRuleEx[] = [
  {
    id: 1,
    source: '10.0.1.0/24 (Matriz)',
    destination: '10.0.2.200–.201 (Srv Filial)',
    port: 'TCP 445/22/80/443',
    action: 'ALLOW',
    description: 'Matriz acessa servidores da Filial integralmente',
  },
  {
    id: 2,
    source: '10.0.2.10–.20 (Filial autorizada)',
    destination: '10.0.1.200–.202 (Srv Matriz)',
    port: 'TCP 443/80',
    action: 'ALLOW',
    description: 'Apenas IPs autorizados da Filial acessam a Matriz',
  },
  {
    id: 3,
    source: '10.0.2.21–.31 (Filial outros)',
    destination: '10.0.1.200–.202 (Srv Matriz)',
    port: 'Qualquer',
    action: 'DENY',
    description:
      'Demais usuários da Filial BLOQUEADOS nos servidores da Matriz',
  },
  {
    id: 4,
    source: '10.10.1.0/28 (VPN SSL)',
    destination: '10.0.1.0/24 · 10.0.2.0/25',
    port: 'TCP 443/22/3389',
    action: 'ALLOW',
    description: 'Usuários remotos VPN acessam ambas as redes',
  },
  {
    id: 5,
    source: '0.0.0.0/0 (Internet)',
    destination: '10.0.1.0/24 · 10.0.2.0/25',
    port: 'Qualquer',
    action: 'DENY',
    description: 'Bloqueia TODO acesso externo não autorizado (default deny)',
  },
  {
    id: 6,
    source: 'LANs internas',
    destination: '0.0.0.0/0 (Internet)',
    port: 'TCP 80/443',
    action: 'ALLOW',
    description: 'Saída HTTP/HTTPS liberada via NAT',
  },
  {
    id: 7,
    source: 'Qualquer',
    destination: 'Qualquer',
    port: 'ICMP',
    action: 'LOG',
    description: 'Ping monitorado internamente para diagnóstico',
  },
]
