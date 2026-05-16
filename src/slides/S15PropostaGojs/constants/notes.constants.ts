import type { GojsNoteItem } from '../types'

export const S15_DEFAULT_NOTES: GojsNoteItem[] = [
  {
    title: 'Dominios Matriz e Filial',
    text: 'A Matriz opera com bloco corporativo 10.10.0.0/16 e a Filial segue subnetting por crescimento +50% e reserva de 20%.',
  },
  {
    title: 'WAN Primaria e Backup',
    text: 'MPLS dual-stack como primario e VPN IPsec IKEv2 sobre internet como contingencia (15-30s de convergencia).',
  },
  {
    title: 'Leitura do Diagrama',
    text: 'Use o icone de informacao em cada ativo para abrir detalhes de IP, VLAN, papel de seguranca e conectividade.',
  },
]
