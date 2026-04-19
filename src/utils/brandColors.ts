/**
 * Brand bar colors for known vendors/platforms.
 * Used by BudgetIcicle segments and CategoryList bars to replace
 * the generic data viz hue when a category name matches a brand.
 */
export const BRAND_BAR_COLORS: Record<string, string> = {
  // EV top-level categories (prevent all-blue icicle at root level)
  'Donations':                               '#22C55E',
  'Interest':                                '#86EFAC',
  'Software & Tools':                        '#8B5CF6',
  'Platform Fees':                           '#EF4444',
  'Operations':                              '#F59E0B',
  // Revenue sources
  'Patreon':                                 '#000000',
  'Give Butter':                             '#F5A623',
  'Benevity':                                '#009DD1',
  // Software & Tools
  'Anthropic (Claude)':                      '#D97757',
  'OpenAI (ChatGPT)':                        '#10A37F',
  'Figma':                                   '#1ABCFE',
  'Read.AI':                                 '#6C47FF',
  'MindMeister':                             '#F96FAD',
  'AWS':                                     '#FF9900',
  'GoDaddy':                                 '#00A4A6',
  'TechSoup (AWS Credits)':                  '#E8752A',
  'Supabase':                                '#3FCF8E',
  'Render.com':                              '#46E3B7',
  // Platform Fees
  'Benevity Processing Fee':                 '#009DD1',
  'Givebutter Fees':                         '#F5A623',
  'Patreon Fees (Processing + Patreon fee)': '#000000',
  'Patreon Fees (adjustment)':               '#000000',
};

/**
 * Returns '#000000' or '#ffffff' — whichever has better contrast against bgColor.
 * Falls back to white for CSS custom properties (var(--...)) which can't be parsed.
 */
export function getContrastText(bgColor: string): string {
  if (!bgColor.startsWith('#') || bgColor.length < 7) return '#ffffff';
  const r = parseInt(bgColor.slice(1, 3), 16) / 255;
  const g = parseInt(bgColor.slice(3, 5), 16) / 255;
  const b = parseInt(bgColor.slice(5, 7), 16) / 255;
  const toLinear = (c: number) => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  const L = 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
  return L > 0.179 ? '#000000' : '#ffffff';
}
