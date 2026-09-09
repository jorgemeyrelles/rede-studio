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
  { num: 3, text: 'Firewall valida e atribui IP do pool SSL-VPN (acesso remoto)' },
  {
    num: 4,
    text: 'Usuário acessa rede interna como se estivesse no escritório',
  },
  { num: 5, text: 'ACL determina o que cada usuário remoto pode acessar' },
]

export const VPN_SUMMARY_ROWS: VpnSummaryRow[] = [
  { item: 'Protocolo', siteToSite: 'IPsec/IKEv2 (backup)', sslRemote: 'SSL/TLS' },
  { item: 'Cifra', siteToSite: 'AES-256-GCM', sslRemote: 'AES-256-GCM' },
  { item: 'Integridade', siteToSite: 'SHA-384', sslRemote: 'TLS nativo' },
  { item: 'Diffie-Hellman', siteToSite: 'Group 20', sslRemote: 'N/A' },
  { item: 'Autenticação', siteToSite: 'Cert X.509', sslRemote: 'Cert + MFA' },
  {
    item: 'Enlace de contingencia',
    siteToSite: '198.51.100.5 ↔ 198.51.100.1',
    sslRemote: 'Pool remoto dedicado',
  },
  { item: 'Transporte primario', siteToSite: 'MPLS dual-stack', sslRemote: 'Internet segura' },
  { item: 'Endpoints', siteToSite: 'Matriz ↔ Filial', sslRemote: 'Usuario remoto' },
  {
    item: 'Status',
    siteToSite: '✅ ATIVA',
    sslRemote: '✅ ATIVA',
    highlight: true,
  },
]