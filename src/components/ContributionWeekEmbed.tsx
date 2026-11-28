import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

type ContributionSource = 'ecosystem' | 'github';

interface ContributionDay {
  date: string;
  ecosystem: number;
  github: number;
}

interface ContributionWidgetData {
  type: 'eco-contribution-data';
  site: string;
  days: ContributionDay[];
  githubAvailable: boolean;
}

const CONTRIBUTION_ORIGIN = 'https://0661619230.com';

function isContributionWidgetData(value: unknown): value is ContributionWidgetData {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    candidate.type === 'eco-contribution-data' &&
    typeof candidate.site === 'string' &&
    typeof candidate.githubAvailable === 'boolean' &&
    Array.isArray(candidate.days) &&
    candidate.days.length === 7 &&
    candidate.days.every((day) => {
      if (typeof day !== 'object' || day === null) return false;
      const contribution = day as Record<string, unknown>;
      return (
        typeof contribution.date === 'string' &&
        typeof contribution.ecosystem === 'number' &&
        typeof contribution.github === 'number'
      );
    })
  );
}

export default function ContributionWeekEmbed({ site }: { site: string }) {
  const [source, setSource] = useState<ContributionSource>('ecosystem');
  const [data, setData] = useState<ContributionWidgetData | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [headerElement, setHeaderElement] = useState<HTMLElement | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    setHeaderElement(document.querySelector<HTMLElement>('.eco-header'));
  }, []);

  useEffect(() => {
    const frame = iframeRef.current;
    setData(null);
    setUnavailable(false);
    const timeout = window.setTimeout(() => setUnavailable(true), 8000);
    const handleMessage = (event: MessageEvent<unknown>) => {
      if (
        event.origin !== CONTRIBUTION_ORIGIN ||
        event.source !== frame?.contentWindow ||
        !isContributionWidgetData(event.data) ||
        event.data.site !== site
      ) {
        return;
      }
      setData(event.data);
      setUnavailable(false);
      window.clearTimeout(timeout);
    };

    window.addEventListener('message', handleMessage);
    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener('message', handleMessage);
    };
  }, [site, headerElement]);

  const status = !data
    ? unavailable
      ? 'Contribution service unavailable'
      : 'Loading contributions…'
    : source === 'github' && !data.githubAvailable
      ? 'GitHub not connected'
      : '';

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
          .eco-contribution-source-switch {
            display: flex;
            flex: 0 0 auto;
            gap: 2px;
          }
          .eco-contribution-source-switch button {
            padding: 0.2rem 0.35rem;
            border: 1px solid var(--border);
            border-radius: 0.3rem;
            background: transparent;
            color: inherit;
            font-size: 9px;
            font-weight: 700;
            cursor: pointer;
          }
          .eco-contribution-source-switch button[aria-pressed="true"] {
            background: var(--accent);
            color: var(--bg, #0b0d13);
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
          .eco-contribution-widget-frame {
            position: absolute;
            top: -2px;
            left: -2px;
            width: 1px;
            height: 1px;
            border: 0;
            opacity: 0;
            pointer-events: none;
          }
        }
        @media (min-width: 1200px) and (max-width: 1400px) {
          .eco-contribution-status { display: none; }
        }
      `}</style>
          <div
            className="eco-contribution-widget-shell"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="eco-contribution-header" aria-label="Last seven days of contributions">
              <span className="eco-contribution-label">Last 7 days</span>
              <div
                className="eco-contribution-source-switch"
                role="group"
                aria-label="Contribution source"
              >
                <button
                  type="button"
                  aria-pressed={source === 'ecosystem'}
                  onClick={() => setSource('ecosystem')}
                >
                  Eco
                </button>
                <button
                  type="button"
                  aria-pressed={source === 'github'}
                  onClick={() => setSource('github')}
                >
                  GitHub
                </button>
              </div>
              <div className="eco-contribution-days" aria-label="Daily contributions">
                {Array.from({ length: 7 }, (_, index) => {
                  const day = data?.days[index];
                  const dayName = day
                    ? new Intl.DateTimeFormat(undefined, {
                        weekday: 'short',
                        timeZone: 'UTC',
                      }).format(new Date(`${day.date}T00:00:00Z`))
                    : '—';
                  const count =
                    !day || (source === 'github' && !data.githubAvailable)
                      ? '—'
                      : String(day[source]);
                  return (
                    <span
                      className="eco-contribution-day"
                      key={day?.date ?? index}
                      aria-label={
                        day ? `${dayName}: ${count} contributions` : 'Contribution data unavailable'
                      }
                      title={
                        day ? `${dayName}: ${count} contributions` : 'Contribution data unavailable'
                      }
                    >
                      <span className="eco-contribution-day-name">{dayName}</span>
                      <span className="eco-contribution-day-count">{count}</span>
                    </span>
                  );
                })}
              </div>
              <span className="eco-contribution-status" role="status" aria-live="polite">
                {status}
              </span>
            </div>
            <iframe
              ref={iframeRef}
              className="eco-contribution-widget-frame"
              src={`https://0661619230.com/contribution-widget/${encodeURIComponent(site)}?compact=1`}
              title={`Contribution data provider for ${site}`}
              loading="eager"
              referrerPolicy="strict-origin-when-cross-origin"
              aria-hidden="true"
              tabIndex={-1}
            />
          </div>
        </>,
        headerElement,
      )
    : null;
}
