import { type ReactNode } from 'react';
import { ArrowUpRight, Moon, Sun } from 'lucide-react';
import { Brand } from '../Brand';
import { useTheme, type Theme } from '../theme';
import '../landing.css';

export type { Theme };

/**
 * Logos shown in the footer next to the Radar Meteorology mark.
 * To add one, put the image in `public/logos/` and add an entry, e.g.
 *   { src: '/logos/imd.png', alt: 'India Meteorological Department' }
 */
const FOOTER_LOGOS: { src: string; alt: string }[] = [];

/** Shared header + footer + theme for the public pages (landing, login, team…). */
export function Site({
  children,
  showDashboard = true,
}: {
  children: (theme: Theme) => ReactNode;
  showDashboard?: boolean;
}) {
  const [theme, setTheme] = useTheme();

  return (
    <div className="lp" data-theme={theme}>
      <a className="skip-link" href="#lp-main">
        Skip to content
      </a>
      <header className="lp-nav">
        <div className="lp-wrap lp-nav-inner">
          <a href="#/" aria-label="Radar Meteorology home" className="lp-brand">
            <Brand />
          </a>
          <div className="lp-nav-actions">
            <button
              className="lp-icon-btn lp-theme"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
            >
              {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
            </button>
            {showDashboard && (
              <a className="lp-btn lp-btn-ghost" href="#/login">
                Dashboard <ArrowUpRight size={15} />
              </a>
            )}
          </div>
        </div>
      </header>

      <main id="lp-main">{children(theme)}</main>

      <footer className="lp-footer">
        <div className="lp-wrap lp-footer-inner">
          <div className="lp-footer-logos">
            <Brand />
            {FOOTER_LOGOS.map((logo) => (
              <img key={logo.src} src={logo.src} alt={logo.alt} className="lp-footer-logo" />
            ))}
          </div>
          <a className="lp-link" href="#/team">
            Team <ArrowUpRight size={14} />
          </a>
        </div>
      </footer>
    </div>
  );
}
