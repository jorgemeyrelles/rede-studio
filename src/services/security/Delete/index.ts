import { mutateStateDocument } from '../../_core';

export function deleteAclRule(id: string) {
  return mutateStateDocument((document) => {
    document.aclRules = document.aclRules.filter((item) => item.id !== id);
    return { id };
  });
}

export function deleteFwPolicy(id: string) {
  return mutateStateDocument((document) => {
    document.fwPolicies = document.fwPolicies.filter((item) => item.id !== id);
    return { id };
  });
}

export function deleteNatRule(id: string) {
  return mutateStateDocument((document) => {
    document.natRules = document.natRules.filter((item) => item.id !== id);
    return { id };
  });
}
