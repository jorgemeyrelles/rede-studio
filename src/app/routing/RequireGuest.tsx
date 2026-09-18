import { Navigate, Outlet, useParams } from 'react-router-dom';
import { useSessionQuery } from '../../features/auth/queries';

/** Layout-guard: só deixa passar se NÃO houver sessão. Senão, manda pro dashboard. */
export default function RequireGuest() {
  const { lang } = useParams<{ lang: string }>();
  const { data: currentUser, isFetched } = useSessionQuery();

  if (!isFetched) return null;

  if (currentUser) {
    return <Navigate to={`/${lang}/projects`} replace />;
  }

  return <Outlet />;
}
