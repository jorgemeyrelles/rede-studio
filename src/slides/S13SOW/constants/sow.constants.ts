import type { SowMetric, SowPhase } from '../../types/sow.types'

export const PHASES: SowPhase[] = [
  {
    num: 'F1',
    cssClass: 'sp-1',
    title: 'Planejamento & Design',
    titleColor: 'var(--blue)',
    tasks: [
      { label: 'Levantamento de requisitos' },
      { label: 'Definição do endereçamento IP' },
      { label: 'Diagramas lógico e físico' },
      { label: 'Política de segurança e ACL' },
      { label: 'Aprovação do escopo' },
    ],
  },
  {
    num: 'F2',
    cssClass: 'sp-2',
    title: 'Implementação',
    titleColor: 'var(--yellow)',
    tasks: [
      { label: 'Configuração roteadores e firewalls' },
      { label: 'Criação e trunk de VLANs' },
      { label: 'Implantação da VPN Site-to-Site' },
      { label: 'Configuração SSL-VPN' },
      { label: 'Setup APs e RADIUS' },
    ],
  },
  {
    num: 'F3',
    cssClass: 'sp-3',
    title: 'Testes & Entrega',
    titleColor: 'var(--green)',
    tasks: [
      { label: 'Testes de conectividade ponta a ponta' },
      { label: 'Testes de VPN e failover' },
      { label: 'Validação das regras de ACL' },
      { label: 'Treinamento dos administradores' },
      { label: 'Entrega da documentação completa' },
    ],
  },
]

export const METRICS: SowMetric[] = [
  { value: '3', label: 'Fases do projeto' },
  { value: '2', label: 'Sites implantados' },
  { value: '126', label: 'Hosts disponíveis na Filial' },
  { value: 'AES 256', label: 'Criptografia VPN' },
]
