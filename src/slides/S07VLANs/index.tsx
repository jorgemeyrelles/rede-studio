import { getSlidePagination } from "../pagination";
import { VLANS } from './constants';

export default function S07VLANs() {
  return (
    <div className="slide" id="s7">
      <div className="slide-bar purple"></div>
      <div className="slide-number">{getSlidePagination("s7")}</div>
      <div className="slide-body">
        <div className="slide-tag">Segmentação de Rede</div>
        <div className="slide-title">
          VLANs — <span>Segmentação Lógica</span>
        </div>
        <div className="slide-subtitle">
          Isolamento de tráfego por tipo de dispositivo · 802.1Q Trunk nos
          switches L3
        </div>
        <div className="vlan-grid">
          {VLANS.map((v, i) => (
            <div key={v.id} className={`vlan-card vc-${i + 1}`}>
              <div className="vc-id">{v.id}</div>
              <div className="vc-name">{v.name}</div>
              <div className="vc-range">{v.range}</div>
              <div className="vc-desc">{v.description}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
