ПОДКЛЮЧЕНИЕ БЕСПЛАТНОГО LIVE API

1. Создайте бесплатный аккаунт API-Football / API-Sports и скопируйте API key.
2. Откройте терминал в папке worker.
3. Выполните:

   npm install
   npx wrangler login
   npm run secret
   npm run deploy

4. При npm run secret вставьте API key.
5. Скопируйте URL вида https://wc26-live-api....workers.dev
6. В корневом config.js замените WC26_WORKER_URL на этот URL.
7. Загрузите обновлённые файлы в GitHub.

Проверка: откройте URL_WORKER/api/health — configured должен быть true.
