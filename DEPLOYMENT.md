# Инструкции по развертыванию Telegram Web App

## Быстрый старт

### 1. Подготовка файлов

Убедитесь, что у вас есть все необходимые файлы:

```
telegram-webapp/
├── index.html
├── script.js
├── style.css
├── config.js
├── api-integration.js
├── test-api.html
└── README.md
```

### 2. Обновление конфигурации

В файле `config.js` обновите URL вашего Google Apps Script:

```javascript
api: {
  baseUrl: 'https://script.google.com/macros/s/YOUR_ACTUAL_SCRIPT_ID/exec',
  // ...
}
```

## Варианты развертывания

### 1. GitHub Pages (Рекомендуется)

#### Шаги:

1. **Создайте репозиторий на GitHub**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/your-username/telegram-webapp.git
   git push -u origin main
   ```

2. **Настройте GitHub Pages**
   - Перейдите в Settings → Pages
   - Source: Deploy from a branch
   - Branch: main
   - Folder: / (root)

3. **Получите URL**
   - Ваш Web App будет доступен по адресу: `https://your-username.github.io/telegram-webapp/`

#### Преимущества:
- Бесплатно
- Автоматическое обновление при push
- HTTPS по умолчанию
- Простая настройка

### 2. Netlify

#### Шаги:

