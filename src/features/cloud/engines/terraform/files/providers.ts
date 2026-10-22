import { attr, block, raw } from '../hcl';
import { localized } from '../shared';
import type { TfContext } from '../context';

/** Seção `providers.tf` do gerador. */
export function emitProviders(ctx: TfContext) {
  const { str, emit, todo, regions, regionAlias, account } = ctx;

  // ── providers.tf ──────────────────────────────────────────────────────
  emit(
    'providers.tf',
    [],
    block(
      'terraform',
      [],
      [
        ...attr('required_version', '>= 1.6'),
        block(
          'required_providers',
          [],
          [...attr('aws', { source: 'hashicorp/aws', version: '~> 6.0' })],
        ),
      ],
    ),
  );
  emit(
    'providers.tf',
    [],
    block(
      'locals',
      [],
      [
        ...attr('common_tags', {
          Project: raw('var.project'),
          Environment: raw('var.environment'),
          Owner: raw('var.owner'),
          CostCenter: raw('var.cost_center'),
          ManagedBy: 'rede-studio',
        }),
      ],
    ),
  );
  if (regions.length === 0)
    todo(
      'providers.tf',
      null,
      localized((x) => x.noRegion),
    );
  const accountId = str(account?.config.accountId);
  for (const region of regions) {
    const alias = regionAlias.get(region.id);
    emit(
      'providers.tf',
      [region.id],
      block(
        'provider',
        ['aws'],
        [
          ...(alias ? attr('alias', alias) : []),
          ...attr('region', str(region.config.region)),
          ...(/^\d{12}$/.test(accountId)
            ? attr('allowed_account_ids', [accountId])
            : []),
          block(
            'default_tags',
            [],
            [...attr('tags', raw('local.common_tags'))],
          ),
        ],
      ),
    );
  }
}
