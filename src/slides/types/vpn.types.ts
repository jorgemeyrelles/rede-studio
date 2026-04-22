/** Passo do fluxo SSL-VPN (acesso remoto) */
export interface SslVpnStep {
  num: number
  text: string
}

/** Linha da tabela comparativa de VPNs */
export interface VpnSummaryRow {
  item: string
  siteToSite: string
  sslRemote: string
  highlight?: boolean
}
