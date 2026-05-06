import type { CSSProperties } from 'react';
import { Header } from '@empoweredvote/ev-ui';
import { ThemeToggle } from './ThemeToggle';
import { useTheme } from '../hooks/useTheme';
import type { NavItem, CTAButton, ProfileMenu } from '@empoweredvote/ev-ui';

interface AppHeaderProps {
  navItems?: NavItem[];
  ctaButton?: CTAButton;
  profileMenu?: ProfileMenu;
  style?: CSSProperties;
  onNavigate?: (href: string) => void;
}

export function AppHeader({ style, ...props }: AppHeaderProps) {
  const { isDark } = useTheme();
  const logoSrc = isDark
    ? `${import.meta.env.BASE_URL}EV-Dark-Logo.png`
    : `${import.meta.env.BASE_URL}EV-Light-Logo.png`;

  return (
    <div style={{ position: 'sticky', top: 0, zIndex: 50, width: '100%' }}>
      <Header
        logoSrc={logoSrc}
        logoAlt="Empowered Vote"
        {...props}
        style={{ ...(style ?? {}), position: 'static', zIndex: 'auto' }}
      />
      {/* Overlay the ThemeToggle to the left of the profile button.
          right: max(72px, …) keeps the position aligned with the profile button
          at any viewport width, accounting for the 1512px max-width container
          with 24px right padding (profile button = 40px wide, +8px gap = 72px). */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          right: 'max(72px, calc((100% - 1512px) / 2 + 72px))',
          display: 'flex',
          alignItems: 'center',
          zIndex: 1,
          pointerEvents: 'none',
        }}
      >
        <div style={{ pointerEvents: 'auto' }}>
          <ThemeToggle />
        </div>
      </div>
    </div>
  );
}
