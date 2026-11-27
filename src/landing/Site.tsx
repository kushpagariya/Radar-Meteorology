import { useEffect, useState, type ReactNode } from 'react';
import { ArrowUpRight, Moon, Sun } from 'lucide-react';
import { Brand } from '../Brand';
import '../landing.css';

export type Theme = 'light' | 'dark';
const THEME_KEY = 'rm-theme';

/**
 * Logos shown in the footer next to the Radar Meteorology mark.
 * To add one, put the image in `public/logos/` and add an entry, e.g.
 *   { src: '/logos/imd.png', alt: 'India Meteorological Department' }
 */
const FOOTER_LOGOS: { src: string; alt: string }[] = [];

function initialTheme(): Theme {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    /* storage unavailable */
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/** Shared header + footer + theme for the public pages (landing, login, team…). */
export function Site({
  children,
  showDashboard = true,
}: {
  children: (theme: Theme) => ReactNode;
  showDashboard?: boolean;
}) {
  const [theme, setTheme] = useState<Theme>(initialTheme);

  useEffect(() => {
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      /* storage unavailable */
    }
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', theme === 'dark' ? '#0b1418' : '#f5f6f3');
    document.body.style.backgroundColor = theme === 'dark' ? '#0a1317' : '#f4f6f2';
  }, [theme]);

  useEffect(
    () => () => {
      document.body.style.backgroundColor = '';
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#f5f6f3');
    },
    [],
  );

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
