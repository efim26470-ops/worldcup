# World Cup 26 Live Center

Адаптивный PWA-сайт в стиле Apple Sports / Liquid Glass для расписания, live-счёта, таблиц и статистики чемпионата мира 2026.

## Что уже работает

- адаптивный интерфейс для Windows, macOS, iPhone и Android;
- светлая, тёмная и системная темы;
- автоматический выбор матчей по локальной дате пользователя;
- календарь матчей, live-карточки, результаты и избранное;
- групповые таблицы, бомбардиры, ассисты и оценки;
- матч-центр: события, статистика, составы и личные встречи;
- PWA: manifest, Service Worker, офлайн-оболочка, Apple Touch Icon;
- готовый Cloudflare Worker для безопасного подключения Sportmonks API;
- автоматический деплой на GitHub Pages через GitHub Actions.

По умолчанию включён **демо-режим**, поэтому сайт открывается и работает сразу, без ключей.

## Быстрый запуск локально

Нельзя открывать `index.html` двойным кликом: Service Worker требует HTTP/HTTPS.

```bash
python -m http.server 8080
```

После этого откройте `http://localhost:8080`.

## Публикация на GitHub Pages

1. Создайте репозиторий и загрузите все файлы из этой папки в корень.
2. Откройте **Settings → Pages**.
3. В **Build and deployment → Source** выберите **GitHub Actions**.
4. Сделайте push в ветку `main`.
5. Workflow `.github/workflows/pages.yml` автоматически опубликует сайт.

Можно также выбрать публикацию из ветки `main / root`, так как сайт не требует сборки.

## Иконка на iPhone

1. Откройте опубликованный сайт именно в Safari.
2. Нажмите **Поделиться**.
3. Выберите **На экран «Домой»**.
4. Подтвердите название и нажмите **Добавить**.

Файл `assets/icons/apple-touch-icon.png` уже подключён. После замены иконки iOS иногда хранит старую версию: удалите ярлык и добавьте сайт заново.

## Подключение live-данных

GitHub Pages является статическим хостингом. API-ключ нельзя записывать в `config.js`: любой посетитель сможет увидеть его в DevTools. Поэтому интерфейс остаётся на GitHub Pages, а запросы выполняет Cloudflare Worker.

### 1. Получите доступ к данным

Worker настроен под Sportmonks Football API v3 и турнир с League ID `732`.

### 2. Разверните Worker

```bash
cd worker
npm install
npx wrangler login
npm run secret
npm run deploy
```

Команда `npm run secret` попросит вставить `SPORTMONKS_TOKEN`. Ключ сохраняется как секрет Cloudflare и не попадает в GitHub.

Для ограничения доступа измените в `worker/wrangler.toml`:

```toml
[vars]
ALLOWED_ORIGINS = "https://USERNAME.github.io"
```

Для project page лучше указать точный origin без пути, например `https://USERNAME.github.io`.

### 3. Переключите фронтенд в live-режим

В `config.js`:

```js
window.WC26_CONFIG = Object.freeze({
  mode: "live",
  apiBaseUrl: "https://wc26-live-api.YOUR-SUBDOMAIN.workers.dev",
  refreshIntervalMs: 15000,
  requestTimeoutMs: 9000,
  locale: "ru-RU",
  tournamentName: "World Cup 26",
  tournamentTimeZone: "America/New_York"
});
```

После push сайт начнёт получать:

- все матчи турнира;
- live-счёт и состояние матча;
- текущие групповые таблицы;
- бомбардиров и ассистентов;
- события, составы и командную статистику выбранного матча.

## Структура

```text
index.html                 интерфейс
styles.css                 Liquid Glass и адаптивность
app.js                     навигация, календарь, рендеринг, PWA
config.js                  режим и адрес API
 demo-data.js              демонстрационные данные
manifest.webmanifest       настройки установленного приложения
service-worker.js          офлайн-кэш
assets/icons/              иконки PWA и iOS
worker/                    безопасный API-proxy
.github/workflows/pages.yml автоматический деплой Pages
```

## Настройка дизайна

Основные цвета и параметры находятся в начале `styles.css`:

```css
--accent: #ff3158;
--accent-2: #1e65ff;
--accent-3: #22b86a;
--glass: rgba(255,255,255,.56);
--radius-xl: 30px;
```

В проекте используется самостоятельный знак в виде абстрактного футбольного многогранника. Официальный логотип FIFA намеренно не встроен: для публичного неофициального проекта безопаснее не создавать впечатление официального партнёрства.

## Важное ограничение

Точные live-оценки игроков, расширенный xG, давление, подробная историческая статистика и гарантированный SLA зависят от тарифа и покрытия выбранного поставщика данных. Интерфейс и Worker подготовлены к расширению, но сами данные должны быть лицензированы у API-провайдера.
