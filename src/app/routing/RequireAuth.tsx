import { Navigate, Outlet, useParams } from 'react-router-dom';
import { useAppSelector } from '../hooks';

/** Layout-guard: só deixa passar se houver sessão. Senão, manda pro login. */
export default function RequireAuth() {
  const { lang } = useParams<{ lang: string }>();
  const { currentUser, initialized } = useAppSelector((state) => state.auth);

  if (!initialized) return null;

  if (!currentUser) {
    return <Navigate to={`/${lang}/login`} replace />;
  }

  return <Outlet />;
}
