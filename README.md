# Notepub Blog Recipe

A minimal blog template for Notepub. Add Markdown, push to `main`, and GitHub Pages publishes your site.

## Quick start
1) In your repo Settings → Pages, set Source = GitHub Actions.
2) Open `config.yaml` and replace `https://USERNAME.github.io/REPO/` with your real Pages URL (must end with `/`).
3) Edit or add posts in `content/`.
4) Push to `main`.

## Content
Markdown lives in `content/`. Each post needs frontmatter:

```yaml
---
type: post
slug: my-post
title: "My Post"
description: "Short summary."
date: 2026-02-06
tags:
  - notepub
  - blog
---
```

## Theme
HTML templates and CSS live in `theme/`.

## Deploy
On every push to `main`, the workflow downloads a pinned Notepub binary, runs `validate` + `build`, and deploys `dist/` to GitHub Pages.
