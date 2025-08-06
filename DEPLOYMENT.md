# 🚀 Инструкции по развертыванию мини-приложения

## 📋 Предварительные требования

1. **Веб-хостинг** с поддержкой HTTPS
2. **Домен** (опционально, но рекомендуется)
3. **Доступ к файлам** вашего Telegram бота

## 🎯 Варианты развертывания

### 1. GitHub Pages (Рекомендуется)

#### Шаги:
1. **Создайте репозиторий** на GitHub
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/your-username/telegram-webapp.git
   git push -u origin main
   ```

2. **Включите GitHub Pages**
   - Перейдите в Settings → Pages
   - Source: Deploy from a branch
   - Branch: main
   - Folder: / (root)

3. **Получите URL**
   - Ваш сайт будет доступен по адресу: `https://your-username.github.io/telegram-webapp/`

4. **Настройте в боте**
   ```javascript
   const webAppButton = {
     text: "📊 Подробный отчёт",
     web_app: {
       url: "https://your-username.github.io/telegram-webapp/"
     }
   };
   ```

### 2. Netlify

#### Шаги:
1. **Зарегистрируйтесь** на [netlify.com](https://netlify.com)

2. **Подключите репозиторий**
   - New site from Git
   - Выберите ваш GitHub репозиторий
   - Build command: оставьте пустым
   - Publish directory: оставьте пустым

3. **Настройте домен**
   - Получите автоматический домен вида: `https://random-name.netlify.app`
   - Или подключите свой домен в Domain settings

4. **Настройте в боте**
   ```javascript
   const webAppButton = {
     text: "📊 Подробный отчёт",
     web_app: {
       url: "https://your-site.netlify.app/"
     }
   };
   ```

### 3. Vercel

#### Шаги:
1. **Зарегистрируйтесь** на [vercel.com](https://vercel.com)

2. **Импортируйте проект**
   - New Project
   - Import Git Repository
   - Выберите ваш репозиторий

3. **Настройте домен**
   - Получите автоматический домен вида: `https://project-name.vercel.app`
   - Или подключите свой домен в Settings → Domains

4. **Настройте в боте**
   ```javascript
   const webAppButton = {
     text: "📊 Подробный отчёт",
     web_app: {
       url: "https://your-project.vercel.app/"
     }
   };
   ```

### 4. Собственный сервер

#### Шаги:
1. **Загрузите файлы** на ваш сервер
   ```bash
   scp -r telegram-webapp/ user@your-server:/var/www/html/
   ```

2. **Настройте веб-сервер** (Apache/Nginx)
   ```nginx
   server {
       listen 80;
       server_name your-domain.com;
       root /var/www/html/telegram-webapp;
       index index.html;
       
       location / {
           try_files $uri $uri/ =404;
       }
   }
   ```

3. **Настройте SSL** (обязательно для Telegram)
   ```bash
   sudo certbot --nginx -d your-domain.com
   ```

4. **Настройте в боте**
   ```javascript
   const webAppButton = {
     text: "📊 Подробный отчёт",
     web_app: {
       url: "https://your-domain.com/"
     }
   };
   ```

## ⚙️ Настройка API интеграции

### 1. Обновите конфигурацию

В файле `config.js` измените настройки API:

```javascript
api: {
  baseUrl: 'https://your-api-domain.com/api',
  token: 'YOUR_API_TOKEN',
  timeout: 10000,
  retryAttempts: 3
}
```

### 2. Создайте API эндпоинты

Ваш сервер должен предоставлять следующие эндпоинты:

#### GET /api/user/{chatId}/report
```json
{
  "transactions": [
    {
      "id": 1,
      "date": "2024-01-15",
      "category": "Продукты",
      "amount": 25000,
      "type": "expense",
      "comment": "Magnum"
    }
  ],
  "categories": {
    "Продукты": {
      "amount": 25000,
      "percentage": 20
    }
  },
  "totals": {
    "income": 650000,
    "expense": 120000,
    "balance": 530000
  }
}
```

#### POST /api/user/{chatId}/period
```json
{
  "startDate": "2024-01-01",
  "endDate": "2024-01-31"
}
```

#### GET /api/user/{chatId}/categories?period=current_month
```json
{
  "categories": {
    "Продукты": {
      "amount": 25000,
      "percentage": 20
    }
  }
}
```

### 3. Настройте CORS

Добавьте заголовки CORS на ваш сервер:

```javascript
// Node.js/Express
app.use(cors({
  origin: ['https://your-webapp-domain.com'],
  credentials: true
}));

// PHP
header('Access-Control-Allow-Origin: https://your-webapp-domain.com');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
```

## 🔧 Интеграция с вашим ботом

### 1. Добавьте кнопку в бота

В вашем боте (`Текстовый документ.js`) добавьте:

```javascript
// В функции handleReportsMenu или аналогичной
function handleReportsMenu(chat_id) {
  const webAppButton = {
    text: "📊 Подробный отчёт",
    web_app: {
      url: "https://your-domain.com/telegram-webapp/"
    }
  };
  
  const keyboard = {
    inline_keyboard: [[webAppButton]]
  };
  
  sendText(chat_id, "Нажмите кнопку для просмотра подробного отчета:", null, keyboard);
}
```

### 2. Создайте API для бота

Добавьте в ваш Google Apps Script:

```javascript
// Новый эндпоинт для веб-приложения
function doGet(e) {
  const chatId = e.parameter.chat_id;
  
  if (!chatId) {
    return ContentService.createTextOutput(JSON.stringify({
      error: 'Chat ID required'
    })).setMimeType(ContentService.MimeType.JSON);
  }
  
  try {
    const data = generateReportData(chatId);
    return ContentService.createTextOutput(JSON.stringify(data))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function generateReportData(chatId) {
  // Получаем данные из Google Sheets
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const expenseSheet = ss.getSheetByName('Расходы');
  const incomeSheet = ss.getSheetByName('Доходы');
  
  const transactions = [];
  const categories = {};
  let totalIncome = 0;
  let totalExpense = 0;
  
  // Обработка доходов
  if (incomeSheet && incomeSheet.getLastRow() > 1) {
    const incomeData = incomeSheet.getRange(2, 1, incomeSheet.getLastRow() - 1, 7).getValues();
    incomeData.forEach(row => {
      if (String(row[4]) === chatId) { // row[4] = ChatID
        const transaction = {
          id: `income_${Date.now()}_${Math.random()}`,
          date: row[0].toISOString().split('T')[0],
          category: getCategoryLabel(row[1], 'ru'),
          amount: parseFloat(row[2]) || 0,
          type: 'income',
          comment: row[3] || ''
        };
        transactions.push(transaction);
        totalIncome += transaction.amount;
      }
    });
  }
  
  // Обработка расходов
  if (expenseSheet && expenseSheet.getLastRow() > 1) {
    const expenseData = expenseSheet.getRange(2, 1, expenseSheet.getLastRow() - 1, 7).getValues();
    expenseData.forEach(row => {
      if (String(row[4]) === chatId) { // row[4] = ChatID
        const transaction = {
          id: `expense_${Date.now()}_${Math.random()}`,
          date: row[0].toISOString().split('T')[0],
          category: getCategoryLabel(row[1], 'ru'),
          amount: parseFloat(row[2]) || 0,
          type: 'expense',
          comment: row[3] || ''
        };
        transactions.push(transaction);
        totalExpense += transaction.amount;
      }
    });
  }
  
  // Сортировка по дате
  transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
  
  // Группировка по категориям
  transactions.forEach(transaction => {
    if (!categories[transaction.category]) {
      categories[transaction.category] = {
        amount: 0,
        percentage: 0
      };
    }
    categories[transaction.category].amount += transaction.amount;
  });
  
  // Вычисление процентов
  Object.keys(categories).forEach(category => {
    const total = categories[category].amount;
    const percentage = total > 0 ? (total / (totalIncome + totalExpense)) * 100 : 0;
    categories[category].percentage = Math.round(percentage * 10) / 10;
  });
  
  return {
    transactions: transactions,
    categories: categories,
    totals: {
      income: totalIncome,
      expense: totalExpense,
      balance: totalIncome - totalExpense
    }
  };
}
```

## 🔒 Безопасность

### 1. Валидация данных
```javascript
// В вашем API
function validateChatId(chatId) {
  return /^\d+$/.test(chatId) && chatId.length > 0;
}

function sanitizeInput(input) {
  return input.replace(/[<>]/g, '');
}
```

### 2. Ограничение доступа
```javascript
// Проверка авторизации
function checkUserAccess(chatId) {
  const authorizedUsers = ['1042926851']; // Ваш ID
  return authorizedUsers.includes(chatId);
}
```

### 3. Rate Limiting
```javascript
// Ограничение запросов
const rateLimit = {
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 100 // максимум 100 запросов
};
```

## 🧪 Тестирование

### 1. Локальное тестирование
```bash
# Запустите локальный сервер
python -m http.server 8000

# Откройте в браузере
http://localhost:8000
```

### 2. Тестирование в Telegram
1. Загрузите файлы на хостинг
2. Добавьте кнопку в бота
3. Протестируйте в Telegram

### 3. Проверка API
```bash
# Тест API
curl -X GET "https://your-api.com/api/user/1042926851/report" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## 📊 Мониторинг

### 1. Логирование
```javascript
// Добавьте логирование в API
console.log(`API Request: ${new Date().toISOString()} - ${chatId}`);
```

### 2. Метрики
- Количество запросов
- Время ответа
- Ошибки
- Популярные категории

## 🔄 Обновления

### 1. Автоматическое развертывание
Настройте CI/CD для автоматического обновления:

```yaml
# .github/workflows/deploy.yml
name: Deploy to GitHub Pages
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Deploy
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./
```

### 2. Версионирование
```javascript
// В config.js
appVersion: '1.0.1'
```

## 📞 Поддержка

При возникновении проблем:

1. **Проверьте консоль браузера** (F12)
2. **Проверьте логи сервера**
3. **Убедитесь в корректности URL**
4. **Проверьте CORS настройки**
5. **Убедитесь в поддержке HTTPS**

## 🎯 Оптимизация

### 1. Кеширование
```javascript
// В config.js
cache: {
  enabled: true,
  duration: 5 * 60 * 1000 // 5 минут
}
```

### 2. Сжатие
```nginx
# Nginx
gzip on;
gzip_types text/css application/javascript application/json;
```

### 3. CDN
Используйте CDN для статических файлов:
```html
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
```

---

**Успешного развертывания! 🚀** 