1. **Загрузите файлы на Netlify**
   - Перейдите на [netlify.com](https://netlify.com)
   - Drag & drop папку с файлами
   - Получите URL вида: `https://random-name.netlify.app`

2. **Настройте кастомный домен (опционально)**
   - Settings → Domain management
   - Add custom domain

#### Преимущества:
- Бесплатно
- Автоматическое развертывание
- Кастомные домены
- SSL сертификаты

### 3. Vercel

#### Шаги:

1. **Установите Vercel CLI**
   ```bash
   npm i -g vercel
   ```

2. **Разверните проект**
   ```bash
   vercel
   ```

3. **Следуйте инструкциям в терминале**

#### Преимущества:
- Быстрое развертывание
- Автоматическая оптимизация
- CDN по умолчанию

### 4. Firebase Hosting

#### Шаги:

1. **Установите Firebase CLI**
   ```bash
   npm install -g firebase-tools
   ```

2. **Инициализируйте проект**
   ```bash
   firebase login
   firebase init hosting
   ```

3. **Настройте firebase.json**
   ```json
   {
     "hosting": {
       "public": ".",
       "ignore": [
         "firebase.json",
         "**/.*",
         "**/node_modules/**"
       ]
     }
   }
   ```

4. **Разверните**
   ```bash
   firebase deploy
   ```

## Интеграция с ботом

### 1. Обновление Google Apps Script

Добавьте в ваш бот функцию для открытия Web App:

```javascript
function handleWebApp(chat_id) {
  const webAppUrl = "https://your-domain.com/telegram-webapp/";
  
  const keyboard = {
    inline_keyboard: [[
      {
        text: "📊 Открыть веб-приложение",
        web_app: { url: webAppUrl }
      }
    ]]
  };
  
  const message = `🔗 Откройте веб-приложение для просмотра ваших финансов:
  
📈 Транзакции и аналитика
📊 Графики и диаграммы
🎯 Цели и планирование
💸 Долги и кредиты

Нажмите кнопку ниже, чтобы открыть приложение:`;
  
  sendText(chat_id, message, null, keyboard);
}
```

### 2. Добавление команды в бот

```javascript
// В функции handleUserInput добавьте:
if (text === '/webapp' || text === 'веб-приложение') {
  handleWebApp(chat_id);
  return;
}
```

### 3. Обновление главного меню

```javascript
function buildMainKeyboard(lang) {
  const keyboard = {
    keyboard: [
      ['💰 Доход', '💸 Расход'],
      ['📊 Отчеты', '🎯 Цели'],
      ['💸 Долги', '⚙️ Настройки'],
      ['🌐 Веб-приложение'] // Добавьте эту строку
    ],
    resize_keyboard: true
  };
  
  return keyboard;
}
```

## Тестирование

### 1. Локальное тестирование

```bash
# Установите простой HTTP сервер
python -m http.server 8000
# или
npx serve .

# Откройте http://localhost:8000
```

### 2. Тестирование API

Откройте `test-api.html` в браузере и протестируйте подключение к вашему Google Apps Script.

### 3. Тестирование в Telegram

1. Разверните Web App на хостинге
2. Обновите URL в боте
3. Отправьте команду `/webapp` в боте
4. Протестируйте все функции

## Настройка безопасности

### 1. CORS настройки

Убедитесь, что ваш Google Apps Script поддерживает CORS:

```javascript
function doGet(e) {
  // ... ваш код ...
  
  const output = ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
  
  // Добавьте заголовки CORS
  output.addHeader('Access-Control-Allow-Origin', '*');
  output.addHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  output.addHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  return output;
}
```

### 2. Валидация пользователей

Добавьте проверку доступа в Google Apps Script:

```javascript
function validateUserAccess(chatId) {
  // Получите список разрешенных пользователей
  const allowedUsers = getAllUserIds();
  
  if (!allowedUsers.includes(chatId)) {
    throw new Error('Access denied');
  }
  
  return true;
}

function doGet(e) {
  const chatId = e.parameter.chat_id;
  
  try {
    // Проверьте доступ пользователя
    validateUserAccess(chatId);
    
    // ... остальной код ...
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}
```

## Мониторинг и аналитика

### 1. Логирование

Добавьте логирование в Google Apps Script:

```javascript
function logWebAppAccess(chatId, action) {
  const timestamp = new Date().toISOString();
  const logEntry = `${timestamp} - User ${chatId} accessed WebApp: ${action}`;
  
  Logger.log(logEntry);
  
  // Сохраните в Google Sheets для аналитики
  const logSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('WebApp_Logs');
  if (logSheet) {
    logSheet.appendRow([timestamp, chatId, action]);
  }
}
```

### 2. Аналитика использования

Создайте Google Analytics для отслеживания использования:

```javascript
// В script.js добавьте:
function trackEvent(eventName, data = {}) {
  if (typeof gtag !== 'undefined') {
    gtag('event', eventName, {
      event_category: 'telegram_webapp',
      event_label: currentData.user?.id || 'anonymous',
      ...data
    });
  }
}
```

## Оптимизация производительности

### 1. Кеширование

Используйте localStorage для кеширования:

```javascript
const cache = {
  set: (key, data, ttl = 5 * 60 * 1000) => {
    localStorage.setItem(key, JSON.stringify({
      data,
      timestamp: Date.now(),
      ttl
    }));
  },
  
  get: (key) => {
    const item = localStorage.getItem(key);
    if (!item) return null;
    
    const { data, timestamp, ttl } = JSON.parse(item);
    if (Date.now() - timestamp > ttl) {
      localStorage.removeItem(key);
      return null;
    }
    
    return data;
  }
};
```

### 2. Ленивая загрузка

Загружайте графики только при необходимости:

```javascript
function updateCharts() {
  // Загружаем графики только если вкладка активна
  const activeTab = document.querySelector('.tab-btn.active');
  if (activeTab && activeTab.getAttribute('data-tab') === 'charts') {
    updateExpenseChart();
    updateIncomeChart();
    updateTrendChart();
  }
}
```

## Устранение неполадок

### 1. Проблемы с CORS

Если возникают ошибки CORS:

1. Убедитесь, что Google Apps Script возвращает правильные заголовки
2. Проверьте, что URL в `config.js` правильный
3. Протестируйте API через `test-api.html`

### 2. Проблемы с загрузкой данных

1. Проверьте консоль браузера на ошибки
2. Убедитесь, что `chat_id` передается правильно
3. Проверьте логи в Google Apps Script

### 3. Проблемы с отображением

1. Проверьте, что все файлы загружены
2. Убедитесь, что CSS применяется правильно
3. Проверьте поддержку браузером

## Обновления и поддержка

### 1. Автоматические обновления

При использовании GitHub Pages обновления происходят автоматически при push в репозиторий.

### 2. Версионирование

Добавьте версионирование в `config.js`:

```javascript
const CONFIG = {
  appName: 'Финансовый отчёт',
  appVersion: '1.0.0',
  // ...
};
```

### 3. Чек-лист развертывания

- [ ] Все файлы загружены на хостинг
- [ ] URL в `config.js` обновлен
- [ ] Google Apps Script развернут и доступен
- [ ] CORS настроен правильно
- [ ] Бот обновлен с новой командой
- [ ] Протестировано локально
- [ ] Протестировано в Telegram

## Заключение

После выполнения всех шагов у вас будет полностью функциональный Telegram Web App, интегрированный с вашим ботом. Пользователи смогут:

1. Открывать Web App через бота
2. Просматривать свои финансовые данные
3. Анализировать расходы и доходы
4. Отслеживать цели и долги
5. Получать визуализацию данных

Web App дополняет функциональность бота, предоставляя более богатый пользовательский интерфейс для анализа финансовых данных. 