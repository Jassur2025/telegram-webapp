// Глобальные переменные
let currentData = {
  transactions: [],
  categories: {},
  totals: { income: 0, expense: 0, balance: 0 }
};

let charts = {
  expenseChart: null,
  incomeChart: null
};

// Инициализация приложения
window.addEventListener('DOMContentLoaded', () => {
  // Инициализация Telegram WebApp
  Telegram.WebApp.ready();
  
  // Настройка темы
  setupTheme();
  
  // Инициализация вкладок
  initTabs();
  
  // Инициализация фильтров
  initFilters();
  
  // Загрузка данных
  loadData();
});

// Настройка темы Telegram
function setupTheme() {
  const themeParams = Telegram.WebApp.themeParams;
  const root = document.documentElement;
  
  if (themeParams) {
    Object.keys(themeParams).forEach(key => {
      root.style.setProperty(`--tg-theme-${key}`, themeParams[key]);
    });
  }
}

// Инициализация вкладок
function initTabs() {
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabPanes = document.querySelectorAll('.tab-pane');
  
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.getAttribute('data-tab');
      
      // Убираем активный класс со всех кнопок и панелей
      tabBtns.forEach(b => b.classList.remove('active'));
      tabPanes.forEach(p => p.classList.remove('active'));
      
      // Добавляем активный класс к выбранной кнопке и панели
      btn.classList.add('active');
      document.getElementById(targetTab).classList.add('active');
      
      // Обновляем данные для активной вкладки
      updateTabContent(targetTab);
    });
  });
}

// Инициализация фильтров
function initFilters() {
  const periodFilter = document.getElementById('periodFilter');
  const typeFilter = document.getElementById('typeFilter');
  
  periodFilter.addEventListener('change', () => {
    filterTransactions();
  });
  
  typeFilter.addEventListener('change', () => {
    filterTransactions();
  });
}

// Загрузка данных
async function loadData() {
  showLoading();
  
  try {
    // Получаем данные пользователя из Telegram
    const user = Telegram.WebApp.initDataUnsafe?.user;
    const chatId = user?.id || 'demo';
    
    // Загружаем данные (в реальном приложении здесь будет API запрос)
    const data = await fetchUserData(chatId);
    currentData = data;
    
    // Обновляем интерфейс
    updateBalance();
    updateTransactions();
    updateCategories();
    updateCharts();
    
  } catch (error) {
    console.error('Ошибка загрузки данных:', error);
    showError('Не удалось загрузить данные');
  }
}

// Получение данных пользователя
async function fetchUserData(chatId) {
  console.log('🔍 Загружаем данные для chatId:', chatId);
  console.log('🔗 API URL:', CONFIG.api.baseUrl);
  
  try {
    const url = `${CONFIG.api.baseUrl}?chat_id=${chatId}`;
    console.log('📡 Отправляем запрос к:', url);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    console.log('📥 Получен ответ:', response.status, response.statusText);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('📊 Полученные данные:', data);
    
    if (data.error) {
      throw new Error(data.error);
    }

    if (!data.transactions || !data.totals) {
      throw new Error('Неверный формат данных от API');
    }

    console.log('✅ Данные успешно загружены');
    return data;
  } catch (error) {
    console.error('❌ Ошибка загрузки данных:', error);
    console.error('🔍 Детали ошибки:', error.message);
    
    // Показываем уведомление об ошибке
    if (typeof Telegram !== 'undefined' && Telegram.WebApp) {
      Telegram.WebApp.showAlert(`Ошибка загрузки данных: ${error.message}`);
    }
    
    // Возвращаем демо данные в случае ошибки
    console.log('🔄 Возвращаем демо данные');
    return {
      transactions: [
        {
          id: 1,
          date: '2024-01-15',
          category: 'Продукты',
          amount: 25000,
          type: 'expense',
          comment: 'Magnum'
        },
        {
          id: 2,
          date: '2024-01-14',
          category: 'Зарплата',
          amount: 500000,
          type: 'income',
          comment: 'Зарплата за январь'
        },
        {
          id: 3,
          date: '2024-01-13',
          category: 'Транспорт',
          amount: 15000,
          type: 'expense',
          comment: 'Такси'
        },
        {
          id: 4,
          date: '2024-01-12',
          category: 'Развлечения',
          amount: 80000,
          type: 'expense',
          comment: 'Кино'
        },
        {
          id: 5,
          date: '2024-01-11',
          category: 'Продажа',
          amount: 150000,
          type: 'income',
          comment: 'Продажа вещей'
        }
      ],
      categories: {
        'Продукты': { amount: 25000, percentage: 20 },
        'Транспорт': { amount: 15000, percentage: 12 },
        'Развлечения': { amount: 80000, percentage: 64 },
        'Зарплата': { amount: 500000, percentage: 100 },
        'Продажа': { amount: 150000, percentage: 100 }
      },
      totals: {
        income: 650000,
        expense: 120000,
        balance: 530000
      }
    };
  }
}

