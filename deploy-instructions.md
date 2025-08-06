# Инструкции по развертыванию мини-приложения

## 1. Развертывание на GitHub Pages (бесплатно)

1. Создайте новый репозиторий на GitHub
2. Загрузите все файлы мини-приложения в репозиторий:
   - `index.html`
   - `script.js`
   - `style.css`
   - `config.js`
   - `api-integration.js`
   - `README.md`
   - `DEPLOYMENT.md`

3. Перейдите в Settings → Pages
4. В разделе "Source" выберите "Deploy from a branch"
5. Выберите ветку "main" и папку "/ (root)"
6. Нажмите "Save"

Ваш мини-приложение будет доступно по адресу: `https://ваш-username.github.io/ваш-репозиторий`

## 2. Обновление URL в боте

После развертывания обновите URL в функции `generateBalanceReport` в файле `Текстовый документ.js`:

```javascript
const keyboard = {
  inline_keyboard: [
    [{ text: "📊 Открыть детальный отчёт", web_app: { url: `https://ваш-username.github.io/ваш-репозиторий/index.html?chat_id=${chat_id}` } }]
  ]
};
```

## 3. Альтернативные варианты развертывания

### Netlify (бесплатно)
1. Зарегистрируйтесь на netlify.com
2. Перетащите папку с файлами на страницу развертывания
3. Получите URL вида: `https://random-name.netlify.app`

### Vercel (бесплатно)
1. Зарегистрируйтесь на vercel.com
2. Подключите GitHub репозиторий
3. Получите URL вида: `https://ваш-проект.vercel.app`

## 4. Тестирование

После развертывания протестируйте:
1. Откройте бота и нажмите кнопку "Баланс"
2. Нажмите кнопку "📊 Открыть детальный отчёт"
3. Проверьте, что мини-приложение загружается и показывает данные

## 5. Обновление API URL

Если вы изменили URL развертывания, обновите его в `config.js`:

```javascript
api: {
  baseUrl: 'https://script.google.com/macros/s/AKfycbxlJgV5nCrI-7niYpcXXucPfpkVAw0AL-7dk6TZ6S8JSmN1zq6ZoJK4Y4AW0yTlXs7FvaQ/exec',
  // ...
}
``` 