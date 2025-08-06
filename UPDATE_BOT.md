# Обновление бота с новым URL мини-приложения

## ✅ Что нужно сделать

### 1. Обновить Google Apps Script

1. Откройте ваш Google Apps Script проект
2. Найдите функцию `generateBalanceReport` (примерно строка 2680)
3. Замените URL в кнопке на:

```javascript
const keyboard = {
  inline_keyboard: [
    [{ text: "📊 Открыть детальный отчёт", web_app: { url: `https://telegram-webapp-7b93.onrender.com/index.html?chat_id=${chat_id}` } }]
  ]
};
```

### 2. Сохранить и развернуть

1. Нажмите **Save** (Ctrl+S)
2. Нажмите **Deploy** → **New deployment**
3. Выберите тип **Web app**
4. Нажмите **Deploy**
5. Скопируйте новый URL развертывания

### 3. Обновить webhook

Если URL развертывания изменился, обновите webhook в Telegram:

```
https://api.telegram.org/bot7887282351:AAGoz1-Zq9bDZME-dQGEq1JW_xLAw-r_mHc/setWebhook?url=НОВЫЙ_URL_РАЗВЕРТЫВАНИЯ
```

## 🧪 Тестирование

1. Откройте бота в Telegram
2. Нажмите кнопку "Баланс"
3. Должна появиться кнопка "📊 Открыть детальный отчёт"
4. Нажмите на неё - должно открыться мини-приложение

## 🔗 Ссылки

- **Мини-приложение**: https://telegram-webapp-7b93.onrender.com
- **Ваш API**: https://script.google.com/macros/s/AKfycbxlJgV5nCrI-7niYpcXXucPfpkVAw0AL-7dk6TZ6S8JSmN1zq6ZoJK4Y4AW0yTlXs7FvaQ/exec

## ❓ Если что-то не работает

1. **Кнопка не появляется**: Проверьте, что код в `generateBalanceReport` обновлен
2. **Мини-приложение не загружается**: Проверьте URL в кнопке
3. **Данные не загружаются**: Проверьте, что API работает и возвращает данные

## 📱 Результат

После обновления:
- ✅ Кнопка "📊 Открыть детальный отчёт" появится при просмотре баланса
- ✅ Каждый пользователь будет видеть только свои данные
- ✅ Красивый интерфейс с графиками и фильтрами
- ✅ Реальные данные из Google Sheets 