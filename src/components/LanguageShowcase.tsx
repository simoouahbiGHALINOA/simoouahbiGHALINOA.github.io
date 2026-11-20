// SPDX-License-Identifier: MIT

import { useEffect, useState } from 'react';

type LanguageMetric = {
  name: string;
  extension: string;
  starterDirectory: string;
  fileCount: number;
  sourceBytes: number;
  actualPercent: number;
  equalPercent: number;
};

type LanguageMetrics = {
  method: string;
  totalSourceBytes: number;
  languages: LanguageMetric[];
};

const languageIcons: Record<string, string> = {
  Rust: '🦀',
  Go: '🐹',
  Python: '🐍',
  TypeScript: '🔷',
  JavaScript: '⚡',
  SQL: '🗃️',
  CSS: '🎨',
  HTML: '🌐',
};

function isLanguageMetrics(value: unknown): value is LanguageMetrics {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.method !== 'string' || typeof candidate.totalSourceBytes !== 'number' || !Array.isArray(candidate.languages)) {
    return false;
  }

  return candidate.languages.every((language: unknown) => {
    if (!language || typeof language !== 'object') return false;
    const item = language as Record<string, unknown>;
    return typeof item.name === 'string'
      && typeof item.extension === 'string'
      && typeof item.starterDirectory === 'string'
      && typeof item.fileCount === 'number'
      && typeof item.sourceBytes === 'number'
      && typeof item.actualPercent === 'number'
      && typeof item.equalPercent === 'number';
  });
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} bytes`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function LanguageShowcase() {
  const [metrics, setMetrics] = useState<LanguageMetrics | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let active = true;
    fetch('/language-metrics.json')
      .then(async (response) => {
        if (!response.ok) throw new Error(`Language metrics request failed with status ${response.status}.`);
        const payload: unknown = await response.json();
        if (!isLanguageMetrics(payload)) throw new Error('Language metrics have an unexpected format.');
        return payload;
      })
      .then((result) => {
        if (active) setMetrics(result);
      })
      .catch((error: unknown) => {
        console.error('Unable to load language metrics.', error);
        if (active) setLoadError(true);
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <section id="languages" className="content-section language-showcase" aria-labelledby="languages-heading">
      <div className="section-heading">
        <span className="eyebrow">LANGUAGES &amp; FILE TYPES</span>
        <h2 id="languages-heading">Eight starters. Equal place in the toolkit.</h2>
        <p>Each language gets an equal starter share and a separate measured share based on its real source files.</p>
      </div>
      {metrics ? (
        <>
          <p className="language-note">
            Equal share is a presentation choice. Measured share uses source-file bytes under <code>src/</code>, <code>starters/</code>,
            and <code>api/</code>; images, dependencies, and build output are excluded.
          </p>
          <div className="language-grid">
            {metrics.languages.map((language) => (
              <article className="language-card" key={language.name}>
                <div className="language-card-heading">
                  <span className="language-icon" aria-hidden="true">{languageIcons[language.name] ?? '💻'}</span>
                  <div>
                    <h3>{language.name}</h3>
                    <code>{language.extension}</code>
                  </div>
                </div>
                <div className="language-share">
                  <span className="language-share-label">Equal starter share</span>
                  <strong>{language.equalPercent.toFixed(1)}%</strong>
                </div>
                <div className="language-bar" aria-hidden="true">
                  <span style={{ width: `${language.equalPercent}%` }} />
                </div>
                <div className="language-share">
                  <span className="language-share-label">Measured source share</span>
                  <strong>{language.actualPercent.toFixed(1)}%</strong>
                </div>
                <div className="language-bar" aria-hidden="true">
                  <span style={{ width: `${language.actualPercent}%` }} />
                </div>
                <div className="language-card-footer">
                  <span>{language.fileCount} files · {formatBytes(language.sourceBytes)}</span>
                  <a
                    href={`https://github.com/simoouahbiGHALINOA/simoouahbiGHALINOA.github.io/tree/main/${language.starterDirectory}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Starter files
                  </a>
                </div>
              </article>
            ))}
          </div>
        </>
      ) : loadError ? (
        <p className="language-error" role="alert">Language metrics could not be loaded. Run <code>npm run generate:language-metrics</code> and rebuild the site.</p>
      ) : (
        <p className="language-note" role="status">Loading measured language shares…</p>
      )}
    </section>
  );
}
