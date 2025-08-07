# Руководство по интеграции Telegram Web App с ботом

## Обзор

Этот проект представляет собой интегрированное решение, объединяющее Telegram Web App с вашим существующим финансовым ботом. Web App предоставляет красивый интерфейс для просмотра финансовых данных, а бот остается основным инструментом для ввода данных.

## Структура проекта

```
telegram-webapp/
├── index.html          # Основная HTML страница
├── script.js           # JavaScript логика
├── style.css           # Стили
├── config.js           # Конфигурация
├── api-integration.js  # API интеграция
├── test-api.html       # Тестирование API
└── INTEGRATION_GUIDE.md # Это руководство
```

## Интеграция с ботом

### 1. Настройка Web App в боте

Добавьте в ваш Google Apps Script код для открытия Web App:

```javascript
function handleOpenWebApp(chat_id) {
  const webAppUrl = "https://your-domain.com/telegram-webapp/";
  const keyboard = {
    inline_keyboard: [[
      {
        text: "📊 Открыть веб-приложение",
        web_app: { url: webAppUrl }
      }
    ]]
  };
  
  sendText(chat_id, "Откройте веб-приложение для просмотра ваших финансов:", null, keyboard);
}
```

### 2. Обновление API для Web App

В вашем Google Apps Script уже есть функция `generateReportData(chatId)`, которая возвращает данные в нужном формате. Убедитесь, что функция `doGet(e)` правильно обрабатывает запросы от Web App.

### 3. Добавление новых API эндпоинтов

Для полной интеграции добавьте следующие функции в ваш Google Apps Script:

```javascript
// API для целей
function getGoalsData(chatId) {
  const goals = getUserGoals(chatId);
  return {
    goals: goals.map(goal => ({
      id: goal.id,
      name: goal.name,
      target: goal.target,
      current: goal.current,
      deadline: goal.deadline,
      category: goal.category
    }))
  };
}

// API для долгов
function getDebtsData(chatId) {
  const debts = getActiveDebtsForUser(chatId);
  return {
    debts: debts.map(debt => ({
      id: debt.id,
      type: debt.type,
      counterparty: debt.counterparty,
      amount: debt.amount,
      currency: debt.currency,
      description: debt.description,
      dueDate: debt.dueDate,
      status: debt.status
    }))
  };
}

// Обновленная функция doGet
function doGet(e) {
  const chatId = e.parameter.chat_id;
  const type = e.parameter.type || 'report';

  if (!chatId) {
    return ContentService.createTextOutput(JSON.stringify({
      error: 'Chat ID required'
    })).setMimeType(ContentService.MimeType.JSON);
  }

  try {
    let data;
    
    switch (type) {
      case 'goals':
        data = getGoalsData(chatId);
        break;
      case 'debts':
        data = getDebtsData(chatId);
        break;
      default:
        data = generateReportData(chatId);
    }
    
    return ContentService.createTextOutput(JSON.stringify(data))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}
```

## Функциональность Web App

### 1. Основные вкладки

- **Транзакции**: Просмотр всех транзакций с фильтрацией
- **Графики**: Визуализация данных через Chart.js
- **Категории**: Анализ расходов по категориям
- **Цели**: Отслеживание финансовых целей
- **Долги**: Управление долгами и кредитами

### 2. Фильтрация

- По периоду (текущий месяц, прошлый месяц, неделя, произвольный)
- По типу (доходы/расходы)
- По категориям

### 3. Интеграция с Telegram

- Автоматическое определение пользователя
- Адаптация под тему Telegram
- Кнопка для открытия бота

## Настройка развертывания

### 1. Хостинг

Разместите файлы на любом статическом хостинге:
- GitHub Pages
- Netlify
- Vercel
- Firebase Hosting

### 2. Обновление URL

В файле `config.js` обновите URL вашего Google Apps Script:

```javascript
api: {
  baseUrl: 'https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec',
  // ...
}
```

### 3. Настройка CORS

Убедитесь, что ваш Google Apps Script настроен для работы с CORS:

```javascript
function doGet(e) {
  // Добавьте заголовки CORS
  const output = ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
  
  output.addHeader('Access-Control-Allow-Origin', '*');
  output.addHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  output.addHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  return output;
}
```

## Тестирование

### 1. Локальное тестирование

Откройте `test-api.html` в браузере для тестирования API:

```bash
# Запустите локальный сервер
python -m http.server 8000
# или
npx serve .
```

### 2. Тестирование в Telegram

1. Разверните Web App на хостинге
2. Обновите URL в боте
3. Протестируйте через команду `/webapp` в боте

## Расширение функциональности

### 1. Добавление новых вкладок

1. Добавьте кнопку вкладки в `index.html`
2. Создайте контейнер для содержимого
3. Добавьте логику в `script.js`
4. Обновите стили в `style.css`

### 2. Новые API эндпоинты

1. Добавьте функцию в Google Apps Script
2. Обновите `doGet()` для обработки нового типа
3. Добавьте функцию загрузки в `script.js`

### 3. Экспорт данных

Реализуйте функции экспорта в PDF или Excel:

```javascript
function downloadReport() {
  // Генерация PDF отчета
  const reportData = {
    user: currentData.user,
    transactions: currentData.transactions,
    totals: currentData.totals,
    period: currentPeriod
  };
  
  // Отправка данных на сервер для генерации PDF
  fetch('/api/generate-pdf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(reportData)
  })
  .then(response => response.blob())
  .then(blob => {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'financial-report.pdf';
    a.click();
  });
}
```

## Безопасность

### 1. Валидация данных

Всегда валидируйте данные на сервере:

```javascript
function validateChatId(chatId) {
  return chatId && /^\d+$/.test(chatId);
}

function sanitizeInput(input) {
  return input.replace(/[<>]/g, '');
}
```

### 2. Ограничение доступа

Добавьте проверку авторизации:

```javascript
function checkUserAccess(chatId) {
  // Проверка, что пользователь имеет доступ к данным
  const allowedUsers = getAllUserIds();
  return allowedUsers.includes(chatId);
}
```

## Производительность

### 1. Кеширование

Используйте localStorage для кеширования данных:

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

### 2. Оптимизация загрузки

- Используйте lazy loading для графиков
- Минимизируйте размер файлов
- Используйте CDN для библиотек

## Поддержка

### 1. Логирование

Добавьте логирование для отладки:

```javascript
function log(message, data = null) {
  if (CONFIG.debug.enabled) {
    console.log(`[${new Date().toISOString()}] ${message}`, data);
  }
}
```

### 2. Обработка ошибок

Всегда обрабатывайте ошибки:

```javascript
async function safeApiCall(fn) {
  try {
    return await fn();
  } catch (error) {
    console.error('API Error:', error);
    Telegram.WebApp.showAlert(`Ошибка: ${error.message}`);
    return null;
  }
}
```

## Заключение

Эта интеграция создает единую экосистему, где:
- **Бот** остается основным инструментом для ввода данных
- **Web App** предоставляет красивый интерфейс для анализа
- **API** обеспечивает связь между компонентами

Пользователи получают лучшее из двух миров: удобство ввода через бота и богатую визуализацию через Web App. 