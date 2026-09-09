import { getSlidePagination } from '../pagination';
import { GojsLogicalDiagram, GojsNotesFooter } from './components';
import { S15_DEFAULT_NOTES } from './constants';

export default function S15PropostaGojs() {
  return (
    <div className="slide slide-wide" id="s15">
      <div className="slide-bar purple"></div>
      <div className="slide-number">{getSlidePagination('s15')}</div>
      <div className="slide-body">
        <div className="slide-tag">Diagrama Integrado - GoJS</div>
        <div className="slide-title">
          Topologia unificada <span>Matriz | WAN | Filial</span>
        </div>
        <div className="slide-subtitle">
          Visual interativo com caminho primario MPLS e contingencia IPsec.
        </div>

        <div className="gojs-proposal-grid">
          <GojsLogicalDiagram
            cardTitle="Arquitetura logica corporativa"
            cardSubtitle="Clique no icone de informacao para visualizar IP, VLAN e contexto operacional."
            ariaLabel="Diagrama logico Matriz e Filial"
            tooltipWidth={320}
            tooltipHeight={188}
          />
        </div>

        <GojsNotesFooter notes={S15_DEFAULT_NOTES} />
      </div>
    </div>
  );
}
