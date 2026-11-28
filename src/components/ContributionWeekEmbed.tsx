import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

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
  }, [site, repository, branch]);

  const status = data ? '' : (loadError ?? 'Loading GitHub contributions…');

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
            height: var(--header-total-height, 40px);
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
          .eco-contribution-provider {
            flex: 0 0 auto;
            padding: 0.2rem 0.35rem;
            border: 1px solid var(--border);
            border-radius: 0.3rem;
            background: var(--accent);
            color: var(--bg, #0b0d13);
            font-size: 9px;
            font-weight: 700;
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
            height: 28px;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 2px;
            border: 1px solid var(--border);
            border-radius: 0.3rem;
            background: rgba(255, 255, 255, 0.04);
            line-height: 1;
          }
          .eco-contribution-day-name { font-size: 7px; }
          .eco-contribution-day-count { font-size: 10px; font-weight: 700; }
          .eco-contribution-status {
            flex: 0 0 auto;
            max-width: 100px;
            overflow: hidden;
            font-size: 9px;
            text-overflow: ellipsis;
            white-space: nowrap;
          }
        }
      `}</style>
          <div
            className="eco-contribution-widget-shell"
            onClick={(event) => event.stopPropagation()}
          >
            <div
              className="eco-contribution-header"
              aria-label={`Last 7 days of commits to ${repository}/${branch}`}
            >
              <span className="eco-contribution-label">Repo commits</span>
              <span className="eco-contribution-provider">GitHub</span>
              <div className="eco-contribution-days" aria-label="Daily repository commits">
                {Array.from({ length: 7 }, (_, index) => {
                  const day = data?.days[index];
                  const dayName = day
                    ? new Intl.DateTimeFormat(undefined, {
                        weekday: 'short',
                        timeZone: 'UTC',
                      }).format(new Date(`${day.date}T00:00:00Z`))
                    : '—';
                  const count = day ? String(day.count) : '—';
                  return (
                    <span
                      className="eco-contribution-day"
                      key={day?.date ?? index}
                      aria-label={
                        day ? `${dayName}: ${count} commits` : 'Commit data unavailable'
                      }
                      title={
                        day ? `${dayName}: ${count} commits` : 'Commit data unavailable'
                      }
                    >
                      <span className="eco-contribution-day-name">{dayName}</span>
                      <span className="eco-contribution-day-count">{count}</span>
                    </span>
                  );
                })}
              </div>
              <span
                className="eco-contribution-status"
                role="status"
                aria-live="polite"
                title={status}
              >
                {status}
              </span>
            </div>
          </div>
        </>,
        headerElement,
      )
    : null;
}
