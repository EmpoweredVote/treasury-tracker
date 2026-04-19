/**
 * Brand bar colors for known vendors/platforms.
 * Used by BudgetIcicle segments and CategoryList bars to replace
 * the generic data viz hue when a category name matches a brand.
 */
export const BRAND_BAR_COLORS: Record<string, string> = {
  // Revenue sources
  'Patreon':                                 '#FF424D',
  'Give Butter':                             '#19C037',
  'Benevity':                                '#009DD1',
  // Software & Tools
  'Anthropic (Claude)':                      '#D97757',
  'OpenAI (ChatGPT)':                        '#10A37F',
  'Figma':                                   '#1ABCFE',
  'Read.AI':                                 '#6C47FF',
  'MindMeister':                             '#E74C3C',
  'AWS':                                     '#FF9900',
  'GoDaddy':                                 '#00A4A6',
  'TechSoup (AWS Credits)':                  '#0082C9',
  'Supabase':                                '#3FCF8E',
  'Render.com':                              '#46E3B7',
  // Platform Fees
  'Benevity Processing Fee':                 '#009DD1',
  'Givebutter Fees':                         '#19C037',
  'Patreon Fees (Processing + Patreon fee)': '#FF424D',
  'Patreon Fees (adjustment)':               '#FF424D',
};
