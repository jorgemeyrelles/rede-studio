import { readIdList } from '../../addressing';
import { attr, block, raw, type HclValue } from '../hcl';
import { T, localized, dnsName } from '../shared';
import type { TfContext } from '../context';

/** Seção `iam.tf` do gerador. */
export function emitIam(ctx: TfContext) {
  const { input, namer, emit, todo, account } = ctx;

  // ── iam.tf ────────────────────────────────────────────────────────────
  if (account) {
    const users = readIdList(account.config.iamUsers);
    /** Quem recebe a política de MFA: [tipo do attachment, atributo, referência]. */
    const mfaHolders: [string, string, string][] = [];
    const mfaAttach = (tfType: string, ownerAttr: string, ref: string) =>
      mfaHolders.push([tfType, ownerAttr, ref]);
    for (const user of users) {
      mfaAttach(
        'aws_iam_user_policy_attachment',
        'user',
        `aws_iam_user.${namer.name('aws_iam_user', user, user)}.name`,
      );
      emit(
        'iam.tf',
        [account.id],
        block(
          'resource',
          ['aws_iam_user', namer.name('aws_iam_user', user, user)],
          [...attr('name', user)],
        ),
      );
    }
    const catalog = input.iamCatalog;
    const selections = (value: unknown) =>
      (Array.isArray(value) ? value : []).filter(
        (s): s is { key: string; policies: string[] } =>
          typeof s?.key === 'string' && Array.isArray(s?.policies),
      );
    const policyArn = (key: string) =>
      catalog?.policies.find((p) => p.key === key)?.policyArn ?? null;
    const attachAll = (
      tfType: string,
      owner: string,
      ownerAttr: string,
      ownerRef: HclValue,
      policies: string[],
    ) => {
      if (!catalog) return;
      for (const key of policies) {
        const arn = policyArn(key);
        if (!arn) continue;
        emit(
          'iam.tf',
          [account.id],
          block(
            'resource',
            [
              tfType,
              namer.name(
                tfType,
                `${owner}|${key}`,
                `${owner}_${arn.split('/').pop()}`,
              ),
            ],
            [...attr(ownerAttr, ownerRef), ...attr('policy_arn', arn)],
          ),
        );
      }
    };
    const groups = selections(account.config.iamGroups);
    const roles = selections(account.config.iamRoles);
    if (!catalog && (groups.length || roles.length))
      todo(
        'iam.tf',
        account,
        localized((x) => x.noIamCatalog),
      );
    for (const group of groups) {
      const template = catalog?.groups.find((g) => g.key === group.key);
      const iamName =
        template?.iamName || dnsName(group.key.split('.').pop() ?? group.key);
      const name = namer.name('aws_iam_group', group.key, iamName);
      mfaAttach(
        'aws_iam_group_policy_attachment',
        'group',
        `aws_iam_group.${name}.name`,
      );
      emit(
        'iam.tf',
        [account.id],
        block('resource', ['aws_iam_group', name], [...attr('name', iamName)]),
      );
      attachAll(
        'aws_iam_group_policy_attachment',
        name,
        'group',
        raw(`aws_iam_group.${name}.name`),
        group.policies,
      );
    }
    for (const role of roles) {
      const template = catalog?.roles.find((r) => r.key === role.key);
      const iamName =
        template?.iamName || dnsName(role.key.split('.').pop() ?? role.key);
      if (!template?.trustedService) {
        todo('iam.tf', account, {
          pt: `${iamName}: ${T.pt.noTrust}`,
          en: `${iamName}: ${T.en.noTrust}`,
          es: `${iamName}: ${T.es.noTrust}`,
        });
        continue;
      }
      const name = namer.name('aws_iam_role', role.key, iamName);
      emit(
        'iam.tf',
        [account.id],
        block(
          'data',
          ['aws_iam_policy_document', `${name}_trust`],
          [
            block(
              'statement',
              [],
              [
                ...attr('actions', ['sts:AssumeRole']),
                block(
                  'principals',
                  [],
                  [
                    ...attr('type', 'Service'),
                    ...attr('identifiers', [template.trustedService]),
                  ],
                ),
              ],
            ),
          ],
        ),
      );
      emit(
        'iam.tf',
        [account.id],
        block(
          'resource',
          ['aws_iam_role', name],
          [
            ...attr('name', iamName),
            ...attr(
              'assume_role_policy',
              raw(`data.aws_iam_policy_document.${name}_trust.json`),
            ),
          ],
        ),
      );
      attachAll(
        'aws_iam_role_policy_attachment',
        name,
        'role',
        raw(`aws_iam_role.${name}.name`),
        role.policies,
      );
    }
    // MFA obrigatório: nega quase tudo sem MFA (a AWS documenta esta política),
    // anexada a todos os usuários e grupos da conta.
    if (account.config.mfaRequired === true && mfaHolders.length) {
      emit(
        'iam.tf',
        [account.id],
        block(
          'data',
          ['aws_iam_policy_document', 'require_mfa'],
          [
            block(
              'statement',
              [],
              [
                ...attr('sid', 'DenyAllExceptMfaSetupWithoutMfa'),
                ...attr('effect', 'Deny'),
                ...attr('not_actions', [
                  'iam:ChangePassword',
                  'iam:CreateVirtualMFADevice',
                  'iam:EnableMFADevice',
                  'iam:GetUser',
                  'iam:ListMFADevices',
                  'iam:ListVirtualMFADevices',
                  'iam:ResyncMFADevice',
                  'sts:GetSessionToken',
                ]),
                ...attr('resources', ['*']),
                block(
                  'condition',
                  [],
                  [
                    ...attr('test', 'BoolIfExists'),
                    ...attr('variable', 'aws:MultiFactorAuthPresent'),
                    ...attr('values', ['false']),
                  ],
                ),
              ],
            ),
          ],
        ),
      );
      emit(
        'iam.tf',
        [account.id],
        block(
          'resource',
          ['aws_iam_policy', 'require_mfa'],
          [
            ...attr('name', raw('"${var.project}-require-mfa"')),
            ...attr(
              'policy',
              raw('data.aws_iam_policy_document.require_mfa.json'),
            ),
          ],
        ),
      );
      for (const [tfType, ownerAttr, ref] of mfaHolders) {
        emit(
          'iam.tf',
          [account.id],
          block(
            'resource',
            [
              tfType,
              namer.name(
                tfType,
                `mfa|${ref}`,
                `${ref.split('.')[1]}_require_mfa`,
              ),
            ],
            [
              ...attr(ownerAttr, raw(ref)),
              ...attr('policy_arn', raw('aws_iam_policy.require_mfa.arn')),
            ],
          ),
        );
      }
    }
  }
}
