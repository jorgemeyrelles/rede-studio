import { Navigate, Outlet, useParams } from 'react-router-dom';
import { useAppSelector } from '../hooks';

/** Layout-guard: só deixa passar se NÃO houver sessão. Senão, manda pro dashboard. */
export default function RequireGuest() {
  const { lang } = useParams<{ lang: string }>();
  const { currentUser, initialized } = useAppSelector((state) => state.auth);

  if (!initialized) return null;

  if (currentUser) {
    return <Navigate to={`/${lang}/projects`} replace />;
  }

  return <Outlet />;
}
