import type { Equipment } from '../types';

type EquipmentCardProps = Equipment & {
  className?: string;
};

export function EquipmentCard({
  name,
  model,
  imagePath,
  imageUrl,
  description,
  keyFeatures,
  estimatedCost,
  specifications,
  className = '',
}: EquipmentCardProps) {
  const primarySrc = imageUrl ?? imagePath;
  const fallbackSrc = imagePath;
  return (
    <div
      style={{
        background: 'var(--panel)',
        border: '1px solid var(--border)',
        borderRadius: '10px',
        padding: '12px',
        marginBottom: '12px',
      }}
      className={className}
    >
      <div
        style={{
          background: '#0a101c',
          border: '1px solid #111c2e',
          borderRadius: '8px',
          height: '120px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          marginBottom: '10px',
        }}
      >
        <img
          src={primarySrc}
          alt={name}
          referrerPolicy="no-referrer"
          crossOrigin="anonymous"
          style={{
            maxWidth: '90%',
            maxHeight: '90%',
            objectFit: 'contain',
            width: 'auto',
            height: 'auto',
          }}
          onError={(e) => {
            const img = e.target as HTMLImageElement;
            if (img.src !== fallbackSrc) {
              img.src = fallbackSrc;
            }
          }}
        />
      </div>

      <div>
        <h3
          style={{
            color: '#9dc1e5',
            fontSize: '13px',
            fontWeight: '700',
            marginBottom: '4px',
          }}
        >
          {name}
        </h3>
        <p style={{ color: '#6a8aa8', fontSize: '12px', marginBottom: '4px' }}>
          Modelo: {model}
        </p>
        <p
          style={{
            color: '#4a6080',
            fontSize: '11px',
            marginBottom: '8px',
            lineHeight: '1.4',
          }}
        >
          {description}
        </p>

        <div style={{ marginBottom: '8px' }}>
          <p
            style={{
              color: '#ffd166',
              fontSize: '11px',
              fontWeight: '700',
              marginBottom: '3px',
            }}
          >
            Características:
          </p>
          <ul
            style={{
              fontSize: '11px',
              color: '#8a9aaa',
              marginLeft: '8px',
              listStyle: 'none',
              padding: 0,
            }}
          >
            {keyFeatures.slice(0, 3).map((feature, idx) => (
              <li key={idx} style={{ marginBottom: '2px' }}>
                <span style={{ color: '#22d3ee', marginRight: '4px' }}>▸</span>
                {feature}
              </li>
            ))}
          </ul>
        </div>

        <div style={{ marginBottom: '8px' }}>
          <p
            style={{
              color: '#22d3ee',
              fontSize: '11px',
              fontWeight: '700',
              marginBottom: '3px',
            }}
          >
            Especificações:
          </p>
          <ul
            style={{
              fontSize: '11px',
              color: '#4a6080',
              marginLeft: '8px',
              listStyle: 'none',
              padding: 0,
            }}
          >
            {specifications.slice(0, 3).map((spec, idx) => (
              <li
                key={idx}
                style={{
                  marginBottom: '2px',
                  display: 'flex',
                  justifyContent: 'space-between',
                }}
              >
                <span>{spec.parameter}:</span>
                <span style={{ color: '#c8d8f0' }}>{spec.value}</span>
              </li>
            ))}
          </ul>
        </div>

        <div
          style={{
            fontSize: '12px',
            background: '#0d2a0d',
            color: '#5c5',
            padding: '8px 10px',
            borderRadius: '6px',
            fontWeight: '700',
            textAlign: 'center',
          }}
        >
          {estimatedCost}
        </div>
      </div>
    </div>
  );
}
