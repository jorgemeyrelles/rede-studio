import { Navigate, Outlet, useParams } from 'react-router-dom';
import { useSessionQuery } from '../../features/auth/queries';

/** Layout-guard: só deixa passar se houver sessão. Senão, manda pro login. */
export default function RequireAuth() {
  const { lang } = useParams<{ lang: string }>();
  const { data: currentUser, isFetched } = useSessionQuery();

  if (!isFetched) return null;

  if (!currentUser) {
    return <Navigate to={`/${lang}/login`} replace />;
  }

  return <Outlet />;
}
