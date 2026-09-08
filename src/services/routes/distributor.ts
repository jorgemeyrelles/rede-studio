import { addressingRoutes } from './addressingRoutes';
import { authRoutes } from './authRoutes';
import { catalogRoutes } from './catalogRoutes';
import { languageRoutes } from './languageRoutes';
import { persistenceRoutes } from './persistenceRoutes';
import { projectsRoutes } from './projectsRoutes';
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
  auth: authRoutes,
  projects: projectsRoutes,
  language: languageRoutes,
};

export type ServicesRoutes = typeof servicesRoutes;
