export const MODE_CLASS: Record<string, string> = {
  // Mesmo matiz das rotas correspondentes (tokens route-*), pra o modo de
  // roteamento "bater" com a cor da rota que ele gera na tabela de rotas.
  static: 'bg-route-static/15 text-route-static',
  ospf: 'bg-route-direct/15 text-route-direct',
  bgp: 'bg-route-bgp/15 text-route-bgp',
  mixed: 'bg-accent/15 text-accent',
};

export const MODE_LABEL: Record<string, string> = {
  static: 'Static',
  ospf: 'OSPF',
  bgp: 'BGP',
  mixed: 'Mixed',
};
