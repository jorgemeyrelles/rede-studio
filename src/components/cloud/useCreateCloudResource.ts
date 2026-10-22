import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { useSessionQuery } from '../../features/auth/queries';
import { addCloudResource } from '../../features/cloud/cloudSlice';
import {
  defaultIamUserName,
  toTagSlug,
} from '../../features/cloud/engines/identity';
import type { AppLanguage } from '../../types/i18n';

/**
 * Cria um recurso do catálogo com os padrões que dependem da sessão e do
 * projeto — o catálogo é puro e não os conhece. Hoje: a conta AWS nasce com
 * o usuário IAM do Rede Studio, o responsável (e-mail) e o centro de custo
 * (slug do nome do projeto).
 */
export function useCreateCloudResource(language: AppLanguage) {
  const dispatch = useAppDispatch();
  const { data: user } = useSessionQuery();
  const projectName = useAppSelector((state) => state.cloud.meta.projectName);

  return (type: string, parentId: string | null) => {
    const initialConfig: Record<string, unknown> = {};
    if (type === 'aws.account') {
      const iamUser = user ? defaultIamUserName(user) : '';
      if (iamUser) initialConfig.iamUsers = [iamUser];
      if (user?.email) initialConfig.owner = user.email;
      const costCenter = toTagSlug(projectName);
      if (costCenter) initialConfig.costCenter = costCenter;
    }
    dispatch(addCloudResource({ type, parentId, language, initialConfig }));
  };
}
