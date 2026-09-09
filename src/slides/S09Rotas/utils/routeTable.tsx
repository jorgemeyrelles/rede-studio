import type { RouteEntry } from '../../../types/network'
import { TYPE_CLASS } from '../constants'

interface RouteTableProps {
  rows: RouteEntry[]
}

const HEADER_COLUMNS = ['Tipo', 'Destino', 'Máscara', 'Gateway', 'Métrica', 'Interface']

export function RouteTable({ rows }: RouteTableProps) {
  return (
    <table>
      <thead>
        <tr>
          {HEADER_COLUMNS.map((column) => (
            <th key={column}>{column}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            <td className={TYPE_CLASS[r.type]}>{r.type}</td>
            <td className="tc-ip">{r.destination}</td>
            <td className="tc-mask">{r.mask}</td>
            <td className="tc-gw">{r.gateway}</td>
            <td className="tc-mask">{r.metric}</td>
            <td style={{ color: r.ifaceColor }}>{r.iface}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
