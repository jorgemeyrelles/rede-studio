/**
 * Regiões comerciais da AWS (partição `aws`; GovCloud e China ficam fora),
 * com o nome oficial publicado na AWS Price List. É a lista de referência
 * do seletor de região; quais delas têm preço carregado vem de
 * `GET /api/cloud-prices/meta` (o seletor marca as que ainda não têm).
 * Sem dependências: `network.ts` importa este arquivo direto (sem passar
 * pelo índice do catálogo, que importa `network.ts`).
 */
export const AWS_COMMERCIAL_REGIONS: ReadonlyArray<{
  code: string;
  name: string;
  /**
   * Letras das zonas de disponibilidade que a região oferece a uma conta
   * nova (`ap-northeast-1` não tem `b`; `us-west-1` só abre duas). O nome
   * da zona é mapeado por conta, então numa conta antiga as letras podem
   * diferir — o inspetor avisa.
   */
  zones: string;
}> = [
  { code: 'sa-east-1', name: 'South America (Sao Paulo)', zones: 'abc' },
  { code: 'us-east-1', name: 'US East (N. Virginia)', zones: 'abcdef' },
  { code: 'us-east-2', name: 'US East (Ohio)', zones: 'abc' },
  { code: 'us-west-1', name: 'US West (N. California)', zones: 'ac' },
  { code: 'us-west-2', name: 'US West (Oregon)', zones: 'abcd' },
  { code: 'mx-central-1', name: 'Mexico (Central)', zones: 'abc' },
  { code: 'ca-central-1', name: 'Canada (Central)', zones: 'abd' },
  { code: 'ca-west-1', name: 'Canada West (Calgary)', zones: 'abc' },
  { code: 'eu-west-1', name: 'EU (Ireland)', zones: 'abc' },
  { code: 'eu-west-2', name: 'EU (London)', zones: 'abc' },
  { code: 'eu-west-3', name: 'EU (Paris)', zones: 'abc' },
  { code: 'eu-central-1', name: 'EU (Frankfurt)', zones: 'abc' },
  { code: 'eu-central-2', name: 'Europe (Zurich)', zones: 'abc' },
  { code: 'eu-north-1', name: 'EU (Stockholm)', zones: 'abc' },
  { code: 'eu-south-1', name: 'EU (Milan)', zones: 'abc' },
  { code: 'eu-south-2', name: 'Europe (Spain)', zones: 'abc' },
  { code: 'il-central-1', name: 'Israel (Tel Aviv)', zones: 'abc' },
  { code: 'me-central-1', name: 'Middle East (UAE)', zones: 'abc' },
  { code: 'me-south-1', name: 'Middle East (Bahrain)', zones: 'abc' },
  { code: 'af-south-1', name: 'Africa (Cape Town)', zones: 'abc' },
  { code: 'ap-south-1', name: 'Asia Pacific (Mumbai)', zones: 'abc' },
  { code: 'ap-south-2', name: 'Asia Pacific (Hyderabad)', zones: 'abc' },
  { code: 'ap-east-1', name: 'Asia Pacific (Hong Kong)', zones: 'abc' },
  { code: 'ap-east-2', name: 'Asia Pacific (Taipei)', zones: 'abc' },
  { code: 'ap-northeast-1', name: 'Asia Pacific (Tokyo)', zones: 'acd' },
  { code: 'ap-northeast-2', name: 'Asia Pacific (Seoul)', zones: 'abcd' },
  { code: 'ap-northeast-3', name: 'Asia Pacific (Osaka)', zones: 'abc' },
  { code: 'ap-southeast-1', name: 'Asia Pacific (Singapore)', zones: 'abc' },
  { code: 'ap-southeast-2', name: 'Asia Pacific (Sydney)', zones: 'abc' },
  { code: 'ap-southeast-3', name: 'Asia Pacific (Jakarta)', zones: 'abc' },
  { code: 'ap-southeast-4', name: 'Asia Pacific (Melbourne)', zones: 'abc' },
  { code: 'ap-southeast-5', name: 'Asia Pacific (Malaysia)', zones: 'abc' },
  { code: 'ap-southeast-6', name: 'Asia Pacific (New Zealand)', zones: 'abc' },
  { code: 'ap-southeast-7', name: 'Asia Pacific (Thailand)', zones: 'abc' },
];

export function awsRegionName(code: unknown): string | null {
  return (
    AWS_COMMERCIAL_REGIONS.find((region) => region.code === code)?.name ?? null
  );
}

/** Letras de AZ da região (`['a','b','c']` se a região não estiver na lista). */
export function awsRegionZones(code: unknown): string[] {
  const zones =
    AWS_COMMERCIAL_REGIONS.find((region) => region.code === code)?.zones ??
    'abc';
  return zones.split('');
}
