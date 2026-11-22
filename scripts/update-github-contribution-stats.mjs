const username = process.env.GITHUB_USERNAME || 'simoouahbiGHALINOA';
const outputPath = process.env.GITHUB_OUTPUT_PATH
  ? new URL(process.env.GITHUB_OUTPUT_PATH, import.meta.url)
  : new URL('../docs/assets/github-contribution-stats.svg', import.meta.url);

const token = process.env.GITHUB_PAT || process.env.GITHUB_TOKEN;
if (!token) {
  throw new Error('Set GITHUB_PAT or GITHUB_TOKEN before updating contribution stats.');
}

async function githubRequest(query, variables = {}) {
  const response = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      accept: 'application/vnd.github+json',
      'content-type': 'application/json',
      'user-agent': 'eco-github-contribution-stats',
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new Error(`GitHub GraphQL request failed with HTTP ${response.status}`);
  }

  const result = await response.json();
  if (result.errors?.length) {
    throw new Error(result.errors.map((error) => error.message).join('; '));
  }
  return result.data;
}

async function getAccountCreatedYear() {
  const response = await fetch(`https://api.github.com/users/${username}`, {
    headers: {
      authorization: `Bearer ${token}`,
      accept: 'application/vnd.github+json',
      'user-agent': 'eco-github-contribution-stats',
    },
  });
  if (!response.ok) {
    throw new Error(`GitHub account lookup failed with HTTP ${response.status}`);
  }
  const profile = await response.json();
  return new Date(profile.created_at).getUTCFullYear();
}

function yearRange(year, now) {
  return {
    from: `${year}-01-01T00:00:00Z`,
    to: year === now.getUTCFullYear()
      ? now.toISOString()
      : `${year + 1}-01-01T00:00:00Z`,
  };
}

async function getContributionYear(year, now) {
  const data = await githubRequest(
    `query ContributionYear($login: String!, $from: DateTime!, $to: DateTime!) {
      user(login: $login) {
        contributionsCollection(from: $from, to: $to) {
          totalCommitContributions
          totalPullRequestContributions
          totalIssueContributions
          totalRepositoriesWithContributedCommits
          contributionCalendar {
            totalContributions
            weeks {
              contributionDays {
                date
                contributionCount
                weekday
              }
            }
          }
        }
      }
    }`,
    { login: username, ...yearRange(year, now) },
  );
  return data?.user?.contributionsCollection;
}

