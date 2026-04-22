import type { RouteEntry, RouteType } from '../../../types/network'

export const TYPE_CLASS: Record<RouteType, string> = {
  Direta: 'rt-type-direct',
  Estática: 'rt-type-static',
  Default: 'rt-type-default',
}

export const SP_ROUTES: RouteEntry[] = [
  {
    type: 'Direta',
    destination: '10.0.1.0',
    mask: '/24',
    gateway: '—',
    iface: 'eth0 — LAN',
    ifaceColor: 'var(--green)',
  },
  {
    type: 'Direta',
    destination: '200.10.1.0',
    mask: '/30',
    gateway: '—',
    iface: 'eth1 — WAN',
    ifaceColor: 'var(--orange)',
  },
  {
    type: 'Estática',
    destination: '10.0.2.0',
    mask: '/25',
    gateway: '10.10.0.2',
    iface: 'vpn0 — túnel',
    ifaceColor: 'var(--cyan)',
  },
  {
    type: 'Estática',
    destination: '10.10.1.0',
    mask: '/28',
    gateway: '—',
    iface: 'vpn1 — SSL',
    ifaceColor: 'var(--purple)',
  },
  {
    type: 'Default',
    destination: '0.0.0.0',
    mask: '/0',
    gateway: '200.10.1.2',
    iface: 'eth1 — WAN',
    ifaceColor: 'var(--orange)',
  },
]

export const CWB_ROUTES: RouteEntry[] = [
  {
    type: 'Direta',
    destination: '10.0.2.0',
    mask: '/25',
    gateway: '—',
    iface: 'eth0 — LAN',
    ifaceColor: 'var(--green)',
  },
  {
    type: 'Direta',
    destination: '200.20.1.0',
    mask: '/30',
    gateway: '—',
    iface: 'eth1 — WAN',
    ifaceColor: 'var(--orange)',
  },
  {
    type: 'Estática',
    destination: '10.0.1.0',
    mask: '/24',
    gateway: '10.10.0.1',
    iface: 'vpn0 — túnel',
    ifaceColor: 'var(--cyan)',
  },
  {
    type: 'Estática',
    destination: '10.10.1.0',
    mask: '/28',
    gateway: '—',
    iface: 'vpn1 — SSL',
    ifaceColor: 'var(--purple)',
  },
  {
    type: 'Default',
    destination: '0.0.0.0',
    mask: '/0',
    gateway: '200.20.1.2',
    iface: 'eth1 — WAN',
    ifaceColor: 'var(--orange)',
  },
]
