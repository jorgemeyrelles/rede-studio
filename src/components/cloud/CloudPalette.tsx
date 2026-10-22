import { Lock } from 'lucide-react';
import { useAppSelector } from '../../app/hooks';
import {
  CLOUD_CATALOG,
  CLOUD_CATEGORIES,
  type CloudCatalogEntry,
} from '../../features/cloud/catalog';
import { paletteAvailability } from '../../features/cloud/tree';
import type { AppLanguage } from '../../types/i18n';
import { getCloudIcon } from './awsIcons';
import { getCloudCopy } from './cloudCopy';
import { useCreateCloudResource } from './useCreateCloudResource';

type CloudPaletteProps = { language: AppLanguage };

/**
 * Paleta do Studio Cloud, por categoria (na ordem de crescimento dentro de
 * cada uma). Cada
 * item mostra se pode ser criado agora; bloqueado, diz o porquê (o pai que
 * falta, o limite atingido). Clicar cria dentro do elemento selecionado —
 * ou do primeiro pai válido.
 */
export default function CloudPalette({ language }: CloudPaletteProps) {
  const createResource = useCreateCloudResource(language);
  const copy = getCloudCopy(language);
  const cloud = useAppSelector((state) => state.cloud);

  const items = CLOUD_CATALOG.filter((entry) => entry.canvas !== false).map(
    (entry) => ({
      entry,
      availability: paletteAvailability(
        cloud,
        entry,
        cloud.ui.selectedResourceId,
      ),
      count: cloud.resources.filter((r) => r.type === entry.type).length,
    }),
  );
  // Próximo passo: a primeira camada do caminho principal ainda não usada
  // que já pode ser criada (itens opcionais, como CloudFront, nunca).
  const nextStep = items.find(
    (item) =>
      !item.entry.optional && item.availability.enabled && item.count === 0,
  )?.entry.type;

  const categories = CLOUD_CATEGORIES.filter((category) =>
    items.some((item) => item.entry.category === category),
  );

  const create = (entry: CloudCatalogEntry, parentId: string | null) =>
    createResource(entry.type, parentId);

  return (
    <aside
      aria-labelledby="cloud-palette-title"
      className="panel flex min-h-0 flex-col"
    >
      <div className="panel-header">
        <div>
          <h2 id="cloud-palette-title" className="panel-title">
            {copy.paletteTitle}
          </h2>
          <p className="mt-0.5 text-2xs text-chalk-faint">{copy.paletteHint}</p>
        </div>
      </div>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3">
        {categories.map((category) => (
          <section key={category} aria-label={copy.categories[category]}>
            <h3 className="text-label mb-1.5 text-chalk-faint">
              {copy.categories[category]}
            </h3>
            <ul className="space-y-1">
              {items
                .filter((item) => item.entry.category === category)
                .map(({ entry, availability }) => {
                  const icon = getCloudIcon(entry.type);
                  const isNext = entry.type === nextStep;
                  return (
                    <li key={entry.type}>
                      <button
                        type="button"
                        disabled={!availability.enabled}
                        onClick={() =>
                          availability.enabled &&
                          create(entry, availability.parentId)
                        }
                        className={`flex w-full items-start gap-2.5 rounded-[2px] border px-2 py-2 text-left transition-colors ${
                          isNext
                            ? 'border-accent/50 bg-accent/[0.06]'
                            : 'border-transparent'
                        } enabled:hover:border-line-strong enabled:hover:bg-ink-raised-2 disabled:cursor-not-allowed`}
                      >
                        {icon ? (
                          <img
                            src={icon}
                            alt=""
                            width={28}
                            height={28}
                            className={`mt-0.5 shrink-0 ${availability.enabled ? '' : 'opacity-40 grayscale'}`}
                          />
                        ) : (
                          <span className="h-7 w-7 shrink-0" />
                        )}
                        <span className="min-w-0">
                          <span
                            className={`block text-xs font-semibold ${availability.enabled ? 'text-chalk' : 'text-chalk-faint'}`}
                          >
                            {entry.label[language]}
                          </span>
                          <span className="mt-0.5 block text-2xs leading-4 text-chalk-dim">
                            {availability.enabled
                              ? entry.summary[language]
                              : null}
                          </span>
                          {isNext && (
                            <span className="mt-1.5 inline-block rounded-[2px] bg-accent/15 px-1.5 font-mono text-2xs text-accent">
                              {copy.nextStep}
                            </span>
                          )}
                          {!availability.enabled && (
                            <span className="mt-0.5 flex items-center gap-1 text-2xs leading-4 text-chalk-faint">
                              <Lock
                                size={11}
                                aria-hidden="true"
                                className="shrink-0"
                              />
                              {availability.reason[language]}
                            </span>
                          )}
                        </span>
                      </button>
                    </li>
                  );
                })}
            </ul>
          </section>
        ))}
      </div>
    </aside>
  );
}
