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
    ? `${import.meta.env.BASE_URL}treasury-tracker-logo-dark.svg`
    : `${import.meta.env.BASE_URL}treasury-tracker-logo-light.svg`;

  return (
    <div style={{ position: 'sticky', top: 0, zIndex: 50, width: '100%' }}>
      <Header
        logoSrc={logoSrc}
        logoAlt="Treasury Tracker"
        {...props}
        style={{ ...(style ?? {}), position: 'static', zIndex: 'auto' }}
      />
      {/* Overlay the ThemeToggle (and optional Home button) to the left of the profile
          button. right: max(72px, …) keeps the group aligned with the profile button
          at any viewport width. Home button sits immediately left of ThemeToggle. */}
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
        {showBackButton && (
          <button
            onClick={onBack}
            title="Home"
            aria-label="Back to Treasury Tracker home"
            className="w-8 h-8 flex items-center justify-center rounded-full text-gray-500 dark:text-ev-gray-400 hover:text-gray-900 dark:hover:text-ev-gray-100 hover:bg-gray-100 dark:hover:bg-ev-gray-700 transition-colors"
            style={{ pointerEvents: 'auto', color: isDark ? '#9CA3AF' : undefined }}
          >
            <Home size={16} aria-hidden="true" />
          </button>
        )}
        <div style={{ pointerEvents: 'auto' }}>
          <ThemeToggle />
        </div>
      </div>
    </div>
  );
}
