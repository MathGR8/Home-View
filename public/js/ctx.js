// Referências compartilhadas entre os módulos da interface.
export const app = {
  plan: null,
  view: '2d',
  tab: 'catalog',
  toast: () => {},
  isMobile: () => matchMedia('(max-width: 820px)').matches,
  openSheet: () => {},
  closeSheets: () => {},
  renderLeft: () => {},
  renderProps: () => {},
  prompt: async () => null,
  confirm: async () => false,
};

export const $ = (s, el = document) => el.querySelector(s);
export const $$ = (s, el = document) => [...el.querySelectorAll(s)];

// Aceita "3,5" ou "350": nos cômodos, valores até 30 são entendidos como metros
export function parseLen(s, metersIfSmall = false) {
  const v = parseFloat(String(s).replace(/\s/g, '').replace('m', '').replace(',', '.'));
  if (!Number.isFinite(v)) return NaN;
  return metersIfSmall && v <= 30 ? Math.round(v * 1000) / 10 : v;
}
export const fmtIn = (v) => String(Math.round((+v || 0) * 10) / 10).replace('.', ',');
