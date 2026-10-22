import { dnsName } from '../shared';
import type { TfContext } from '../context';

/** Seção `variables.tf` do gerador. */
export function emitVariables(ctx: TfContext) {
  const { input, t, str, account, variable } = ctx;

  // ── variables.tf ──────────────────────────────────────────────────────
  variable(
    'project',
    t.vars.project,
    dnsName(input.projectName || 'rede-studio'),
  );
  variable(
    'environment',
    t.vars.environment,
    str(account?.config.environment) || 'dev',
  );
  variable('owner', t.vars.owner, str(account?.config.owner));
  variable('cost_center', t.vars.costCenter, str(account?.config.costCenter));
  variable('db_username', t.vars.dbUsername, 'dbadmin');
}
