import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import NavBar from '../components/NavBar';
import SlideArrows from '../components/SlideArrows';
import SlidesIndex from '../slides';
import { SLIDE_ORDER } from '../slides/pagination';
import type { SlideId } from '../types/slide';

function getSlideIdFromSearch(search: string): SlideId {
  const params = new URLSearchParams(search);
  const slide = params.get('slide') as SlideId | null;

  if (slide && SLIDE_ORDER.includes(slide)) {
    return slide;
  }

  return 's1';
}

export default function SlidesPage() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const rawSlide = params.get('slide');
    const resolvedSlide = getSlideIdFromSearch(location.search);

    if (rawSlide !== resolvedSlide) {
      navigate(`?slide=${resolvedSlide}`, { replace: true });
      return;
    }

    const targetSlide = document.getElementById(resolvedSlide);
    if (!targetSlide) {
      return;
    }

    targetSlide.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [location.search, navigate]);

  return (
    <>
      <NavBar />
      <SlideArrows />
      <SlidesIndex />
    </>
  );
}
