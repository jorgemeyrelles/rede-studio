/** Identificadores dos slides navegáveis via âncora */
export type SlideId =
  | 's1'
  | 's2'
  | 's3'
  | 's4'
  | 's5'
  | 's6'
  | 's7'
  | 's8'
  | 's9'
  | 's10'
  | 's11'
  | 's12'
  | 's13'
  | 's14'
  | 's15'
  | 's16'
  | 's17'
  | 's18'
  | 's19'
  | 's20';

/** Cor da barra lateral de cada slide */
export type SlideBarColor =
  | 'blue'
  | 'cyan'
  | 'green'
  | 'orange'
  | 'purple'
  | 'yellow'
  | 'red'
  | '';

/** Sites da rede corporativa */
export type Site = 'Matriz SP' | 'Filial CWB' | 'VPN Tunnel' | 'VPN SSL';

/** Camadas do modelo hierárquico de rede */
export type NetworkLayer =
  | 'Core'
  | 'Core WAN'
  | 'Distribuição'
  | 'Acesso'
  | 'Endpoint'
  | 'Reserva';
