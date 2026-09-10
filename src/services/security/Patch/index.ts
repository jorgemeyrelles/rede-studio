import { mutateStateDocument } from '../../_core';
import type {
    PatchAclRuleDto,
    PatchFwPolicyDto,
    PatchNatRuleDto,
} from '../Dto';

export function patchAclRule(id: string, changes: PatchAclRuleDto) {
  return mutateStateDocument((document) => {
    const target = document.aclRules.find((item) => item.id === id) ?? null;
    if (!target) return null;
    Object.assign(target, changes);
    return target;
  });
}

export function patchFwPolicy(id: string, changes: PatchFwPolicyDto) {
  return mutateStateDocument((document) => {
    const target = document.fwPolicies.find((item) => item.id === id) ?? null;
    if (!target) return null;
    Object.assign(target, changes);
    return target;
  });
}

export function patchNatRule(id: string, changes: PatchNatRuleDto) {
  return mutateStateDocument((document) => {
    const target = document.natRules.find((item) => item.id === id) ?? null;
    if (!target) return null;
    Object.assign(target, changes);
    return target;
  });
}
