import { useEffect, useMemo, useState } from "react";
import {
  getNextSlide,
  getPreviousSlide,
  SLIDE_ORDER,
} from "../slides/pagination";
import type { SlideId } from "../types/slide";

function getHashSlideId(): SlideId {
  const hash = window.location.hash.replace("#", "") as SlideId;

  if (SLIDE_ORDER.includes(hash)) {
    return hash;
  }

  return "s1";
}

export default function SlideArrows() {
  const [currentSlide, setCurrentSlide] = useState<SlideId>("s1");

  useEffect(() => {
    const handleHashChange = () => {
      setCurrentSlide(getHashSlideId());
    };

    handleHashChange();
    window.addEventListener("hashchange", handleHashChange);

    return () => {
      window.removeEventListener("hashchange", handleHashChange);
    };
  }, []);

  const prevSlide = useMemo(
    () => getPreviousSlide(currentSlide),
    [currentSlide],
  );
  const nextSlide = useMemo(() => getNextSlide(currentSlide), [currentSlide]);

  return (
    <div className="slide-arrows" aria-label="Navegação entre slides">
      <a
        className={`slide-arrow ${!prevSlide ? "disabled" : ""}`}
        href={prevSlide ? `#${prevSlide}` : "#"}
        aria-disabled={!prevSlide}
        aria-label="Slide anterior"
        onClick={(event) => {
          if (!prevSlide) {
            event.preventDefault();
          }
        }}
      >
        ↑
      </a>
      <a
        className={`slide-arrow ${!nextSlide ? "disabled" : ""}`}
        href={nextSlide ? `#${nextSlide}` : "#"}
        aria-disabled={!nextSlide}
        aria-label="Próximo slide"
        onClick={(event) => {
          if (!nextSlide) {
            event.preventDefault();
          }
        }}
      >
        ↓
      </a>
    </div>
  );
}
