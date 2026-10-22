/** Evento que as tabelas disparam para o canvas enquadrar elementos ("Localizar"). */
export const CLOUD_FOCUS_EVENT = 'rede:cloud-focus';

export type CloudFocusDetail = { ids: string[] };

export function focusOnCanvas(ids: string[]) {
  window.dispatchEvent(
    new CustomEvent<CloudFocusDetail>(CLOUD_FOCUS_EVENT, { detail: { ids } }),
  );
}
