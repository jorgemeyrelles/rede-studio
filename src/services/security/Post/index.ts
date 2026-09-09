import { makeServiceId, mutateStateDocument } from '../../_core';
import type {
    CreateAclRuleDto,
    CreateFwPolicyDto,
    CreateNatRuleDto,
} from '../Dto';

export function createAclRule(input: CreateAclRuleDto) {
  return mutateStateDocument((document) => {
    const aclRule = { ...input, id: input.id ?? makeServiceId('acl') };
    document.aclRules.push(aclRule);
    return aclRule;
  });
}

export function createFwPolicy(input: CreateFwPolicyDto) {
  return mutateStateDocument((document) => {
    const fwPolicy = { ...input, id: input.id ?? makeServiceId('policy') };
    document.fwPolicies.push(fwPolicy);
    return fwPolicy;
  });
}

export function createNatRule(input: CreateNatRuleDto) {
  return mutateStateDocument((document) => {
    const natRule = { ...input, id: input.id ?? makeServiceId('nat') };
    document.natRules.push(natRule);
    return natRule;
  });
}
