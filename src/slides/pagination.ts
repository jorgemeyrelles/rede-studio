import type { SlideId } from '../types/slide';

export const SLIDE_ORDER: SlideId[] = [
  's1',
  's2',
  's3',
  's4',
  's5',
  's6',
  's7',
  's8',
  's9',
  's10',
  's11',
  's12',
  's13',
  's14',
  's15',
  's16',
];

export const TOTAL_SLIDES = SLIDE_ORDER.length;

const slideIndexMap = new Map<SlideId, number>(
  SLIDE_ORDER.map((id, index) => [id, index + 1]),
);

export function getSlidePagination(id: SlideId): string {
  const current = slideIndexMap.get(id);

  if (!current) {
    return `00 / ${TOTAL_SLIDES}`;
  }

  return `${String(current).padStart(2, '0')} / ${TOTAL_SLIDES}`;
}

export function getPreviousSlide(id: SlideId): SlideId | null {
  const index = SLIDE_ORDER.indexOf(id);

  if (index <= 0) {
    return null;
  }

  return SLIDE_ORDER[index - 1];
}

export function getNextSlide(id: SlideId): SlideId | null {
  const index = SLIDE_ORDER.indexOf(id);

  if (index < 0 || index >= SLIDE_ORDER.length - 1) {
    return null;
  }

  return SLIDE_ORDER[index + 1];
}
