import { getSlidePagination } from '../pagination';
import { GojsLogicalDiagram, GojsNotesFooter } from './components';
import { S15_DEFAULT_NOTES } from './constants';

export default function S15PropostaGojs() {
  return (
    <div className="slide slide-wide" id="s15">
      <div className="slide-bar purple"></div>
      <div className="slide-number">{getSlidePagination('s15')}</div>
      <div className="slide-body">
        <div className="slide-tag">Proposta DEV - JS</div>
        <div className="slide-title">
          Diagrama logico unificado <span>Matriz | Tunelamento | Filial</span>
        </div>
        <div className="slide-subtitle">
          Clique na seta no canto superior direito de cada icone para expandir
          dados de IP e VLAN.
        </div>

        <div className="gojs-proposal-grid">
          <GojsLogicalDiagram
            cardTitle="Logico - Matriz x Filial com tunelamento central"
            cardSubtitle="Cada ativo possui um expander: clique na seta para ver Site, IP, VLAN e contexto."
            ariaLabel="Diagrama logico com GoJS"
            tooltipWidth={300}
            tooltipHeight={170}
          />
        </div>

        <GojsNotesFooter notes={S15_DEFAULT_NOTES} />
      </div>
    </div>
  );
}
