import React, { lazy, Suspense, useEffect, useState } from 'react';
import {
  ArrowUpRight,
  AudioLines,
  ChevronRight,
  CircleHelp,
  Clock3,
  Code2,
  Github,
  House,
  Info,
  ListMusic,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  ShieldCheck,
  Sun,
  UserPlus,
  X,
} from 'lucide-react';
import MusicPlayer from './components/MusicPlayer';
import LanguageShowcase from './components/LanguageShowcase';
import GitHubFollowButton from './components/GitHubFollowButton';
import TimelineVideo from './components/TimelineVideo';
import TimelinePage from './TimelinePage';

const ThreeBackground = lazy(() => import('./components/ThreeBackground'));

const PROFILE_URL = 'https://github.com/simoouahbiGHALINOA';
const REPOSITORIES_URL = 'https://github.com/simoouahbiGHALINOA?tab=repositories';
const PROTECTED_USERS_URL = '/protectedUSERS_root_path_secure/';
const SOURCE_URL = 'https://github.com/simoouahbiGHALINOA/HYPERSCALE-ecosystem';

function readLayoutPreference(key: string, fallback: boolean) {
  try {
    const saved = window.localStorage.getItem(key);
    return saved === null ? fallback : saved === 'true';
  } catch {
    return fallback;
  }
}

function EcoHeader({
  leftOpen,
  rightOpen,
  onToggleLeft,
  onToggleRight,
}: {
  leftOpen: boolean;
  rightOpen: boolean;
  onToggleLeft: () => void;
  onToggleRight: () => void;
}) {
  return (
    <header className="eco-header">
      <div className="header-side">
        <button className="icon-button toggle-button" type="button" onClick={onToggleLeft} aria-label="Toggle navigation" aria-expanded={leftOpen} title="Toggle navigation (Ctrl+B)">
          {leftOpen ? <PanelLeftClose size={19} /> : <PanelLeftOpen size={19} />}
        </button>
        <a className="brand" href="/" aria-label="ECO home"><span className="brand-mark">ECO</span><span className="brand-label">ECOSYSTEM</span></a>
        <nav className="header-nav" aria-label="Main navigation">
          <a href="/">Home</a>
          <a href="/about.html">About</a>
          <a href="/timeline.html">Timeline</a>
          <a href="/#languages">Languages</a>
          <a href="/#listen">Listen</a>
        </nav>
      </div>
      <div className="header-side header-side-right">
        <a className="header-link github-link" href={REPOSITORIES_URL} target="_blank" rel="noreferrer" aria-label="View all repositories on GitHub"><Github size={16} /><span>Repositories</span></a>
        <a className="icon-button toggle-button" href={SOURCE_URL} target="_blank" rel="noreferrer" aria-label="Open the original ECO ecosystem repository" title="Original ECO ecosystem"><ArrowUpRight size={18} /></a>
        <a className="icon-button toggle-button" href={PROTECTED_USERS_URL} aria-label="Sign in with GitHub" title="Sign in with GitHub"><UserPlus size={19} /></a>
        <button className="icon-button toggle-button right-toggle" type="button" onClick={onToggleRight} aria-label="Toggle right sidebar" aria-expanded={rightOpen} title="Toggle right sidebar (Ctrl+M)">
          {rightOpen ? <PanelRightClose size={19} /> : <PanelRightOpen size={19} />}
        </button>
      </div>
    </header>
  );
}

function EcoLeftSidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <>
      {open && <button className="sidebar-backdrop left-backdrop" type="button" aria-label="Close navigation" onClick={onClose} />}
      <aside className={`left-sidebar ${open ? 'sidebar-open' : ''}`} aria-hidden={!open}>
        <div className="sidebar-content">
          <div className="sidebar-section-label">Navigation</div>
          <nav className="sidebar-nav" aria-label="ECO pages">
            <a href="/" className="sidebar-link"><House size={18} /><span>Home</span><ChevronRight size={15} /></a>
            <a href="/about.html" className="sidebar-link"><Info size={18} /><span>About</span></a>
            <a href="/timeline.html" className="sidebar-link"><Clock3 size={18} /><span>Work timeline</span></a>
            <a href="/#languages" className="sidebar-link"><Code2 size={18} /><span>Languages &amp; starters</span></a>
            <a href="/#listen" className="sidebar-link"><ListMusic size={18} /><span>Music library</span></a>
            <div className="sidebar-divider" />
            <a href={SOURCE_URL} className="sidebar-link" target="_blank" rel="noreferrer"><ArrowUpRight size={18} /><span>ECOS-SYS source</span></a>
            <a href={PROFILE_URL} className="sidebar-link" target="_blank" rel="noreferrer"><Github size={18} /><span>GitHub profile</span></a>
            <a href={PROTECTED_USERS_URL} className="sidebar-link"><UserPlus size={18} /><span>Protected users</span></a>
          </nav>
          <p className="sidebar-footnote">A small public starting point for the @eco ecosystem.</p>
        </div>
        <button type="button" className="sidebar-close icon-button" aria-label="Close navigation" onClick={onClose}><X size={18} /></button>
      </aside>
    </>
  );
}

