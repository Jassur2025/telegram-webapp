// API интеграция для Telegram бота
// Этот файл содержит примеры для получения реальных данных из вашего бота

// Конфигурация API
const API_CONFIG = {
  baseUrl: 'https://script.google.com/macros/s/AKfycbxlJgV5nCrI-7niYpcXXucPfpkVAw0AL-7dk6TZ6S8JSmN1zq6ZoJK4Y4AW0yTlXs7FvaQ/exec',
  token: '',
  timeout: 10000
};

// Получение данных пользователя из вашего бота
async function fetchUserDataFromBot(chatId) {
  try {
    const response = await fetch(`${API_CONFIG.baseUrl}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
      },
      body: JSON.stringify({
        action: 'getUserData',
        chat_id: chatId
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return transformBotData(data);
  } catch (error) {
    console.error('Ошибка получения данных из бота:', error);
    throw error;
  }
}

// Трансформация данных из формата бота в формат веб-приложения
function transformBotData(botData) {
  const transformed = {
    transactions: [],
    categories: {},
    totals: {
      income: 0,
      expense: 0,
      balance: 0
    }
  };

  // Обработка доходов
  if (botData.incomes && Array.isArray(botData.incomes)) {
    botData.incomes.forEach(income => {
      transformed.transactions.push({
        id: `income_${income.id || Date.now()}`,
        date: formatDateForWeb(income.date),
        category: income.category || 'Доход',
        amount: parseFloat(income.amount) || 0,
        type: 'income',
        comment: income.comment || ''
      });

      // Подсчет общей суммы доходов
      transformed.totals.income += parseFloat(income.amount) || 0;
    });
  }

  // Обработка расходов
  if (botData.expenses && Array.isArray(botData.expenses)) {
    botData.expenses.forEach(expense => {
      transformed.transactions.push({
        id: `expense_${expense.id || Date.now()}`,
        date: formatDateForWeb(expense.date),
        category: expense.category || 'Расход',
        amount: parseFloat(expense.amount) || 0,
        type: 'expense',
        comment: expense.comment || ''
      });

      // Подсчет общей суммы расходов
      transformed.totals.expense += parseFloat(expense.amount) || 0;
    });
  }

  // Сортировка транзакций по дате (новые сначала)
  transformed.transactions.sort((a, b) => new Date(b.date) - new Date(a.date));

  // Подсчет баланса
  transformed.totals.balance = transformed.totals.income - transformed.totals.expense;

  // Группировка по категориям
  const categoryStats = {};
  transformed.transactions.forEach(transaction => {
    if (!categoryStats[transaction.category]) {
      categoryStats[transaction.category] = {
        amount: 0,
        count: 0
      };
    }
    categoryStats[transaction.category].amount += transaction.amount;
    categoryStats[transaction.category].count += 1;
  });

  // Вычисление процентов для категорий
  Object.keys(categoryStats).forEach(category => {
    const totalForType = transformed.totals[transaction.type];
    const percentage = totalForType > 0 ? (categoryStats[category].amount / totalForType) * 100 : 0;
    
    transformed.categories[category] = {
      amount: categoryStats[category].amount,
      percentage: Math.round(percentage * 10) / 10
    };
  });

  return transformed;
}

// Форматирование даты для веб-приложения
function formatDateForWeb(dateString) {
  if (!dateString) return new Date().toISOString().split('T')[0];
  
  // Если дата в формате DD.MM.YYYY
  if (dateString.includes('.')) {
    const [day, month, year] = dateString.split('.');
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  
  // Если дата в формате Date object
  if (dateString instanceof Date) {
    return dateString.toISOString().split('T')[0];
  }
  
  // Если дата уже в формате YYYY-MM-DD
  if (dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
    return dateString;
  }
  
  // По умолчанию возвращаем текущую дату
  return new Date().toISOString().split('T')[0];
}

// Получение данных за определенный период
async function fetchPeriodData(chatId, startDate, endDate) {
  try {
    const response = await fetch(`${API_CONFIG.baseUrl}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        action: 'getPeriodData',
        chat_id: chatId,
        startDate: startDate,
        endDate: endDate
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return transformBotData(data);
  } catch (error) {
    console.error('Ошибка получения данных за период:', error);
    throw error;
  }
}

// Получение статистики по категориям
async function fetchCategoryStats(chatId, period = 'current_month') {
  try {
    const response = await fetch(`${API_CONFIG.baseUrl}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        action: 'getCategoryStats',
        chat_id: chatId,
        period: period
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return data.categories || {};
  } catch (error) {
    console.error('Ошибка получения статистики категорий:', error);
    throw error;
  }
}

// Экспорт данных в PDF
async function exportToPDF(chatId, period = 'current_month') {
  try {
    const response = await fetch(`${API_CONFIG.baseUrl}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        action: 'exportToPDF',
        chat_id: chatId,
        period: period,
        includeCharts: true
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `financial_report_${period}.pdf`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  } catch (error) {
    console.error('Ошибка экспорта в PDF:', error);
    throw error;
  }
}

// Проверка авторизации пользователя
async function checkUserAuth(chatId) {
  try {
    const response = await fetch(`${API_CONFIG.baseUrl}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        action: 'checkAuth',
        chat_id: chatId
      })
    });

    if (!response.ok) {
      return false;
    }

    const data = await response.json();
    return data.authorized || false;
  } catch (error) {
    console.error('Ошибка проверки авторизации:', error);
    return false;
  }
}

// Обработка ошибок API
function handleApiError(error) {
  let message = 'Произошла ошибка при загрузке данных';
  
  if (error.message.includes('401')) {
    message = 'Необходима авторизация. Пожалуйста, войдите в бота.';
  } else if (error.message.includes('403')) {
    message = 'Доступ запрещен. Проверьте права доступа.';
  } else if (error.message.includes('404')) {
    message = 'Данные не найдены.';
  } else if (error.message.includes('500')) {
    message = 'Ошибка сервера. Попробуйте позже.';
  } else if (error.message.includes('timeout')) {
    message = 'Превышено время ожидания. Проверьте соединение.';
  }
  
  return message;
}

// Инициализация API при загрузке страницы
function initApi() {
  // Получаем chat_id из Telegram WebApp
  const user = Telegram.WebApp.initDataUnsafe?.user;
  const chatId = user?.id;
  
  if (!chatId) {
    console.warn('Chat ID не найден, используем демо режим');
    return null;
  }
  
  return chatId;
}

// Экспорт функций для использования в основном скрипте
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    fetchUserDataFromBot,
    fetchPeriodData,
    fetchCategoryStats,
    exportToPDF,
    checkUserAuth,
    handleApiError,
    initApi
  };
} 