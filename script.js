// Глобальные переменные
let currentData = {
  transactions: [],
  categories: {},
  totals: { income: 0, expense: 0, balance: 0 },
  goals: [],
  debts: [],
  user: null
};

let charts = {
  expenseChart: null,
  incomeChart: null,
  trendChart: null
};

let currentPeriod = {
  type: 'current',
  startDate: null,
  endDate: null
};

// Инициализация приложения
window.addEventListener('DOMContentLoaded', () => {
  // Инициализация Telegram WebApp
  Telegram.WebApp.ready();
  
  // Настройка темы
  setupTheme();
  
  // Инициализация пользователя
  initUser();
  
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

// Инициализация пользователя
function initUser() {
  const user = Telegram.WebApp.initDataUnsafe?.user;
  if (user) {
    currentData.user = user;
    updateUserInfo();
  }
}

// Обновление информации о пользователе
function updateUserInfo() {
  const userInfo = document.getElementById('userInfo');
  if (userInfo && currentData.user) {
    userInfo.innerHTML = `
      <div class="user-avatar">
        ${currentData.user.first_name ? currentData.user.first_name.charAt(0).toUpperCase() : 'U'}
      </div>
      <div class="user-details">
        <div class="user-name">${currentData.user.first_name || 'Пользователь'}</div>
        <div class="user-id">ID: ${currentData.user.id}</div>
      </div>
    `;
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
    if (periodFilter.value === 'custom') {
      showCustomPeriodModal();
    } else {
      currentPeriod.type = periodFilter.value;
      filterTransactions();
    }
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
    
    // Загружаем данные
    const data = await fetchUserData(chatId);
    currentData = { ...currentData, ...data };
    
    // Загружаем дополнительные данные
    await loadGoals(chatId);
    await loadDebts(chatId);
    
    // Обновляем интерфейс
    updateBalance();
    updateTransactions();
    updateCategories();
    updateGoals();
    updateDebts();
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
    return getDemoData();
  }
}

// Загрузка целей
async function loadGoals(chatId) {
  try {
    // В реальном приложении здесь будет API запрос для целей
    currentData.goals = [
      {
        id: 1,
        name: 'Новый телефон',
        target: 5000000,
        current: 1500000,
        deadline: '2024-12-31',
        category: 'Техника'
      },
      {
        id: 2,
        name: 'Отпуск',
        target: 2000000,
        current: 800000,
        deadline: '2024-06-30',
        category: 'Путешествия'
      }
    ];
  } catch (error) {
    console.error('Ошибка загрузки целей:', error);
    currentData.goals = [];
  }
}

// Загрузка долгов
async function loadDebts(chatId) {
  try {
    // В реальном приложении здесь будет API запрос для долгов
    currentData.debts = [
      {
        id: 1,
        type: 'debt',
        counterparty: 'Али',
        amount: 500000,
        currency: 'UZS',
        description: 'Взял в долг',
        dueDate: '2024-02-15',
        status: 'active'
      },
      {
        id: 2,
        type: 'credit',
        counterparty: 'Мария',
        amount: 300000,
        currency: 'UZS',
        description: 'Дал в долг',
        dueDate: '2024-01-30',
        status: 'active'
      }
    ];
  } catch (error) {
    console.error('Ошибка загрузки долгов:', error);
    currentData.debts = [];
  }
}

// Демо данные
function getDemoData() {
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

// Обновление целей
function updateGoals() {
  const container = document.getElementById('goalsContainer');
  const goals = currentData.goals;
  
  if (goals.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🎯</div>
        <div class="empty-state-text">Нет целей</div>
        <div class="empty-state-subtext">Создайте первую цель в боте</div>
      </div>
    `;
    return;
  }
  
  container.innerHTML = goals.map(goal => {
    const progress = (goal.current / goal.target) * 100;
    const daysLeft = Math.ceil((new Date(goal.deadline) - new Date()) / (1000 * 60 * 60 * 24));
    
    return `
      <div class="goal-card">
        <div class="goal-header">
          <div class="goal-name">${goal.name}</div>
          <div class="goal-category">${goal.category}</div>
        </div>
        <div class="goal-progress">
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${progress}%"></div>
          </div>
          <div class="progress-text">${Math.round(progress)}%</div>
        </div>
        <div class="goal-details">
          <div class="goal-amount">
            ${formatMoney(goal.current)} / ${formatMoney(goal.target)} ₸
          </div>
          <div class="goal-deadline">
            ${daysLeft > 0 ? `${daysLeft} дней` : 'Просрочено'}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// Обновление долгов
function updateDebts() {
  const container = document.getElementById('debtsContainer');
  const debts = currentData.debts;
  
  if (debts.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">💸</div>
        <div class="empty-state-text">Нет долгов</div>
        <div class="empty-state-subtext">Управляйте долгами в боте</div>
      </div>
    `;
    return;
  }
  
  container.innerHTML = debts.map(debt => {
    const daysLeft = Math.ceil((new Date(debt.dueDate) - new Date()) / (1000 * 60 * 60 * 24));
    const isOverdue = daysLeft < 0;
    
    return `
      <div class="debt-card ${isOverdue ? 'overdue' : ''}">
        <div class="debt-header">
          <div class="debt-type">${debt.type === 'debt' ? 'Долг' : 'Кредит'}</div>
          <div class="debt-status ${debt.status}">${debt.status}</div>
        </div>
        <div class="debt-counterparty">${debt.counterparty}</div>
        <div class="debt-amount">${formatMoney(debt.amount)} ${debt.currency}</div>
        <div class="debt-description">${debt.description}</div>
        <div class="debt-deadline ${isOverdue ? 'overdue' : ''}">
          ${isOverdue ? 'Просрочено' : `${daysLeft} дней`}
        </div>
      </div>
    `;
  }).join('');
}

// Обновление графиков
function updateCharts() {
  updateExpenseChart();
  updateIncomeChart();
  updateTrendChart();
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
    .filter(([name, data]) => data.amount > 0 && !isIncomeCategory(name))
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
        backgroundColor: CONFIG.charts.colors.expense
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
        backgroundColor: CONFIG.charts.colors.income
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

// График трендов
function updateTrendChart() {
  const ctx = document.getElementById('trendChart');
  if (!ctx) return;
  
  // Уничтожаем предыдущий график
  if (charts.trendChart) {
    charts.trendChart.destroy();
  }
  
  // Группируем транзакции по дням
  const dailyData = {};
  currentData.transactions.forEach(transaction => {
    const date = transaction.date;
    if (!dailyData[date]) {
      dailyData[date] = { income: 0, expense: 0 };
    }
    if (transaction.type === 'income') {
      dailyData[date].income += transaction.amount;
    } else {
      dailyData[date].expense += transaction.amount;
    }
  });
  
  const dates = Object.keys(dailyData).sort();
  const incomeData = dates.map(date => dailyData[date].income);
  const expenseData = dates.map(date => dailyData[date].expense);
  
  if (dates.length === 0) {
    ctx.parentElement.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-text">Нет данных для графика</div>
      </div>
    `;
    return;
  }
  
  charts.trendChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: dates.map(date => formatDate(date)),
      datasets: [
        {
          label: 'Доходы',
          data: incomeData,
          borderColor: '#28a745',
          backgroundColor: 'rgba(40, 167, 69, 0.1)',
          tension: 0.4
        },
        {
          label: 'Расходы',
          data: expenseData,
          borderColor: '#dc3545',
          backgroundColor: 'rgba(220, 53, 69, 0.1)',
          tension: 0.4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top'
        },
        title: {
          display: true,
          text: 'Тренд доходов и расходов'
        }
      },
      scales: {
        y: {
          beginAtZero: true
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
    case 'goals':
      updateGoals();
      break;
    case 'debts':
      updateDebts();
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
    if (periodFilter === 'custom' && currentPeriod.startDate && currentPeriod.endDate) {
      filteredTransactions = filteredTransactions.filter(transaction => {
        const transactionDate = new Date(transaction.date);
        return transactionDate >= currentPeriod.startDate && 
               transactionDate <= currentPeriod.endDate;
      });
    } else {
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

// Показать модальное окно для произвольного периода
function showCustomPeriodModal() {
  const modal = document.getElementById('customPeriodModal');
  modal.style.display = 'flex';
  
  // Устанавливаем значения по умолчанию
  const today = new Date();
  const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  
  document.getElementById('startDate').value = lastMonth.toISOString().split('T')[0];
  document.getElementById('endDate').value = today.toISOString().split('T')[0];
}

// Применить произвольный период
function applyCustomPeriod() {
  const startDate = new Date(document.getElementById('startDate').value);
  const endDate = new Date(document.getElementById('endDate').value);
  
  if (startDate && endDate && startDate <= endDate) {
    currentPeriod.type = 'custom';
    currentPeriod.startDate = startDate;
    currentPeriod.endDate = endDate;
    
    closeModal();
    filterTransactions();
  } else {
    Telegram.WebApp.showAlert('Пожалуйста, выберите корректный период');
  }
}

// Закрыть модальное окно
function closeModal() {
  const modal = document.getElementById('customPeriodModal');
  modal.style.display = 'none';
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

// Открыть бота
function openBot() {
  if (currentData.user) {
    // Замените 'Personal_F_bot' на username вашего бота
    Telegram.WebApp.openTelegramLink(`https://t.me/Personal_F_bot?start=webapp_${currentData.user.id}`);
  } else {
    Telegram.WebApp.showAlert('Не удалось определить пользователя');
  }
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
  return CONFIG.categories.icons[categoryName] || '📊';
}

function isIncomeCategory(categoryName) {
  return CONFIG.categories.incomeCategories.includes(categoryName);
}

function showLoading() {
  const containers = ['transactionsList', 'categoriesGrid', 'goalsContainer', 'debtsContainer'];
  containers.forEach(id => {
    const container = document.getElementById(id);
    if (container) {
      container.innerHTML = '<div class="loading">Загрузка данных...</div>';
    }
  });
}

function showError(message) {
  const containers = ['transactionsList', 'categoriesGrid', 'goalsContainer', 'debtsContainer'];
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