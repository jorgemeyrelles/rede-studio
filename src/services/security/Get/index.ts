import { readStateDocument } from '../../_core';

export function getSecuritySnapshot() {
  const document = readStateDocument();
  if (!document) return null;

  return {
    aclRules: document.aclRules,
    fwPolicies: document.fwPolicies,
    natRules: document.natRules,
  };
}

export function getAclRulesByNode(nodeId: string) {
  const document = readStateDocument();
  if (!document) return [];

  return document.aclRules.filter(
    (rule) => rule.sourceNodeId === nodeId || rule.destinationNodeId === nodeId,
  );
}
