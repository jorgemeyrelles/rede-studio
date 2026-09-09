import { servicesRoutes } from '../../services';

// Metodo legado direto (mantido como referencia):
// export { clearNetworkState, loadNetworkState, saveNetworkState } from './utils';

export const { clearNetworkState, loadNetworkState, saveNetworkState } =
	servicesRoutes.persistence;
