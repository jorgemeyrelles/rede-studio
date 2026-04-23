import NavBar from '../components/NavBar';
import SlideArrows from '../components/SlideArrows';
import S01Capa from '../slides/S01Capa';
import S02Agenda from '../slides/S02Agenda';
import S03Escopo from '../slides/S03Escopo';
import S04TopologiaLogica from '../slides/S04TopologiaLogica';
import S05TopologiaFisica from '../slides/S05TopologiaFisica';
import S06Enderecamento from '../slides/S06Enderecamento';
import S07VLANs from '../slides/S07VLANs';
import S08Diagramas from '../slides/S08Diagramas';
import S09Rotas from '../slides/S09Rotas';
import S10VPN from '../slides/S10VPN';
import S11Firewall from '../slides/S11Firewall';
import S12Seguranca from '../slides/S12Seguranca';
import S13SOW from '../slides/S13SOW';
import S14Encerramento from '../slides/S14Encerramento';
import S15PropostaGojs from '../slides/S15PropostaGojs';
import S16EquipamentosRecomendados from '../slides/S16EquipamentosRecomendados';

export default function SlidesPage() {
  return (
    <>
      <NavBar />
      <SlideArrows />
      <S01Capa />
      <S02Agenda />
      <S03Escopo />
      <S04TopologiaLogica />
      <S05TopologiaFisica />
      <S06Enderecamento />
      <S07VLANs />
      <S08Diagramas />
      <S09Rotas />
      <S10VPN />
      <S11Firewall />
      <S12Seguranca />
      <S13SOW />
      <S14Encerramento />
      <S15PropostaGojs />
      <S16EquipamentosRecomendados />
    </>
  );
}