// Обновление баланса
function updateBalance() {
  document.getElementById('totalIncome').textContent = formatMoney(currentData.totals.income) + ' ₸';
  document.getElementById('totalExpense').textContent = formatMoney(currentData.totals.expense) + ' ₸';
  document.getElementById('totalBalance').textContent = formatMoney(currentData.totals.balance) + ' ₸';
}

// Обновление списка транзакций
function updateTransactions() {
  const container = document.getElementById('transactionsList');
  const transactions = currentData.transactions;
  
  if (transactions.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📊</div>
        <div class="empty-state-text">Нет транзакций</div>
        <div class="empty-state-subtext">Добавьте первую транзакцию в боте</div>
      </div>
    `;
    return;
  }
  
  container.innerHTML = transactions.map(transaction => `
    <div class="transaction-item">
      <div class="transaction-info">
        <div class="transaction-category">${transaction.category}</div>
        <div class="transaction-date">${formatDate(transaction.date)}</div>
        ${transaction.comment ? `<div class="transaction-comment">${transaction.comment}</div>` : ''}
      </div>
      <div class="transaction-amount ${transaction.type}">
        ${transaction.type === 'income' ? '+' : '-'}${formatMoney(transaction.amount)} ₸
      </div>
    </div>
  `).join('');
}

// Обновление категорий
function updateCategories() {
  const container = document.getElementById('categoriesGrid');
  const categories = currentData.categories;
  
  if (Object.keys(categories).length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📊</div>
        <div class="empty-state-text">Нет данных по категориям</div>
        <div class="empty-state-subtext">Добавьте транзакции для анализа</div>
      </div>
    `;
    return;
  }
  
  container.innerHTML = Object.entries(categories).map(([name, data]) => `
    <div class="category-card">
      <div class="category-icon">${getCategoryIcon(name)}</div>
      <div class="category-name">${name}</div>
      <div class="category-amount">${formatMoney(data.amount)} ₸</div>
      <div class="category-percentage">${data.percentage}%</div>
    </div>
  `).join('');
}

// Обновление графиков
function updateCharts() {
  updateExpenseChart();
  updateIncomeChart();
}

// График расходов
function updateExpenseChart() {
  const ctx = document.getElementById('expenseChart');
  if (!ctx) return;
  
  // Уничтожаем предыдущий график
  if (charts.expenseChart) {
    charts.expenseChart.destroy();
  }
  
  const expenseCategories = Object.entries(currentData.categories)
    .filter(([name, data]) => data.amount > 0)
    .sort((a, b) => b[1].amount - a[1].amount);
  
  if (expenseCategories.length === 0) {
    ctx.parentElement.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-text">Нет данных для графика</div>
      </div>
    `;
    return;
  }
  
  charts.expenseChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: expenseCategories.map(([name]) => name),
      datasets: [{
        data: expenseCategories.map(([, data]) => data.amount),
        backgroundColor: [
          '#FF6384',
          '#36A2EB',
          '#FFCE56',
          '#4BC0C0',
          '#9966FF',
          '#FF9F40'
        ]
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom'
        },
        title: {
          display: true,
          text: 'Расходы по категориям'
        }
      }
    }
  });
}

// График доходов
function updateIncomeChart() {
  const ctx = document.getElementById('incomeChart');
  if (!ctx) return;
  
  // Уничтожаем предыдущий график
  if (charts.incomeChart) {
    charts.incomeChart.destroy();
  }
  
  const incomeCategories = Object.entries(currentData.categories)
    .filter(([name, data]) => data.amount > 0 && isIncomeCategory(name))
    .sort((a, b) => b[1].amount - a[1].amount);
  
  if (incomeCategories.length === 0) {
    ctx.parentElement.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-text">Нет данных для графика</div>
      </div>
    `;
    return;
  }
  
  charts.incomeChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: incomeCategories.map(([name]) => name),
      datasets: [{
        data: incomeCategories.map(([, data]) => data.amount),
        backgroundColor: [
          '#28a745',
          '#20c997',
          '#17a2b8',
          '#6f42c1'
        ]
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom'
        },
        title: {
          display: true,
          text: 'Доходы по категориям'
        }
      }
    }
  });
}

