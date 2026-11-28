import { mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';

const configuredRepository = process.env.CONTRIBUTION_REPOSITORY?.trim();
const gitRepository = configuredRepository
  ? undefined
  : execFileSync('git', ['remote', 'get-url', 'origin'], { encoding: 'utf8' })
      .trim()
      .match(/github\.com[:/]([^/]+)\/([^/]+?)(?:\.git)?$/i);
if (!configuredRepository && !gitRepository) {
  throw new Error('Set CONTRIBUTION_REPOSITORY or configure a GitHub origin remote.');
}

const repository = configuredRepository || `${gitRepository[1]}/${gitRepository[2]}`;
const username = process.env.GITHUB_USERNAME?.trim() || repository.split('/')[0];
const site = process.env.CONTRIBUTION_SITE?.trim() || username.toLowerCase();
const branch =
  process.env.CONTRIBUTION_BRANCH?.trim() ||
  execFileSync('git', ['branch', '--show-current'], { encoding: 'utf8' }).trim();

if (!username || !/^[a-z\d-]+$/i.test(username)) {
  throw new Error('Set GITHUB_USERNAME to the target GitHub account.');
}
if (!site || !/^[a-z0-9-]+$/.test(site)) {
  throw new Error('Set CONTRIBUTION_SITE to the client site ID.');
}
if (!repository || !/^[\w.-]+\/[\w.-]+$/.test(repository)) {
  throw new Error('Set CONTRIBUTION_REPOSITORY to the owner/repository to count.');
}
if (!branch) {
  throw new Error('Set CONTRIBUTION_BRANCH to the branch to count.');
}

const now = new Date();
const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
const dates = Array.from({ length: 7 }, (_, index) => {
  const date = new Date(today);
  date.setUTCDate(today.getUTCDate() - (6 - index));
  return date.toISOString().slice(0, 10);
});
const from = `${dates[0]}T00:00:00Z`;

const contributionCounts = new Map(dates.map((date) => [date, 0]));
const headers = {
  accept: 'application/vnd.github+json',
  'user-agent': 'github-repository-commit-feed',
};
const token = process.env.GITHUB_TOKEN?.trim() || process.env.GITHUB_PAT?.trim();
if (token) headers.authorization = `Bearer ${token}`;

for (let page = 1; ; page += 1) {
  const url = new URL(`https://api.github.com/repos/${repository}/commits`);
  url.searchParams.set('sha', branch);
  url.searchParams.set('since', from);
  url.searchParams.set('until', now.toISOString());
  url.searchParams.set('per_page', '100');
  url.searchParams.set('page', String(page));

  const response = await fetch(url, {
    headers,
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    throw new Error(`GitHub commit request failed with HTTP ${response.status}.`);
  }

  const commits = await response.json();
  if (!Array.isArray(commits)) {
    throw new Error('GitHub returned an invalid commit list.');
  }

  for (const commit of commits) {
    const authorDate = commit?.commit?.author?.date;
    if (typeof authorDate !== 'string' || Number.isNaN(Date.parse(authorDate))) {
      throw new Error('GitHub returned a commit with an invalid author date.');
    }
    const date = authorDate.slice(0, 10);
    if (!contributionCounts.has(date)) continue;
    contributionCounts.set(date, contributionCounts.get(date) + 1);
  }

  if (commits.length < 100) break;
}

const days = dates.map((date) => ({ date, count: contributionCounts.get(date) }));

const outputPath = resolve(
  process.env.GITHUB_CONTRIBUTION_OUTPUT_PATH ?? 'public/github-contributions.json',
);
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(
  outputPath,
  `${JSON.stringify({ site, username, repository, branch, generatedAt: now.toISOString(), days }, null, 2)}\n`,
);
console.log(`Wrote commit feed for ${repository}@${branch} to ${outputPath}.`);
