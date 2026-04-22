import {
  CISCO_ACCESS_POINTS,
  CISCO_FIREWALLS,
  CISCO_ROUTERS,
  CISCO_SWITCHES,
  FORTINET_FIREWALLS,
  FORTINET_ROUTERS,
  FORTINET_SWITCHES,
} from '../constants';
import { EquipmentCard } from './EquipmentCard';

type EquipmentCategoryProps = {
  category: 'router' | 'firewall' | 'switch' | 'access-point';
  categoryLabel: string;
};

export function EquipmentCategoryComparison({
  category,
  categoryLabel,
}: EquipmentCategoryProps) {
  let ciscoEquipments: typeof CISCO_ROUTERS = [];
  let fortinetEquipments: typeof FORTINET_ROUTERS = [];

  switch (category) {
    case 'router':
      ciscoEquipments = CISCO_ROUTERS;
      fortinetEquipments = FORTINET_ROUTERS;
      break;
    case 'firewall':
      ciscoEquipments = CISCO_FIREWALLS;
      fortinetEquipments = FORTINET_FIREWALLS;
      break;
    case 'switch':
      ciscoEquipments = CISCO_SWITCHES;
      fortinetEquipments = FORTINET_SWITCHES;
      break;
    case 'access-point':
      ciscoEquipments = CISCO_ACCESS_POINTS;
      break;
  }

  return (
    <div style={{ marginBottom: '20px' }}>
      <h3
        style={{
          color: '#2d7fff',
          fontSize: '15px',
          fontWeight: '700',
          marginBottom: '12px',
          textTransform: 'uppercase',
          letterSpacing: '1px',
        }}
      >
        {categoryLabel}
      </h3>

      <div
        style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}
      >
        {/* Cisco */}
        <div>
          <h4
            style={{
              color: '#ff7b2d',
              fontSize: '14px',
              fontWeight: '700',
              marginBottom: '10px',
              paddingBottom: '6px',
              borderBottom: '1px solid #3a1a00',
            }}
          >
            🔵 Cisco Solutions
          </h4>
          <div>
            {ciscoEquipments.length > 0 ? (
              ciscoEquipments.map((equipment) => (
                <EquipmentCard key={equipment.id} {...equipment} />
              ))
            ) : (
              <p style={{ color: '#4a6080', fontSize: '12px' }}>
                Sem equipamentos Cisco nesta categoria
              </p>
            )}
          </div>
        </div>

        {/* Fortinet */}
        <div>
          <h4
            style={{
              color: '#ff4444',
              fontSize: '14px',
              fontWeight: '700',
              marginBottom: '10px',
              paddingBottom: '6px',
              borderBottom: '1px solid #3a0000',
            }}
          >
            🔴 Fortinet Solutions
          </h4>
          <div>
            {fortinetEquipments.length > 0 ? (
              fortinetEquipments.map((equipment) => (
                <EquipmentCard key={equipment.id} {...equipment} />
              ))
            ) : (
              <p style={{ color: '#4a6080', fontSize: '10px' }}>
                Sem equipamentos Fortinet nesta categoria
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
