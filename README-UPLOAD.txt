WORLD CUP 2026 — LEAN v6.1

Загрузите ВСЁ содержимое этой папки в корень GitHub-репозитория worldcup.
Файл index.html должен находиться непосредственно в корне репозитория.

Состав:
- index.html
- styles.css
- app.js
- config.js
- demo-data.js
- manifest.webmanifest
- service-worker.js
- .nojekyll
- assets/flags — 48 локальных флагов
- assets/icons — PWA-иконки Windows, Android и iPhone

После загрузки:
1. Подождите публикацию GitHub Pages.
2. Откройте https://efim26470-ops.github.io/worldcup/?lean=61
3. Нажмите Ctrl+F5.
4. Если сохранилась старая версия: F12 → Application → Service Workers → Unregister,
   затем Storage → Clear site data.

Важно: сначала обновите Cloudflare Worker из отдельной папки CLOUDFLARE-WORKER.
