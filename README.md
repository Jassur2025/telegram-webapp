# 💰 Telegram Web App для финансового бота

Красивое веб-приложение для просмотра финансовых данных из Telegram бота с поддержкой графиков, целей и долгов.

## 🚀 Возможности

- **📊 Аналитика транзакций** - Просмотр доходов и расходов
- **📈 Интерактивные графики** - Визуализация данных через Chart.js
- **🎯 Отслеживание целей** - Мониторинг финансовых целей
- **💸 Управление долгами** - Контроль долгов и кредитов
- **🔍 Фильтрация** - По периоду, типу и категориям
- **📱 Адаптивный дизайн** - Оптимизировано для мобильных устройств
- **🌙 Темная тема** - Автоматическая адаптация под тему Telegram

## 📁 Структура проекта

```
telegram-webapp/
├── index.html              # Основная HTML страница
├── script.js               # JavaScript логика
├── style.css               # Стили и адаптивный дизайн
├── config.js               # Конфигурация приложения
├── api-integration.js      # API интеграция
├── test-api.html           # Тестирование API
├── INTEGRATION_GUIDE.md    # Руководство по интеграции
├── DEPLOYMENT.md           # Инструкции по развертыванию
└── README.md               # Это файл
```

## 🛠️ Быстрый старт

### 1. Клонирование репозитория

```bash
git clone https://github.com/your-username/telegram-webapp.git
cd telegram-webapp
```

### 2. Настройка конфигурации

Отредактируйте `config.js`:

```javascript
api: {
  baseUrl: 'https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec',
  // ...
}
```

### 3. Локальное тестирование

```bash
# Запустите локальный сервер
python -m http.server 8000
# или
npx serve .

# Откройте http://localhost:8000
```

### 4. Развертывание

Выберите один из вариантов:

- **GitHub Pages** (рекомендуется) - см. `DEPLOYMENT.md`
- **Netlify** - drag & drop файлов
- **Vercel** - через CLI
- **Firebase Hosting** - для продвинутых пользователей

## 🔗 Интеграция с ботом

### 1. Добавьте функцию в Google Apps Script

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
  
  sendText(chat_id, "Откройте веб-приложение для просмотра ваших финансов:", null, keyboard);
}
```

### 2. Добавьте команду в бот

```javascript
// В функции handleUserInput
if (text === '/webapp' || text === 'веб-приложение') {
  handleWebApp(chat_id);
  return;
}
```

### 3. Обновите главное меню

```javascript
function buildMainKeyboard(lang) {
  return {
    keyboard: [
      ['💰 Доход', '💸 Расход'],
      ['📊 Отчеты', '🎯 Цели'],
      ['💸 Долги', '⚙️ Настройки'],
      ['🌐 Веб-приложение'] // Добавьте эту строку
    ],
    resize_keyboard: true
  };
}
```

## 📊 API Структура

Web App ожидает следующие данные от Google Apps Script:

```javascript
{
  transactions: [
    {
      id: 1,
      date: '2024-01-15',
      category: 'Продукты',
      amount: 25000,
      type: 'expense',
      comment: 'Magnum'
    }
  ],
  categories: {
    'Продукты': {
      amount: 25000,
      percentage: 20
    }
  },
  totals: {
    income: 650000,
    expense: 120000,
    balance: 530000
  }
}
```

## 🎨 Кастомизация

### Цвета и тема

Отредактируйте `config.js`:

```javascript
charts: {
  colors: {
    income: ['#28a745', '#20c997', '#17a2b8', '#6f42c1'],
    expense: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0']
  }
}
```

### Категории

Добавьте новые категории в `config.js`:

```javascript
categories: {
  icons: {
    'Новая категория': '🎯',
    // ...
  }
}
```

## 🔧 Разработка

### Добавление новых вкладок

1. Добавьте кнопку в `index.html`:
```html
<button class="tab-btn" data-tab="newtab">Новая вкладка</button>
```

2. Создайте контейнер:
```html
<div class="tab-pane" id="newtab">
  <div class="newtab-container" id="newtabContainer">
  </div>
</div>
```

3. Добавьте логику в `script.js`:
```javascript
function updateNewTab() {
  const container = document.getElementById('newtabContainer');
  // Ваша логика
}
```

### Новые API эндпоинты

1. Добавьте функцию в Google Apps Script
2. Обновите `doGet()` для обработки нового типа
3. Добавьте функцию загрузки в `script.js`

## 🚨 Устранение неполадок

### Проблемы с CORS

1. Убедитесь, что Google Apps Script возвращает правильные заголовки
2. Проверьте URL в `config.js`
3. Протестируйте через `test-api.html`

### Проблемы с загрузкой данных

1. Проверьте консоль браузера (F12)
2. Убедитесь, что `chat_id` передается правильно
3. Проверьте логи в Google Apps Script

### Проблемы с отображением

1. Проверьте, что все файлы загружены
2. Убедитесь, что CSS применяется правильно
3. Проверьте поддержку браузером

## 📈 Производительность

### Кеширование

Web App использует localStorage для кеширования данных:

```javascript
cache: {
  enabled: true,
  duration: 5 * 60 * 1000, // 5 минут
  maxSize: 10 * 1024 * 1024 // 10 МБ
}
```

### Оптимизация

- Ленивая загрузка графиков
- Минимизация запросов к API
- Адаптивные изображения
- CDN для библиотек

## 🔒 Безопасность

### Валидация данных

Все данные валидируются на сервере:

```javascript
function validateChatId(chatId) {
  return chatId && /^\d+$/.test(chatId);
}
```

### Ограничение доступа

Проверка авторизации пользователей:

```javascript
function checkUserAccess(chatId) {
  const allowedUsers = getAllUserIds();
  return allowedUsers.includes(chatId);
}
```

## 📞 Поддержка

При возникновении проблем:

1. **Проверьте консоль браузера** (F12)
2. **Проверьте логи Google Apps Script**
3. **Убедитесь в корректности URL**
4. **Проверьте CORS настройки**
5. **Убедитесь в поддержке HTTPS**

## 🤝 Вклад в проект

1. Fork репозитория
2. Создайте feature branch (`git checkout -b feature/amazing-feature`)
3. Commit изменения (`git commit -m 'Add amazing feature'`)
4. Push в branch (`git push origin feature/amazing-feature`)
5. Откройте Pull Request

## 📄 Лицензия

Этот проект распространяется под лицензией MIT. См. файл `LICENSE` для подробностей.

## 🙏 Благодарности

- [Chart.js](https://www.chartjs.org/) - для графиков
- [Telegram Web App API](https://core.telegram.org/bots/webapps) - для интеграции
- [Google Apps Script](https://developers.google.com/apps-script) - для бэкенда

---

**Создано с ❤️ для Telegram ботов**