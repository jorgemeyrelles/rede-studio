export type TooltipPlacement = 'bottom' | 'right' | 'left' | 'top'

export type TooltipAclItem = {
  id: number
  action: string
  summary: string
}

export type TooltipData = {
  key: string
  site: string
  ip: string
  vlan: string
  vlanInfo: string
  title: string
  iconSrc: string
  x: number
  y: number
  preferredPlacement?: TooltipPlacement
  firewallChecklist?: string[]
  vpnCryptoChecklist?: string[]
  aclHighlights?: TooltipAclItem[]
} | null
