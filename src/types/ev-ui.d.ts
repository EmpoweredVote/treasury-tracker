declare module '@chrisandrewsedu/ev-ui' {
  import { CSSProperties, ReactNode } from 'react';

  export interface NavDropdownItem {
    label: string;
    href: string;
  }

  export interface NavItem {
    label: string;
    href: string;
    dropdown?: NavDropdownItem[];
  }

  export interface CTAButton {
    label: string;
    href: string;
  }

  export interface HeaderProps {
    logoSrc?: string;
    logoAlt?: string;
    navItems?: NavItem[];
    ctaButton?: CTAButton;
    currentPath?: string;
    onNavigate?: (href: string) => void;
    style?: CSSProperties;
  }

  export function Header(props: HeaderProps): JSX.Element;

  export interface SiteHeaderProps {
    logoSrc?: string;
    currentPath?: string;
    onNavigate?: (href: string) => void;
    style?: CSSProperties;
  }

  export function SiteHeader(props: SiteHeaderProps): JSX.Element;

  export const defaultNavItems: NavItem[];
  export const defaultCtaButton: CTAButton;

  export interface RadarChartCoreProps {
    labels: string[];
    data: number[];
    data2?: number[];
    onSpokeClick?: (index: number) => void;
    invertedSpokes?: boolean[];
  }

  export function RadarChartCore(props: RadarChartCoreProps): JSX.Element;

  // Design tokens
  export const colors: {
    evTeal: string;
    evTealDark: string;
    evTealLight: string;
    evCoral: string;
    evYellow: string;
    bgLight: string;
    bgWhite: string;
    textPrimary: string;
    textSecondary: string;
    textMuted: string;
    textWhite: string;
    borderLight: string;
    borderMedium: string;
    error: string;
    success: string;
  };

  export const fonts: {
    primary: string;
    fallback: string;
  };

  export const fontWeights: {
    regular: number;
    medium: number;
    semibold: number;
    bold: number;
  };

  export const fontSizes: {
    xs: string;
    sm: string;
    base: string;
    lg: string;
    xl: string;
    '2xl': string;
    '3xl': string;
    '4xl': string;
    '5xl': string;
  };

  export const spacing: Record<string, string>;
  export const borderRadius: Record<string, string>;
  export const shadows: Record<string, string>;
  export const breakpoints: Record<string, string>;
}