function escapeXml(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function formatNumber(value) {
  return value.toLocaleString('en-US');
}

function activityColor(count) {
  if (count <= 0) return '#18243b';
  if (count <= 2) return '#164e63';
  if (count <= 5) return '#0e7490';
  if (count <= 10) return '#0891b2';
  if (count <= 20) return '#22c55e';
  return '#84cc16';
}

const now = new Date();
const currentYear = now.getUTCFullYear();
const createdYear = await getAccountCreatedYear();
const yearCollections = [];
let allTimeContributions = 0;
let allTimeCommits = 0;

for (let year = createdYear; year <= currentYear; year += 1) {
  const collection = await getContributionYear(year, now);
  if (!collection) throw new Error(`Contribution data is unavailable for ${year}`);
  yearCollections.push(collection);
  allTimeContributions += collection.contributionCalendar.totalContributions;
  allTimeCommits += collection.totalCommitContributions;
}

const currentCollection = yearCollections.at(-1);
const calendar = currentCollection.contributionCalendar;
const totalContributions = calendar.totalContributions;
const totalCommits = currentCollection.totalCommitContributions;
const totalPullRequests = currentCollection.totalPullRequestContributions;
const totalIssues = currentCollection.totalIssueContributions;
const totalRepositories = currentCollection.totalRepositoriesWithContributedCommits;

const daysByDate = new Map();
for (const week of calendar.weeks) {
  for (const day of week.contributionDays) {
    daysByDate.set(day.date, day);
  }
}

const days = [...daysByDate.values()].sort((a, b) => a.date.localeCompare(b.date));
const bestDay = days.reduce(
  (best, day) => (!best || day.contributionCount > best.contributionCount ? day : best),
  null,
);

let currentStreak = 0;
let longestStreak = 0;
let run = 0;
for (const day of days) {
  if (day.contributionCount > 0) {
    run += 1;
    longestStreak = Math.max(longestStreak, run);
  } else {
    run = 0;
  }
}
for (let index = days.length - 1; index >= 0; index -= 1) {
  if (days[index].contributionCount > 0) currentStreak += 1;
  else if (currentStreak > 0) break;
}

const monthPositions = new Map();
for (const week of calendar.weeks) {
  for (const day of week.contributionDays) {
    const date = new Date(`${day.date}T00:00:00Z`);
    if (date.getUTCFullYear() !== currentYear) continue;
    const month = date.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
    const weekIndex = calendar.weeks.indexOf(week);
    if (!monthPositions.has(month)) monthPositions.set(month, weekIndex);
  }
}

const startDate = new Date(`${currentYear}-01-01T00:00:00Z`);
const startWeekday = startDate.getUTCDay();
const allCalendarDates = [];
for (let index = 0; index < calendar.weeks.length; index += 1) {
  allCalendarDates[index] = calendar.weeks[index]?.contributionDays ?? [];
}

const gridX = 100;
const gridY = 315;
const cell = 17;
const gap = 4;
const step = cell + gap;
const gridParts = [];

for (let weekIndex = 0; weekIndex < allCalendarDates.length; weekIndex += 1) {
  for (const day of allCalendarDates[weekIndex]) {
    const date = new Date(`${day.date}T00:00:00Z`);
    if (date.getUTCFullYear() !== currentYear) continue;
    const weekday = date.getUTCDay();
    const x = gridX + weekIndex * step;
    const y = gridY + weekday * step;
    gridParts.push(
      `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" rx="3" fill="${activityColor(day.contributionCount)}"><title>${escapeXml(day.date)}: ${day.contributionCount} contribution${day.contributionCount === 1 ? '' : 's'}</title></rect>`,
    );
  }
}

const monthLabels = [...monthPositions.entries()].map(([month, weekIndex]) =>
  `<text x="${gridX + weekIndex * step}" y="292" fill="#9fb0ca" font-family="system-ui,sans-serif" font-size="14">${month}</text>`,
).join('');

const weekdayLabels = [
  [1, 'Mon'],
  [3, 'Wed'],
  [5, 'Fri'],
].map(([weekday, label]) =>
  `<text x="42" y="${gridY + weekday * step + 13}" fill="#9fb0ca" font-family="system-ui,sans-serif" font-size="13">${label}</text>`,
).join('');

const bestDayLabel = bestDay
  ? new Date(`${bestDay.date}T00:00:00Z`).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
  : 'No activity';

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="650" viewBox="0 0 1200 650" role="img" aria-labelledby="title desc">
  <title id="title">${escapeXml(username)} GitHub contribution activity</title>
  <desc id="desc">${formatNumber(totalContributions)} contributions in ${currentYear}; ${formatNumber(totalCommits)} commits; ${formatNumber(allTimeContributions)} all-time contributions.</desc>
  <defs>
    <linearGradient id="background" x1="0" y1="0" x2="1" y2="1">
      <stop stop-color="#07111f"/>
      <stop offset=".55" stop-color="#0d1a2d"/>
      <stop offset="1" stop-color="#111827"/>
    </linearGradient>
    <linearGradient id="cyan" x1="0" y1="0" x2="1" y2="1">
      <stop stop-color="#22d3ee"/>
      <stop offset="1" stop-color="#3b82f6"/>
    </linearGradient>
  </defs>

  <rect width="1200" height="650" rx="24" fill="url(#background)" stroke="#1d4ed8" stroke-opacity=".58" stroke-width="2"/>

  <g>
    <rect x="30" y="30" width="352" height="145" rx="18" fill="#111c2e" stroke="#334155"/>
    <rect x="424" y="30" width="352" height="145" rx="18" fill="#111c2e" stroke="#334155"/>
    <rect x="818" y="30" width="352" height="145" rx="18" fill="#111c2e" stroke="#334155"/>

    <rect x="54" y="54" width="58" height="58" rx="13" fill="#10233a" stroke="#22d3ee" stroke-opacity=".75"/>
    <path d="M66 84h7l7-15 9 31 8-24 6 8h9" fill="none" stroke="#38bdf8" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
    <text x="128" y="82" fill="#f8fafc" font-family="system-ui,sans-serif" font-size="38" font-weight="800">${formatNumber(totalContributions)}</text>
    <text x="128" y="112" fill="#9fb0ca" font-family="system-ui,sans-serif" font-size="16">${currentYear} contributions</text>

    <rect x="448" y="54" width="58" height="58" rx="13" fill="#102b2b" stroke="#34d399" stroke-opacity=".75"/>
    <path d="M470 92c-18-15-2-29 12-20-4-18 22-19 22-2 0 10-12 22-34 22zm0 0c9-7 19-12 30-17" fill="none" stroke="#34d399" stroke-width="3" stroke-linecap="round"/>
    <text x="522" y="82" fill="#f8fafc" font-family="system-ui,sans-serif" font-size="38" font-weight="800">${formatNumber(totalCommits)}</text>
    <text x="522" y="112" fill="#9fb0ca" font-family="system-ui,sans-serif" font-size="16">GitHub commits</text>

    <rect x="842" y="54" width="58" height="58" rx="13" fill="#2a2140" stroke="#a3e635" stroke-opacity=".75"/>
    <path d="M871 67l5 10 11 5-11 5-5 11-5-11-11-5 11-5z" fill="none" stroke="#fde047" stroke-width="3" stroke-linejoin="round"/>
    <text x="916" y="82" fill="#f8fafc" font-family="system-ui,sans-serif" font-size="38" font-weight="800">${formatNumber(allTimeContributions)}</text>
    <text x="916" y="112" fill="#9fb0ca" font-family="system-ui,sans-serif" font-size="16">all-time contributions</text>
  </g>

  <rect x="30" y="195" width="1140" height="425" rx="20" fill="#0b1729" stroke="#1e3a5f"/>
  <text x="58" y="242" fill="#f8fafc" font-family="system-ui,sans-serif" font-size="26" font-weight="800">Contribution activity</text>
  <text x="58" y="268" fill="#9fb0ca" font-family="system-ui,sans-serif" font-size="16">January - December ${currentYear}</text>

  <rect x="1030" y="220" width="112" height="40" rx="8" fill="#17243a" stroke="#334155"/>
  <text x="1050" y="246" fill="#dbeafe" font-family="system-ui,sans-serif" font-size="15">${currentYear}</text>

  ${monthLabels}
  ${weekdayLabels}
  ${gridParts.join('\n')}

  <text x="100" y="520" fill="#9fb0ca" font-family="system-ui,sans-serif" font-size="14">Less</text>
  ${[0, 2, 5, 10, 20].map((count, index) => `<rect x="${145 + index * 23}" y="508" width="17" height="17" rx="3" fill="${activityColor(count)}"/>`).join('')}
  <text x="266" y="520" fill="#9fb0ca" font-family="system-ui,sans-serif" font-size="14">More</text>
  <text x="100" y="570" fill="#9fb0ca" font-family="system-ui,sans-serif" font-size="15">Best day</text>
  <text x="100" y="596" fill="#e2e8f0" font-family="system-ui,sans-serif" font-size="14">${escapeXml(bestDayLabel)} · ${formatNumber(bestDay?.contributionCount ?? 0)} activities</text>
  <text x="510" y="570" fill="#9fb0ca" font-family="system-ui,sans-serif" font-size="15">Current streak</text>
  <text x="510" y="596" fill="#34d399" font-family="system-ui,sans-serif" font-size="20" font-weight="800">${currentStreak} days</text>
  <text x="730" y="570" fill="#9fb0ca" font-family="system-ui,sans-serif" font-size="15">Longest streak</text>
  <text x="730" y="596" fill="#84cc16" font-family="system-ui,sans-serif" font-size="20" font-weight="800">${longestStreak} days</text>
  <text x="948" y="570" fill="#9fb0ca" font-family="system-ui,sans-serif" font-size="15">Activity breakdown</text>
  <text x="948" y="596" fill="#cbd5e1" font-family="system-ui,sans-serif" font-size="13">${formatNumber(totalPullRequests)} PR · ${formatNumber(totalIssues)} issues · ${formatNumber(totalRepositories)} repos</text>
</svg>
`;

await import('node:fs/promises').then(({ writeFile }) => writeFile(outputPath, svg));
