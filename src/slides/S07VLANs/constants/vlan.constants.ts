import type { VlanCard } from '../../../types/network'

export const VLANS: VlanCard[] = [
  {
    id: 10,
    name: 'VLAN 10 - Servidores Producao',
    range: 'Matriz: 10.10.10.0/24 · Filial: Servidores locais /28',
    description:
      'Segmento critico para servicos corporativos. Na filial, VLAN dedicada deve suportar expansao para 6-8 servidores.',
  },
  {
    id: 20,
    name: 'VLAN 20 - Dev/Homolog',
    range: 'Matriz: 10.10.20.0/24 · Filial: Desenvolvimento /24 (144 hosts)',
    description:
      'Isola workloads de desenvolvimento e homologacao. Prefixo /24 atende crescimento da filial sem redesenho.',
  },
  {
    id: 30,
    name: 'VLAN 30 - TI / Infra',
    range: 'Matriz: 10.10.30.0/24 · Filial: TI/Infra /26 (36 hosts)',
    description:
      'Rede tecnica de operacao e sustentacao. Permite controles administrativos e troubleshooting com menor superficie de risco.',
  },
  {
    id: 40,
    name: 'VLANs 40, 50 e 60 - Usuarios (agrupadas no slide)',
    range: 'Matriz: 10.10.40.0/23, 10.10.50.0/23, 10.10.60.0/23',
    description:
      'Segmentacao por perfil de negocio (Desenvolvimento, Administrativo e Comercial/Suporte) para escalar e aplicar politicas distintas.',
  },
  {
    id: 70,
    name: 'VLAN 70 - Wi-Fi Corporativo',
    range: 'Matriz: 10.10.70.0/24 · Filial: SSID corporativo dedicado',
    description:
      'Acesso sem fio de funcionarios com politicas internas e autenticacao corporativa.',
  },
  {
    id: 80,
    name: 'VLANs 80 e 99 - Visitantes e Gerencia',
    range: 'Matriz: 10.10.80.0/24 + 10.10.99.0/27 · Filial: Visitantes isolada + VLAN de gerencia',
    description:
      'Visitantes sem acesso a rede interna. Gerencia restrita a equipe de TI para switches, APs e equipamentos de rede.',
  },
]