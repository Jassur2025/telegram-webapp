# Инструкция по развертыванию и исправлению ошибок

## 🔧 Исправление ошибки "ERR_NAME_NOT_RESOLVED"

### Проблема
Ошибка возникает из-за неправильной конфигурации API URL в файлах:
- `api-integration.js` - указан несуществующий домен `your-api-domain.com`
- `config.js` - указан правильный URL Google Apps Script

### Решение

1. **Обновлен `api-integration.js`**:
   - Изменен URL с `https://your-api-domain.com/api` на правильный URL Google Apps Script
   - Обновлены все функции для работы с POST запросами
   - Добавлена поддержка действий: `getUserData`, `getPeriodData`, `getCategoryStats`, `checkAuth`

2. **Обновлен основной скрипт Google Apps Script**:
   - Добавлена функция `handleWebAppRequest` для обработки запросов от веб-приложения
   - Добавлены функции `generateReportDataForPeriod` и `generateCategoryStats`
   - Обновлена функция `doPost` для поддержки новых действий

3. **Обновлен `script.js`**:
   - Изменен метод запроса с GET на POST
   - Добавлена поддержка правильного формата запросов

## 🚀 Развертывание

### 1. Развертывание Google Apps Script

1. Откройте [Google Apps Script](https://script.google.com/)
2. Создайте новый проект
3. Скопируйте содержимое файла `Текстовый документ.js` в редактор
4. Сохраните проект
5. Нажмите "Deploy" → "New deployment"
6. Выберите тип "Web app"
7. Настройте:
   - Execute as: "Me"
   - Who has access: "Anyone"
8. Скопируйте URL развертывания

### 2. Обновление конфигурации

1. Откройте `config.js`
2. Замените URL в поле `baseUrl` на ваш URL развертывания:
   ```javascript
   baseUrl: 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec'
   ```

3. Откройте `api-integration.js`
4. Убедитесь, что URL совпадает с `config.js`

### 3. Настройка Google Sheets

1. Создайте Google Sheets документ
2. Добавьте листы:
   - "Расходы" (с колонками: Дата, Категория, Сумма, Комментарий, ChatID, Валюта, Сумма в UZS)
   - "Доходы" (с колонками: Дата, Категория, Сумма, Комментарий, ChatID, Валюта, Сумма в UZS)
   - "Setting" (для настроек)
   - "Цели" (для целей)
   - "Бюджеты" (для бюджетов)
   - "Семьи" (для семей)
   - "Курсы валют" (для курсов валют)
   - "Долги" (для долгов)

3. В Google Apps Script:
   - Откройте проект
   - Перейдите в "Settings" → "Script Properties"
   - Добавьте свойства:
     - `TELEGRAM_TOKEN` - токен вашего Telegram бота
     - `GEMINI_API_KEY` - ключ API Gemini (опционально)
     - `SPEECHKIT_KEY` - ключ SpeechKit (опционально)
     - `SPEECHKIT_FOLDER_ID` - ID папки SpeechKit (опционально)

### 4. Тестирование

1. Откройте `test-api-simple.html` в браузере
2. Введите ваш Chat ID (ID пользователя Telegram)
3. Нажмите кнопки для тестирования различных функций API

### 5. Развертывание веб-приложения

1. Загрузите все файлы на веб-сервер или используйте GitHub Pages
2. Убедитесь, что все файлы доступны по HTTPS
3. Протестируйте веб-приложение

## 🔍 Диагностика проблем

### Ошибка "ERR_NAME_NOT_RESOLVED"
- **Причина**: Неправильный URL API
- **Решение**: Проверьте URL в `config.js` и `api-integration.js`

### Ошибка "Unauthorized access"
- **Причина**: Пользователь не имеет доступа к данным
- **Решение**: Убедитесь, что Chat ID правильный и пользователь создал семью в боте

### Ошибка "Internal server error"
- **Причина**: Ошибка в Google Apps Script
- **Решение**: Проверьте логи в Google Apps Script Editor

### Ошибка CORS
- **Причина**: Проблемы с настройками CORS
- **Решение**: Убедитесь, что Google Apps Script развернут как Web App

## 📝 Логи и отладка

### Просмотр логов Google Apps Script
1. Откройте Google Apps Script Editor
2. Перейдите в "View" → "Execution log"
3. Выполните тестовый запрос
4. Проверьте логи на наличие ошибок

### Отладка веб-приложения
1. Откройте Developer Tools в браузере (F12)
2. Перейдите на вкладку "Console"
3. Выполните тестовый запрос
4. Проверьте ошибки в консоли

## ✅ Чек-лист развертывания

- [ ] Google Apps Script развернут как Web App
- [ ] URL в конфигурации обновлен
- [ ] Google Sheets создан с правильными листами
- [ ] Script Properties настроены
- [ ] Тестовый запрос работает
- [ ] Веб-приложение загружено на сервер
- [ ] Все файлы доступны по HTTPS

## 🆘 Получение помощи

Если у вас возникли проблемы:

1. Проверьте логи Google Apps Script
2. Убедитесь, что все URL правильные
3. Проверьте, что Google Sheets доступен
4. Убедитесь, что Script Properties настроены
5. Протестируйте API с помощью `test-api-simple.html` 