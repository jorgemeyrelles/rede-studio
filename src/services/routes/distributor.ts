import { addressingRoutes } from './addressingRoutes';
import { catalogRoutes } from './catalogRoutes';
import { persistenceRoutes } from './persistenceRoutes';
import { qosRoutes } from './qosRoutes';
import { securityRoutes } from './securityRoutes';
import { sessionsRoutes } from './sessionsRoutes';
import { stateRoutes } from './stateRoutes';
import { topologyRoutes } from './topologyRoutes';
import { vpnRoutes } from './vpnRoutes';

export const servicesRoutes = {
  persistence: persistenceRoutes,
  state: stateRoutes,
  topology: topologyRoutes,
  addressing: addressingRoutes,
  security: securityRoutes,
  qos: qosRoutes,
  catalog: catalogRoutes,
  vpn: vpnRoutes,
  sessions: sessionsRoutes,
};

export type ServicesRoutes = typeof servicesRoutes;
