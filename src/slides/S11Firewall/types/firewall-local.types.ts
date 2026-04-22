import type { AclAction, AclRule } from '../../types/firewall.types'

export type ExtendedAction = AclAction | 'LOG'

export interface AclRuleEx extends Omit<AclRule, 'action'> {
  action: ExtendedAction
}
