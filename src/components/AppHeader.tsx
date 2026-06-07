import type { CSSProperties } from 'react';
import { Header } from '@empoweredvote/ev-ui';
import { ThemeToggle } from './ThemeToggle';
import { useTheme } from '../hooks/useTheme';
import type { NavItem, CTAButton, ProfileMenu } from '@empoweredvote/ev-ui';
import { Home } from 'lucide-react';

interface AppHeaderProps {
  navItems?: NavItem[];
  ctaButton?: CTAButton;
  profileMenu?: ProfileMenu;
  style?: CSSProperties;
  onNavigate?: (href: string) => void;
  showBackButton?: boolean;
  onBack?: () => void;
}

export function AppHeader({ style, showBackButton, onBack, ...props }: AppHeaderProps) {
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
      {/* Home button — overlaid just right of the logo (logo ≈ 90px wide at 43px height,
          24px container padding → place at ~120px from the container left edge). */}
      {showBackButton && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: 'max(120px, calc((100% - 1512px) / 2 + 120px))',
            display: 'flex',
            alignItems: 'center',
            zIndex: 1,
          }}
        >
          <button
            onClick={onBack}
            title="Back to Treasury Tracker home"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 10px',
              borderRadius: '6px',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,83,102,0.2)'}`,
              background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,83,102,0.06)',
              color: isDark ? '#7dd3e0' : '#005366',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 600,
              fontFamily: 'Manrope, sans-serif',
              transition: 'background 0.15s, border-color 0.15s',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.background = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,83,102,0.12)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.background = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,83,102,0.06)';
            }}
          >
            <Home size={14} />
            <span>Home</span>
          </button>
        </div>
      )}
    </div>
  );
}