function EcoRightSidebar({
  open,
  onClose,
  theme,
  onToggleTheme,
}: {
  open: boolean;
  onClose: () => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
}) {
  return (
    <>
      {open && <button className="sidebar-backdrop right-backdrop" type="button" aria-label="Close settings" onClick={onClose} />}
      <aside className={`right-sidebar ${open ? 'sidebar-open' : ''}`} aria-hidden={!open}>
        <div className="sidebar-content settings-content">
          <div className="settings-title-row"><div><span className="sidebar-section-label">PREFERENCES</span><h2>Settings</h2></div><button type="button" className="icon-button" aria-label="Close settings" onClick={onClose}><X size={18} /></button></div>
          <section className="settings-section">
            <h3>Appearance</h3>
            <button type="button" className="setting-action" onClick={onToggleTheme}>
              {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
              <span>{theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}</span>
            </button>
          </section>
          <section className="settings-section">
            <h3>Your music</h3>
            <a className="setting-action" href="/#listen"><AudioLines size={17} /><span>Open your music library</span><ChevronRight size={15} /></a>
            <p className="settings-note">Private tracks and saved links stay in this browser on this device. They are never uploaded by this site.</p>
          </section>
          <section className="settings-section">
            <h3>Project information</h3>
            <a className="setting-action" href="https://github.com/simoouahbiGHALINOA/simoouahbiGHALINOA.github.io/blob/main/SECURITY.md" target="_blank" rel="noreferrer"><ShieldCheck size={17} /><span>Security policy</span><ArrowUpRight size={14} /></a>
            <a className="setting-action" href="https://github.com/simoouahbiGHALINOA/simoouahbiGHALINOA.github.io/blob/main/TERMS.md" target="_blank" rel="noreferrer"><CircleHelp size={17} /><span>Terms</span><ArrowUpRight size={14} /></a>
          </section>
          <a href={SOURCE_URL} target="_blank" rel="noreferrer" className="settings-version">ECO starter · source <ArrowUpRight size={13} /></a>
        </div>
      </aside>
    </>
  );
}

function HomePage() {
  return (
    <main id="main" className="page-main" tabIndex={-1}>
      <section className="hero-section">
        <div className="hero-content">
          <p className="eyebrow">CREATOR &amp; MAINTAINER OF ECOS-SYS</p>
          <h1>Hi, I’m <span>simoouahbiGHALINOA.</span><br />I build <span className="gradient-text">ECO.</span></h1>
          <p className="hero-subtitle">A personal home for my work, my ecosystem, and the music I enjoy. Built with @eco and connected to the open source project.</p>
          <div className="hero-actions">
            <a className="primary-button" href="/about.html">Get to know me <ArrowUpRight size={16} /></a>
            <GitHubFollowButton />
            <a className="secondary-button" href="#listen"><AudioLines size={16} /> Listen with me</a>
          </div>
          <p className="hero-caption">One ecosystem · built in public · powered by curiosity</p>
        </div>
        <div className="hero-orbit" aria-hidden="true"><span /><span /><span /></div>
      </section>

      <section className="content-section intro-section" id="ecosystem">
        <div className="section-heading"><span className="eyebrow">THE PROJECT</span><h2>One ecosystem, many ideas.</h2><p>ECOS-SYS brings together connected applications, developer tools, and AI experiments. This Pages site is its lightweight public front door.</p></div>
        <div className="feature-grid">
          <article className="feature-card"><span className="feature-icon">◈</span><h3>Connected tools</h3><p>Explore the wider ecosystem and its source code on GitHub.</p></article>
          <article className="feature-card"><span className="feature-icon">✳</span><h3>Made to evolve</h3><p>A simple starter layout ready for new @eco pages and ideas.</p></article>
          <article className="feature-card"><span className="feature-icon">♫</span><h3>Your listening space</h3><p>Bring your own audio, keep a playlist privately on your device, and resume where you left off.</p></article>
        </div>
      </section>

      <TimelineVideo />
      <section className="content-section source-section">
        <div><span className="eyebrow">WORK TIMELINE</span><h2>Explore the screenshots.</h2><p>Browse dated snapshots of ECOS-SYS work on the dedicated timeline page.</p></div>
        <a className="secondary-button" href="/timeline.html">View screenshot timeline <ArrowUpRight size={15} /></a>
      </section>

      <LanguageShowcase />

      <section className="content-section listen-section" aria-labelledby="listen-heading">
        <div className="listen-card">
          <span className="eyebrow">MUSIC, YOUR WAY</span>
          <h2 id="listen-heading">Press play. Make yourself at home.</h2>
          <p>Add audio files from your device or save audio links in your private browser library. You can also add public tracks to the shared playlist in <code>src/music/playlist.ts</code>.</p>
          <a className="primary-button" href="#listen">Open music player <AudioLines size={16} /></a>
          <p className="privacy-caption">Your private library stays on this device. Playback resumes after you press Play again.</p>
        </div>
      </section>

      <section className="content-section source-section">
        <div><span className="eyebrow">KEEP IN TOUCH</span><h2>Follow the work.</h2><p>Visit the GitHub profile to follow new work, open a discussion, or get in touch.</p></div>
        <a className="secondary-button" href={REPOSITORIES_URL} target="_blank" rel="noreferrer"><Github size={17} /> View repositories <ArrowUpRight size={15} /></a>
      </section>
    </main>
  );
}

function AboutPage() {
  return (
    <main id="main" className="page-main about-page" tabIndex={-1}>
      <section className="about-hero">
        <span className="eyebrow">ABOUT THE CREATOR</span>
        <h1>Building <span className="gradient-text">ECO</span>, one idea at a time.</h1>
        <p>I’m simoouahbiGHALINOA, the creator and maintainer of ECOS-SYS. I work on a growing ecosystem that connects applications, AI, and developer tools.</p>
        <div className="hero-actions">
          <GitHubFollowButton />
          <a className="secondary-button" href={SOURCE_URL} target="_blank" rel="noreferrer">Explore ECOS-SYS <ArrowUpRight size={15} /></a>
        </div>
      </section>
      <section className="content-section about-details">
        <div className="section-heading"><span className="eyebrow">HOW I BUILD</span><h2>Thoughtful systems, connected by design.</h2></div>
        <div className="feature-grid">
          <article className="feature-card"><span className="feature-icon">🦀</span><h3>Rust</h3><p>High-performance compute and core systems.</p></article>
          <article className="feature-card"><span className="feature-icon">⚡</span><h3>Go</h3><p>Realtime communication and resilient services.</p></article>
          <article className="feature-card"><span className="feature-icon">🤖</span><h3>AI &amp; web</h3><p>Python, TypeScript, and web apps that connect the ECO experience.</p></article>
        </div>
      </section>
      <section className="content-section source-section">
        <div><span className="eyebrow">THE SOURCE</span><h2>Built in the open.</h2><p>Find the main project, its code, and current work in the original repository.</p></div>
        <a className="secondary-button" href={SOURCE_URL} target="_blank" rel="noreferrer"><Github size={17} /> HYPERSCALE-ecosystem <ArrowUpRight size={15} /></a>
      </section>
    </main>
  );
}

function EcoFooter() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  return (
    <footer className="eco-footer">
      <span className="footer-license">Built with @eco · © {now.getFullYear()} simoouahbiGHALINOA</span>
      <MusicPlayer />
      <a className="footer-github-link" href={REPOSITORIES_URL} target="_blank" rel="noreferrer" aria-label="View all GitHub repositories">
        <Github size={19} />
      </a>
      <div className="footer-meta">
        <time dateTime={now.toISOString()}>{now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</time>
        <a href="https://github.com/simoouahbiGHALINOA/simoouahbiGHALINOA.github.io/blob/main/TERMS.md" target="_blank" rel="noreferrer">Terms</a>
        <a href="https://github.com/simoouahbiGHALINOA/simoouahbiGHALINOA.github.io/blob/main/SECURITY.md" target="_blank" rel="noreferrer">Security</a>
      </div>
    </footer>
  );
}

export default function App() {
  const [leftOpen, setLeftOpen] = useState(() => readLayoutPreference('eco-starter:left-open', window.innerWidth > 900));
  const [rightOpen, setRightOpen] = useState(() => readLayoutPreference('eco-starter:right-open', false));
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    try {
      return window.localStorage.getItem('eco-starter:theme') === 'light' ? 'light' : 'dark';
    } catch {
      return 'dark';
    }
  });
  const isAbout = window.location.pathname.endsWith('/about.html');
  const isTimeline = window.location.pathname.endsWith('/timeline.html');

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.title = isTimeline ? 'Work Timeline | ECO' : isAbout ? 'About | ECO' : 'ECO | Simoouahbi';
    try {
      window.localStorage.setItem('eco-starter:theme', theme);
    } catch {
      // The selected theme remains active for this page even if storage is disabled.
    }
  }, [isAbout, isTimeline, theme]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.key.toLowerCase() === 'b') {
        event.preventDefault();
        setLeftOpen((open) => !open);
      } else if (event.ctrlKey && event.key.toLowerCase() === 'm') {
        event.preventDefault();
        setRightOpen((open) => !open);
      } else if (event.key === 'Escape') {
        setLeftOpen(false);
        setRightOpen(false);
        try {
          window.localStorage.setItem('eco-starter:left-open', 'false');
          window.localStorage.setItem('eco-starter:right-open', 'false');
        } catch {
          // Closing sidebars still works when storage is disabled.
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const toggleSidebar = (side: 'left' | 'right') => {
    const setter = side === 'left' ? setLeftOpen : setRightOpen;
    const key = side === 'left' ? 'eco-starter:left-open' : 'eco-starter:right-open';
    setter((open) => {
      const next = !open;
      try {
        window.localStorage.setItem(key, String(next));
      } catch {
        // Sidebar state still updates for this visit when storage is disabled.
      }
      return next;
    });
  };

  const closeSidebar = (side: 'left' | 'right') => {
    (side === 'left' ? setLeftOpen : setRightOpen)(false);
    try {
      window.localStorage.setItem(side === 'left' ? 'eco-starter:left-open' : 'eco-starter:right-open', 'false');
    } catch {
      // Closing the sidebar still works when storage is disabled.
    }
  };

  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>
      <Suspense fallback={<div className="three-background canvas-fallback" aria-hidden="true" />}>
        <ThreeBackground theme={theme} />
      </Suspense>
      <div className="eco-public-layout">
        <EcoHeader
          leftOpen={leftOpen}
          rightOpen={rightOpen}
          onToggleLeft={() => toggleSidebar('left')}
          onToggleRight={() => toggleSidebar('right')}
        />
        <div className="main-container">
          <EcoLeftSidebar open={leftOpen} onClose={() => closeSidebar('left')} />
          {isTimeline ? <TimelinePage /> : isAbout ? <AboutPage /> : <HomePage />}
          <EcoRightSidebar
            open={rightOpen}
            onClose={() => closeSidebar('right')}
            theme={theme}
            onToggleTheme={() => setTheme((current) => current === 'dark' ? 'light' : 'dark')}
          />
        </div>
        <EcoFooter />
      </div>
    </>
  );
}
