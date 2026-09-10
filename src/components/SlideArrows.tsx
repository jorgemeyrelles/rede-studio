import { useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  getNextSlide,
  getPreviousSlide,
  SLIDE_ORDER,
} from "../slides/pagination";
import type { SlideId } from "../types/slide";

function getSearchSlideId(search: string): SlideId {
  const params = new URLSearchParams(search);
  const slide = params.get("slide") as SlideId | null;

  if (slide && SLIDE_ORDER.includes(slide)) {
    return slide;
  }

  return "s1";
}

export default function SlideArrows() {
  const location = useLocation();
  const currentSlide = useMemo(
    () => getSearchSlideId(location.search),
    [location.search],
  );

  const prevSlide = useMemo(
    () => getPreviousSlide(currentSlide),
    [currentSlide],
  );
  const nextSlide = useMemo(() => getNextSlide(currentSlide), [currentSlide]);

  return (
    <div className="slide-arrows" aria-label="Navegação entre slides">
      <Link
        className={`slide-arrow ${!prevSlide ? "disabled" : ""}`}
        to={prevSlide ? `?slide=${prevSlide}` : location.pathname + location.search}
        aria-disabled={!prevSlide}
        aria-label="Slide anterior"
        onClick={(event) => {
          if (!prevSlide) {
            event.preventDefault();
          }
        }}
      >
        ↑
      </Link>
      <Link
        className={`slide-arrow ${!nextSlide ? "disabled" : ""}`}
        to={nextSlide ? `?slide=${nextSlide}` : location.pathname + location.search}
        aria-disabled={!nextSlide}
        aria-label="Próximo slide"
        onClick={(event) => {
          if (!nextSlide) {
            event.preventDefault();
          }
        }}
      >
        ↓
      </Link>
    </div>
  );
}
