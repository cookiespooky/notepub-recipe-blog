# Notepub Recipe Blog

Нейтральный шаблон блога на Notepub: хабы + связанные статьи.

## Быстрый старт

1. В настройках репозитория откройте `Settings -> Pages` и выберите `Source = GitHub Actions`.
2. Добавьте или измените Markdown в `content/`.
3. Сделайте push в `main`.

## Режимы источника контента

Workflow деплоя поддерживает три источника через переменную репозитория `CONTENT_SOURCE`:

- `local` (по умолчанию): контент из `content/` этого репозитория
- `content_repo`: контент подтягивается из внешнего репозитория
- `s3`: контент читается из S3-совместимого хранилища

Переключение режима делается через переменные, без правки YAML workflow.

### 1) local

Ничего дополнительно настраивать не нужно.

### 2) content_repo

Нужные variables в сайт-репозитории:

- `CONTENT_SOURCE=content_repo`
- `CONTENT_REPO=owner/repo`
- `CONTENT_REF=main` (опционально, по умолчанию `main`)

Workflow сохраняет только системный `search.md` в сайт-репозитории и синхронизирует пользовательский контент из внешнего репозитория, чтобы не было конфликтов маршрутов `home`.

### 3) s3

Нужные variables:

- `CONTENT_SOURCE=s3`
- `S3_ENDPOINT`
- `S3_REGION`
- `S3_BUCKET`
- `S3_PREFIX` (опционально, по умолчанию `content`)
- `S3_USE_PATH_STYLE` (опционально, по умолчанию `true`)

Нужные secrets:

- `S3_ACCESS_KEY`
- `S3_SECRET_KEY`

Для `local` и `content_repo` в `config.yaml` оставляем `content.source: local`.
Для `s3` workflow генерирует эффективный S3-конфиг на лету.

## Base URL и медиа

- `base_url` в CI выставляется автоматически под GitHub Pages.
- Локально можно оставить `http://127.0.0.1:8080/`.
- `media_base_url` нужен для корректных ссылок на `/media/*` в статическом хостинге.

## Локальная сборка

Рекомендуемая фиксированная версия движка: `v0.1.3`

```bash
NOTEPUB_BIN=/path/to/notepub ./scripts/build.sh
```

или с явным конфигом:

```bash
NOTEPUB_BIN=/path/to/notepub NOTEPUB_CONFIG=./config.yaml ./scripts/build.sh
```

## Контент

Обычно Markdown лежит в `content/` (режим `local`). Пример frontmatter:

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

## Тема и поиск

- Шаблоны и стили: `theme/`
- Поиск: SSR-страница `/search` + JS-автокомплит

## SEO и LLM-индексация

В шаблон включены:

- canonical, robots, OpenGraph, Twitter tags
- JSON-LD fallback (`WebSite`, `WebPage`, `BlogPosting`, breadcrumbs)
- `llms.txt` и `llms-full.txt` в `theme/assets/`
- в build-скрипте копирование `llms*.txt` в корень `dist/` и добавление `LLM:` в `robots.txt`
