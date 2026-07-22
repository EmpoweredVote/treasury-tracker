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
  const featureLogo = isDark
    ? `${import.meta.env.BASE_URL}treasury-tracker-logo-dark.svg`
    : `${import.meta.env.BASE_URL}treasury-tracker-logo-light.svg`;

  return (
    <div style={{ position: 'sticky', top: 0, zIndex: 50, width: '100%' }}>
      <Header
        darkMode={isDark}
        logoSrc={`${import.meta.env.BASE_URL}${isDark ? 'EVLogo-dark.svg' : 'EVLogo.svg'}`}
        logoAlt="Empowered Vote"
        logoHref="https://empowered.vote"
        centerLogoSrc={featureLogo}
        centerLogoAlt="Treasury Tracker"
        centerLogoHref="https://treasurytracker.empowered.vote"
        {...props}
        style={{ ...(style ?? {}), position: 'static', zIndex: 'auto' }}
      />
      {/* Overlay the ThemeToggle to the left of the profile button. right: max(72px, …)
          keeps it aligned with the profile button at any viewport width. */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          right: 'max(72px, calc((100% - 1512px) / 2 + 72px))',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          zIndex: 110,
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
