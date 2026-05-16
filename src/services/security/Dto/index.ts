import type {
    AclRule,
    FirewallNatRule,
    FirewallPolicy,
} from '../../../features/network/types';

export type SecuritySnapshotDto = {
  aclRules: AclRule[];
  fwPolicies: FirewallPolicy[];
  natRules: FirewallNatRule[];
};

export type CreateAclRuleDto = Omit<AclRule, 'id'> & { id?: string };
export type CreateFwPolicyDto = Omit<FirewallPolicy, 'id'> & { id?: string };
export type CreateNatRuleDto = Omit<FirewallNatRule, 'id'> & { id?: string };

export type PatchAclRuleDto = Partial<Omit<AclRule, 'id'>>;
export type PatchFwPolicyDto = Partial<Omit<FirewallPolicy, 'id'>>;
export type PatchNatRuleDto = Partial<Omit<FirewallNatRule, 'id'>>;
