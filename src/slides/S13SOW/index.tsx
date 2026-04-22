import { getSlidePagination } from "../pagination";
import { METRICS, PHASES } from './constants';

export default function S13SOW() {
  return (
    <div className="slide" id="s13">
      <div className="slide-bar orange"></div>
      <div className="slide-number">{getSlidePagination("s13")}</div>
      <div className="slide-body">
        <div className="slide-tag">Planejamento</div>
        <div className="slide-title">
          Cronograma de <span>Implantação</span>
        </div>
        <div className="slide-subtitle">
          Fases do projeto · responsáveis · entregas
        </div>
        <div className="sow-grid">
          {PHASES.map((phase) => (
            <div key={phase.num} className={`sow-phase ${phase.cssClass}`}>
              <div className="sow-phase-num">{phase.num}</div>
              <div
                className="sow-phase-title"
                style={{ color: phase.titleColor }}
              >
                {phase.title}
              </div>
              <ul className="sow-tasks">
                {phase.tasks.map((task, i) => (
                  <li key={i} className="sow-task">
                    <span className="ck">✔</span>
                    {task.label}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="sow-bottom">
          {METRICS.map((m) => (
            <div key={m.label} className="sow-metric">
              <div className="sow-metric-val">{m.value}</div>
              <div className="sow-metric-lbl">{m.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
