/** Seven Paths Manor luxury venue design tokens */
export const NAVY = '#0A1628';
export const GOLD = '#C9A84C';
export const IVORY = '#FDFAF4';
export const ROSE = '#DCAE96';
export const SAGE = '#8FAF8F';
export const FONT_DISPLAY = "'Playfair Display', serif";
export const FONT_BODY = "'Inter', sans-serif";

export const cardStyle = {
  backgroundColor: IVORY,
  border: `1px solid ${GOLD}35`,
  boxShadow: '0 1px 3px rgba(10, 22, 40, 0.04)',
} as const;

export const cardStyleNavy = {
  backgroundColor: NAVY,
  border: `1px solid ${GOLD}25`,
  boxShadow: '0 4px 24px rgba(10, 22, 40, 0.15)',
} as const;
