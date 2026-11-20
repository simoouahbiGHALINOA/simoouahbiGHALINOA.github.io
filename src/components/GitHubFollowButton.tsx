import { useEffect, useState } from 'react';
import { ArrowUpRight, Github } from 'lucide-react';
import {
  getProfileClickCount,
  isProfileClickTrackingConfigured,
  recordProfileClick,
} from '../lib/profileClicks';

const PROFILE_URL = 'https://github.com/simoouahbiGHALINOA';

export default function GitHubFollowButton() {
  const [clickCount, setClickCount] = useState<number | null>(null);
  const [trackingError, setTrackingError] = useState(false);
  const trackingConfigured = isProfileClickTrackingConfigured();

  useEffect(() => {
    if (!trackingConfigured) return;

    let active = true;
    getProfileClickCount()
      .then((count) => {
        if (active) setClickCount(count);
      })
      .catch((error: unknown) => {
        console.error('Unable to load GitHub profile click count.', error);
        if (active) setTrackingError(true);
      });

    return () => {
      active = false;
    };
  }, [trackingConfigured]);

  const handleClick = () => {
    if (!trackingConfigured) return;

    void recordProfileClick()
      .then((count) => {
        setClickCount((current) => current === null ? count : Math.max(current, count));
        setTrackingError(false);
      })
      .catch((error: unknown) => {
        console.error('Unable to record GitHub profile click.', error);
        setTrackingError(true);
      });
  };

  const status = !trackingConfigured
    ? 'Click counter is not configured yet; the GitHub profile link still works.'
    : trackingError
      ? 'Click counter is temporarily unavailable; the GitHub profile link still works.'
      : clickCount === null
        ? 'Loading anonymous profile-link clicks…'
        : `${clickCount.toLocaleString()} profile-link clicks; this is not a follower count.`;

  return (
    <div className="follow-action">
      <a
        className="secondary-button"
        href={PROFILE_URL}
        target="_blank"
        rel="noreferrer"
        onClick={handleClick}
      >
        <Github size={16} /> Follow on GitHub <ArrowUpRight size={15} />
      </a>
      <p className="follow-click-note" role={trackingError ? 'alert' : 'status'}>{status}</p>
    </div>
  );
}
