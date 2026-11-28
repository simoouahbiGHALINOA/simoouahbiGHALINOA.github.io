import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const username = process.env.GITHUB_USERNAME?.trim();
const site = process.env.CONTRIBUTION_SITE?.trim();
const token = process.env.GITHUB_TOKEN?.trim() || process.env.GITHUB_PAT?.trim();

if (!username || !/^[a-z\d-]+$/i.test(username)) {
  throw new Error('Set GITHUB_USERNAME to the target GitHub account.');
}
if (!site || !/^[a-z0-9-]+$/.test(site)) {
  throw new Error('Set CONTRIBUTION_SITE to the client site ID.');
}
if (!token) {
  throw new Error('Set GITHUB_TOKEN or GITHUB_PAT in the GitHub Actions environment.');
}

const now = new Date();
const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
const dates = Array.from({ length: 7 }, (_, index) => {
  const date = new Date(today);
  date.setUTCDate(today.getUTCDate() - (6 - index));
  return date.toISOString().slice(0, 10);
});
const from = `${dates[0]}T00:00:00Z`;

const response = await fetch('https://api.github.com/graphql', {
  method: 'POST',
  headers: {
    authorization: `Bearer ${token}`,
    accept: 'application/vnd.github+json',
    'content-type': 'application/json',
    'user-agent': 'github-contribution-feed',
  },
  body: JSON.stringify({
    query: `query ContributionWeek($login: String!, $from: DateTime!, $to: DateTime!) {
      user(login: $login) {
        login
        contributionsCollection(from: $from, to: $to) {
          contributionCalendar {
            weeks {
              contributionDays {
                date
                contributionCount
              }
            }
          }
        }
      }
    }`,
    variables: { login: username, from, to: now.toISOString() },
  }),
  signal: AbortSignal.timeout(30_000),
});

if (!response.ok) {
  throw new Error(`GitHub contribution request failed with HTTP ${response.status}.`);
}

const result = await response.json();
if (result.errors?.length) {
  throw new Error(
    `GitHub could not return contribution activity: ${result.errors
      .map((error) => error.message)
      .join('; ')}`,
  );
}

const user = result.data?.user;
const weeks = user?.contributionsCollection?.contributionCalendar?.weeks;
if (!user || !Array.isArray(weeks)) {
  throw new Error(`GitHub returned no contribution calendar for @${username}.`);
}

const contributionCounts = new Map();
for (const week of weeks) {
  if (!Array.isArray(week.contributionDays)) {
    throw new Error('GitHub returned an invalid contribution calendar.');
  }
  for (const day of week.contributionDays) {
    if (
      typeof day.date !== 'string' ||
      !Number.isInteger(day.contributionCount) ||
      day.contributionCount < 0
    ) {
      throw new Error('GitHub returned an invalid contribution day.');
    }
    contributionCounts.set(day.date, day.contributionCount);
  }
}

const days = dates.map((date) => {
  const count = contributionCounts.get(date);
  if (count === undefined) {
    throw new Error(`GitHub omitted contribution data for ${date}.`);
  }
  return { date, count };
});

const outputPath = resolve(
  process.env.GITHUB_CONTRIBUTION_OUTPUT_PATH ?? 'public/github-contributions.json',
);
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(
  outputPath,
  `${JSON.stringify({ site, username: user.login, generatedAt: now.toISOString(), days }, null, 2)}\n`,
);
console.log(`Wrote GitHub contribution feed for @${user.login} to ${outputPath}.`);
