# Notepub Recipe Blog

A neutral template blog with hubs and linked articles.

## Quick start
1) In your repo Settings → Pages, set Source = GitHub Actions.
2) Edit or add Markdown in `content/`.
3) Push to `main`.

## Content source modes
The deploy workflow supports three content sources via repository variable `CONTENT_SOURCE`:

- `local` (default): use Markdown from this repo `content/`.
- `content_repo`: pull Markdown from external content repo before build.
- `s3`: read Markdown directly from S3-compatible storage.

You do not need to edit workflow YAML for mode switching.

### 1) local
No extra settings required.

### 2) content_repo
Required repository variables in site repo:

- `CONTENT_SOURCE=content_repo`
- `CONTENT_REPO=owner/repo`
- `CONTENT_REF=main` (optional, default `main`)

The workflow keeps only system `search.md` in site repo and syncs user content from external repo, so there is no duplicate `home` route conflict.

### 3) s3
Required repository variables:

- `CONTENT_SOURCE=s3`
- `S3_ENDPOINT`
- `S3_REGION`
- `S3_BUCKET`
- `S3_PREFIX` (optional, default `content`)
- `S3_USE_PATH_STYLE` (optional, default `true`)

Required repository secrets:

- `S3_ACCESS_KEY`
- `S3_SECRET_KEY`

For `local` and `content_repo`, `config.yaml` stays `content.source: local`.
For `s3`, workflow creates an effective S3 config at runtime.

## Base URL
`base_url` is auto-set in CI for GitHub Pages. Local `config.yaml` can stay at `http://127.0.0.1:8080/`.

## Build locally
Recommended pinned engine version: `v0.1.3`

Use the build script:

```bash
NOTEPUB_BIN=/path/to/notepub ./scripts/build.sh
```

Or with explicit config:

```bash
NOTEPUB_BIN=/path/to/notepub NOTEPUB_CONFIG=./config.yaml ./scripts/build.sh
```

## Content
Markdown usually lives in `content/` (for `local` mode). Each page needs frontmatter:

```yaml
---
type: article
slug: my-post
title: "My Post"
description: "Short summary."
hub: "notepub"
tags:
  - demo
---
```

## Theme
Templates and CSS live in `theme/`.

## Search
Search is SSR-friendly: `/search` renders without JS, while JS enhances autocomplete.

## SEO + LLM indexing

This recipe includes:

- Canonical URLs, robots, OpenGraph, Twitter tags in layout metadata.
- JSON-LD fallback (`WebSite`, `WebPage`, `BlogPosting`, breadcrumbs).
- `llms.txt` and `llms-full.txt` in `theme/assets/`.
- Build script that copies `llms*.txt` to site root and appends `LLM:` pointer to `robots.txt`.

Use the build script:

```bash
NOTEPUB_BIN=/path/to/notepub ./scripts/build.sh
```
