import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { RefreshCw } from 'lucide-react';

interface ContributionDay {
  date: string;
  count: number;
}

interface GitHubContributionData {
  site: string;
  username: string;
  repository: string;
  branch: string;
  generatedAt: string;
  days: ContributionDay[];
}

interface EcosystemContributionDay {
  date: string;
  ecosystem: number;
  github: number;
}

interface EcosystemContributionData {
  generatedAt: string;
  githubAvailable: boolean;
  days: EcosystemContributionDay[];
}

type ContributionSource = 'eco' | 'github';

const ECO_CONTRIBUTION_API_BASE_URL = 'https://0661619230.com';

function isGitHubContributionData(value: unknown): value is GitHubContributionData {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.site === 'string' &&
    typeof candidate.username === 'string' &&
    typeof candidate.repository === 'string' &&
    typeof candidate.branch === 'string' &&
    typeof candidate.generatedAt === 'string' &&
    Array.isArray(candidate.days) &&
    candidate.days.length === 7 &&
    candidate.days.every((day) => {
      if (typeof day !== 'object' || day === null) return false;
      const contribution = day as Record<string, unknown>;
      return (
        typeof contribution.date === 'string' &&
        /^\d{4}-\d{2}-\d{2}$/.test(contribution.date) &&
        typeof contribution.count === 'number' &&
        Number.isInteger(contribution.count) &&
        contribution.count >= 0
      );
    })
  );
}

function isEcosystemContributionData(value: unknown): value is EcosystemContributionData {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.generatedAt === 'string' &&
    typeof candidate.githubAvailable === 'boolean' &&
    Array.isArray(candidate.days) &&
    candidate.days.length === 7 &&
    candidate.days.every((day) => {
      if (typeof day !== 'object' || day === null) return false;
      const contribution = day as Record<string, unknown>;
      return (
        typeof contribution.date === 'string' &&
        /^\d{4}-\d{2}-\d{2}$/.test(contribution.date) &&
        Number.isInteger(contribution.ecosystem) &&
        Number(contribution.ecosystem) >= 0 &&
        Number.isInteger(contribution.github) &&
        Number(contribution.github) >= 0
      );
    })
  );
}

