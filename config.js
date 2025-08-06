// Конфигурация мини-приложения
// Измените эти настройки под ваши нужды

const CONFIG = {
  // Основные настройки
  appName: 'Финансовый отчёт',
  appVersion: '1.0.0',
  
  // Настройки API
  api: {
    baseUrl: 'https://your-api-domain.com/api',
    token: 'YOUR_API_TOKEN',
    timeout: 10000,
    retryAttempts: 3
  },
  
  // Настройки отображения
  display: {
    currency: '₸', // Валюта (₸, $, €, ₽)
    dateFormat: 'DD.MM.YYYY', // Формат даты
    numberFormat: 'ru-RU', // Локаль для чисел
    timezone: 'Asia/Tashkent' // Часовой пояс
  },
  
  // Настройки графиков
  charts: {
    colors: {
      income: ['#28a745', '#20c997', '#17a2b8', '#6f42c1'],
      expense: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40']
    },
    animation: true,
    responsive: true
  },
  
  // Настройки фильтров
  filters: {
    defaultPeriod: 'current', // current, last, week, custom
    defaultType: 'all', // all, income, expense
    maxPeriodDays: 365 // Максимальный период в днях
  },
  
  // Настройки категорий
  categories: {
    icons: {
      'Продукты': '🛒',
      'Транспорт': '🚗',
      'Развлечения': '🎬',
      'Зарплата': '💰',
      'Продажа': '📦',
      'Такси': '🚕',
      'Одежда': '👕',
      'Ресторан': '🍽️',
      'Кино': '🎭',
      'Спорт': '⚽',
      'Здоровье': '🏥',
      'Образование': '📚',
      'Путешествия': '✈️',
      'Подарки': '🎁',
      'Комунальные': '🏠',
      'Интернет': '🌐',
      'Телефон': '📱',
      'Другое': '📊'
    },
    incomeCategories: ['Зарплата', 'Продажа', 'Возврат', 'Кешбек', 'Доход']
  },
  
  // Настройки уведомлений
  notifications: {
    enabled: true,
    duration: 3000, // Длительность в миллисекундах
    position: 'top-right' // top-right, top-left, bottom-right, bottom-left
  },
  
  // Настройки кеширования
  cache: {
    enabled: true,
    duration: 5 * 60 * 1000, // 5 минут в миллисекундах
    maxSize: 10 * 1024 * 1024 // 10 МБ
  },
  
  // Настройки безопасности
  security: {
    validateData: true,
    sanitizeInput: true,
    maxRequestSize: 1024 * 1024 // 1 МБ
  },
  
  // Настройки локализации
  localization: {
    defaultLanguage: 'ru',
    supportedLanguages: ['ru', 'uz', 'en'],
    fallbackLanguage: 'ru'
  },
  
  // Настройки отладки
  debug: {
    enabled: false,
    logLevel: 'error', // error, warn, info, debug
    showPerformance: false
  }
};

// Функции для работы с конфигурацией
const ConfigManager = {
  // Получение значения конфигурации
  get(key) {
    const keys = key.split('.');
    let value = CONFIG;
    
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        return undefined;
      }
    }
    
    return value;
  },
  
  // Установка значения конфигурации
  set(key, value) {
    const keys = key.split('.');
    let obj = CONFIG;
    
    for (let i = 0; i < keys.length - 1; i++) {
      const k = keys[i];
      if (!(k in obj) || typeof obj[k] !== 'object') {
        obj[k] = {};
      }
      obj = obj[k];
    }
    
    obj[keys[keys.length - 1]] = value;
  },
  
  // Проверка наличия ключа
  has(key) {
    return this.get(key) !== undefined;
  },
  
  // Получение всех настроек
  getAll() {
    return JSON.parse(JSON.stringify(CONFIG));
  },
  
  // Сброс к значениям по умолчанию
  reset() {
    Object.keys(CONFIG).forEach(key => {
      delete CONFIG[key];
    });
    
    // Перезагружаем конфигурацию
    location.reload();
  }
};

// Функции для работы с валютой
const CurrencyManager = {
  format(amount, currency = CONFIG.display.currency) {
    const formatter = new Intl.NumberFormat(CONFIG.display.numberFormat, {
      style: 'currency',
      currency: currency === '₸' ? 'UZS' : currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    });
    
    return formatter.format(amount);
  },
  
  parse(value) {
    return parseFloat(value.replace(/[^\d.-]/g, '')) || 0;
  }
};

