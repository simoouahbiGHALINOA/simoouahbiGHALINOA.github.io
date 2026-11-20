// SPDX-License-Identifier: MIT

import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoots = ['src', 'starters', 'api'];
const languages = [
  { name: 'Rust', extensions: ['.rs'], extensionLabel: '.rs', starterDirectory: 'starters/rust' },
  { name: 'Go', extensions: ['.go'], extensionLabel: '.go', starterDirectory: 'starters/go' },
  { name: 'Python', extensions: ['.py'], extensionLabel: '.py', starterDirectory: 'starters/python' },
  { name: 'TypeScript', extensions: ['.ts', '.tsx'], extensionLabel: '.ts, .tsx', starterDirectory: 'starters/typescript' },
  { name: 'JavaScript', extensions: ['.js', '.mjs', '.cjs'], extensionLabel: '.js, .mjs, .cjs', starterDirectory: 'starters/javascript' },
  { name: 'SQL', extensions: ['.sql'], extensionLabel: '.sql', starterDirectory: 'starters/sql' },
  { name: 'CSS', extensions: ['.css'], extensionLabel: '.css', starterDirectory: 'starters/css' },
  { name: 'HTML', extensions: ['.html', '.htm'], extensionLabel: '.html, .htm', starterDirectory: 'starters/html' },
];

const extensions = new Map(
  languages.flatMap((language) => language.extensions.map((extension) => [extension, language.name])),
);
const totals = new Map(languages.map((language) => [language.name, { bytes: 0, fileCount: 0 }]));

async function collectSourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    if (
      entry.name.startsWith('.')
      || entry.name === 'node_modules'
      || entry.name === 'dist'
      || entry.name === 'generated'
      || entry.name === 'target'
    ) {
      continue;
    }

    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await collectSourceFiles(fullPath);
      continue;
    }
    if (!entry.isFile()) continue;

    const language = extensions.get(path.extname(entry.name).toLowerCase());
    if (!language) continue;

    const size = (await stat(fullPath)).size;
    const total = totals.get(language);
    total.bytes += size;
    total.fileCount += 1;
  }
}

for (const sourceRoot of sourceRoots) {
  await collectSourceFiles(path.join(projectRoot, sourceRoot));
}

const totalSourceBytes = [...totals.values()].reduce((sum, total) => sum + total.bytes, 0);
if (totalSourceBytes === 0) {
  throw new Error('No supported source files were found for language metrics.');
}

const exactTenths = languages.map((language) => {
  const total = totals.get(language.name);
  return {
    name: language.name,
    tenths: (total.bytes / totalSourceBytes) * 1000,
  };
});
const actualTenths = new Map(exactTenths.map(({ name, tenths }) => [name, Math.floor(tenths)]));
const remainingTenths = 1000 - [...actualTenths.values()].reduce((sum, tenths) => sum + tenths, 0);
const largestRemainders = [...exactTenths].sort((first, second) => {
  return (second.tenths - Math.floor(second.tenths)) - (first.tenths - Math.floor(first.tenths));
});
for (const { name } of largestRemainders.slice(0, remainingTenths)) {
  actualTenths.set(name, actualTenths.get(name) + 1);
}

const metrics = {
  method: 'first-party source file bytes',
  totalSourceBytes,
  languages: languages.map((language) => {
    const total = totals.get(language.name);
    return {
      name: language.name,
      extension: language.extensionLabel,
      starterDirectory: language.starterDirectory,
      fileCount: total.fileCount,
      sourceBytes: total.bytes,
      actualPercent: actualTenths.get(language.name) / 10,
      equalPercent: Number((100 / languages.length).toFixed(1)),
    };
  }),
};

const outputPath = path.join(projectRoot, 'public', 'language-metrics.json');
await writeFile(outputPath, `${JSON.stringify(metrics, null, 2)}\n`, 'utf8');

const icons = {
  Rust: '🦀',
  Go: '🐹',
  Python: '🐍',
  TypeScript: '🔷',
  JavaScript: '⚡',
  SQL: '🗃️',
  CSS: '🎨',
  HTML: '🌐',
};
const table = [
  '| Language | Equal starter share | Measured source share | Files | File types | Starter |',
  '|----------|---------------------|-----------------------|-------|------------|---------|',
  ...metrics.languages.map((language) => {
    const starterLink = `./${language.starterDirectory}/README.md`;
    return `| ${icons[language.name]} ${language.name} | ${language.equalPercent.toFixed(1)}% | ${language.actualPercent.toFixed(1)}% | ${language.fileCount} | \`${language.extension}\` | [Open](${starterLink}) |`;
  }),
];
const readmePath = path.join(projectRoot, 'README.md');
const readme = await readFile(readmePath, 'utf8');
const startMarker = '<!-- language-metrics:start -->';
const endMarker = '<!-- language-metrics:end -->';
const start = readme.indexOf(startMarker);
const contentStart = start + startMarker.length;
const end = readme.indexOf(endMarker, contentStart);
if (start < 0 || end < 0) {
  throw new Error('README language-metrics markers are missing.');
}

const generatedTable = `${startMarker}\n${table.join('\n')}\n${endMarker}`;
const updatedReadme = `${readme.slice(0, start)}${generatedTable}${readme.slice(end + endMarker.length)}`;
if (updatedReadme !== readme) await writeFile(readmePath, updatedReadme, 'utf8');

console.log(`Generated source-language metrics for ${languages.length} languages at ${path.relative(projectRoot, outputPath)}.`);
