import type { SslVpnStep, VpnSummaryRow } from '../../types/vpn.types'

export const SSL_STEPS: SslVpnStep[] = [
  {
    num: 1,
    text: 'Usuário remoto abre cliente VPN no PC pessoal ou corporativo',
  },
  {
    num: 2,
    text: 'Autenticação com usuário + senha + certificado digital (MFA)',
  },
  { num: 3, text: 'Firewall valida e atribui IP do pool 10.10.1.0/28' },
  {
    num: 4,
    text: 'Usuário acessa rede interna como se estivesse no escritório',
  },
  { num: 5, text: 'ACL determina o que cada usuário remoto pode acessar' },
]

export const VPN_SUMMARY_ROWS: VpnSummaryRow[] = [
  { item: 'Protocolo', siteToSite: 'IPsec/IKEv2', sslRemote: 'SSL/TLS' },
  { item: 'Cifra', siteToSite: 'AES-256-GCM', sslRemote: 'AES-256-GCM' },
  { item: 'Autenticação', siteToSite: 'Cert X.509', sslRemote: 'Cert + MFA' },
  {
    item: 'Rede túnel',
    siteToSite: '10.10.0.0/30',
    sslRemote: '10.10.1.0/28',
  },
  { item: 'Endpoints', siteToSite: 'SP ↔ CWB', sslRemote: 'Usuário remoto' },
  {
    item: 'Status',
    siteToSite: '✅ ATIVA',
    sslRemote: '✅ ATIVA',
    highlight: true,
  },
]