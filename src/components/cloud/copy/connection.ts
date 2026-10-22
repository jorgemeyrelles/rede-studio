import type { AppLanguage } from '../../../types/i18n';

/** Textos de `connection` no Studio Cloud (parte de `cloudCopy.ts`). */
export type ConnectionCopy = {
  title: string;
  from: string;
  to: string;
  kind: string;
  kinds: { traffic: string; association: string; data: string };
  mode: string;
  modes: { 'one-way': string; both: string; pair: string };
  modeHelp: { 'one-way': string; both: string; pair: string };
  reverse: string;
  partner: string;
  protocol: string;
  ports: string;
  encrypted: string;
  gbMonth: string;
  remove: string;
  removed: string;
  sgRule: (sgs: string) => string;
  noSgRule: string;
  canvasHint: string;
  pathPattern: string;
  pathHelp: string;
};

export const connectionCopy: Record<AppLanguage, ConnectionCopy> = {
  pt: {
    title: 'Conexão',
    from: 'Origem',
    to: 'Destino',
    kind: 'Tipo',
    kinds: { traffic: 'Tráfego', association: 'Associação', data: 'Dados' },
    mode: 'Direção',
    modes: {
      'one-way': 'Ida',
      both: 'Ida e volta iguais',
      pair: 'Ida e volta diferentes',
    },
    modeHelp: {
      'one-way': 'Seta no destino.',
      both: 'Uma conexão, seta nas duas pontas, mesma configuração.',
      pair: 'Duas conexões paralelas, cada uma com sua configuração.',
    },
    reverse: 'Inverter sentido',
    partner: 'Abrir a outra direção',
    protocol: 'Protocolo',
    ports: 'Portas',
    encrypted: 'Criptografia em trânsito (TLS)',
    gbMonth: 'Transferência por mês (GB)',
    remove: 'Excluir conexão',
    removed: 'Conexão excluída.',
    sgRule: (sgs) => `Gera regra de entrada em ${sgs} (aba Segurança).`,
    noSgRule: 'Não gera regra de security group.',
    canvasHint:
      'Para conectar, arraste de um dos pontos do recurso (ou segure o clique sobre ele) até outro recurso.',
    pathPattern: 'Caminho',
    pathHelp:
      'Vazio = destino padrão. Ex.: /api/* manda só esse caminho para cá (regra do listener ou comportamento do CloudFront).',
  },
  en: {
    title: 'Connection',
    from: 'Source',
    to: 'Target',
    kind: 'Type',
    kinds: { traffic: 'Traffic', association: 'Association', data: 'Data' },
    mode: 'Direction',
    modes: {
      'one-way': 'One way',
      both: 'Both ways, same',
      pair: 'Both ways, different',
    },
    modeHelp: {
      'one-way': 'Arrow at the target.',
      both: 'One connection, arrows at both ends, same configuration.',
      pair: 'Two parallel connections, each with its own configuration.',
    },
    reverse: 'Reverse direction',
    partner: 'Open the other direction',
    protocol: 'Protocol',
    ports: 'Ports',
    encrypted: 'Encryption in transit (TLS)',
    gbMonth: 'Transfer per month (GB)',
    remove: 'Delete connection',
    removed: 'Connection deleted.',
    sgRule: (sgs) => `Creates an inbound rule in ${sgs} (Security tab).`,
    noSgRule: 'Creates no security group rule.',
    canvasHint:
      'To connect, drag from one of the resource’s points (or press and hold on it) to another resource.',
    pathPattern: 'Path',
    pathHelp:
      'Empty = default destination. E.g. /api/* sends only that path here (listener rule or CloudFront behavior).',
  },
  es: {
    title: 'Conexión',
    from: 'Origen',
    to: 'Destino',
    kind: 'Tipo',
    kinds: { traffic: 'Tráfico', association: 'Asociación', data: 'Datos' },
    mode: 'Dirección',
    modes: {
      'one-way': 'Ida',
      both: 'Ida y vuelta iguales',
      pair: 'Ida y vuelta distintas',
    },
    modeHelp: {
      'one-way': 'Flecha en el destino.',
      both: 'Una conexión, flechas en ambos extremos, misma configuración.',
      pair: 'Dos conexiones paralelas, cada una con su configuración.',
    },
    reverse: 'Invertir sentido',
    partner: 'Abrir la otra dirección',
    protocol: 'Protocolo',
    ports: 'Puertos',
    encrypted: 'Cifrado en tránsito (TLS)',
    gbMonth: 'Transferencia por mes (GB)',
    remove: 'Eliminar conexión',
    removed: 'Conexión eliminada.',
    sgRule: (sgs) => `Crea una regla de entrada en ${sgs} (pestaña Seguridad).`,
    noSgRule: 'No crea regla de security group.',
    canvasHint:
      'Para conectar, arrastra desde uno de los puntos del recurso (o mantén presionado sobre él) hasta otro recurso.',
    pathPattern: 'Ruta',
    pathHelp:
      'Vacío = destino predeterminado. Ej.: /api/* envía solo esa ruta aquí (regla del listener o comportamiento de CloudFront).',
  },
};
