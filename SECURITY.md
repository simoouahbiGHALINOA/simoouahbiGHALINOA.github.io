# Security policy

## Scope

This repository builds a static GitHub Pages site. It has no application server,
account system, sign-in flow, or private cloud storage.

The music player stores visitor-added files in the browser's IndexedDB and saved
audio URLs and playback position in that browser's local storage. This data is
not uploaded by this site, is not encrypted by the site, and is not synchronized
between devices. A saved audio URL is not loaded until the visitor chooses to
play it, at which point the browser contacts that audio host.

## Reporting a vulnerability

Please do not publish details of an unpatched security issue in a public issue.
Use GitHub's private vulnerability reporting for this repository if it is
available. Otherwise, contact the maintainer through the GitHub profile:
<https://github.com/simoouahbiGHALINOA>.

Include the affected URL or file, the impact, and steps to reproduce. Avoid
including real credentials, private audio links, or other personal data.

## Safe use

- Do not put passwords, access tokens, or sensitive signed URLs in a playlist.
- Clear this site's browser storage to remove locally saved music and settings.
- Only add or publish audio that you own or are authorized to use.
