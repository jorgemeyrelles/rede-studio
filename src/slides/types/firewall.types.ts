/** Ação da regra de controle de acesso */
export type AclAction = 'ALLOW' | 'DENY'

/** Regra individual na tabela de Firewall / ACL */
export interface AclRule {
  id: number
  source: string
  destination: string
  port: string
  action: AclAction
  description: string
}