// Обновление содержимого вкладки
function updateTabContent(tabName) {
  switch (tabName) {
    case 'transactions':
      filterTransactions();
      break;
    case 'charts':
      updateCharts();
      break;
    case 'categories':
      updateCategories();
      break;
  }
}

// Фильтрация транзакций
function filterTransactions() {
  const periodFilter = document.getElementById('periodFilter').value;
  const typeFilter = document.getElementById('typeFilter').value;
  
  let filteredTransactions = [...currentData.transactions];
  
  // Фильтр по периоду
  if (periodFilter !== 'all') {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    filteredTransactions = filteredTransactions.filter(transaction => {
      const transactionDate = new Date(transaction.date);
      
      switch (periodFilter) {
        case 'current':
          return transactionDate.getMonth() === currentMonth && 
                 transactionDate.getFullYear() === currentYear;
        case 'last':
          const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
          const lastYear = currentMonth === 0 ? currentYear - 1 : currentYear;
          return transactionDate.getMonth() === lastMonth && 
                 transactionDate.getFullYear() === lastYear;
        case 'week':
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          return transactionDate >= weekAgo;
        default:
          return true;
      }
    });
  }
  
  // Фильтр по типу
  if (typeFilter !== 'all') {
    filteredTransactions = filteredTransactions.filter(transaction => 
      transaction.type === typeFilter
    );
  }
  
  // Обновляем отображение
  const container = document.getElementById('transactionsList');
  
  if (filteredTransactions.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🔍</div>
        <div class="empty-state-text">Нет транзакций</div>
        <div class="empty-state-subtext">Попробуйте изменить фильтры</div>
      </div>
    `;
    return;
  }
  
  container.innerHTML = filteredTransactions.map(transaction => `
    <div class="transaction-item">
      <div class="transaction-info">
        <div class="transaction-category">${transaction.category}</div>
        <div class="transaction-date">${formatDate(transaction.date)}</div>
        ${transaction.comment ? `<div class="transaction-comment">${transaction.comment}</div>` : ''}
      </div>
      <div class="transaction-amount ${transaction.type}">
        ${transaction.type === 'income' ? '+' : '-'}${formatMoney(transaction.amount)} ₸
      </div>
    </div>
  `).join('');
}

// Обновление данных
function refreshData() {
  loadData();
}

// Скачивание отчета
function downloadReport() {
  // В реальном приложении здесь будет генерация PDF
  Telegram.WebApp.showAlert('Функция скачивания отчета будет доступна в следующем обновлении');
}

// Вспомогательные функции
function formatMoney(amount) {
  return new Intl.NumberFormat('ru-RU').format(amount);
}

function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

function getCategoryIcon(categoryName) {
  const icons = {
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
    'Телефон': '📱'
  };
  
  return icons[categoryName] || '📊';
}

function isIncomeCategory(categoryName) {
  const incomeCategories = ['Зарплата', 'Продажа', 'Возврат', 'Кешбек', 'Доход'];
  return incomeCategories.includes(categoryName);
}

function showLoading() {
  const containers = ['transactionsList', 'categoriesGrid'];
  containers.forEach(id => {
    const container = document.getElementById(id);
    if (container) {
      container.innerHTML = '<div class="loading">Загрузка данных...</div>';
    }
  });
}

function showError(message) {
  const containers = ['transactionsList', 'categoriesGrid'];
  containers.forEach(id => {
    const container = document.getElementById(id);
    if (container) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">❌</div>
          <div class="empty-state-text">Ошибка</div>
          <div class="empty-state-subtext">${message}</div>
        </div>
      `;
    }
  });
}