// Функции для работы с датами
const DateManager = {
  format(date, format = CONFIG.display.dateFormat) {
    const d = new Date(date);
    
    if (isNaN(d.getTime())) {
      return '';
    }
    
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    
    return format
      .replace('DD', day)
      .replace('MM', month)
      .replace('YYYY', year);
  },
  
  parse(dateString) {
    if (!dateString) return new Date();
    
    // Парсим формат DD.MM.YYYY
    const match = dateString.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
    if (match) {
      const [, day, month, year] = match;
      return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    }
    
    // Парсим формат YYYY-MM-DD
    const isoMatch = dateString.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoMatch) {
      const [, year, month, day] = isoMatch;
      return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    }
    
    return new Date(dateString);
  },
  
  getPeriodDates(period) {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    switch (period) {
      case 'current':
        return {
          start: new Date(currentYear, currentMonth, 1),
          end: new Date(currentYear, currentMonth + 1, 0)
        };
      case 'last':
        const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
        const lastYear = currentMonth === 0 ? currentYear - 1 : currentYear;
        return {
          start: new Date(lastYear, lastMonth, 1),
          end: new Date(lastYear, lastMonth + 1, 0)
        };
      case 'week':
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return {
          start: weekAgo,
          end: now
        };
      default:
        return {
          start: new Date(currentYear, currentMonth, 1),
          end: now
        };
    }
  }
};

// Функции для работы с категориями
const CategoryManager = {
  getIcon(categoryName) {
    return CONFIG.categories.icons[categoryName] || '📊';
  },
  
  isIncome(categoryName) {
    return CONFIG.categories.incomeCategories.includes(categoryName);
  },
  
  getIncomeCategories() {
    return CONFIG.categories.incomeCategories;
  },
  
  getExpenseCategories() {
    return Object.keys(CONFIG.categories.icons).filter(
      cat => !this.isIncome(cat)
    );
  },
  
  getAllCategories() {
    return Object.keys(CONFIG.categories.icons);
  }
};

// Функции для работы с уведомлениями
const NotificationManager = {
  show(message, type = 'info') {
    if (!CONFIG.notifications.enabled) return;
    
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    // Добавляем стили
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${type === 'error' ? '#dc3545' : type === 'success' ? '#28a745' : '#007bff'};
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 10000;
      animation: slideIn 0.3s ease;
    `;
    
    document.body.appendChild(notification);
    
    // Удаляем через указанное время
    setTimeout(() => {
      notification.style.animation = 'slideOut 0.3s ease';
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }, CONFIG.notifications.duration);
  },
  
  success(message) {
    this.show(message, 'success');
  },
  
  error(message) {
    this.show(message, 'error');
  },
  
  warning(message) {
    this.show(message, 'warning');
  }
};

// Функции для работы с кешем
const CacheManager = {
  set(key, value, ttl = CONFIG.cache.duration) {
    if (!CONFIG.cache.enabled) return;
    
    const item = {
      value: value,
      timestamp: Date.now(),
      ttl: ttl
    };
    
    try {
      localStorage.setItem(`cache_${key}`, JSON.stringify(item));
    } catch (error) {
      console.warn('Ошибка сохранения в кеш:', error);
    }
  },
  
  get(key) {
    if (!CONFIG.cache.enabled) return null;
    
    try {
      const item = localStorage.getItem(`cache_${key}`);
      if (!item) return null;
      
      const data = JSON.parse(item);
      const now = Date.now();
      
      if (now - data.timestamp > data.ttl) {
        this.remove(key);
        return null;
      }
      
      return data.value;
    } catch (error) {
      console.warn('Ошибка чтения из кеша:', error);
      return null;
    }
  },
  
  remove(key) {
    try {
      localStorage.removeItem(`cache_${key}`);
    } catch (error) {
      console.warn('Ошибка удаления из кеша:', error);
    }
  },
  
  clear() {
    try {
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('cache_')) {
          localStorage.removeItem(key);
        }
      });
    } catch (error) {
      console.warn('Ошибка очистки кеша:', error);
    }
  }
};

// Экспорт для использования в других файлах
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    CONFIG,
    ConfigManager,
    CurrencyManager,
    DateManager,
    CategoryManager,
    NotificationManager,
    CacheManager
  };
} 