export default function ContributionWeekEmbed({
  site,
  repository,
  branch,
}: {
  site: string;
  repository: string;
  branch: string;
}) {
  const [data, setData] = useState<GitHubContributionData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [ecoData, setEcoData] = useState<EcosystemContributionData | null>(null);
  const [ecoLoadError, setEcoLoadError] = useState<string | null>(null);
  const [ecoLoading, setEcoLoading] = useState(true);
  const [source, setSource] = useState<ContributionSource>('eco');
  const [refreshKey, setRefreshKey] = useState(0);
  const [headerElement, setHeaderElement] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setHeaderElement(document.querySelector<HTMLElement>('.eco-header'));
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setData(null);
    setLoadError(null);
    async function loadContributions() {
      try {
        const response = await fetch('/github-contributions.json', {
          cache: 'no-store',
          signal: controller.signal,
        });
        if (response.status === 404) {
          throw new Error('GitHub repository commit feed is not published yet.');
        }
        if (!response.ok) {
          throw new Error(`GitHub contribution feed failed with HTTP ${response.status}.`);
        }
        const payload: unknown = await response.json();
        if (
          !isGitHubContributionData(payload) ||
          payload.site !== site ||
          payload.repository !== repository ||
          payload.branch !== branch
        ) {
          throw new Error(
            'GitHub commit data is invalid or belongs to another site, repository, or branch.',
          );
        }
        setData(payload);
      } catch (error) {
        if (controller.signal.aborted) return;
        setLoadError(
          error instanceof Error ? error.message : 'GitHub contributions could not be loaded.',
        );
      }
    }
    void loadContributions();
    return () => {
      controller.abort();
    };
  }, [site, repository, branch, refreshKey]);

  useEffect(() => {
    const controller = new AbortController();
    setEcoData(null);
    setEcoLoadError(null);
    setEcoLoading(true);

    async function loadEcosystemContributions() {
      try {
        const response = await fetch(
          `${ECO_CONTRIBUTION_API_BASE_URL}/api/public/client-contributions/${encodeURIComponent(site)}`,
          { cache: 'no-store', signal: controller.signal },
        );
        if (!response.ok) {
          throw new Error(`ECO contribution feed failed with HTTP ${response.status}.`);
        }
        const payload: unknown = await response.json();
        if (!isEcosystemContributionData(payload)) {
          throw new Error('ECO contribution data is invalid.');
        }
        setEcoData(payload);
      } catch (error) {
        if (controller.signal.aborted) return;
        setEcoLoadError(
          error instanceof Error ? error.message : 'ECO contributions could not be loaded.',
        );
      } finally {
        if (!controller.signal.aborted) setEcoLoading(false);
      }
    }

    void loadEcosystemContributions();
    return () => {
      controller.abort();
    };
  }, [site, refreshKey]);

  const sourceLabel = source === 'eco' ? 'ECO' : 'GitHub';
  const hasSyncError =
    source === 'github'
      ? Boolean(loadError)
      : Boolean(ecoLoadError || (!ecoLoading && !ecoData));
  const syncLabel = hasSyncError
    ? `${sourceLabel} sync failed`
    : source === 'github'
      ? data ? 'GitHub synced' : 'Syncing GitHub'
      : ecoData ? 'ECO synced' : 'Syncing ECO';

  return headerElement
    ? createPortal(
        <>
          <style>{`
        .eco-contribution-widget-shell { display: none !important; }
        @media (min-width: 1200px) {
          .eco-contribution-widget-shell {
            display: flex !important;
            order: 1;
            flex: 1 1 400px;
            min-width: 260px;
            max-width: 660px;
            height: 30px;
            margin: 0;
          }
          .eco-header > .header-side-right {
            order: 2;
            flex: 0 0 auto;
          }
          .eco-contribution-header {
            display: flex;
            align-items: center;
            gap: 0.4rem;
            width: 100%;
            height: 100%;
            padding: 0 0.4rem;
            overflow: hidden;
            border: 1px solid var(--border);
            border-radius: 0.55rem;
            background: var(--bg-raised, rgba(11, 13, 19, 0.94));
            color: var(--text);
            box-shadow: 0 0 8px var(--accent-glow, rgba(43, 159, 181, 0.2));
          }
          .eco-contribution-label {
            flex: 0 0 auto;
            font-size: 10px;
            font-weight: 700;
            white-space: nowrap;
          }
          .eco-contribution-source-toggle {
            display: flex;
            flex: 0 0 auto;
            align-items: center;
            gap: 1px;
            padding: 1px;
            border: 1px solid var(--border);
            border-radius: 0.3rem;
            background: rgba(255, 255, 255, 0.04);
          }
          .eco-contribution-source-button {
            padding: 0.22rem 0.35rem;
            border: 0;
            border-radius: 0.2rem;
            background: transparent;
            color: var(--text);
            font-size: 9px;
            font-weight: 700;
            line-height: 1;
            white-space: nowrap;
            cursor: pointer;
          }
          .eco-contribution-source-button[aria-pressed="true"] {
            background: var(--accent);
            color: var(--bg, #0b0d13);
          }
          .eco-contribution-source-button:focus-visible {
            outline: 2px solid var(--text);
            outline-offset: 1px;
          }
          .eco-contribution-days {
            display: grid;
            flex: 1;
            min-width: 0;
            grid-template-columns: repeat(7, minmax(0, 1fr));
            gap: 3px;
          }
          .eco-contribution-day {
            display: flex;
            min-width: 0;
            height: 22px;
            flex-direction: row;
            align-items: center;
            justify-content: center;
            gap: 3px;
            border: 1px solid var(--border);
            border-radius: 0.3rem;
            background: rgba(255, 255, 255, 0.04);
            line-height: 1;
            white-space: nowrap;
          }
          .eco-contribution-day-name { font-size: 8px; }
          .eco-contribution-day-count { font-size: 9px; font-weight: 700; }
          .eco-contribution-status {
            flex: 0 0 auto;
            display: inline-flex;
            align-items: center;
            padding: 0;
            border: 0;
            background: transparent;
            color: ${hasSyncError ? '#ff4d5e' : 'inherit'};
            cursor: pointer;
          }
          .eco-contribution-status:focus-visible {
            outline: 2px solid var(--text);
            outline-offset: 2px;
          }
        }
      `}</style>
          <div
            className="eco-contribution-widget-shell"
            onClick={(event) => event.stopPropagation()}
          >
            <div
              className="eco-contribution-header"
              aria-label={`Last contributions from ${sourceLabel} for ${repository}/${branch}`}
            >
              <span className="eco-contribution-label">Last contributions</span>
              <div
                className="eco-contribution-source-toggle"
                role="group"
                aria-label="Contribution source"
              >
                <button
                  type="button"
                  className="eco-contribution-source-button"
                  aria-pressed={source === 'eco'}
                  onClick={() => setSource('eco')}
                >
                  ECO
                </button>
                <button
                  type="button"
                  className="eco-contribution-source-button"
                  aria-pressed={source === 'github'}
                  onClick={() => setSource('github')}
                >
                  GitHub
                </button>
              </div>
              <div
                className="eco-contribution-days"
                aria-label={`Daily ${sourceLabel} contributions`}
              >
                {Array.from({ length: 7 }, (_, index) => {
                  const date = data?.days[index]?.date ?? ecoData?.days[index]?.date;
                  const ecoDay = ecoData?.days.find((day) => day.date === date);
                  const dayCount =
                    source === 'eco' ? ecoDay?.ecosystem : data?.days[index]?.count;
                  const dayName = date
                    ? new Intl.DateTimeFormat(undefined, {
                        weekday: 'short',
                        timeZone: 'UTC',
                      }).format(new Date(`${date}T00:00:00Z`))
                    : '—';
                  const count = dayCount === undefined ? '—' : String(dayCount);
                  const daySource = source === 'eco' ? 'ECO contributions' : 'GitHub commits';
                  return (
                    <span
                      className="eco-contribution-day"
                      key={date ?? index}
                      aria-label={
                        date ? `${dayName}: ${count} ${daySource}` : 'Contribution data unavailable'
                      }
                      title={
                        date ? `${dayName}: ${count} ${daySource}` : 'Contribution data unavailable'
                      }
                    >
                      <span className="eco-contribution-day-name">{dayName}</span>
                      <span className="eco-contribution-day-count">{count}</span>
                    </span>
                  );
                })}
              </div>
              <button
                type="button"
                className={`eco-contribution-status${hasSyncError ? ' has-sync-error' : ''}`}
                aria-label={`${syncLabel}. Click to refresh`}
                onClick={() => setRefreshKey((current) => current + 1)}
              >
                <RefreshCw size={13} aria-hidden="true" />
              </button>
            </div>
          </div>
        </>,
        headerElement,
      )
    : null;
}
