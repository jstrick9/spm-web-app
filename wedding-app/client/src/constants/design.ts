// Seven Paths Manor Design System
// Palette: Rich Black + Pure White + Deep Plum

// ─── Primary Palette ─────────────────────────────
export const BLACK   = '#0D0D0D';   // rich black — primary backgrounds
export const CHARCOAL = '#1A1A1A';  // dark sections
export const WHITE   = '#FFFFFF';   // pure white — text on dark
export const OFFWHITE = '#F8F8F6';  // warm white — card backgrounds

// ─── Plum Accent Palette ─────────────────────────
export const PLUM        = '#4A1A4E';  // deep plum — primary accent
export const PLUM_MID    = '#6B2D70';  // medium plum — hover states
export const PLUM_LIGHT  = '#8B4A90';  // light plum — muted accents

// ─── Neutral Palette ─────────────────────────────
export const GRAY_DARK   = '#2C2C2C';  // body text on light
export const GRAY_MID    = '#9B9B9B';  // muted text, placeholders
export const GRAY_LIGHT  = '#E8E8E6';  // borders, dividers

// ─── Semantic Aliases (keep old names working) ───
export const NAVY   = BLACK;     // backwards compatibility
export const GOLD   = PLUM;      // backwards compatibility
export const IVORY  = OFFWHITE;  // backwards compatibility
export const ROSE   = PLUM_LIGHT; // couple-facing features
export const SAGE   = '#8FAF8F'; // kept for nature/outdoor

// ─── Opacity Variants ────────────────────────────
export const PLUM_BORDER  = 'rgba(74,26,78,0.25)';
export const PLUM_GLASS   = 'rgba(74,26,78,0.15)';
export const BLACK_GLASS  = 'rgba(13,13,13,0.08)';

// ─── Typography ──────────────────────────────────
export const FONT_DISPLAY = "'Cormorant Garamond', serif";
export const FONT_HEADING = "'Playfair Display', serif";
export const FONT_BODY    = "'Inter', sans-serif";

// Keep old name working
export const FONT_DISPLAY_OLD = FONT_DISPLAY;

// ─── Component Style Helpers ─────────────────────
export const cardStyle = {
  backgroundColor: OFFWHITE,
  border: `1px solid ${PLUM_BORDER}`,
  borderRadius: '4px',
  boxShadow: `0 2px 16px ${BLACK_GLASS}`,
} as const;

export const cardStyleDark = {
  backgroundColor: CHARCOAL,
  border: `1px solid ${PLUM_BORDER}`,
  borderRadius: '4px',
} as const;

// Keep old name for backwards compatibility
export const cardStyleNavy = cardStyleDark;

// ─── Button Gradients ────────────────────────────
export const GRADIENT_PRIMARY =
  `linear-gradient(135deg, ${PLUM}, ${PLUM_MID})`;

export const GRADIENT_DARK_OVERLAY =
  `linear-gradient(135deg, rgba(13,13,13,0.8), rgba(13,13,13,0.5))`;
