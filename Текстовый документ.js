// =============================================
//               CONFIGURATION
// =============================================
const OWNER_ID = '1042926851'; // Ваш ID Владельца
const DEBUG_MODE = false;
const AI_ANALYSIS_DAYS = 90;

const SCRIPT_PROPS = PropertiesService.getScriptProperties();
const TELEGRAM_TOKEN = SCRIPT_PROPS.getProperty('TELEGRAM_TOKEN');
const GEMINI_API_KEY = SCRIPT_PROPS.getProperty('GEMINI_API_KEY');
const SPEECHKIT_KEY = SCRIPT_PROPS.getProperty('SPEECHKIT_KEY');
const SPEECHKIT_FOLDER_ID = SCRIPT_PROPS.getProperty('SPEECHKIT_FOLDER_ID');

const sheetExpense = 'Расходы';
const sheetIncome = 'Доходы';
const settingSheet = 'Setting';
const goalsSheet = 'Цели';
const budgetsSheet = 'Бюджеты';
const familiesSheet = 'Семьи';
const currencyRatesSheet = 'Курсы валют';
const debtsSheet = 'Долги';

// =============================================
//               CURRENCY CONFIGURATION
// =============================================
const CURRENCIES = {
  UZS: { name: 'Сум', symbol: 'сум', rate: 1 },
  USD: { name: 'Доллар', symbol: '$', rate: 12500 }, // Примерный курс 1 USD = 12500 UZS
  EUR: { name: 'Евро', symbol: '€', rate: 13500 },   // Примерный курс 1 EUR = 13500 UZS
  RUB: { name: 'Рубль', symbol: '₽', rate: 135 }     // Примерный курс 1 RUB = 135 UZS
};

const DEFAULT_CURRENCY = 'UZS';

// =============================================
//          INDIVIDUAL CURRENCY RATES
// =============================================
function getCurrencyRatesForUser(chat_id) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(currencyRatesSheet);
  if (!sheet || sheet.getLastRow() < 2) {
    // Если лист не существует или пуст, возвращаем дефолтные курсы
    return {
      USD: { name: 'Доллар', symbol: '$', rate: 12500 },
      EUR: { name: 'Евро', symbol: '€', rate: 13500 },
      RUB: { name: 'Рубль', symbol: '₽', rate: 135 }
    };
  }
  
  const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 4).getValues();
  const userRates = {};
  
  for (const row of data) {
    if (String(row[0]) === String(chat_id)) {
      const currency = row[1];
      const rate = parseFloat(row[2]) || 0;
      const symbol = row[3] || '';
      
      userRates[currency] = {
        name: CURRENCIES[currency]?.name || currency,
        symbol: symbol,
        rate: rate
      };
    }
  }
  
  // Если для пользователя нет курсов, возвращаем дефолтные
  if (Object.keys(userRates).length === 0) {
    return {
      USD: { name: 'Доллар', symbol: '$', rate: 12500 },
      EUR: { name: 'Евро', symbol: '€', rate: 13500 },
      RUB: { name: 'Рубль', symbol: '₽', rate: 135 }
    };
  }
  
  return userRates;
}

function setCurrencyRateForUser(chat_id, currency, rate) {
  Logger.log(`setCurrencyRateForUser: chat_id=${chat_id}, currency=${currency}, rate=${rate}`);
  
  let sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(currencyRatesSheet);
  
  // Создаем лист если не существует
  if (!sheet) {
    Logger.log(`Создаю новый лист ${currencyRatesSheet}`);
    sheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet(currencyRatesSheet);
    sheet.getRange(1, 1, 1, 4).setValues([['ChatID', 'Currency', 'Rate', 'Symbol']]);
  }
  
  // Ищем существующую запись
  const data = sheet.getRange(2, 1, Math.max(sheet.getLastRow() - 1, 1), 4).getValues();
  let rowIndex = -1;
  
  for (let i = 0; i < data.length; i++) {
    if (String(data[i][0]) === String(chat_id) && data[i][1] === currency) {
      rowIndex = i + 2; // +2 потому что начинаем с 2-й строки
      break;
    }
  }
  
  if (rowIndex === -1) {
    // Добавляем новую запись
    const symbol = CURRENCIES[currency]?.symbol || '';
    sheet.appendRow([chat_id, currency, rate, symbol]);
    Logger.log(`Добавлена новая запись курса для chat_id: ${chat_id}, currency: ${currency}, rate: ${rate}`);
  } else {
    // Обновляем существующую запись
    const symbol = CURRENCIES[currency]?.symbol || '';
    sheet.getRange(rowIndex, 1, 1, 4).setValues([[chat_id, currency, rate, symbol]]);
    Logger.log(`Обновлена существующая запись курса для chat_id: ${chat_id}, currency: ${currency}, rate: ${rate}`);
  }
}

function getCurrentUserCurrencyRates(chat_id) {
  return getCurrencyRatesForUser(chat_id);
}

function initializeUserCurrencyRates(chat_id) {
  // Инициализируем базовые курсы для нового пользователя
  const existingRates = getCurrencyRatesForUser(chat_id);
  
  // Проверяем, есть ли уже курсы для этого пользователя
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(currencyRatesSheet);
  if (sheet && sheet.getLastRow() > 1) {
    const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 4).getValues();
    const hasUserRates = data.some(row => String(row[0]) === String(chat_id));
    
    if (hasUserRates) {
      return; // У пользователя уже есть курсы
    }
  }
  
  // Создаем базовые курсы для нового пользователя
  setCurrencyRateForUser(chat_id, 'USD', 12500);
  setCurrencyRateForUser(chat_id, 'EUR', 13500);
  setCurrencyRateForUser(chat_id, 'RUB', 135);
  
  Logger.log(`Инициализированы базовые курсы для пользователя: ${chat_id}`);
}

// =============================================
//                DEBT MANAGEMENT
// =============================================
function getDebtsAndCredits(userIds) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(debtsSheet);
  
  // Если лист не существует, создаем его
  if (!sheet) {
    const newSheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet(debtsSheet);
    newSheet.getRange(1, 1, 1, 12).setValues([
      ['Дата', 'ChatID', 'Тип', 'Контрагент', 'Сумма', 'Валюта', 'Сумма_UZS', 'Описание', 'Дата_возврата', 'Статус', 'Дата_погашения', 'Сумма_погашения']
    ]);
    return { totalDebt: 0, totalCredit: 0 }; // Новый лист - нет долгов
  }
  
  if (sheet.getLastRow() < 2) {
    return { totalDebt: 0, totalCredit: 0 }; // Нет данных
  }
  
  const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 12).getValues();
  let totalDebt = 0;    // Сколько пользователь должен (дебет)
  let totalCredit = 0;  // Сколько пользователю должны (кредит)
  
  data.forEach(row => {
    if (userIds.includes(String(row[1])) && row[9] === 'Активен') { // row[1] = ChatID, row[9] = Статус
      const type = row[2];        // Дебет или Кредит
      const amountUZS = parseFloat(row[6]) || 0; // Сумма в UZS
      const paidAmount = parseFloat(row[11]) || 0; // Погашенная сумма
      const remainingAmount = amountUZS - paidAmount;
      
      if (remainingAmount > 0) {
        if (type === 'Дебет') {
          totalDebt += remainingAmount;      // Я должен
        } else if (type === 'Кредит') {
          totalCredit += remainingAmount;    // Мне должны
        }
      }
    }
  });
  
  return { totalDebt, totalCredit };
}

function addDebtRecord(chat_id, type, counterparty, amount, currency, amountInUZS, description, dueDate) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(debtsSheet);
  
  // Если лист не существует, создаем его
  if (!sheet) {
    const newSheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet(debtsSheet);
    newSheet.getRange(1, 1, 1, 12).setValues([
      ['Дата', 'ChatID', 'Тип', 'Контрагент', 'Сумма', 'Валюта', 'Сумма_UZS', 'Описание', 'Дата_возврата', 'Статус', 'Дата_погашения', 'Сумма_погашения']
    ]);
  }
  
  const currentDate = new Date();
  // Пользовательская дата возврата (dueDate) может быть объектом Date или строкой.
  // Если параметр не передан, оставляем ячейку пустой, чтобы пользователь мог установить позже.
  const returnDate = dueDate ? dueDate : '';
  
  // Добавляем новую запись о долге
  sheet.appendRow([
    currentDate,           // A: Дата создания
    chat_id,              // B: ChatID
    type,                 // C: Тип (Дебет/Кредит)
    counterparty,         // D: Контрагент
    amount,               // E: Сумма (оригинальная)
    currency,             // F: Валюта
    amountInUZS,          // G: Сумма в UZS
    description,          // H: Описание
    returnDate,           // I: Планируемая дата возврата
    'Активен',            // J: Статус
    '',                   // K: Дата погашения (пусто)
    0                     // L: Сумма погашения (0)
  ]);
  
  Logger.log(`Добавлен долг: ${type} ${counterparty} ${amount} ${currency} для chat_id: ${chat_id}`);
}

function getActiveDebtsForUser(chat_id) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(debtsSheet);
  
  if (!sheet || sheet.getLastRow() < 2) {
    return [];
  }
  
  const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 12).getValues();
  const activeDebts = [];
  
  data.forEach((row, index) => {
    if (String(row[1]) === String(chat_id) && row[9] === 'Активен') { // row[1] = ChatID, row[9] = Статус
      const type = row[2];           // Дебет или Кредит
      const counterparty = row[3];   // Контрагент
      const amount = parseFloat(row[4]) || 0;        // Сумма (оригинальная)
      const currency = row[5];       // Валюта
      const amountInUZS = parseFloat(row[6]) || 0;   // Сумма в UZS
      const description = row[7];    // Описание
      const dueDate = row[8];        // Дата возврата
      const paidAmount = parseFloat(row[11]) || 0;   // Погашенная сумма
      const remainingAmount = amountInUZS - paidAmount;
      
      if (remainingAmount > 0) {
        activeDebts.push({
          rowIndex: index + 2, // +2 потому что начинаем с 2-й строки
          type,
          counterparty,
          amount,
          currency,
          amountInUZS,
          description,
          dueDate,
          paidAmount,
          remainingAmount
        });
      }
    }
  });
  
  return activeDebts;
}

// =============================================
//             DEBT DUE DATE MANAGEMENT
// =============================================
function getOverdueDebts(chat_id) {
  const activeDebts = getActiveDebtsForUser(chat_id);
  const now = new Date();
  const overdueDebts = [];
  
  activeDebts.forEach(debt => {
    const dueDate = new Date(debt.dueDate);
    if (dueDate < now) {
      const daysOverdue = Math.ceil((now - dueDate) / (1000 * 60 * 60 * 24));
      overdueDebts.push({
        ...debt,
        daysOverdue
      });
    }
  });
  
  return overdueDebts;
}

function getUpcomingDebts(chat_id, daysAhead = 7) {
  const activeDebts = getActiveDebtsForUser(chat_id);
  const now = new Date();
  const futureDate = new Date(now.getTime() + (daysAhead * 24 * 60 * 60 * 1000));
  const upcomingDebts = [];
  
  activeDebts.forEach(debt => {
    const dueDate = new Date(debt.dueDate);
    if (dueDate >= now && dueDate <= futureDate) {
      const daysUntilDue = Math.ceil((dueDate - now) / (1000 * 60 * 60 * 24));
      upcomingDebts.push({
        ...debt,
        daysUntilDue
      });
    }
  });
  
  return upcomingDebts;
}

function checkDebtNotifications(chat_id) {
  const overdueDebts = getOverdueDebts(chat_id);
  const upcomingDebts = getUpcomingDebts(chat_id, 3); // 3 дня вперед
  
  let notifications = [];
  
  // Уведомления о просроченных долгах
  if (overdueDebts.length > 0) {
    let overdueMessage = "🚨 *ПРОСРОЧЕННЫЕ ДОЛГИ:*\n\n";
    overdueDebts.forEach(debt => {
      const typeIcon = debt.type === 'Дебет' ? '💸' : '💚';
      const typeText = debt.type === 'Дебет' ? 'Вы должны' : 'Вам должны';
      overdueMessage += `${typeIcon} ${typeText} ${debt.counterparty}\n`;
      overdueMessage += `💰 ${formatMultiCurrency(debt.amount, debt.currency, debt.amountInUZS)}\n`;
      overdueMessage += `📅 Просрочено на ${debt.daysOverdue} дн.\n\n`;
    });
    notifications.push(overdueMessage);
  }
  
  // Уведомления о приближающихся долгах
  if (upcomingDebts.length > 0) {
    let upcomingMessage = "⏰ *ДОЛГИ НА БЛИЖАЙШИЕ ДНИ:*\n\n";
    upcomingDebts.forEach(debt => {
      const typeIcon = debt.type === 'Дебет' ? '💸' : '💚';
      const typeText = debt.type === 'Дебет' ? 'Вы должны' : 'Вам должны';
      upcomingMessage += `${typeIcon} ${typeText} ${debt.counterparty}\n`;
      upcomingMessage += `💰 ${formatMultiCurrency(debt.amount, debt.currency, debt.amountInUZS)}\n`;
      upcomingMessage += `📅 Через ${debt.daysUntilDue} дн.\n\n`;
    });
    notifications.push(upcomingMessage);
  }
  
  return notifications;
}

// =============================================
//               CURRENCY HELPERS
// =============================================
function convertCurrency(amount, fromCurrency, toCurrency = 'UZS', chat_id = null) {
  if (fromCurrency === toCurrency) return amount;
  
  let rates;
  if (chat_id) {
    rates = getCurrentUserCurrencyRates(chat_id);
  } else {
    rates = CURRENCIES;
  }
  
  const fromRate = rates[fromCurrency]?.rate || CURRENCIES[fromCurrency]?.rate || 1;
  const toRate = rates[toCurrency]?.rate || CURRENCIES[toCurrency]?.rate || 1;
  
  return (amount * fromRate) / toRate;
}

function detectCurrency(text) {
  const lowerText = text.toLowerCase();
  
  // Поиск символов валют
  if (lowerText.includes('$') || lowerText.includes('доллар') || lowerText.includes('usd')) {
    return 'USD';
  }
  if (lowerText.includes('€') || lowerText.includes('евро') || lowerText.includes('eur')) {
    return 'EUR';
  }
  if (lowerText.includes('₽') || lowerText.includes('рубль') || lowerText.includes('rub')) {
    return 'RUB';
  }
  if (lowerText.includes('сум') || lowerText.includes('uzs')) {
    return 'UZS';
  }
  
  // По умолчанию возвращаем базовую валюту
  return DEFAULT_CURRENCY;
}

function formatCurrency(amount, currency = 'UZS') {
  const currencyInfo = CURRENCIES[currency];
  if (!currencyInfo) return formatMoney(amount);
  
  return `${formatMoney(amount)} ${currencyInfo.symbol}`;
}

function formatMultiCurrency(originalAmount, originalCurrency, convertedAmount) {
  const currencyInfo = CURRENCIES[originalCurrency];
  if (!currencyInfo || originalCurrency === 'UZS') {
    return formatMoney(originalAmount);
  }
  
  return `${formatMoney(originalAmount)} ${currencyInfo.symbol} (${formatMoney(convertedAmount)} сум)`;
}

// =============================================
//               COMMANDS & KEYBOARDS
// =============================================
const COMMANDS = { 
  addExpense: "✚ Добавить расход", 
  addIncome: "💰 Добавить доход", 
  viewReport: "📊 Посмотреть отчёт", 
  askAnalyst: "🤖 Спросить Аналитика", 
  settings: "⚙️ Настройки", 
  familyMode: "👨‍👩‍👧‍👦 Семейный режим", 
  myBudget: "💰 Мой Бюджет", 
  myGoals: "🎯 Мои цели", 
  setupCategories: "⚙️ Настроить категории расходов", 
  addNewCategory: "🛠️ Добавить новую категорию расходов", 
  updateRates: "💱 Настройка курсов валют", 
  migrateData: "🔄 Мигрировать данные", 
  clearBase: "🧹 Очистить базу", 
  changeLang: "🌐 Сменить язык", 
  back: "⬅️ Назад", 
  newGoal: "➕ Новая цель", 
  listMyGoals: "📋 Список моих целей", 
  backToSettings: "⬅️ Назад в Настройки", 
  suggestBudget: "💡 Предложить бюджет", 
  setupManually: "✏️ Настроить вручную", 
  viewBudget: "👁️ Посмотреть бюджет", 
  forecast: "🔮 Прогноз", 
  detailedReport: "📋 Детальный отчёт", 
  viewBalance: "💰 Баланс", 
  createFamily: "🏠 Создать семью", 
  joinFamily: "👥 Присоединиться к семье", 
  myFamily: "👨‍👩‍👧‍👦 Моя семья", 
  leaveFamily: "🚪 Покинуть семью",
  // Новые команды для ручного ввода курсов валют
  setUsdRate: "💵 Установить курс USD",
  setEurRate: "💶 Установить курс EUR", 
  setRubRate: "💷 Установить курс RUB",
  viewCurrentRates: "👁️ Посмотреть текущие курсы",
  // Команды для управления долгами
  debtsMenu: "💳 Управление долгами",
  giveCredit: "📤 Дать в долг",
  takeDebt: "📥 Взять в долг",
  payDebt: "💰 Погасить долг",
  viewDebts: "📊 Мои долги",
  extendDebt: "📅 Продлить срок",
  checkOverdue: "🚨 Просроченные"
};

// Uzbek translations of command labels
const COMMANDS_UZ = {
  addExpense: "➕ Xarajat",
  addIncome: "➕ Daromad",
  viewReport: "📊 Hisobotlar",
  settings: "⚙️ Sozlamalar",
  askAnalyst: "🤖 Tahlilchi",
  familyMode: "👨‍👩‍👧‍👦 Oila rejimi",
  myBudget: "💰 Mening byudjetim",
  myGoals: "🎯 Maqsadlarim",
  setupCategories: "⚙️ Xarajat kategoriyalarini sozlash",
  addNewCategory: "🛠️ Yangi xarajat kategoriyasini qo'shish",
  updateRates: "💱 Valyuta kurslarini sozlash",
  migrateData: "🔄 Ma'lumotlarni migratsiya qilish",
  clearBase: "🧹 Bazani tozalash",
  changeLang: "🌐 Tilni o'zgartirish",
  back: "⬅️ Orqaga",
  newGoal: "➕ Yangi maqsad",
  listMyGoals: "📋 Maqsadlar ro'yxati",
  backToSettings: "⬅️ Sozlamalarga qaytish",
  suggestBudget: "💡 Byudjet taklif qilish",
  setupManually: "✏️ Qo'lda sozlash",
  viewBudget: "👁️ Byudjetni ko'rish",
  forecast: "🔮 Prognoz",
  detailedReport: "📋 Batafsil hisobot",
  viewBalance: "💰 Balans",
  createFamily: "🏠 Oila yaratish",
  joinFamily: "👥 Oilaga qo'shilish",
  myFamily: "👨‍👩‍👧‍👦 Mening oilam",
  leaveFamily: "🚪 Oiladan chiqish",
  setUsdRate: "💵 USD kursini o'rnatish",
  setEurRate: "💶 EUR kursini o'rnatish",
  setRubRate: "💷 RUB kursini o'rnatish",
  viewCurrentRates: "👁️ Joriy kurslarni ko'rish",
  debtsMenu: "💳 Qarzlarni boshqarish",
  giveCredit: "📤 Qarz berish",
  takeDebt: "📥 Qarz olish",
  payDebt: "💰 Qarzni to'lash",
  viewDebts: "📊 Qarzlarim",
  extendDebt: "📅 Muddatni uzaytirish",
  checkOverdue: "🚨 Kechiktirilganlar"
};

const mainKeyboard = { keyboard: [[{ text: COMMANDS.addExpense }, { text: COMMANDS.addIncome }], [{ text: COMMANDS.viewReport }], [{ text: COMMANDS.debtsMenu }], [{ text: COMMANDS.askAnalyst }], [{ text: COMMANDS.settings }]], resize_keyboard: true, is_persistent: true };
const settingsKeyboard = { keyboard: [[{ text: COMMANDS.familyMode }], [{ text: COMMANDS.myBudget }], [{ text: COMMANDS.myGoals }], [{ text: COMMANDS.setupCategories }], [{ text: COMMANDS.addNewCategory }], [{ text: COMMANDS.updateRates }], [{ text: COMMANDS.migrateData }], [{ text: COMMANDS.clearBase }], [{ text: COMMANDS.back }]], resize_keyboard: true, is_persistent: true };
const currencyRatesKeyboard = { keyboard: [[{ text: COMMANDS.setUsdRate }, { text: COMMANDS.setEurRate }], [{ text: COMMANDS.setRubRate }], [{ text: COMMANDS.viewCurrentRates }], [{ text: COMMANDS.backToSettings }]], resize_keyboard: true, is_persistent: true };
const goalsKeyboard = { keyboard: [[{ text: COMMANDS.newGoal }, { text: COMMANDS.listMyGoals }], [{ text: COMMANDS.backToSettings }]], resize_keyboard: true, is_persistent: true };
const budgetKeyboard = { keyboard: [[{ text: COMMANDS.suggestBudget }, { text: COMMANDS.setupManually }], [{ text: COMMANDS.viewBudget }], [{ text: COMMANDS.backToSettings }]], resize_keyboard: true, is_persistent: true };
const reportsKeyboard = { keyboard: [[{ text: COMMANDS.forecast }], [{ text: COMMANDS.detailedReport }, { text: COMMANDS.viewBalance }], [{ text: COMMANDS.back }]], resize_keyboard: true, is_persistent: true };
const debtsKeyboard = { keyboard: [[{ text: COMMANDS.giveCredit }, { text: COMMANDS.takeDebt }], [{ text: COMMANDS.payDebt }, { text: COMMANDS.extendDebt }], [{ text: COMMANDS.viewDebts }, { text: COMMANDS.checkOverdue }], [{ text: COMMANDS.back }]], resize_keyboard: true, is_persistent: true };
function buildFamilyKeyboard(lang) {
  const C = getCommandsByLang(lang);
  return { keyboard: [[{ text: C.createFamily }, { text: C.joinFamily }], [{ text: C.myFamily }, { text: C.leaveFamily }], [{ text: C.backToSettings }]], resize_keyboard: true, is_persistent: true };
}

const familyKeyboard = { keyboard: [[{ text: COMMANDS.createFamily }, { text: COMMANDS.joinFamily }], [{ text: COMMANDS.myFamily }, { text: COMMANDS.leaveFamily }], [{ text: COMMANDS.backToSettings }]], resize_keyboard: true, is_persistent: true };
const unauthorizedKeyboard = { keyboard: [[{ text: COMMANDS.createFamily }, { text: COMMANDS.joinFamily }]], resize_keyboard: true, is_persistent: true };

// =============================================
//         TELEGRAM & AI API HELPERS
// =============================================
function callTelegramApi(method, payload) { 
  if (!TELEGRAM_TOKEN) { 
    Logger.log("TELEGRAM_TOKEN не найден!"); 
    return; 
  } 
  const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/${method}`; 
  const options = { 
    method: "post", 
    contentType: "application/json", 
    payload: JSON.stringify(payload), 
    muteHttpExceptions: true 
  }; 
  try { 
    return UrlFetchApp.fetch(url, options); 
  } catch (e) { 
    Logger.log(`Ошибка при вызове метода ${method}: ${e}`); 
  } 
}
function callGeminiApi(prompt) { 
  if (!GEMINI_API_KEY) { 
    Logger.log("Ошибка: Ключ GEMINI_API_KEY не найден."); 
    return "Сервис аналитики временно недоступен."; 
  } 
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`; 
  const payload = { 
    "contents": [{ "parts": [{ "text": prompt }] }] 
  }; 
  const options = { 
    'method': 'post', 
    'contentType': 'application/json', 
    'payload': JSON.stringify(payload), 
    'muteHttpExceptions': true 
  }; 
  try { 
    const response = UrlFetchApp.fetch(apiUrl, options); 
    const responseCode = response.getResponseCode(); 
    const responseText = response.getContentText(); 
    
    // Логируем для отладки
    Logger.log(`Gemini API Response Code: ${responseCode}`);
    Logger.log(`Gemini API Response: ${responseText.substring(0, 200)}...`);
    
    if (responseCode !== 200) { 
      Logger.log(`ОШИБКА: Сервер вернул код ${responseCode}. Ответ: ${responseText}`); 
      
      // Специальная обработка для ошибки 503
      if (responseCode === 503) {
        return "Сервис аналитики временно недоступен. Попробуйте позже.";
      }
      
      return `Произошла ошибка на стороне сервиса аналитики (Код: ${responseCode})`; 
    } 
    
    const data = JSON.parse(responseText); 
    if (data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) { 
      return data.candidates[0].content.parts[0].text.trim(); 
    } else { 
      Logger.log(`ОШИБКА: Структура ответа ИИ некорректна. Ответ: ${responseText}`); 
      return "ИИ вернул некорректный ответ."; 
    } 
  } catch (e) { 
    Logger.log("КРИТИЧЕСКАЯ ОШИБКА: " + e.toString()); 
    return "Произошла критическая ошибка."; 
  } 
}
const sendText = (chat_id, text, parse_mode, reply_markup) => { 
  const payload = { 
    chat_id: String(chat_id), 
    text: text, 
    parse_mode: parse_mode || "HTML" 
  }; 
  if (reply_markup) { 
    payload.reply_markup = JSON.stringify(reply_markup); 
  } 
  callTelegramApi("sendMessage", payload); 
};
const deleteMessage = (chat_id, message_id) => callTelegramApi("deleteMessage", { chat_id: String(chat_id), message_id: message_id });
const answerCallback = (callback_id) => callTelegramApi("answerCallbackQuery", { callback_query_id: callback_id });
const editMessageText = (chat_id, message_id, text, parse_mode, reply_markup) => { 
  const payload = { 
    chat_id: String(chat_id), 
    message_id: message_id, 
    text: text, 
    parse_mode: parse_mode, 
    reply_markup: JSON.stringify(reply_markup) 
  }; 
  callTelegramApi("editMessageText", payload); 
};
function handleVoiceMessage(chat_id, voice) {
  const lang = getUserLang(chat_id);
  if (!SPEECHKIT_KEY || !SPEECHKIT_FOLDER_ID) {
    const message = lang === 'uz' ? 
      '⚠️ STT o\'chirilgan: SPEECHKIT_KEY yoki SPEECHKIT_FOLDER_ID yo\'q.' :
      '⚠️ STT выключено: нет SPEECHKIT_KEY или SPEECHKIT_FOLDER_ID.';
    return sendText(chat_id, message);
  }
  try {
    // 1. Скачиваем голосовой файл из Telegram
    const fileInfo = JSON.parse(callTelegramApi('getFile', { file_id: voice.file_id }).getContentText());
    const fileUrl = `https://api.telegram.org/file/bot${TELEGRAM_TOKEN}/${fileInfo.result.file_path}`;
    const oggBlob = UrlFetchApp.fetch(fileUrl).getBlob().setName('voice.ogg');
    oggBlob.setContentType('application/ogg');

    // 2. Отправляем в Yandex SpeechKit для распознавания
    const sttLang = lang === 'uz' ? 'uz-UZ' : 'ru-RU';
    const text = callYandexStt(oggBlob, sttLang);

    if (!text || !text.trim()) {
      const message = lang === 'uz' ? 
        '❌ Ovozni aniqlab bo\'lmadi.' :
        '❌ Не удалось распознать голос.';
      return sendText(chat_id, message);
    }

    handleUserInput(chat_id, text.trim(), '');
  } catch (e) {
    Logger.log('Voice STT exception: ' + e);
    const message = lang === 'uz' ? 
      '❌ Nutqni aniqlashda xatolik.' :
      '❌ Ошибка распознавания речи.';
    sendText(chat_id, message);
  }
}

function sendPhoto(chat_id, photo_url, caption) { 
  const payload = { 
    chat_id: String(chat_id), 
    photo: photo_url, 
    caption: caption, 
    parse_mode: "Markdown" 
  }; 
  callTelegramApi("sendPhoto", payload); 
}

// =============================================
//           MAIN HANDLER
// =============================================
function doPost(e) {
  let contents; 
  try { 
    contents = JSON.parse(e.postData.contents); 
  } catch (err) { 
    return; 
  }
  const message = contents.message; 
  // Если пришло голосовое сообщение – распознаём и выходим
  if (message && message.voice) {
    const cid = String(message.chat.id);
    handleVoiceMessage(cid, message.voice);
    return;
  } 
  const callback = contents.callback_query;
  let chat_id, text, userFirstName;
  if (message) { 
    chat_id = message.chat.id; 
    text = message.text ? message.text.trim() : ''; 
    userFirstName = message.from ? message.from.first_name : ''; 
  }
  else if (callback) { 
    chat_id = callback.message.chat.id; 
    text = ''; 
    userFirstName = callback.from ? callback.from.first_name : ''; 
  }
  else { 
    return; 
  }
  chat_id = String(chat_id);
  
  Logger.log(`doPost: chat_id=${chat_id}, text="${text}", message=${!!message}, callback=${!!callback}`);
  
  const familyInfo = getFamilyInfo(chat_id);
  if (chat_id === OWNER_ID || familyInfo) {
    const textCommandRouter = {
      "/start": handleStart, 
      [COMMANDS.addExpense]: (c) => sendCategoryButtons(c, 'расход'), 
      [COMMANDS.addIncome]: (c) => sendCategoryButtons(c, 'доход'),
      [COMMANDS.askAnalyst]: handleAskAnalyst, 
      [COMMANDS.viewReport]: handleReportsMenu, 
      [COMMANDS.forecast]: handleForecast,
      [COMMANDS.detailedReport]: sendReport, 
      [COMMANDS.viewBalance]: handleBalance, 
      [COMMANDS.settings]: sendSettingsMenu,
      [COMMANDS.back]: sendMainMenu, 
      [COMMANDS.backToSettings]: sendSettingsMenu, 
      [COMMANDS.familyMode]: handleFamilyMode,
      [COMMANDS.myBudget]: handleMyBudget, 
      [COMMANDS.myGoals]: handleMyGoals, 
      [COMMANDS.setupCategories]: sendConfigureExpenseCategoryMenu,
      [COMMANDS.addNewCategory]: handleNewCategory, 
      [COMMANDS.updateRates]: handleUpdateRates, 
      [COMMANDS.migrateData]: handleMigrateData, 
      [COMMANDS.clearBase]: askClearConfirmation, 
      [COMMANDS.changeLang]: handleChangeLanguage, 
      [COMMANDS.newGoal]: handleNewGoal,
      [COMMANDS.listMyGoals]: handleListGoals, 
      [COMMANDS.suggestBudget]: handleSuggestBudget, 
      [COMMANDS.setupManually]: handleSetupBudgetManually,
      [COMMANDS.viewBudget]: handleViewCurrentBudget, 
      [COMMANDS.createFamily]: handleCreateFamily, 
      [COMMANDS.joinFamily]: handleJoinFamily,
      [COMMANDS.myFamily]: handleViewMyFamily, 
      [COMMANDS.leaveFamily]: handleLeaveFamily,
      [COMMANDS.setUsdRate]: handleSetUsdRate,
      [COMMANDS.setEurRate]: handleSetEurRate,
      [COMMANDS.setRubRate]: handleSetRubRate,
      [COMMANDS.viewCurrentRates]: handleViewCurrentRates,
      // Обработчики команд долгов
      [COMMANDS.debtsMenu]: handleDebtsMenu,
      [COMMANDS.giveCredit]: handleGiveCredit,
      [COMMANDS.takeDebt]: handleTakeDebt,
      [COMMANDS.payDebt]: handlePayDebt,
      [COMMANDS.viewDebts]: handleViewDebts,
      [COMMANDS.extendDebt]: handleExtendDebt,
      [COMMANDS.checkOverdue]: handleCheckOverdue
    };
    
    // Дублируем обработчики для узбекских команд
    const UZ_KEYS = ['addExpense','addIncome','askAnalyst','viewReport','forecast','detailedReport','viewBalance','settings','back','backToSettings','familyMode','myBudget','myGoals','setupCategories','addNewCategory','updateRates','migrateData','clearBase','changeLang','newGoal','listMyGoals','suggestBudget','setupManually','viewBudget','createFamily','joinFamily','myFamily','leaveFamily','setUsdRate','setEurRate','setRubRate','viewCurrentRates','debtsMenu','giveCredit','takeDebt','payDebt','viewDebts','extendDebt','checkOverdue'];
    UZ_KEYS.forEach(k => {
      if (COMMANDS_UZ[k] && COMMANDS[k]) {
        textCommandRouter[COMMANDS_UZ[k]] = textCommandRouter[COMMANDS[k]];
      }
    });
    
    Logger.log(`Доступные команды: ${Object.keys(textCommandRouter).join(', ')}`);
    Logger.log(`Полученная команда: "${text}"`);
    Logger.log(`Команды курсов валют: setUsdRate="${COMMANDS.setUsdRate}", setEurRate="${COMMANDS.setEurRate}", setRubRate="${COMMANDS.setRubRate}", viewCurrentRates="${COMMANDS.viewCurrentRates}"`);
    
    if (message) { 
      const handler = textCommandRouter[text]; 
      Logger.log(`Найден обработчик для "${text}": ${!!handler}`);
      if (handler) { 
        Logger.log(`Вызываю обработчик для "${text}"`);
        handler(chat_id); 
      } else { 
        Logger.log(`Обработчик не найден, передаю в handleUserInput`);
        handleUserInput(chat_id, text, userFirstName); 
      } 
    }
    else if (callback) { 
      Logger.log(`Обрабатываю callback: ${callback.data}`);
      handleCallbackQuery(callback); 
    }
  } else {
    const unauthorizedRouter = { 
      "/start": handleStart, 
      [COMMANDS.createFamily]: handleCreateFamily, 
      [COMMANDS.joinFamily]: handleJoinFamily 
    };
    if (message) { 
      const handler = unauthorizedRouter[text]; 
      if (handler) { 
        handler(chat_id); 
      } else { 
        const state = PropertiesService.getUserProperties().getProperty(chat_id + "_state"); 
        if (state === "awaiting_family_name") { 
          createFamily(chat_id, userFirstName, text); 
        } else if (state === "awaiting_invite_code") { 
          joinFamily(chat_id, userFirstName, text); 
        } else { 
          sendText(chat_id, "🔐 Для доступа к функциям бота, пожалуйста, создайте или присоединитесь к семье.", null, unauthorizedKeyboard); 
        } 
      } 
    }
  }
}

// =============================================
//     LEVEL 6.1 - PROACTIVE FUNCTIONS
// =============================================
function sendWeeklyDigest() {
  Logger.log("--- Запуск еженедельной рассылки дайджестов ---");
  const allUserIds = getAllUserIds();
  Logger.log("Найдено уникальных пользователей для рассылки: " + allUserIds.length);
  allUserIds.forEach(userId => {
    Logger.log("Готовлю дайджест для пользователя: " + userId);
    const dateLimit = new Date();
    dateLimit.setDate(dateLimit.getDate() - 7);
    const incomeSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetIncome);
    const expenseSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetExpense);
      const allIncomes = incomeSheet.getLastRow() > 1 ? incomeSheet.getRange(2, 1, incomeSheet.getLastRow() - 1, 7).getValues() : [];
  const allExpenses = expenseSheet.getLastRow() > 1 ? expenseSheet.getRange(2, 1, expenseSheet.getLastRow() - 1, 7).getValues() : [];
    const userWeeklyIncomes = allIncomes.filter(row => String(row[4]) === userId && new Date(row[0]) >= dateLimit);
    const userWeeklyExpenses = allExpenses.filter(row => String(row[4]) === userId && new Date(row[0]) >= dateLimit);
    const totalIncome = userWeeklyIncomes.reduce((sum, row) => sum + Number(row[2] || 0), 0);
    const totalExpenses = userWeeklyExpenses.reduce((sum, row) => sum + Number(row[2] || 0), 0);
    if (totalIncome === 0 && totalExpenses === 0) {
      Logger.log("У пользователя " + userId + " нет данных за неделю. Пропускаем.");
      return;
    }
    const expensesByCategory = {};
    userWeeklyExpenses.forEach(row => {
      const category = row[1];
      const amount = Number(row[2] || 0);
      expensesByCategory[category] = (expensesByCategory[category] || 0) + amount;
    });
    let topCategory = "Нет";
    let maxSpent = 0;
    for (const category in expensesByCategory) {
      if (expensesByCategory[category] > maxSpent) {
        maxSpent = expensesByCategory[category];
        topCategory = category;
      }
    }
    let digestMessage = "🗓️ *Еженедельный финансовый дайджест*\n\n";
    digestMessage += `За последние 7 дней:\n\n`;
    digestMessage += `📈 *Доходы:* ${formatMoney(totalIncome)} сум\n`;
    digestMessage += `📉 *Расходы:* ${formatMoney(totalExpenses)} сум\n\n`;
    digestMessage += `💸 *Самая большая категория трат:* ${topCategory} (${formatMoney(maxSpent)} сум)\n\n`;
    digestMessage += `Хорошей следующей недели!`;
    sendText(userId, digestMessage, "Markdown");
    Logger.log("Дайджест успешно отправлен пользователю: " + userId);
  });
  Logger.log("--- Рассылка дайджестов завершена ---");
}

// =============================================
//           HANDLERS
// =============================================
function handleStart(chat_id) { 
  const userProps = PropertiesService.getUserProperties(); 
  userProps.deleteProperty(chat_id + "_state"); 
  userProps.deleteProperty(chat_id + "_awaiting_ai_question"); 
  userProps.deleteProperty(chat_id + "_selected"); 
  userProps.deleteProperty(chat_id + "_awaitingCategory"); 
  userProps.deleteProperty(chat_id + "_temp_goal"); 
  userProps.deleteProperty(chat_id + "_temp_budget"); 
  userProps.deleteProperty(chat_id + "_last_transaction"); 
  
  // Инициализируем курсы валют для пользователя
  initializeUserCurrencyRates(chat_id);
  
  // Проверяем, установлен ли язык
  const currentLang = userProps.getProperty(chat_id + "_lang");
  if (!currentLang) {
    const langKeyboard = { inline_keyboard: [[{ text: "🇷🇺 Русский", callback_data: "set_lang_ru" }, { text: "🇺🇿 O'zbek", callback_data: "set_lang_uz" }]] };
    return sendText(chat_id, "Tilni tanlang:", null, langKeyboard);
  }
  
  const familyInfo = getFamilyInfo(chat_id); 
  if (chat_id === OWNER_ID || familyInfo) { 
    // Проверяем уведомления о долгах
    const notifications = checkDebtNotifications(chat_id);
    if (notifications.length > 0) {
      notifications.forEach(notification => {
        sendText(chat_id, notification, "Markdown");
      });
    }
    
    sendMainMenu(chat_id); 
  } else { 
    const lang = getUserLang(chat_id);
    const message = lang === 'uz' ? 
      "👋 Xush kelibsiz! Bu shaxsiy va oilaviy moliyalarni boshqarish boti." :
      "👋 Добро пожаловать! Это бот для управления личными и семейными финансами.";
    sendText(chat_id, message, null, unauthorizedKeyboard); 
  } 
}
function handleNewCategory(chat_id) { 
  const lang = getUserLang(chat_id);
  PropertiesService.getUserProperties().setProperty(chat_id + "_awaitingCategory", "true"); 
  const message = lang === 'uz' ? 
    "Yangi kategoriya nomini kiriting:" :
    "Введите название новой категории:";
  sendText(chat_id, message); 
}
function handleAskAnalyst(chat_id) { 
  const lang = getUserLang(chat_id);
  PropertiesService.getUserProperties().setProperty(chat_id + "_awaiting_ai_question", "true"); 
  const message = lang === 'uz' ? 
    "💬 Savolingizni bering..." :
    "💬 Задайте свой вопрос...";
  sendText(chat_id, message, "Markdown"); 
}
function classifyExpenseWithAI(chat_id, text) {
  // 1. Сначала жесткие правила для самых очевидных случаев
  const lowerText = text.toLowerCase();
  
  // Безусловные правила для доходов (приоритетные)
  if (/получил\s+(зп|зарплату?)/i.test(text) || 
      /начислили\s+(зп|зарплату?)/i.test(text) ||
      lowerText.includes("зарплата") ||
      lowerText.includes("получил зп") ||
      lowerText.includes("возврат") ||
      lowerText.includes("кешбек") ||
      lowerText.includes("продажа") ||
      // Узбекские слова для доходов
      lowerText.includes("oylik") ||
      lowerText.includes("maosh") ||
      lowerText.includes("daromad") ||
      lowerText.includes("sotuv") ||
      lowerText.includes("qaytarish") ||
      lowerText.includes("keshbek")) {
    return enforceIncomeCategory("Зарплата");
  }

  // Жесткие правила для расходов
  if (lowerText.includes("кофе") || 
      lowerText.includes("еда") || 
      lowerText.includes("питание") || 
      lowerText.includes("обед") || 
      lowerText.includes("ужин") || 
      lowerText.includes("завтрак") ||
      lowerText.includes("кафе") ||
      lowerText.includes("ресторан") ||
      lowerText.includes("макдональдс") ||
      lowerText.includes("бургер") ||
      lowerText.includes("пицца") ||
      // Узбекские слова для питания
      lowerText.includes("kofe") ||
      lowerText.includes("ovqat") ||
      lowerText.includes("oziv") ||
      lowerText.includes("tushlik") ||
      lowerText.includes("kechki ovqat") ||
      lowerText.includes("nonushta") ||
      lowerText.includes("kafe") ||
      lowerText.includes("restoran") ||
      lowerText.includes("burger") ||
      lowerText.includes("pitsa")) {
    return enforceExpenseCategory("Питание");
  }

  if (lowerText.includes("такси") || 
      lowerText.includes("автобус") || 
      lowerText.includes("метро") || 
      lowerText.includes("проезд") ||
      lowerText.includes("транспорт") ||
      // Узбекские слова для транспорта
      lowerText.includes("taksi") ||
      lowerText.includes("avtobus") ||
      lowerText.includes("metro") ||
      lowerText.includes("transport")) {
    return enforceExpenseCategory("Такси");
  }

  if (lowerText.includes("одежда") || 
      lowerText.includes("футболка") || 
      lowerText.includes("брюки") || 
      lowerText.includes("обувь") ||
      lowerText.includes("магазин") ||
      lowerText.includes("шопинг") ||
      // Узбекские слова для одежды
      lowerText.includes("kiyim") ||
      lowerText.includes("futbolka") ||
      lowerText.includes("shim") ||
      lowerText.includes("oyoq") ||
      lowerText.includes("do'kon") ||
      lowerText.includes("shopping")) {
    return enforceExpenseCategory("Одежда");
  }

  if (lowerText.includes("развлечения") || 
      lowerText.includes("кино") || 
      lowerText.includes("театр") || 
      lowerText.includes("игра") ||
      lowerText.includes("игры") ||
      // Узбекские слова для развлечений
      lowerText.includes("o'yin") ||
      lowerText.includes("kino") ||
      lowerText.includes("teatr") ||
      lowerText.includes("kulgu") ||
      lowerText.includes("ko'ngil ochar")) {
    return enforceExpenseCategory("Развлечения");
  }

  // 2. Затем интеллектуальный анализ через Gemini для остальных случаев
  const incomeCategories = getCategories('доход');
  const expenseCategories = getCategories('расход');
  const allCategoryNames = [...incomeCategories.map(c => c.label), ...expenseCategories.map(c => c.label)];
  
  const prompt = `Определи категорию операции строго по правилам:
  
  Если доход (зарплата, премия, возврат) → верни категорию из: ${incomeCategories.map(c => c.label).join(', ')}
  Если расход → верни категорию из: ${expenseCategories.map(c => c.label).join(', ')}
  
  Операция: "${text}"
  
  Верни ТОЛЬКО название категории без пояснений.`;

  const aiResponse = callGeminiApi(prompt)?.trim();
  
  // 3. Валидация ответа ИИ и конвертация в ID
  Logger.log(`AI Response: "${aiResponse}"`);
  
  // Проверяем, не является ли ответ ошибкой
  if (aiResponse && !aiResponse.includes("ошибка") && !aiResponse.includes("error") && !aiResponse.includes("Код:")) {
    const validatedCategory = validateCategory(aiResponse);
    Logger.log(`Validated Category: "${validatedCategory}"`);
    
    if (validatedCategory) {
      const categoryId = convertCategoryNameToId(validatedCategory);
      Logger.log(`Converted to ID: "${categoryId}"`);
      return categoryId;
    }
  }
  
  // Если AI не сработал или вернул ошибку, используем простую логику
  Logger.log(`AI failed or returned error, using simple logic`);
  
  // Простая логика на основе ключевых слов
  if (lowerText.includes("еда") || lowerText.includes("пища") || lowerText.includes("кушать") || 
      lowerText.includes("пить") || lowerText.includes("напиток") || lowerText.includes("продукты") ||
      // Узбекские слова
      lowerText.includes("ovqat") || lowerText.includes("oziv") || lowerText.includes("yemak") || 
      lowerText.includes("ichmok") || lowerText.includes("ichimlik") || lowerText.includes("mahsulot")) {
    return enforceExpenseCategory("Питание");
  }
  
  if (lowerText.includes("машина") || lowerText.includes("бензин") || lowerText.includes("топливо") || 
      lowerText.includes("парковка") || lowerText.includes("стоянка")) {
    return enforceExpenseCategory("Топливо");
  }
  
  if (lowerText.includes("счет") || lowerText.includes("коммунальные") || lowerText.includes("электричество") || 
      lowerText.includes("газ") || lowerText.includes("вода") || lowerText.includes("интернет")) {
    return enforceExpenseCategory("Коммунальные");
  }
  
  // По умолчанию считаем расходом
  Logger.log(`Using fallback category - defaulting to expense`);
  return enforceExpenseCategory("Другое");
}

// Вспомогательные функции
function enforceIncomeCategory(categoryName) {
  const incomeCategories = getCategories('доход');
  const category = incomeCategories.find(c => c.label === categoryName);
  if (category) return category.id;
  
  // Если не найдена категория по названию, ищем по ID в словаре
  const { ruToId, uzToId } = loadCategoryDict();
  if (ruToId[categoryName]) {
    return ruToId[categoryName];
  }
  if (uzToId[categoryName]) {
    return uzToId[categoryName];
  }
  
  // Попробуем найти по узбекским названиям доходов
  const uzIncomeCategories = getCategories('доход', 'uz');
  const uzCategory = uzIncomeCategories.find(c => c.label.toLowerCase().includes(categoryName.toLowerCase()));
  if (uzCategory) return uzCategory.id;
  
  // Если ничего не найдено, возвращаем первый доступный доход
  const defaultCategory = incomeCategories.find(c => c.label === "Доход");
  return defaultCategory ? defaultCategory.id : (incomeCategories[0] ? incomeCategories[0].id : null);
}

function enforceExpenseCategory(categoryName) {
  const expenseCategories = getCategories('расход');
  const category = expenseCategories.find(c => c.label === categoryName);
  if (category) return category.id;
  
  // Если не найдена категория по названию, ищем по ID в словаре
  const { ruToId, uzToId } = loadCategoryDict();
  if (ruToId[categoryName]) {
    return ruToId[categoryName];
  }
  if (uzToId[categoryName]) {
    return uzToId[categoryName];
  }
  
  // Попробуем найти по узбекским названиям расходов
  const uzExpenseCategories = getCategories('расход', 'uz');
  const uzCategory = uzExpenseCategories.find(c => c.label.toLowerCase().includes(categoryName.toLowerCase()));
  if (uzCategory) return uzCategory.id;
  
  // Если ничего не найдено, возвращаем первый доступный расход
  const defaultCategory = expenseCategories.find(c => c.label === "Другое");
  return defaultCategory ? defaultCategory.id : (expenseCategories[0] ? expenseCategories[0].id : null);
}

function validateCategory(categoryName) {
  const allCategories = [...getCategories('доход'), ...getCategories('расход')];
  const category = allCategories.find(c => c.label === categoryName);
  return category ? category.label : null;
}

function convertCategoryNameToId(categoryName) {
  const { ruToId, uzToId } = loadCategoryDict();
  Logger.log(`Converting category name: "${categoryName}"`);
  Logger.log(`Available Russian categories: ${Object.keys(ruToId).join(', ')}`);
  Logger.log(`Available Uzbek categories: ${Object.keys(uzToId).join(', ')}`);
  
  // Сначала пробуем найти по русскому названию
  if (ruToId[categoryName]) {
    Logger.log(`Found in Russian dict: ${ruToId[categoryName]}`);
    return ruToId[categoryName];
  }
  // Затем по узбекскому
  if (uzToId[categoryName]) {
    Logger.log(`Found in Uzbek dict: ${uzToId[categoryName]}`);
    return uzToId[categoryName];
  }
  // Если не найдено, возвращаем null
  Logger.log(`Category not found in dictionaries`);
  return null;
}
function handleUserInput(chat_id, text, userName) {
  const userProps = PropertiesService.getUserProperties();
  const state = userProps.getProperty(chat_id + "_state");

  if (state && state.startsWith("awaiting_goal_")) {
    handleGoalCreation(chat_id, text, state);
    return;
  }
  if (state && state.startsWith("awaiting_deposit|")) {
    const goalId = state.split("|")[1];
    const amount = parseFloat(text.replace(',', '.'));
    if (isNaN(amount) || amount <= 0) {
      return sendText(chat_id, "❌ Сумма должна быть положительным числом.");
    }
    addDepositToGoal(goalId, amount);
    userProps.deleteProperty(chat_id + "_state");
    sendText(chat_id, `✅ Цель успешно пополнена на ${formatMoney(amount)} сум!`);
    handleListGoals(chat_id);
    return;
  }
  if (state && state.startsWith("awaiting_budget_limit|")) {
    const categoryId = state.split("|")[1];
    const limit = parseFloat(text.replace(',', '.'));
    if (isNaN(limit) || limit < 0) {
      return sendText(chat_id, "❌ Лимит должен быть числом.");
    }
    setBudgetForCategory(chat_id, categoryId, limit);
    userProps.deleteProperty(chat_id + "_state");
    const catLabel = getCategoryLabel(categoryId, getUserLang(chat_id));
    sendText(chat_id, `✅ Установлен лимит для категории "${catLabel}": ${formatMoney(limit)} сум.`);
    handleSetupBudgetManually(chat_id);
    return;
  }
  
  // Обработка ручного ввода курсов валют
  if (state === "awaiting_usd_rate") {
    Logger.log(`Обрабатываю awaiting_usd_rate для chat_id: ${chat_id}, текст: ${text}`);
    
    const rate = parseFloat(text.replace(',', '.'));
    if (isNaN(rate) || rate <= 0) {
      Logger.log(`Неверный курс: ${text}`);
      return sendText(chat_id, "❌ Курс должен быть положительным числом.");
    }
    
    Logger.log(`Сохраняю курс USD: ${rate} для chat_id: ${chat_id}`);
    
    // Сохраняем индивидуальный курс для пользователя
    setCurrencyRateForUser(chat_id, 'USD', rate);
    sendText(chat_id, `✅ Курс USD обновлен: 1 USD = ${formatMoney(rate)} сум`);
    
    userProps.deleteProperty(chat_id + "_state");
    Logger.log(`Состояние очищено для chat_id: ${chat_id}`);
    handleUpdateRates(chat_id);
    return;
  }
  
  if (state === "awaiting_eur_rate") {
    Logger.log(`Обрабатываю awaiting_eur_rate для chat_id: ${chat_id}, текст: ${text}`);
    
    const rate = parseFloat(text.replace(',', '.'));
    if (isNaN(rate) || rate <= 0) {
      Logger.log(`Неверный курс EUR: ${text}`);
      return sendText(chat_id, "❌ Курс должен быть положительным числом.");
    }
    
    Logger.log(`Сохраняю курс EUR: ${rate} для chat_id: ${chat_id}`);
    
    // Сохраняем индивидуальный курс для пользователя
    setCurrencyRateForUser(chat_id, 'EUR', rate);
    sendText(chat_id, `✅ Курс EUR обновлен: 1 EUR = ${formatMoney(rate)} сум`);
    
    userProps.deleteProperty(chat_id + "_state");
    Logger.log(`Состояние очищено для chat_id: ${chat_id}`);
    handleUpdateRates(chat_id);
    return;
  }
  
  if (state === "awaiting_rub_rate") {
    Logger.log(`Обрабатываю awaiting_rub_rate для chat_id: ${chat_id}, текст: ${text}`);
    
    const rate = parseFloat(text.replace(',', '.'));
    if (isNaN(rate) || rate <= 0) {
      Logger.log(`Неверный курс RUB: ${text}`);
      return sendText(chat_id, "❌ Курс должен быть положительным числом.");
    }
    
    Logger.log(`Сохраняю курс RUB: ${rate} для chat_id: ${chat_id}`);
    
    // Сохраняем индивидуальный курс для пользователя
    setCurrencyRateForUser(chat_id, 'RUB', rate);
    sendText(chat_id, `✅ Курс RUB обновлен: 1 RUB = ${formatMoney(rate)} сум`);
    
    userProps.deleteProperty(chat_id + "_state");
    Logger.log(`Состояние очищено для chat_id: ${chat_id}`);
    handleUpdateRates(chat_id);
    return;
  }
  
  // Обработка ввода дат для пользовательских периодов
  if (state && state.startsWith("awaiting_start_date|")) {
    const [, reportType, scope] = state.split("|");
    const datePattern = /^(\d{2})\.(\d{2})\.(\d{4})$/;
    const match = text.match(datePattern);
    
    if (!match) {
      return sendText(chat_id, "❌ Неверный формат даты. Введите в формате ДД.ММ.ГГГГ (например: 01.08.2024):");
    }
    
    const [, day, month, year] = match;
    const startDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    // Устанавливаем время начала на начало дня (00:00:00)
    startDate.setHours(0, 0, 0, 0);
    
    if (isNaN(startDate.getTime())) {
      return sendText(chat_id, "❌ Некорректная дата. Введите корректную дату в формате ДД.ММ.ГГГГ:");
    }
    
    userProps.setProperty(chat_id + "_state", `awaiting_end_date|${reportType}|${scope}|${startDate.getTime()}`);
    userProps.deleteProperty(chat_id + "_start_date");
    sendText(chat_id, "📅 Введите дату окончания периода в формате ДД.ММ.ГГГГ (например: 31.08.2024):");
    return;
  }
  
  if (state && state.startsWith("awaiting_end_date|")) {
    const [, reportType, scope, startDateMs] = state.split("|");
    const datePattern = /^(\d{2})\.(\d{2})\.(\d{4})$/;
    const match = text.match(datePattern);
    
    if (!match) {
      return sendText(chat_id, "❌ Неверный формат даты. Введите в формате ДД.ММ.ГГГГ (например: 31.08.2024):");
    }
    
    const [, day, month, year] = match;
    const endDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    // Устанавливаем время окончания на конец дня (23:59:59)
    endDate.setHours(23, 59, 59, 999);
    
    if (isNaN(endDate.getTime())) {
      return sendText(chat_id, "❌ Некорректная дата. Введите корректную дату в формате ДД.ММ.ГГГГ:");
    }
    
    const startDate = new Date(parseInt(startDateMs));
    
    if (endDate <= startDate) {
      return sendText(chat_id, "❌ Дата окончания должна быть позже даты начала. Введите корректную дату окончания:");
    }
    
    userProps.deleteProperty(chat_id + "_state");
    
    const familyInfo = getFamilyInfo(chat_id);
    const userIds = scope === 'family' && familyInfo ? familyInfo.members.map(m => m.id) : [chat_id];
    const scopeText = scope === 'family' && familyInfo ? `(семья: ${familyInfo.name})` : `(личный)`;
    
    const startDateStr = `${String(startDate.getDate()).padStart(2, '0')}.${String(startDate.getMonth() + 1).padStart(2, '0')}.${startDate.getFullYear()}`;
    const endDateStr = `${String(endDate.getDate()).padStart(2, '0')}.${String(endDate.getMonth() + 1).padStart(2, '0')}.${endDate.getFullYear()}`;
    const periodText = `с ${startDateStr} до ${endDateStr}`;
    
    if (reportType === 'detailed') {
      generateDetailedReportForPeriod(chat_id, userIds, scopeText, startDate, endDate, periodText);
    }
    return;
  }
  
  // Обработка ввода информации о долгах
  if (state === "awaiting_credit_info") {
    // Поддерживаем форматы: "5000 Имя описание", "5000$ Имя описание", "5000 $ Имя описание", "$ 5000 Имя описание"
    const parts = text.match(/^(?:(\$|€|₽|USD|EUR|RUB)\s*)?(\d+[\.,]?\d*)\s*(\$|€|₽|USD|EUR|RUB)?\s+([^\s]+)\s*(.*)$/);
    if (!parts) {
      return sendText(chat_id, "❌ Неверный формат. Введите: `Сумма Имя Описание`\n\nПримеры:\n• `50000 Алексей за ремонт`\n• `5000$ Жасур ака ремонт`\n• `€500 Мария за машину`", "Markdown");
    }
    
    const amount = parseFloat(parts[2].replace(',', '.'));
    const debtor = parts[4].trim();
    const description = parts[5] ? parts[5].trim() : 'Долг';
    
    if (isNaN(amount) || amount <= 0) {
      return sendText(chat_id, "❌ Сумма должна быть положительным числом.");
    }
    
    // ИСПРАВЛЕНИЕ: Правильно определяем валюту из захваченных групп regex
    let currency = 'UZS'; // по умолчанию
    const currencySymbolBefore = parts[1]; // символ валюты в начале
    const currencySymbolAfter = parts[3];  // символ валюты после числа
    
    if (currencySymbolBefore || currencySymbolAfter) {
      const currencySymbol = currencySymbolBefore || currencySymbolAfter;
      if (currencySymbol === '$' || currencySymbol === 'USD') {
        currency = 'USD';
      } else if (currencySymbol === '€' || currencySymbol === 'EUR') {
        currency = 'EUR';
      } else if (currencySymbol === '₽' || currencySymbol === 'RUB') {
        currency = 'RUB';
      }
    } else {
      // Если нет явного символа валюты, пытаемся определить из текста
      currency = detectCurrency(description || text);
    }
    
    const amountInUZS = convertCurrency(amount, currency, 'UZS', chat_id);
    
    // Логирование для отладки
    Logger.log(`Добавление кредита: amount=${amount}, currency=${currency}, amountInUZS=${amountInUZS}, debtor=${debtor}`);
    Logger.log(`Regex части: currencyBefore=${currencySymbolBefore}, currencyAfter=${currencySymbolAfter}`);
    
    // Сохраняем данные и запрашиваем дату погашения
    userProps.setProperty(chat_id + "_pendingDebtData", JSON.stringify({type: 'Кредит', counterparty: debtor, amount, currency, amountInUZS, description}));
    userProps.setProperty(chat_id + "_state", "awaiting_due_date");
    return sendText(chat_id, "📅 Введите дату погашения в формате ДД.ММ.ГГГГ (например: 15.02.2024):");
  }
  
  if (state === "awaiting_debt_info") {
    // Поддерживаем форматы: "5000 Имя описание", "5000$ Имя описание", "5000 $ Имя описание", "$ 5000 Имя описание"
    const parts = text.match(/^(?:(\$|€|₽|USD|EUR|RUB)\s*)?(\d+[\.,]?\d*)\s*(\$|€|₽|USD|EUR|RUB)?\s+([^\s]+)\s*(.*)$/);
    if (!parts) {
      return sendText(chat_id, "❌ Неверный формат. Введите: `Сумма Имя Описание`\n\nПримеры:\n• `100000 Мария за машину`\n• `1000$ Алексей за ремонт`\n• `€200 Петр за услуги`", "Markdown");
    }
    
    const amount = parseFloat(parts[2].replace(',', '.'));
    const creditor = parts[4].trim();
    const description = parts[5] ? parts[5].trim() : 'Долг';
    
    if (isNaN(amount) || amount <= 0) {
      return sendText(chat_id, "❌ Сумма должна быть положительным числом.");
    }
    
    // ИСПРАВЛЕНИЕ: Правильно определяем валюту из захваченных групп regex
    let currency = 'UZS'; // по умолчанию
    const currencySymbolBefore = parts[1]; // символ валюты в начале
    const currencySymbolAfter = parts[3];  // символ валюты после числа
    
    if (currencySymbolBefore || currencySymbolAfter) {
      const currencySymbol = currencySymbolBefore || currencySymbolAfter;
      if (currencySymbol === '$' || currencySymbol === 'USD') {
        currency = 'USD';
      } else if (currencySymbol === '€' || currencySymbol === 'EUR') {
        currency = 'EUR';
      } else if (currencySymbol === '₽' || currencySymbol === 'RUB') {
        currency = 'RUB';
      }
    } else {
      // Если нет явного символа валюты, пытаемся определить из текста
      currency = detectCurrency(description || text);
    }
    
    const amountInUZS = convertCurrency(amount, currency, 'UZS', chat_id);
    
    // Логирование для отладки
    Logger.log(`Добавление долга: amount=${amount}, currency=${currency}, amountInUZS=${amountInUZS}, creditor=${creditor}`);
    Logger.log(`Regex части: currencyBefore=${currencySymbolBefore}, currencyAfter=${currencySymbolAfter}`);
    
    // Сохраняем данные и запрашиваем дату погашения
    userProps.setProperty(chat_id + "_pendingDebtData", JSON.stringify({type: 'Дебет', counterparty: creditor, amount, currency, amountInUZS, description}));
    userProps.setProperty(chat_id + "_state", "awaiting_due_date");
    return sendText(chat_id, "📅 Введите дату погашения в формате ДД.ММ.ГГГГ (например: 15.02.2024):");
  }
  
  // Обработка ввода срока погашения для нового долга/кредита
  if (state === "awaiting_due_date") {
    // Парсим дату в формате ДД.ММ.ГГГГ
    const datePattern = /^(\d{2})\.(\d{2})\.(\d{4})$/;
    const match = text.match(datePattern);
    
    if (!match) {
      return sendText(chat_id, "❌ Неверный формат даты. Введите в формате ДД.ММ.ГГГГ (например: 15.02.2024):");
    }
    
    const [, day, month, year] = match;
    const dueDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    
    if (isNaN(dueDate.getTime())) {
      return sendText(chat_id, "❌ Некорректная дата. Введите корректную дату в формате ДД.ММ.ГГГГ:");
    }
    
    // Проверяем, что дата не в прошлом
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (dueDate < today) {
      return sendText(chat_id, "❌ Дата не может быть в прошлом. Введите будущую дату:");
    }
    
    const pendingDataJson = userProps.getProperty(chat_id + "_pendingDebtData");
    if (!pendingDataJson) {
    userProps.deleteProperty(chat_id + "_state");
      return sendText(chat_id, "❌ Не удалось найти данные долга. Попробуйте заново.");
    }
    
    const data = JSON.parse(pendingDataJson);
    
    addDebtRecord(chat_id, data.type, data.counterparty, data.amount, data.currency, data.amountInUZS, data.description, dueDate);
    
    // Очистка состояний
    userProps.deleteProperty(chat_id + "_state");
    userProps.deleteProperty(chat_id + "_pendingDebtData");
    
    const typeText = data.type === 'Дебет' ? 'Долг' : 'Кредит';
    const dueDateStr = `${day}.${month}.${year}`;
    sendText(chat_id, `✅ ${typeText} добавлен!\n👤 Контрагент: ${data.counterparty}\n💰 Сумма: ${formatMultiCurrency(data.amount, data.currency, data.amountInUZS)}\n📅 Срок погашения: ${dueDateStr}\n📝 ${data.description}`);
    
    handleDebtsMenu(chat_id);
    return;
  }
  
  // Обработка изменения срока долга
  if (state && state.startsWith("awaiting_new_due_date|")) {
    const debtRowIndex = parseInt(state.split("|")[1]);
    
    // Парсим дату в формате ДД.ММ.ГГГГ
    const datePattern = /^(\d{2})\.(\d{2})\.(\d{4})$/;
    const match = text.match(datePattern);
    
    if (!match) {
      return sendText(chat_id, "❌ Неверный формат даты. Введите в формате ДД.ММ.ГГГГ (например: 15.02.2024):");
    }
    
    const [, day, month, year] = match;
    const newDueDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    
    if (isNaN(newDueDate.getTime())) {
      return sendText(chat_id, "❌ Некорректная дата. Введите корректную дату в формате ДД.ММ.ГГГГ:");
    }
    
    // Проверяем, что дата не в прошлом (можем разрешить сегодня)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (newDueDate < today) {
      return sendText(chat_id, "❌ Дата не может быть в прошлом. Введите будущую дату:");
    }
    
    // Обрабатываем изменение срока
    const result = extendDebtDueDate(chat_id, debtRowIndex, newDueDate);
    
    userProps.deleteProperty(chat_id + "_state");
    
    if (result.success) {
      const typeText = result.type === 'Дебет' ? 'долга' : 'кредита';
      let message = `✅ *Срок ${typeText} изменен!*\n\n`;
      message += `👤 Контрагент: ${result.counterparty}\n`;
      message += `📅 Новый срок: ${result.newDate}`;
      
      sendText(chat_id, message, "Markdown");
    } else {
      sendText(chat_id, `❌ ${result.error}`);
    }
    
    handleDebtsMenu(chat_id);
    return;
  }
  
  // Обработка погашения долгов
  if (state && state.startsWith("awaiting_payment|")) {
    const debtRowIndex = parseInt(state.split("|")[1]);
    
    // Парсим сумму погашения (поддерживаем валютные символы)
    const amountMatch = text.match(/^(?:(\$|€|₽|USD|EUR|RUB)\s*)?(\d+[\.,]?\d*)\s*(\$|€|₽|USD|EUR|RUB)?/);
    if (!amountMatch) {
      return sendText(chat_id, "❌ Неверный формат суммы. Введите число, например: `10000`, `100$`, `€50`");
    }
    
    const paymentAmount = parseFloat(amountMatch[2].replace(',', '.'));
    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      return sendText(chat_id, "❌ Сумма должна быть положительным числом.");
    }
    
    // Определяем валюту платежа
    const paymentCurrency = detectCurrency(text);
    const paymentAmountInUZS = convertCurrency(paymentAmount, paymentCurrency, 'UZS', chat_id);
    
    // Обрабатываем погашение
    const result = processDebtPayment(chat_id, debtRowIndex, paymentAmountInUZS, paymentAmount, paymentCurrency);
    
    userProps.deleteProperty(chat_id + "_state");
    
    if (result.success) {
      let message = `✅ *Долг погашен!*\n\n`;
      message += `💰 Сумма платежа: ${formatMultiCurrency(paymentAmount, paymentCurrency, paymentAmountInUZS)}\n`;
      message += `👤 Кредитор: ${result.counterparty}\n`;
      
      if (result.fullyPaid) {
        message += `🎉 Долг полностью погашен!`;
      } else {
        message += `💳 Осталось доплатить: ${formatMoney(result.remainingAmount)} сум`;
      }
      
      sendText(chat_id, message, "Markdown");
    } else {
      sendText(chat_id, `❌ ${result.error}`);
    }
    
    handleDebtsMenu(chat_id);
    return;
  }

  const awaitingAiQuestion = userProps.getProperty(chat_id + "_awaiting_ai_question");
  if (awaitingAiQuestion === "true") {
    try {
      const aiAnswer = getAiFinancialAnalysis(chat_id, text);
      sendText(chat_id, aiAnswer, "Markdown");
    } finally {
      userProps.deleteProperty(chat_id + "_awaiting_ai_question");
      sendMainMenu(chat_id);
    }
    return;
  }

  const selectedData = userProps.getProperty(chat_id + "_selected");
  if (selectedData) {
    const [type, categoryId] = selectedData.split("|");
    const catLabel = getCategoryLabel(categoryId, getUserLang(chat_id));
    const parts = text.match(/^(\d+[\.,]?\d*)\s*(.*)$/);
    if (!parts) {
      return sendText(chat_id, "❌ Неверный формат. `Сумма Комментарий`", "Markdown");
    }
    const amount = parseFloat(parts[1].replace(',', '.'));
    const comment = parts[2] ? parts[2].trim() : '';
    
    // Определяем валюту из комментария
    const currency = detectCurrency(comment || text);
    const amountInUZS = convertCurrency(amount, currency, 'UZS', chat_id);
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const targetSheetName = type === 'доход' ? sheetIncome : sheetExpense;
    const sheet = ss.getSheetByName(targetSheetName);
    const rowNumber = sheet.getLastRow() + 1;
    
    // Добавляем строку с валютой: Дата, Категория (ID), Сумма, Комментарий, Chat_ID, Валюта, Сумма_UZS
    sheet.appendRow([new Date(), categoryId, amount, comment, chat_id, currency, amountInUZS]);
    userProps.deleteProperty(chat_id + "_selected");
    
    // Сохраняем информацию о последней транзакции для возможности удаления
    const transactionInfo = {
      sheetName: targetSheetName,
      rowNumber: rowNumber,
      type: type,
      category: categoryId,
      amount: amount,
      currency: currency,
      amountInUZS: amountInUZS,
      comment: comment
    };
    userProps.setProperty(chat_id + "_last_transaction", JSON.stringify(transactionInfo));
    
    const deleteKeyboard = {
      inline_keyboard: [
        [{ text: "🗑️ Удалить эту транзакцию", callback_data: `delete_last_transaction` }]
      ]
    };
    
    const displayText = currency === 'UZS' ? 
      `✅ ${type === 'доход' ? 'Доход' : 'Расход'} на ${formatMoney(amount)} сум добавлен в категорию "${catLabel}".` :
      `✅ ${type === 'доход' ? 'Доход' : 'Расход'} на ${formatMultiCurrency(amount, currency, amountInUZS)} добавлен в категорию "${catLabel}".`;
    
    sendText(chat_id, displayText, null, deleteKeyboard);
    if (type === 'расход') {
      checkBudgetLimit(chat_id, categoryId);
    }
    sendMainMenu(chat_id);
    return;
  }

  const awaitingCategory = userProps.getProperty(chat_id + "_awaitingCategory");
  if (awaitingCategory === "true") {
    const ss = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(settingSheet);
    const targetRow = findNextEmptyRowInColumn(ss, 1);
    ss.getRange(targetRow, 1).setValue(text);
    userProps.deleteProperty(chat_id + "_awaitingCategory");
    sendText(chat_id, `✅ Новая категория "${text}" добавлена.`);
    sendSettingsMenu(chat_id);
    return;
  }

  // Проверяем, является ли ввод доходом или расходом
  const parts = text.match(/^(\d+[\.,]?\d*)\s*(.*)$/);
  if (parts) {
    const amount = parseFloat(parts[1].replace(',', '.'));
    const comment = parts[2] ? parts[2].trim() : '';
    if (isNaN(amount) || amount <= 0) {
      return sendText(chat_id, "❌ Сумма должна быть положительным числом.");
    }
    
    // Определяем валюту из комментария
    const currency = detectCurrency(comment || text);
    const amountInUZS = convertCurrency(amount, currency, 'UZS', chat_id);
    
    const incomeCategories = getCategories('доход');
    const expenseCategories = getCategories('расход', getUserLang(chat_id));
    const categoryId = classifyExpenseWithAI(chat_id, comment || text);
    if (categoryId) {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      // Определяем тип категории по ID
      const categoryInfo = loadCategoryDict().byId[categoryId];
      const targetSheetName = categoryInfo && categoryInfo.type === 'доход' ? sheetIncome : sheetExpense;
      const sheet = ss.getSheetByName(targetSheetName);
      const rowNumber = sheet.getLastRow() + 1;
      
      // Добавляем строку с валютой: Дата, Категория (ID), Сумма, Комментарий, Chat_ID, Валюта, Сумма_UZS
      sheet.appendRow([new Date(), categoryId, amount, comment || text, chat_id, currency, amountInUZS]);
      const type = categoryInfo && categoryInfo.type === 'доход' ? 'Доход' : 'Расход';
      
      // Сохраняем информацию о последней транзакции для возможности удаления
      const transactionInfo = {
        sheetName: targetSheetName,
        rowNumber: rowNumber,
        type: type,
        category: categoryId,
        amount: amount,
        currency: currency,
        amountInUZS: amountInUZS,
        comment: comment || text
      };
      userProps.setProperty(chat_id + "_last_transaction", JSON.stringify(transactionInfo));
      
      const deleteKeyboard = {
        inline_keyboard: [
          [{ text: "🗑️ Удалить эту транзакцию", callback_data: `delete_last_transaction` }]
        ]
      };
      
      const catLabel = getCategoryLabel(categoryId, getUserLang(chat_id));
      const displayText = currency === 'UZS' ? 
        `✅ ${type} на ${formatMoney(amount)} сум добавлен в категорию "${catLabel}".` :
        `✅ ${type} на ${formatMultiCurrency(amount, currency, amountInUZS)} добавлен в категорию "${catLabel}".`;
      
      sendText(chat_id, displayText, null, deleteKeyboard);
      if (type === 'Расход') {
        checkBudgetLimit(chat_id, categoryId);
      }
      sendMainMenu(chat_id);
      return;
    }
  }

  // Если ИИ не смог классифицировать или формат неверный
  const confirmationKeyboard = {
    inline_keyboard: [
      [{ text: "✅ Да, спросить аналитика", callback_data: `ask_ai|${text}` }],
      [{ text: "⛔ Нет, выбрать категорию вручную", callback_data: `select_category|${text}` }]
    ]
  };
  sendText(chat_id, `Я не распознал команду или не смог классифицировать: "*${text}*".\nХотите задать вопрос аналитику или выбрать категорию вручную?`, "Markdown", confirmationKeyboard);
}
function handleCallbackQuery(callback) {
  const chat_id = String(callback.message.chat.id);
  const message_id = callback.message.message_id;
  const data = callback.data;
  answerCallback(callback.id);

      const partsCb = data.split("|");
    const action = partsCb[0];
  switch(action) {
    case 'set_lang_ru':
      PropertiesService.getUserProperties().setProperty(chat_id + "_lang", 'ru');
      editMessageText(chat_id, message_id, 'Язык установлен: Русский 🇷🇺');
      sendMainMenu(chat_id);
      break;
    case 'set_lang_uz':
      PropertiesService.getUserProperties().setProperty(chat_id + "_lang", 'uz');
      editMessageText(chat_id, message_id, "Til o'rnatildi: O'zbek 🇺🇿");
      sendMainMenu(chat_id);
      break;
    case 'ask_ai':
      deleteMessage(chat_id, message_id);
      const question = data.substring(data.indexOf('|') + 1);
      const aiAnswer = getAiFinancialAnalysis(chat_id, question);
      sendText(chat_id, aiAnswer, "Markdown");
      sendMainMenu(chat_id);
      break;
    case 'cancel_ai_question':
      deleteMessage(chat_id, message_id);
      sendMainMenu(chat_id);
      break;
    case 'select_category':
      deleteMessage(chat_id, message_id);
      const text = data.substring(data.indexOf('|') + 1);
      PropertiesService.getUserProperties().setProperty(chat_id + "_selected", `расход|${text}`);
      sendCategoryButtons(chat_id, 'расход');
      break;
    case 'add_to_goal':
      const goalId = data.split("|")[1];
      const goalName = data.split("|")[2];
      PropertiesService.getUserProperties().setProperty(chat_id + "_state", `awaiting_deposit|${goalId}`);
      deleteMessage(chat_id, message_id);
      sendText(chat_id, `Введите сумму, которую хотите отложить на цель *"${goalName}"*:`, "Markdown");
      break;
    case 'set_budget_limit':
      const category = data.split("|")[1];
      PropertiesService.getUserProperties().setProperty(chat_id + "_state", `awaiting_budget_limit|${category}`);
      deleteMessage(chat_id, message_id);
      sendText(chat_id, `Введите новый лимит для категории *"${category}"* (0 для удаления):`, "Markdown");
      break;
    case 'back_to_budget_menu':
      deleteMessage(chat_id, message_id);
      handleMyBudget(chat_id);
      break;
    case 'apply_ai_budget':
      deleteMessage(chat_id, message_id);
      const tempBudgetJson = PropertiesService.getUserProperties().getProperty(chat_id + "_temp_budget");
      if (!tempBudgetJson) {
        return sendText(chat_id, "❌ Не удалось найти предложенный бюджет.");
      }
      const budgetToApply = JSON.parse(tempBudgetJson);
      for (const category in budgetToApply) {
        setBudgetForCategory(chat_id, category, budgetToApply[category]);
      }
      PropertiesService.getUserProperties().deleteProperty(chat_id + "_temp_budget");
      sendText(chat_id, "✅ Бюджет от ИИ успешно применен!");
      handleViewCurrentBudget(chat_id);
      break;
    case 'clear':
      const confirm = partsCb[1];
      if (confirm === 'yes') {
        clearUserData(chat_id);
        editMessageText(chat_id, message_id, '✅ Данные удалены!');
        sendMainMenu(chat_id);
      } else {
        editMessageText(chat_id, message_id, 'Операция отменена.');
      }
      break;
    case 'decline_ai_budget':
      deleteMessage(chat_id, message_id);
      PropertiesService.getUserProperties().deleteProperty(chat_id + "_temp_budget");
      sendText(chat_id, "ℹ️ Предложенный бюджет отклонен.");
      handleMyBudget(chat_id);
      break;
    case 'delete_last_transaction':
      deleteMessage(chat_id, message_id);
      handleDeleteLastTransaction(chat_id);
      break;
    case 'run_report':
      deleteMessage(chat_id, message_id);
      const reportType = data.split("|")[1];
      const scope = data.split("|")[2];
      const familyInfo = getFamilyInfo(chat_id);
      const userIds = scope === 'family' && familyInfo ? familyInfo.members.map(m => m.id) : [chat_id];
      const scopeText = scope === 'family' && familyInfo ? `(семья: ${familyInfo.name})` : `(личный)`;
      if (reportType === 'balance') generateBalanceReport(chat_id, userIds, scopeText);
      if (reportType === 'detailed') generateDetailedReport(chat_id, userIds, scopeText);
      if (reportType === 'forecast') generateForecast(chat_id, userIds, scopeText);
      break;
    case 'choose_period':
      deleteMessage(chat_id, message_id);
      const chooseReportType = data.split("|")[1];
      const chooseScope = data.split("|")[2];
      handleChoosePeriod(chat_id, chooseReportType, chooseScope);
      break;
    case 'run_report_period':
      deleteMessage(chat_id, message_id);
      const periodReportType = data.split("|")[1];
      const periodScope = data.split("|")[2];
      const period = data.split("|")[3];
      handleRunReportPeriod(chat_id, periodReportType, periodScope, period);
      break;
    case 'custom_period':
      deleteMessage(chat_id, message_id);
      const customReportType = data.split("|")[1];
      const customScope = data.split("|")[2];
      handleCustomPeriod(chat_id, customReportType, customScope);
      break;
    case 'pay_debt':
      deleteMessage(chat_id, message_id);
      const debtRowIndex = data.split("|")[1];
      handlePayDebtProcess(chat_id, parseInt(debtRowIndex));
      break;
    case 'back_to_debts':
      deleteMessage(chat_id, message_id);
      handleDebtsMenu(chat_id);
      break;
    case 'extend_debt':
      deleteMessage(chat_id, message_id);
      const extendDebtRowIndex = data.split("|")[1];
      handleExtendDebtProcess(chat_id, parseInt(extendDebtRowIndex));
      break;
    default:
      deleteMessage(chat_id, message_id);
      PropertiesService.getUserProperties().setProperty(chat_id + "_selected", data);
      sendText(chat_id, `Выбрана категория: *${data.split("|")[1]}*.\n\nВведите \`Сумма Комментарий\``, "Markdown");
      break;
  }
}
function getAiFinancialAnalysis(chat_id, question) {
  const lang = getUserLang(chat_id);
  
  if (DEBUG_MODE) { 
    const debugPrompt = `Кратко и дружелюбно ответь на вопрос: "${question}"`; 
    const debugMessage = lang === 'uz' ? 
      "🤖 Test so'rovini yuboraman..." :
      "🤖 Отправляю тестовый запрос...";
    sendText(chat_id, debugMessage); 
    return callGeminiApi(debugPrompt); 
  }
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const expenseSheet = ss.getSheetByName(sheetExpense); 
  const incomeSheet = ss.getSheetByName(sheetIncome);
  if (!expenseSheet || !incomeSheet) {
    const errorMessage = lang === 'uz' ? 
      "Xatolik: 'Daromadlar' yoki 'Xarajatlar' jadvallari topilmadi." :
      "Ошибка: не найдены листы 'Доходы' или 'Расходы'.";
    return errorMessage;
  }
  
  const userIdsForAnalysis = [chat_id];
  const dateLimit = new Date(); 
  dateLimit.setDate(dateLimit.getDate() - AI_ANALYSIS_DAYS);
  const allExpenseData = expenseSheet.getLastRow() > 1 ? expenseSheet.getRange(2, 1, expenseSheet.getLastRow() - 1, 7).getValues() : [];
  const allIncomeData = incomeSheet.getLastRow() > 1 ? incomeSheet.getRange(2, 1, incomeSheet.getLastRow() - 1, 7).getValues() : [];
  const recentExpenseData = allExpenseData.filter(row => userIdsForAnalysis.includes(String(row[4])) && new Date(row[0]) >= dateLimit);
  const recentIncomeData = allIncomeData.filter(row => userIdsForAnalysis.includes(String(row[4])) && new Date(row[0]) >= dateLimit);
  const expenseJson = recentExpenseData.map(row => ({ дата: row[0].toLocaleDateString('ru-RU'), категория: row[1], сумма: row[2], комментарий: row[3] }));
  const incomeJson = recentIncomeData.map(row => ({ дата: row[0].toLocaleDateString('ru-RU'), категория: row[1], сумма: row[2], комментарий: row[3] }));
  const goalsData = getUserGoals(chat_id);
  const goalsText = goalsData.length > 0 ? JSON.stringify(goalsData.map(g => ({название: g.название, цель: g.целевая_сумма, накоплено: g.накоплено, дедлайн: g.дедлайн}))) : "У пользователя нет активных финансовых целей.";
  const prompt = `Ты — финансовый консультант. Проанализируй данные за последние ${AI_ANALYSIS_DAYS} дней. АКТИВНЫЕ ЦЕЛИ: ${goalsText}. ДОХОДЫ: ${JSON.stringify(incomeJson)}. РАСХОДЫ: ${JSON.stringify(expenseJson)}. ВОПРОС ПОЛЬЗОВАТЕЛЯ: "${question}". Твой ответ должен быть структурирован: 1. Краткий анализ. 2. Прямой ответ. 3. Рекомендация. ВАЖНО: Отвечай очень кратко (максимум 3-4 предложения), четко и по делу. Убери всю "воду". Используй Markdown.`;
  
  const analyzingMessage = lang === 'uz' ? 
    "🤖 Ma'lumotlaringizni tahlil qilaman..." :
    "🤖 Анализирую ваши данные...";
  sendText(chat_id, analyzingMessage);
  
  const aiResponse = callGeminiApi(prompt);
  
  // Проверяем, не вернулась ли ошибка
  if (aiResponse && (aiResponse.includes("ошибка") || aiResponse.includes("error") || aiResponse.includes("Код:") || aiResponse.includes("503"))) {
    const errorMessage = lang === 'uz' ? 
      "❌ Tahlil xizmati vaqtincha mavjud emas. Iltimos, keyinroq urinib ko'ring." :
      "❌ Сервис аналитики временно недоступен. Попробуйте позже.";
    return errorMessage;
  }
  
  return aiResponse;
}
function handleMyBudget(chat_id) { 
  const lang = getUserLang(chat_id);
  const message = lang === 'uz' ? 
    "💰 Bu yerda oyiga byudjetingizni boshqarishingiz mumkin." :
    "💰 Здесь вы можете управлять своим бюджетом на месяц.";
  sendText(chat_id, message, null, budgetKeyboard); 
}
function handleSuggestBudget(chat_id) {
  const lang = getUserLang(chat_id);
  const message = lang === 'uz' ? 
    "🤖 So'nggi 3 oy xarajatlaringizni tahlil qilaman... Iltimos, kuting." :
    "🤖 Анализирую ваши расходы за последние 3 месяца... Пожалуйста, подождите.";
  sendText(chat_id, message);
  const averageExpenses = getAverageExpenses(chat_id, 3);
  if (Object.keys(averageExpenses).length === 0) { 
    const noDataMessage = lang === 'uz' ? 
      "ℹ️ So'nggi 3 oy xarajatlari haqida tahlil uchun yetarli ma'lumot yo'q." :
      "ℹ️ У вас недостаточно данных о расходах за последние 3 месяца для анализа.";
    return sendText(chat_id, noDataMessage); 
  }
  
  // Конвертируем ID в названия для ИИ
  const expensesWithLabels = {};
  for (const categoryId in averageExpenses) {
    const catLabel = getCategoryLabel(categoryId, getUserLang(chat_id));
    expensesWithLabels[catLabel] = averageExpenses[categoryId];
  }
  
  const prompt = `Ты — строгий, но справедливый финансовый консультант. Твоя задача — предложить пользователю реалистичный месячный бюджет на основе его средних трат за последние 3 месяца. Предложи лимиты по каждой категории. Для некоторых категорий предложи небольшое сокращение (на 10-15%), чтобы помочь пользователю экономить. Ответ должен быть в формате JSON. Пример JSON: {"Продукты": 2000000, "Такси": 500000} Данные о средних трат пользователя (в сумах): ${JSON.stringify(expensesWithLabels)} Сформируй бюджет и верни его в виде JSON объекта. Без лишних слов, только JSON.`;
  const aiResponse = callGeminiApi(prompt);
  try {
    const jsonString = aiResponse.match(/\{.*\}/s)[0];
    const suggestedBudgetWithLabels = JSON.parse(jsonString);
    
    // Конвертируем названия обратно в ID
    const suggestedBudgetWithIds = {};
    for (const categoryLabel in suggestedBudgetWithLabels) {
      const categoryId = convertCategoryNameToId(categoryLabel);
      if (categoryId) {
        suggestedBudgetWithIds[categoryId] = suggestedBudgetWithLabels[categoryLabel];
      }
    }
    
    let report;
    if (lang === 'uz') {
      report = "🤖 *AI xarajatlaringizni tahlil qildi va oyiga quyidagi byudjetni taklif qiladi:*\n\n";
      for (const categoryId in suggestedBudgetWithIds) { 
        const catLabel = getCategoryLabel(categoryId, lang);
        report += ` - *${catLabel}*: ${formatMoney(suggestedBudgetWithIds[categoryId])} so'm\n`; 
      }
      report += "\nBu byudjetni qo'llashni xohlaysizmi?";
    } else {
      report = "🤖 *ИИ проанализировал ваши траты и предлагает следующий бюджет на месяц:*\n\n";
      for (const categoryId in suggestedBudgetWithIds) { 
        const catLabel = getCategoryLabel(categoryId, lang);
        report += ` - *${catLabel}*: ${formatMoney(suggestedBudgetWithIds[categoryId])} сум\n`; 
      }
      report += "\nХотите применить этот бюджет?";
    }
    PropertiesService.getUserProperties().setProperty(chat_id + "_temp_budget", JSON.stringify(suggestedBudgetWithIds));
    const confirmationKeyboard = { 
      inline_keyboard: [
        [{ text: lang === 'uz' ? "✅ Ha, qo'llash" : "✅ Да, применить", callback_data: `apply_ai_budget` }],
        [{ text: lang === 'uz' ? "⛔ Yo'q, rahmat" : "⛔ Нет, спасибо", callback_data: `decline_ai_budget` }]
      ]
    };
    sendText(chat_id, report, "Markdown", confirmationKeyboard);
  } catch (e) { 
    Logger.log("Ошибка парсинга бюджета от ИИ: " + e.toString() + ". Ответ ИИ: " + aiResponse); 
    sendText(chat_id, "❌ ИИ вернул ответ в некорректном формате. Попробуйте еще раз позже."); 
  }
}
function handleSetupBudgetManually(chat_id) {
  const expenseCategories = getCategories('расход', getUserLang(chat_id)); 
  const currentBudget = getBudget(chat_id);
  if (expenseCategories.length === 0) { 
    return sendText(chat_id, "Сначала добавьте категории расходов в Настройках."); 
  }
  let text = "✏️ *Настройка бюджета вручную:*\n\nНажмите на категорию, чтобы установить или изменить лимит.\n\n";
  const buttons = [];
  expenseCategories.forEach(cat => {
    const limit = currentBudget[cat.id] || 0;
    const buttonText = limit > 0 ? `${cat.label}: ${formatMoney(limit)} сум` : `${cat.label}: (не задан)`;
    buttons.push([{ text: buttonText, callback_data: `set_budget_limit|${cat.id}` }]);
  });
  buttons.push([{ text: COMMANDS.backToSettings, callback_data: "back_to_budget_menu" }]);
  sendText(chat_id, text, "Markdown", { inline_keyboard: buttons });
}
function handleViewCurrentBudget(chat_id) {
  const budget = getBudget(chat_id);
  if (Object.keys(budget).length === 0) { 
    return sendText(chat_id, "ℹ️ У вас еще не настроен бюджет.", null, budgetKeyboard); 
  }
  const expenses = getExpensesForCurrentMonth([chat_id]);
  let report = "👀 *Ваш бюджет на текущий месяц:*\n\n";
  for (const categoryId in budget) {
    const limit = budget[categoryId]; 
    const spent = expenses[categoryId] || 0; 
    const remaining = limit - spent; 
    const progress = limit > 0 ? (spent / limit) * 100 : 0;
    const catLabel = getCategoryLabel(categoryId, getUserLang(chat_id));
    report += `*${catLabel}*:\n` + ` - Потрачено: ${formatMoney(spent)} из ${formatMoney(limit)} сум\n` + ` - Остаток: ${formatMoney(remaining)} сум (${progress.toFixed(0)}%)\n\n`;
  }
  sendText(chat_id, report, "Markdown", budgetKeyboard);
}
function checkBudgetLimit(chat_id, categoryId) {
  const budget = getBudget(chat_id); 
  const limit = budget[categoryId]; 
  if (!limit) return;
  const expenses = getExpensesForCurrentMonth([chat_id]); 
  const totalSpent = expenses[categoryId] || 0;
  const progress = (totalSpent / limit) * 100;
  const catLabel = getCategoryLabel(categoryId, getUserLang(chat_id));
  if (progress >= 100) { 
    sendText(chat_id, `⛔ *Превышен лимит!* Вы потратили ${progress.toFixed(0)}% бюджета по категории "${catLabel}".`); 
  }
  else if (progress >= 90) { 
    sendText(chat_id, `⚠️ *Внимание!* Вы потратили уже ${progress.toFixed(0)}% бюджета по категории "${catLabel}".`); 
  }
}
function handleMyGoals(chat_id) { 
  sendText(chat_id, "🎯 Управление финансовыми целями.", null, goalsKeyboard); 
}
function handleNewGoal(chat_id) { 
  PropertiesService.getUserProperties().setProperty(chat_id + "_state", "awaiting_goal_name"); 
  sendText(chat_id, "Напишите название цели:", "Markdown"); 
}
function handleListGoals(chat_id) {
  const goals = getUserGoals(chat_id);
  if (goals.length === 0) { 
    return sendText(chat_id, "У вас пока нет активных целей.", null, goalsKeyboard); 
  }
  sendText(chat_id, "📋 *Ваши активные цели:*", "Markdown");
  goals.forEach(goal => {
    const progress = goal.целевая_сумма > 0 ? (goal.накоплено / goal.целевая_сумма) * 100 : 0;
    const report = `🎯 *${goal.название}*\n` + `   - Собрано: ${formatMoney(goal.накоплено)} из ${formatMoney(goal.целевая_сумма)} сум (${progress.toFixed(1)}%)\n` + `   - Дедлайн: ${goal.дедлайн}`;
    const inlineKeyboard = { inline_keyboard: [[{ text: "🎯 Пополнить", callback_data: `add_to_goal|${goal.id}|${goal.название}` }]] };
    sendText(chat_id, report, "Markdown", inlineKeyboard);
  });
}
function handleGoalCreation(chat_id, text, state) {
  const userProps = PropertiesService.getUserProperties();
  const tempGoal = JSON.parse(userProps.getProperty(chat_id + "_temp_goal") || "{}");
  switch(state) {
    case "awaiting_goal_name": 
      tempGoal.name = text; 
      userProps.setProperty(chat_id + "_temp_goal", JSON.stringify(tempGoal)); 
      userProps.setProperty(chat_id + "_state", "awaiting_goal_amount"); 
      sendText(chat_id, "Введите целевую сумму (только цифры):", "Markdown"); 
      break;
    case "awaiting_goal_amount": 
      const amount = parseFloat(text); 
      if (isNaN(amount) || amount <= 0) { 
        return sendText(chat_id, "❌ Сумма должна быть числом больше нуля."); 
      } 
      tempGoal.amount = amount; 
      userProps.setProperty(chat_id + "_temp_goal", JSON.stringify(tempGoal)); 
      userProps.setProperty(chat_id + "_state", "awaiting_goal_deadline"); 
      sendText(chat_id, "Напишите дедлайн (ДД.ММ.ГГГГ):", "Markdown"); 
      break;
    case "awaiting_goal_deadline": 
      tempGoal.deadline = text; 
      const goalsSheetObj = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(goalsSheet); 
      goalsSheetObj.appendRow(["G" + new Date().getTime(), chat_id, tempGoal.name, tempGoal.amount, 0, tempGoal.deadline]); 
      userProps.deleteProperty(chat_id + "_state"); 
      userProps.deleteProperty(chat_id + "_temp_goal"); 
      sendText(chat_id, `✅ Новая цель "${tempGoal.name}" создана!`); 
      handleMyGoals(chat_id); 
      break;
  }
}
function handleReportsMenu(chat_id) { 
  const lang = getUserLang(chat_id);
  const msg = lang === 'uz' ? '📊 Hisobotlar va prognozlar menyusi:' : '📊 Меню отчетов и прогнозов:';
  sendText(chat_id, msg, null, buildReportsKeyboard(lang));
}
function handleForecast(chat_id) { 
  if (chat_id === OWNER_ID) { 
    const keyboard = { 
      inline_keyboard: [
        [{ text: "👤 Только мой", callback_data: "run_report|forecast|personal" }, 
         { text: "👨‍👩‍👧‍👦 Общий семейный", callback_data: "run_report|forecast|family" }]
      ]
    }; 
    sendText(chat_id, "Какой прогноз сделать?", "Markdown", keyboard); 
  } else { 
    generateForecast(chat_id, [chat_id], "(личный)"); 
  } 
}
function handleBalance(chat_id) { 
  if (chat_id === OWNER_ID) { 
    const keyboard = { 
      inline_keyboard: [
        [{ text: "👤 Только мой", callback_data: "run_report|balance|personal" }, 
         { text: "👨‍👩‍👧‍👦 Общий семейный", callback_data: "run_report|balance|family" }]
      ]
    }; 
    sendText(chat_id, "Какой остаток показать?", "Markdown", keyboard); 
  } else { 
    generateBalanceReport(chat_id, [chat_id], "(личный)"); 
  } 
}
function sendReport(chat_id) { 
  if (chat_id === OWNER_ID) { 
    const keyboard = { 
      inline_keyboard: [
        [{ text: "👤 Только мой", callback_data: "choose_period|detailed|personal" }, 
         { text: "👨‍👩‍👧‍👦 Общий семейный", callback_data: "choose_period|detailed|family" }]
      ]
    }; 
    sendText(chat_id, "Какой детализированный отчет показать?", "Markdown", keyboard); 
  } else { 
    handleChoosePeriod(chat_id, "detailed", "personal");
  } 
}
function handleChoosePeriod(chat_id, reportType, scope) {
  const keyboard = { 
    inline_keyboard: [
      [{ text: "📅 Текущий месяц", callback_data: `run_report_period|${reportType}|${scope}|current_month` }],
      [{ text: "📆 Прошлый месяц", callback_data: `run_report_period|${reportType}|${scope}|last_month` }],
      [{ text: "🗓️ Выбрать период", callback_data: `custom_period|${reportType}|${scope}` }]
    ]
  }; 
  
  const scopeText = scope === 'family' ? 'семейный' : 'личный';
  sendText(chat_id, `📊 Выберите период для ${scopeText} отчёта:`, "Markdown", keyboard); 
}

function handleRunReportPeriod(chat_id, reportType, scope, period) {
  const familyInfo = getFamilyInfo(chat_id);
  const userIds = scope === 'family' && familyInfo ? familyInfo.members.map(m => m.id) : [chat_id];
  const scopeText = scope === 'family' && familyInfo ? `(семья: ${familyInfo.name})` : `(личный)`;
  
  let startDate, endDate, periodText;
  const now = new Date();
  
  if (period === 'current_month') {
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    startDate.setHours(0, 0, 0, 0); // Начало дня
    endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    endDate.setHours(23, 59, 59, 999); // Конец дня
    periodText = `за ${getMonthName(now.getMonth())} ${now.getFullYear()}`;
  } else if (period === 'last_month') {
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    startDate = new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 1);
    startDate.setHours(0, 0, 0, 0); // Начало дня
    endDate = new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 0);
    endDate.setHours(23, 59, 59, 999); // Конец дня
    periodText = `за ${getMonthName(lastMonth.getMonth())} ${lastMonth.getFullYear()}`;
  }
  
  if (reportType === 'detailed') {
    generateDetailedReportForPeriod(chat_id, userIds, scopeText, startDate, endDate, periodText);
  }
}

function handleCustomPeriod(chat_id, reportType, scope) {
  const userProps = PropertiesService.getUserProperties();
  userProps.setProperty(chat_id + "_state", `awaiting_start_date|${reportType}|${scope}`);
  sendText(chat_id, "📅 Введите дату начала периода в формате ДД.ММ.ГГГГ (например: 01.08.2024):");
}

function getMonthName(monthIndex) {
  const months = [
    'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
    'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'
  ];
  return months[monthIndex];
}

function getUserLang(chat_id) {
  const lang = PropertiesService.getUserProperties().getProperty(chat_id + "_lang");
  return lang === 'uz' ? 'uz' : 'ru';
}

function getCommandsByLang(lang) {
  return lang === 'uz' ? COMMANDS_UZ : COMMANDS;
}

function buildMainKeyboard(lang) {
  const C = getCommandsByLang(lang);
  return { keyboard: [[{ text: C.addExpense }, { text: C.addIncome }], [{ text: C.viewReport }], [{ text: C.debtsMenu }], [{ text: C.askAnalyst }], [{ text: C.settings }]], resize_keyboard: true, is_persistent: true };
}

function handleChangeLanguage(chat_id) {
  const lang = getUserLang(chat_id);
  const langKeyboard = { inline_keyboard: [[{ text: "🇷🇺 Русский", callback_data: "set_lang_ru" }, { text: "🇺🇿 O'zbek", callback_data: "set_lang_uz" }]] };
  const message = lang === 'uz' ? 
    "Tilni tanlang:" :
    "Выберите язык:";
  sendText(chat_id, message, null, langKeyboard);
}

function buildReportsKeyboard(lang) {
  const C = getCommandsByLang(lang);
  return { keyboard: [[{ text: C.forecast }], [{ text: C.detailedReport }, { text: C.viewBalance }], [{ text: C.back }]], resize_keyboard: true, is_persistent: true };
}

function buildSettingsKeyboard(lang) {
  const C = getCommandsByLang(lang);
  return { keyboard: [[{ text: C.familyMode }], [{ text: C.myBudget }], [{ text: C.myGoals }], [{ text: C.setupCategories }], [{ text: C.addNewCategory }], [{ text: C.updateRates }], [{ text: C.migrateData }], [{ text: C.clearBase }], [{ text: C.changeLang }], [{ text: C.back }]], resize_keyboard: true, is_persistent: true };
}

function sendMainMenu(chat_id) { 
  const lang = getUserLang(chat_id);
  const msg = lang === 'uz' ? 'Asosiy menyu:' : 'Главное меню:';
  sendText(chat_id, msg, null, buildMainKeyboard(lang));
}

function sendSettingsMenu(chat_id) { 
  const lang = getUserLang(chat_id);
  const msg = lang === 'uz' ? 'Sozlamalar menyusi:' : 'Меню настроек:';
  sendText(chat_id, msg, null, buildSettingsKeyboard(lang));
}

function sendCategoryButtons(chat_id, type) { 
  const categories = getCategories(type, getUserLang(chat_id)); 
  if (!categories.length) return sendText(chat_id, `❌ Нет доступных категорий.`); 
  const buttons = categories.map(c => [{ text: c.label, callback_data: `${type}|${c.id}` }]); 
  sendText(chat_id, `Выбери категорию:`, null, { inline_keyboard: buttons }); 
}
function askClearConfirmation(chat_id) { 
  const lang = getUserLang(chat_id);
  const confKeyboard = { 
    inline_keyboard: [
      [{ text: lang === 'uz' ? "⚠️ Ha, tozalash!" : "⚠️ Да, очистить!", callback_data: "clear|yes" }],
      [{ text: lang === 'uz' ? "⛔ Yo'q" : "⛔ Нет", callback_data: "clear|no" }]
    ]
  }; 
  PropertiesService.getUserProperties().setProperty(chat_id + "_awaitingClearConfirmation", "true"); 
  const message = lang === 'uz' ? 
    "‼️ *DIQQAT!* ‼️\nSiz *BARCHA* xarajat va daromadlarni tozalashni xohlaysizmi?" :
    "‼️ *ВНИМАНИЕ!* ‼️\nВы уверены, что хотите очистить *ВСЕ* расходы и доходы?";
  sendText(chat_id, message, "Markdown", confKeyboard); 
}
function sendConfigureExpenseCategoryMenu(chat_id, message_id = null) { 
  sendText(chat_id, "Эта функция в разработке."); 
}
function handleFamilyMode(chat_id) { 
  const lang = getUserLang(chat_id);
  const message = lang === 'uz' ? 
    "👨‍👩‍👧‍👦 Bu yerda o'zingizning oilangizni yaratishingiz yoki mavjud oilaga qo'shilishingiz mumkin." :
    "👨‍👩‍👧‍👦 Здесь вы можете создать свою семью или присоединиться к существующей.";
  sendText(chat_id, message, null, buildFamilyKeyboard(lang)); 
}
function handleCreateFamily(chat_id) { 
  const lang = getUserLang(chat_id);
  const family = getFamilyInfo(chat_id); 
  if (family && chat_id !== OWNER_ID) { 
    const message = lang === 'uz' ? 
      `Siz allaqachon "${family.name}" oilasida siz.` :
      `Вы уже состоите в семье "${family.name}".`;
    return sendText(chat_id, message); 
  } 
  PropertiesService.getUserProperties().setProperty(chat_id + "_state", "awaiting_family_name"); 
  const message = lang === 'uz' ? 
    "O'zingizning oilangiz uchun nom o'ylab bering:" :
    "Придумайте название для вашей семьи:";
  sendText(chat_id, message, "Markdown"); 
}
function handleJoinFamily(chat_id) { 
  const lang = getUserLang(chat_id);
  const family = getFamilyInfo(chat_id); 
  if (family) { 
    const message = lang === 'uz' ? 
      `Siz allaqachon "${family.name}" oilasida siz.` :
      `Вы уже состоите в семье "${family.name}".`;
    return sendText(chat_id, message); 
  } 
  PropertiesService.getUserProperties().setProperty(chat_id + "_state", "awaiting_invite_code"); 
  const message = lang === 'uz' ? 
    "Taklif kodini kiriting:" :
    "Введите код-приглашение:";
  sendText(chat_id, message); 
}
function handleViewMyFamily(chat_id) { 
  const lang = getUserLang(chat_id);
  const family = getFamilyInfo(chat_id); 
  if (!family) { 
    const message = lang === 'uz' ? 
      "Siz hali oilada emassiz." :
      "Вы пока не состоите в семье.";
    return sendText(chat_id, message, null, buildFamilyKeyboard(lang)); 
  } 
  
  let message;
  if (lang === 'uz') {
    message = `*Sizning oilangiz: ${family.name}*\n\n`;
    message += `Taklif kodi:\n\`${family.inviteCode}\`\n\n`;
    message += `A'zolar:\n`;
  } else {
    message = `*Ваша семья: ${family.name}*\n\n`;
    message += `Код для приглашения:\n\`${family.inviteCode}\`\n\n`;
    message += `Участники:\n`;
  }
  
  family.members.forEach(member => { 
    message += `- ${member.name}\n`; 
  }); 
  sendText(chat_id, message, "Markdown"); 
}
function handleLeaveFamily(chat_id) { 
  const lang = getUserLang(chat_id);
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(familiesSheet); 
  if (!sheet || sheet.getLastRow() < 2) {
    const message = lang === 'uz' ? 
      "❌ Siz oilada emassiz." :
      "❌ Вы не состоите в семье.";
    return sendText(chat_id, message);
  } 
  
  const data = sheet.getDataRange().getValues(); 
  let userRow = -1;
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][2]) == chat_id) {
      userRow = i + 1;
      break;
    }
  }
  
  if (userRow === -1) {
    const message = lang === 'uz' ? 
      "❌ Siz oilada emassiz." :
      "❌ Вы не состоите в семье.";
    return sendText(chat_id, message);
  }
  
  sheet.deleteRow(userRow);
  const message = lang === 'uz' ? 
    "✅ Siz muvaffaqiyatli oiladan chiqdingiz." :
    "✅ Вы успешно покинули семью.";
  sendText(chat_id, message);
  sendMainMenu(chat_id);
}

function handleDeleteLastTransaction(chat_id) {
  const userProps = PropertiesService.getUserProperties();
  const lastTransactionJson = userProps.getProperty(chat_id + "_last_transaction");
  
  if (!lastTransactionJson) {
    return sendText(chat_id, "❌ Нет информации о последней транзакции для удаления.");
  }
  
  try {
    const transactionInfo = JSON.parse(lastTransactionJson);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(transactionInfo.sheetName);
    
    if (!sheet) {
      return sendText(chat_id, "❌ Ошибка: лист не найден.");
    }
    
    // Проверяем, что строка принадлежит этому пользователю (теперь 7 колонок)
    const rowData = sheet.getRange(transactionInfo.rowNumber, 1, 1, 7).getValues()[0];
    if (String(rowData[4]) !== chat_id) {
      return sendText(chat_id, "❌ Ошибка: транзакция не принадлежит вам.");
    }
    
    // Удаляем строку
    sheet.deleteRow(transactionInfo.rowNumber);
    
    // Удаляем информацию о транзакции
    userProps.deleteProperty(chat_id + "_last_transaction");
    
    const typeText = transactionInfo.type === 'Доход' ? 'доход' : 'расход';
    const catLabel = getCategoryLabel(transactionInfo.category, getUserLang(chat_id));
    const displayText = transactionInfo.currency === 'UZS' ? 
      `✅ ${typeText} на ${formatMoney(transactionInfo.amount)} сум в категории "${catLabel}" успешно удален.` :
      `✅ ${typeText} на ${formatMultiCurrency(transactionInfo.amount, transactionInfo.currency, transactionInfo.amountInUZS)} в категории "${catLabel}" успешно удален.`;
    
    sendText(chat_id, displayText);
    
  } catch (error) {
    Logger.log("Ошибка при удалении транзакции: " + error.toString());
    sendText(chat_id, "❌ Произошла ошибка при удалении транзакции.");
  } 
}

// =============================================
//           SHEET HELPERS
// =============================================
function formatMoney(num) {
  return Number(num).toLocaleString('ru-RU');
}

// =============================================
//         CATEGORY DICTIONARY HELPERS
// =============================================
let CATEGORY_CACHE = null; // кешируем до перезапуска

function loadCategoryDict() {
  if (CATEGORY_CACHE) return CATEGORY_CACHE;

  const ss = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(settingSheet);
  if (!ss) {
    CATEGORY_CACHE = { byId: {}, ruToId: {}, uzToId: {} };
    return CATEGORY_CACHE;
  }

  const lastRow = ss.getLastRow();
  if (lastRow < 2) {
    CATEGORY_CACHE = { byId: {}, ruToId: {}, uzToId: {} };
    return CATEGORY_CACHE;
  }

  const data = ss.getRange(2, 1, lastRow - 1, 6).getValues(); // Теперь читаем 6 столбцов
  const byId = {}, ruToId = {}, uzToId = {};

  data.forEach(row => {
    // Обрабатываем расходы (столбцы A, B, C)
    const expenseId = String(row[0]).trim();
    if (expenseId) {
      const ruExp = row[1] ? String(row[1]).trim() : '';
      const uzExp = row[2] ? String(row[2]).trim() : '';
      
      if (ruExp) {
        byId[expenseId] = { ru: ruExp, uz: uzExp || ruExp, type: 'расход' };
        ruToId[ruExp] = expenseId;
        if (uzExp) uzToId[uzExp] = expenseId;
        Logger.log(`Loaded expense: ID=${expenseId}, RU=${ruExp}, UZ=${uzExp}`);
      }
    }

    // Обрабатываем доходы (столбцы D, E, F)
    const incomeId = String(row[3]).trim();
    if (incomeId) {
      const ruInc = row[4] ? String(row[4]).trim() : '';
      const uzInc = row[5] ? String(row[5]).trim() : '';
      
      if (ruInc) {
        byId[incomeId] = { ru: ruInc, uz: uzInc || ruInc, type: 'доход' };
        ruToId[ruInc] = incomeId;
        if (uzInc) uzToId[uzInc] = incomeId;
        Logger.log(`Loaded income: ID=${incomeId}, RU=${ruInc}, UZ=${uzInc}`);
      }
    }
  });

  CATEGORY_CACHE = { byId, ruToId, uzToId };
  return CATEGORY_CACHE;
}

// Функция translateIncomeUz больше не нужна, так как у нас есть прямые переводы в столбце F
// function translateIncomeUz(ru) {
//   const map = { 'Продажа': 'Sotuv', 'Возврат': 'Qaytarish', 'Кешбек': 'Keshbek', 'Другое': 'Boshqa', 'Зарплата': 'Maosh' };
//   return map[ru] || ru;
// }

function getCategoryLabel(id, lang) {
  const dict = loadCategoryDict().byId;
  return dict[id] ? (lang === 'uz' ? dict[id].uz : dict[id].ru) : id;
}
function getCategories(type, lang = 'ru') {
  const { byId } = loadCategoryDict();
  const arr = Object.entries(byId)
    .filter(([, v]) => v.type === type)
    .map(([id, v]) => ({ id, label: lang === 'uz' ? v.uz : v.ru }));
  return arr.sort((a, b) => a.label.localeCompare(b.label, lang === 'uz' ? 'uz' : 'ru'));
}


function clearUserData(chat_id) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetsInfo = [
    { name: sheetExpense, idCol: 5 },
    { name: sheetIncome, idCol: 5 },
    { name: debtsSheet, idCol: 2 },
    { name: goalsSheet, idCol: 2 }
  ];
  sheetsInfo.forEach(info => {
    const sh = ss.getSheetByName(info.name);
    if (!sh || sh.getLastRow() < 2) return;
    const data = sh.getRange(2, info.idCol, sh.getLastRow()-1, 1).getValues();
    // удаляем снизу вверх
    for (let i = data.length-1; i>=0; i--) {
      if (String(data[i][0]) === String(chat_id)) {
        sh.deleteRow(i+2);
      }
    }
  });
  // очищаем пользовательские пропсы (кроме настроек языка/курсов)
  const userProps = PropertiesService.getUserProperties();
  const keys = userProps.getKeys();
  keys.forEach(k => {
    if (k.startsWith(chat_id + "_")) {
      if (k.endsWith("_lang") || k.endsWith("_usd_rate") || k.endsWith("_eur_rate") || k.endsWith("_rub_rate")) return;
      userProps.deleteProperty(k);
    }
  });
}

function findNextEmptyRowInColumn(sheet, columnNumber) { 
  if (!sheet) return -1; 
  const values = sheet.getRange(1, columnNumber, sheet.getMaxRows(), 1).getValues(); 
  for (let i = 1; i < values.length; i++) { 
    if (values[i][0] === '') return i + 1; 
  } 
  return values.length + 1; 
}
function getUserGoals(chat_id) { 
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(goalsSheet); 
  if (!sheet || sheet.getLastRow() < 2) return []; 
  const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 6).getValues(); 
  return data.filter(row => String(row[1]) == chat_id).map(row => ({ 
    id: row[0], 
    название: row[2], 
    целевая_сумма: row[3], 
    накоплено: row[4], 
    дедлайн: row[5] instanceof Date ? row[5].toLocaleDateString('ru-RU') : row[5] 
  })); 
}
function addDepositToGoal(goalId, amount) { 
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(goalsSheet); 
  if (!sheet || sheet.getLastRow() < 2) return; 
  const data = sheet.getRange(1, 1, sheet.getLastRow(), 6).getValues(); 
  for (let i = 1; i < data.length; i++) { 
    if (data[i][0] == goalId) { 
      const currentAmount = data[i][4] || 0; 
      const cellToUpdate = sheet.getRange(i + 1, 5); 
      cellToUpdate.setValue(currentAmount + amount); 
      return; 
    } 
  } 
}
function setBudgetForCategory(chat_id, category, limit) { 
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(budgetsSheet); 
  const data = sheet.getDataRange().getValues(); 
  let found = false; 
  for (let i = 1; i < data.length; i++) { 
    if (String(data[i][0]) == chat_id && data[i][1] == category) { 
      if (limit > 0) { 
        sheet.getRange(i + 1, 3).setValue(limit); 
      } else { 
        sheet.deleteRow(i + 1); 
      } 
      found = true; 
      break; 
    } 
  } 
  if (!found && limit > 0) { 
    sheet.appendRow([chat_id, category, limit]); 
  } 
}
function getBudget(chat_id) { 
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(budgetsSheet); 
  if (!sheet || sheet.getLastRow() < 2) return {}; 
  const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 3).getValues(); 
  const budget = {}; 
  data.forEach(row => { 
    if (String(row[0]) == chat_id) { 
      budget[row[1]] = row[2]; 
    } 
  }); 
  return budget; 
}
function getExpensesForCurrentMonth(userIds) { 
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetExpense); 
  if (!sheet || sheet.getLastRow() < 2) return {}; 
  const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 7).getValues(); // Теперь 7 колонок
  const expenses = {}; 
  const now = new Date(); 
  data.forEach(row => { 
    if (userIds.includes(String(row[4]))) { 
      const expenseDate = new Date(row[0]); 
      if (expenseDate.getMonth() === now.getMonth() && expenseDate.getFullYear() === now.getFullYear()) { 
        const categoryId = row[1]; 
        // Используем сумму в UZS для отчетности
        const amount = parseFloat(row[6]) || parseFloat(row[2]) || 0; // row[6] = Сумма_UZS, row[2] = Сумма
        expenses[categoryId] = (expenses[categoryId] || 0) + amount; 
      } 
    } 
  }); 
  return expenses; 
}
function getAverageExpenses(chat_id, months) { 
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetExpense); 
  if (!sheet || sheet.getLastRow() < 2) return {}; 
  const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 7).getValues(); 
  const expensesByMonth = {}; 
  const dateLimit = new Date(); 
  dateLimit.setMonth(dateLimit.getMonth() - months); 
  data.forEach(row => { 
    if(String(row[4]) == chat_id) { 
      const expenseDate = new Date(row[0]); 
      if (expenseDate >= dateLimit) { 
        const monthYear = `${expenseDate.getFullYear()}-${expenseDate.getMonth()}`; 
        const categoryId = row[1]; 
        // Используем сумму в UZS для отчетности (как в getExpensesForCurrentMonth)
        const amount = parseFloat(row[6]) || parseFloat(row[2]) || 0; // row[6] = Сумма_UZS, row[2] = Сумма
        if (!expensesByMonth[monthYear]) { 
          expensesByMonth[monthYear] = {}; 
        } 
        expensesByMonth[monthYear][categoryId] = (expensesByMonth[monthYear][categoryId] || 0) + amount; 
      } 
    } 
  }); 
  const numMonths = Object.keys(expensesByMonth).length; 
  if (numMonths === 0) return {}; 
  const totalExpenses = {}; 
  for (const month in expensesByMonth) { 
    for (const categoryId in expensesByMonth[month]) { 
      totalExpenses[categoryId] = (totalExpenses[categoryId] || 0) + expensesByMonth[month][categoryId]; 
    } 
  } 
  const averageExpenses = {}; 
  for (const categoryId in totalExpenses) { 
    averageExpenses[categoryId] = Math.round(totalExpenses[categoryId] / numMonths); 
  } 
  return averageExpenses; 
}
function getIncomeForCurrentMonth(userIds) { 
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetIncome); 
  if (!sheet || sheet.getLastRow() < 2) return 0; 
  const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 7).getValues(); // Теперь 7 колонок
  let totalIncome = 0; 
  const now = new Date(); 
  data.forEach(row => { 
    if (userIds.includes(String(row[4]))) { 
      const incomeDate = new Date(row[0]); 
      if (incomeDate.getMonth() === now.getMonth() && incomeDate.getFullYear() === now.getFullYear()) { 
        // Используем сумму в UZS для отчетности
        const amount = parseFloat(row[6]) || parseFloat(row[2]) || 0; // row[6] = Сумма_UZS, row[2] = Сумма
        totalIncome += amount; 
      } 
    } 
  }); 
  return totalIncome; 
}
function createFamily(chat_id, userName, familyName) { 
  const lang = getUserLang(chat_id);
  PropertiesService.getUserProperties().deleteProperty(chat_id + "_state"); 
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(familiesSheet); 
  const familyId = "FAM-" + new Date().getTime(); 
  const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase(); 
  sheet.appendRow([familyId, inviteCode, chat_id, userName, familyName]); 
  const message = lang === 'uz' ? 
    `✅ "${familyName}" oilasi muvaffaqiyatli yaratildi!` :
    `✅ Семья "${familyName}" успешно создана!`;
  sendText(chat_id, message); 
  handleViewMyFamily(chat_id); 
}
function joinFamily(chat_id, userName, inviteCode) { 
  const lang = getUserLang(chat_id);
  PropertiesService.getUserProperties().deleteProperty(chat_id + "_state"); 
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(familiesSheet); 
  const data = sheet.getDataRange().getValues(); 
  let familyFound = null; 
  let familyName = ''; 
  for (let i = 1; i < data.length; i++) { 
    if (data[i][1] == inviteCode.trim().toUpperCase()) { 
      familyFound = { id: data[i][0] }; 
      familyName = data[i][4]; 
      break; 
    } 
  } 
  if (familyFound) { 
    sheet.appendRow([familyFound.id, inviteCode.trim().toUpperCase(), chat_id, userName, familyName]); 
    const successMessage = lang === 'uz' ? 
      `🎉 Tabriklaymiz! Siz "${familyName}" oilasiga qo'shildingiz.` :
      `🎉 Поздравляем! Вы присоединились к семье "${familyName}".`;
    sendText(chat_id, successMessage); 
    handleViewMyFamily(chat_id); 
  } else { 
    const errorMessage = lang === 'uz' ? 
      "❌ Bunday taklif kodi bilan oila topilmadi." :
      "❌ Семья с таким кодом-приглашением не найдена.";
    sendText(chat_id, errorMessage); 
  } 
}
function getFamilyInfo(chat_id) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(familiesSheet);
  if (!sheet || sheet.getLastRow() < 2) return null;
  const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 7).getValues();
  let userFamilyId = null;
  for (const row of data) { 
    if (String(row[2]) == chat_id) { 
      userFamilyId = row[0]; 
      break; 
    } 
  }
  if (!userFamilyId) return null;
  const familyMembers = data.filter(row => row[0] == userFamilyId);
  const familyName = familyMembers[0][4] || "Семья " + familyMembers[0][3];
  return { 
    id: userFamilyId, 
    name: familyName, 
    inviteCode: familyMembers[0][1], 
    members: familyMembers.map(row => ({ id: String(row[2]), name: row[3] })) 
  };
}
function getAllUserIds() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const incomeSheet = ss.getSheetByName(sheetIncome);
  const expenseSheet = ss.getSheetByName(sheetExpense);
  const userIds = new Set();
  
  if (incomeSheet && incomeSheet.getLastRow() > 1) {
    const incomeData = incomeSheet.getRange(2, 5, incomeSheet.getLastRow() - 1, 1).getValues();
    incomeData.forEach(row => userIds.add(String(row[0])));
  }
  
  if (expenseSheet && expenseSheet.getLastRow() > 1) {
    const expenseData = expenseSheet.getRange(2, 5, expenseSheet.getLastRow() - 1, 1).getValues();
    expenseData.forEach(row => userIds.add(String(row[0])));
  }
  
  return Array.from(userIds);
}
function generateBalanceReport(chat_id, userIds, scopeText) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const incomeSheet = ss.getSheetByName(sheetIncome); 
  const expenseSheet = ss.getSheetByName(sheetExpense);
  const allIncomes = incomeSheet.getLastRow() > 1 ? incomeSheet.getRange(2, 1, incomeSheet.getLastRow() - 1, 7).getValues() : [];
  const allExpenses = expenseSheet.getLastRow() > 1 ? expenseSheet.getRange(2, 1, expenseSheet.getLastRow() - 1, 7).getValues() : [];
  
  // Используем суммы в UZS для расчетов
  const incomeTotal = allIncomes.filter(row => userIds.includes(String(row[4]))).reduce((sum, row) => {
    const amount = parseFloat(row[6]) || parseFloat(row[2]) || 0; // row[6] = Сумма_UZS, row[2] = Сумма
    return sum + amount;
  }, 0);
  
  const expenseTotal = allExpenses.filter(row => userIds.includes(String(row[4]))).reduce((sum, row) => {
    const amount = parseFloat(row[6]) || parseFloat(row[2]) || 0; // row[6] = Сумма_UZS, row[2] = Сумма
    return sum + amount;
  }, 0);
  
  // Получаем данные о долгах
  const { totalDebt, totalCredit } = getDebtsAndCredits(userIds);
  
  // Расчеты по вашему формату
  const onHand = incomeTotal + totalDebt - expenseTotal; // На руках = Доходы + Долги - Расходы
  const minusDebt = -totalDebt; // Минус долг (отрицательное значение)
  const finalBalance = onHand + minusDebt; // Итоговый баланс = На руках + Минус долг
  
  let report = `📊 *Личный баланс:*\n\n`;
  report += `💰 Доходы: ${formatMoney(incomeTotal)}\n`;
  report += `💳 Взял в долг: ${formatMoney(totalDebt)}\n`;
  report += `🛒 Расходы: ${formatMoney(expenseTotal)}\n\n`;
  report += `📦 На руках: ${formatMoney(onHand)}\n`;
  report += `📉 Минус долг: ${formatMoney(minusDebt)}\n\n`;
  report += `✅ Итоговый баланс: ${formatMoney(finalBalance)}`;
  
  // Добавляем кнопку для открытия мини-приложения
  const keyboard = {
    inline_keyboard: [
      [{ text: "📊 Открыть детальный отчёт", web_app: { url: `https://ваш-домен.com/index.html?chat_id=${chat_id}` } }]
    ]
  };
  
  sendText(chat_id, report, "Markdown", keyboard);
}

function handleCheckOverdue(chat_id) {
  const overdueDebts = getOverdueDebts(chat_id);
  
  if (overdueDebts.length === 0) {
    return sendText(chat_id, "✅ У вас нет просроченных долгов!");
  }
  
  let message = "🚨 *ПРОСРОЧЕННЫЕ ДОЛГИ:*\n\n";
  
  overdueDebts.forEach((debt, index) => {
    const typeIcon = debt.type === 'Дебет' ? '💸' : '💚';
    const typeText = debt.type === 'Дебет' ? 'Вы должны' : 'Вам должны';
    message += `${index + 1}. ${typeIcon} *${debt.counterparty}*\n`;
    message += `💰 ${formatMultiCurrency(debt.amount, debt.currency, debt.amountInUZS)}\n`;
    message += `📝 ${debt.description}\n`;
    message += `📅 Просрочено на *${debt.daysOverdue} дн.*\n\n`;
  });
  
  message += "💡 *Рекомендации:*\n";
  message += "• Свяжитесь с должниками/кредиторами\n";
  message += "• Используйте '📅 Продлить срок' для изменения дедлайна\n";
  message += "• Погасите просроченные долги как можно скорее";
  
  sendText(chat_id, message, "Markdown");
}

function handleExtendDebt(chat_id) {
  const activeDebts = getActiveDebtsForUser(chat_id);
  
  if (activeDebts.length === 0) {
    return sendText(chat_id, "У вас нет активных долгов для изменения срока.");
  }
  
  let message = "📅 *Выберите долг для изменения срока:*\n\n";
  const keyboard = { inline_keyboard: [] };
  
  activeDebts.forEach((debt, index) => {
    const typeIcon = debt.type === 'Дебет' ? '💸' : '💚';
    const dueDate = new Date(debt.dueDate);
    const formattedDate = `${String(dueDate.getDate()).padStart(2, '0')}.${String(dueDate.getMonth() + 1).padStart(2, '0')}.${dueDate.getFullYear()}`;
    
    message += `${index + 1}. ${typeIcon} ${debt.counterparty}\n`;
    message += `💰 ${formatMultiCurrency(debt.amount, debt.currency, debt.amountInUZS)}\n`;
    message += `📅 До ${formattedDate}\n\n`;
    
    keyboard.inline_keyboard.push([{
      text: `${index + 1}. ${debt.counterparty} (${formattedDate})`,
      callback_data: `extend_debt|${debt.rowIndex}`
    }]);
  });
  
  keyboard.inline_keyboard.push([{ text: "⬅️ Назад", callback_data: "back_to_debts" }]);
  
  sendText(chat_id, message, "Markdown", keyboard);
}

function extendDebtDueDate(chat_id, debtRowIndex, newDueDate) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(debtsSheet);
  
  if (!sheet || debtRowIndex < 2 || debtRowIndex > sheet.getLastRow()) {
    return { success: false, error: "Долг не найден." };
  }
  
  try {
    // Получаем информацию о долге
    const debtData = sheet.getRange(debtRowIndex, 1, 1, 12).getValues()[0];
    const [date, chatId, type, counterparty, amount, currency, amountInUZS, description, returnDate, status] = debtData;
    
    // Проверяем, что это долг пользователя
    if (String(chatId) !== String(chat_id) || status !== 'Активен') {
      return { success: false, error: "Этот долг нельзя изменить." };
    }
    
    // Обновляем дату возврата
    sheet.getRange(debtRowIndex, 9).setValue(newDueDate); // Дата_возврата
    
    const formattedDate = `${String(newDueDate.getDate()).padStart(2, '0')}.${String(newDueDate.getMonth() + 1).padStart(2, '0')}.${newDueDate.getFullYear()}`;
    
    return {
      success: true,
      counterparty: counterparty,
      newDate: formattedDate,
      type: type
    };
    
  } catch (error) {
    Logger.log(`Ошибка при изменении срока долга: ${error.toString()}`);
    return { success: false, error: "Произошла ошибка при изменении срока." };
  }
}

function handleExtendDebtProcess(chat_id, debtRowIndex) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(debtsSheet);
  
  if (!sheet || debtRowIndex < 2 || debtRowIndex > sheet.getLastRow()) {
    return sendText(chat_id, "❌ Долг не найден.");
  }
  
  // Получаем информацию о долге
  const debtData = sheet.getRange(debtRowIndex, 1, 1, 12).getValues()[0];
  const [date, chatId, type, counterparty, amount, currency, amountInUZS, description, returnDate, status] = debtData;
  
  // Проверяем, что это долг пользователя и он активен
  if (String(chatId) !== String(chat_id) || status !== 'Активен') {
    return sendText(chat_id, "❌ Этот долг нельзя изменить.");
  }
  
  const currentDueDate = new Date(returnDate);
  const formattedCurrentDate = `${String(currentDueDate.getDate()).padStart(2, '0')}.${String(currentDueDate.getMonth() + 1).padStart(2, '0')}.${currentDueDate.getFullYear()}`;
  
  // Сохраняем информацию о долге для изменения срока
  const userProps = PropertiesService.getUserProperties();
  userProps.setProperty(chat_id + "_state", `awaiting_new_due_date|${debtRowIndex}`);
  
  const typeIcon = type === 'Дебет' ? '💸' : '💚';
  const typeText = type === 'Дебет' ? 'должны' : 'должен';
  
  const debtInfo = `📅 *Изменение срока долга:*\n\n` +
    `${typeIcon} ${counterparty} ${typeText} ${formatMultiCurrency(amount, currency, amountInUZS)}\n` +
    `📝 ${description}\n` +
    `📅 Текущий срок: ${formattedCurrentDate}\n\n` +
    `Введите новую дату в формате ДД.ММ.ГГГГ:\n` +
    `Примеры: \`15.02.2024\`, \`01.03.2024\``;
  
  sendText(chat_id, debtInfo, "Markdown");
}

// =============================================
//             AUTOMATED DEBT REMINDERS
// =============================================
function sendDailyDebtReminders() {
  Logger.log("--- Запуск ежедневных напоминаний о долгах ---");
  
  // Получаем всех пользователей с активными долгами
  const allUserIds = getAllUserIds();
  Logger.log(`Проверяю напоминания для ${allUserIds.length} пользователей`);
  
  allUserIds.forEach(userId => {
    try {
      Logger.log(`Проверяю напоминания для пользователя: ${userId}`);
      
      const notifications = checkDebtNotifications(userId);
      
      if (notifications.length > 0) {
        // Отправляем не больше одного уведомления в день
        const userProps = PropertiesService.getScriptProperties();
        const lastNotificationKey = `last_debt_notification_${userId}`;
        const lastNotification = userProps.getProperty(lastNotificationKey);
        const today = new Date().toDateString();
        
        if (lastNotification !== today) {
          Logger.log(`Отправляю напоминания пользователю ${userId}`);
          
          notifications.forEach(notification => {
            sendText(userId, notification, "Markdown");
          });
          
          // Сохраняем дату последнего уведомления
          userProps.setProperty(lastNotificationKey, today);
          Logger.log(`Напоминания отправлены пользователю: ${userId}`);
        } else {
          Logger.log(`Уведомления уже отправлены сегодня пользователю: ${userId}`);
        }
      } else {
        Logger.log(`Нет напоминаний для пользователя: ${userId}`);
      }
      
    } catch (error) {
      Logger.log(`Ошибка при обработке напоминаний для ${userId}: ${error.toString()}`);
    }
  });
  
  Logger.log("--- Ежедневные напоминания о долгах завершены ---");
}

function createDebtRemindersSchedule() {
  // Создаем триггер для ежедневных напоминаний в 9:00
  ScriptApp.newTrigger('sendDailyDebtReminders')
    .timeBased()
    .everyDays(1)
    .atHour(9)
    .create();
    
  Logger.log("Создан триггер для ежедневных напоминаний о долгах в 9:00");
}
function generateDetailedReport(chat_id, userIds, scopeText) {
  const expenses = getExpensesForCurrentMonth(userIds);

  if (Object.keys(expenses).length === 0) {
    return sendText(chat_id, `📊 *Детализированный отчёт ${scopeText}:*\n\nНет данных о расходах в этом месяце.`, "Markdown");
  }

  const sortedExpenses = Object.entries(expenses).sort(([,a],[,b]) => b-a);
  const sortedData = Object.fromEntries(sortedExpenses);

  let caption = `📊 *Структура расходов ${scopeText} за текущий месяц:*\n\n`;
  let totalExpenses = 0;
  sortedExpenses.forEach(([, amount]) => {
    totalExpenses += amount;
  });

  sortedExpenses.forEach(([categoryId, amount]) => {
    const percentage = ((amount / totalExpenses) * 100).toFixed(1);
    const catLabel = getCategoryLabel(categoryId, getUserLang(chat_id));
    caption += `- *${catLabel}*: ${formatMoney(amount)} сум (${percentage}%)\n`;
  });
  caption += `\n*Итого расходов:* ${formatMoney(totalExpenses)} сум`;

  const chartUrl = generateChartUrl(sortedData, chat_id);
  sendPhoto(chat_id, chartUrl, caption);
}

function generateDetailedReportForPeriod(chat_id, userIds, scopeText, startDate, endDate, periodText) {
  const expenses = getExpensesForPeriod(userIds, startDate, endDate);

  if (Object.keys(expenses).length === 0) {
    return sendText(chat_id, `📊 *Детализированный отчёт ${scopeText}:*\n\nНет данных о расходах ${periodText}.`, "Markdown");
  }

  const sortedExpenses = Object.entries(expenses).sort(([,a],[,b]) => b-a);
  const sortedData = Object.fromEntries(sortedExpenses);

  let caption = `📊 *Структура расходов ${scopeText} ${periodText}:*\n\n`;
  let totalExpenses = 0;
  sortedExpenses.forEach(([, amount]) => {
    totalExpenses += amount;
  });

  sortedExpenses.forEach(([categoryId, amount]) => {
    const percentage = ((amount / totalExpenses) * 100).toFixed(1);
    const catLabel = getCategoryLabel(categoryId, getUserLang(chat_id));
    caption += `- *${catLabel}*: ${formatMoney(amount)} сум (${percentage}%)\n`;
  });
  caption += `\n*Итого расходов:* ${formatMoney(totalExpenses)} сум`;

  const chartUrl = generateChartUrl(sortedData, chat_id);
  sendPhoto(chat_id, chartUrl, caption);
}

function getExpensesForPeriod(userIds, startDate, endDate) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetExpense);
  if (!sheet || sheet.getLastRow() < 2) return {};
  
  Logger.log(`getExpensesForPeriod: период с ${startDate} до ${endDate}`);
  
  const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 7).getValues(); // 7 колонок для валют
  const expenses = {};
  let includedCount = 0;
  
  data.forEach(row => {
    if (userIds.includes(String(row[4]))) {
      const expenseDate = new Date(row[0]);
      
      // Проверяем, что дата попадает в заданный период
      if (expenseDate >= startDate && expenseDate <= endDate) {
        const categoryId = row[1];
        // Используем сумму в UZS для отчетности
        const amount = parseFloat(row[6]) || parseFloat(row[2]) || 0; // row[6] = Сумма_UZS, row[2] = Сумма
        expenses[categoryId] = (expenses[categoryId] || 0) + amount;
        includedCount++;
        
        Logger.log(`Включён расход: дата=${expenseDate}, категория=${categoryId}, сумма=${amount}`);
      } else {
        Logger.log(`Исключён расход: дата=${expenseDate} не попадает в период ${startDate} - ${endDate}`);
      }
    }
  });
  
  Logger.log(`getExpensesForPeriod: найдено ${includedCount} расходов в периоде`);
  return expenses;
}

function generateForecast(chat_id, userIds, scopeText) {
  sendText(chat_id, `🔮 Рассчитываю прогноз ${scopeText}...`);
  const today = new Date();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const dayOfMonth = today.getDate();
  if (dayOfMonth >= daysInMonth - 1) { 
    return sendText(chat_id, "🔮 Прогноз не имеет смысла, так как месяц почти закончился."); 
  }
  const daysPassed = dayOfMonth; 
  const daysRemaining = daysInMonth - dayOfMonth;
  const incomeThisMonth = getIncomeForCurrentMonth(userIds);
  const expensesThisMonthObj = getExpensesForCurrentMonth(userIds);
  const expensesThisMonthTotal = Object.values(expensesThisMonthObj).reduce((a, b) => a + b, 0);
  const currentBalanceForMonth = incomeThisMonth - expensesThisMonthTotal;
  const averageDailySpend = daysPassed > 0 ? expensesThisMonthTotal / daysPassed : 0;
  const projectedFutureSpend = averageDailySpend * daysRemaining;
  const projectedFinalBalance = currentBalanceForMonth - projectedFutureSpend;
  const prompt = `Ты — финансовый аналитик-прогнозист. На основе расчетов, сделай краткий и понятный прогноз. - Текущий баланс за месяц: ${formatMoney(currentBalanceForMonth)} сум. - Средний расход в день: ${formatMoney(averageDailySpend)} сум. - Прогнозируемые расходы до конца месяца: ${formatMoney(projectedFutureSpend)} сум. - Прогнозируемый остаток на конец месяца: ${formatMoney(projectedFinalBalance)} сум. Сформируй ответ. Если прогнозируется дефицит, дай строгий совет. Если все хорошо, похвали. ВАЖНО: Ответ должен быть очень кратким (2-3 предложения).`;
  const forecast = callGeminiApi(prompt);
  sendText(chat_id, forecast, "Markdown");
}
function generateChartUrl(data, chat_id = null) {
  const MAX_CATEGORIES_TO_SHOW = 7;
  
  if (!data || Object.keys(data).length === 0) {
    return generateEmptyChartUrl();
  }
  
  const sortedEntries = Object.entries(data).sort(([,a], [,b]) => b - a);
  let originalLabels = sortedEntries.map(([categoryId]) => {
    // Конвертируем ID в названия, если передан chat_id
    if (chat_id) {
      return getCategoryLabel(categoryId, getUserLang(chat_id));
    }
    return categoryId;
  });
  let originalValues = sortedEntries.map(([,value]) => value);
  
  let chartLabels = originalLabels;
  let chartValues = originalValues;

  if (originalLabels.length > MAX_CATEGORIES_TO_SHOW) {
    const topLabels = originalLabels.slice(0, MAX_CATEGORIES_TO_SHOW - 1);
    const topValues = originalValues.slice(0, MAX_CATEGORIES_TO_SHOW - 1);
    const otherValues = originalValues.slice(MAX_CATEGORIES_TO_SHOW - 1);
    const otherSum = otherValues.reduce((sum, current) => sum + current, 0);
    
    chartLabels = [...topLabels, 'Прочее'];
    chartValues = [...topValues, otherSum];
  }
  
  const totalSum = chartValues.reduce((sum, val) => sum + val, 0);
  
  if (totalSum === 0) {
    return generateEmptyChartUrl();
  }

  const chartConfig = {
    type: 'outlabeledPie',
    data: {
      labels: chartLabels,
      datasets: [{
        backgroundColor: [
          '#FF9B27', '#FF682B', '#CB275A', '#47338C',
          '#2764B4', '#02B1C4', '#3BBAED', '#A8E6CF'
        ],
        data: chartValues,
        borderWidth: 2,
        borderColor: '#ffffff'
      }]
    },
    options: {
      plugins: {
        legend: false,
        outlabels: {
          text: '%l\n%p',
          color: '#fcfafa',
          stretch: 45,
          font: {
            resizable: true,
            minSize: 18,
            maxSize: 24,
            weight: 'bold'
          },
          lineColor: '#666666',
          lineWidth: 1
        }
      },
      layout: {
        padding: {
          top: 40,
          bottom: 40,
          left: 40,
          right: 40
        }
      }
    }
  };

  try {
    const finalUrl = "https://quickchart.io/chart?bkg=white&w=1400&h=800&c=" +
                      encodeURIComponent(JSON.stringify(chartConfig));
    
    return finalUrl;
    
  } catch (error) {
    Logger.log("Ошибка генерации outlabeled диаграммы: " + error.toString());
    return generateFallbackChart(chartLabels, chartValues);
  }
}
function generateChartUrlWithAmounts(data) {
  const MAX_CATEGORIES_TO_SHOW = 7;
  
  if (!data || Object.keys(data).length === 0) {
    return generateEmptyChartUrl();
  }
  
  const sortedEntries = Object.entries(data).sort(([,a], [,b]) => b - a);
  let originalLabels = sortedEntries.map(([label]) => label);
  let originalValues = sortedEntries.map(([,value]) => value);
  
  let chartLabels = originalLabels;
  let chartValues = originalValues;

  if (originalLabels.length > MAX_CATEGORIES_TO_SHOW) {
    const topLabels = originalLabels.slice(0, MAX_CATEGORIES_TO_SHOW - 1);
    const topValues = originalValues.slice(0, MAX_CATEGORIES_TO_SHOW - 1);
    const otherValues = originalValues.slice(MAX_CATEGORIES_TO_SHOW - 1);
    const otherSum = otherValues.reduce((sum, current) => sum + current, 0);
    
    chartLabels = [...topLabels, 'Прочее'];
    chartValues = [...topValues, otherSum];
  }
  
  const totalSum = chartValues.reduce((sum, val) => sum + val, 0);
  
  if (totalSum === 0) {
    return generateEmptyChartUrl();
  }

  const chartConfig = {
    type: 'outlabeledPie',
    data: {
      labels: chartLabels,
      datasets: [{
        backgroundColor: [
          '#FF9B27', '#FF682B', '#CB275A', '#47338C',
          '#2764B4', '#02B1C4', '#3BBAED', '#A8E6CF'
        ],
        data: chartValues
      }]
    },
    options: {
      plugins: {
        legend: false,
        outlabels: {
          text: function(context) {
            const value = context.dataset.data[context.dataIndex];
            const percentage = ((value / totalSum) * 100).toFixed(1);
            const formattedValue = formatMoney(value);
            return `${context.label}\n${formattedValue}\n(${percentage}%)`;
          },
          color: '#333333',
          stretch: 30,
          font: {
            resizable: true,
            minSize: 10,
            maxSize: 13
          }
        }
      }
    }
  };
  
  return "https://quickchart.io/chart?bkg=white&w=1400&h=800&c=" +
         encodeURIComponent(JSON.stringify(chartConfig));
}
function generateFallbackChart(labels, values) {
  const totalSum = values.reduce((sum, val) => sum + val, 0);
  
  const config = {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: values,
        backgroundColor: [
          '#FF9B27', '#FF682B', '#CB275A', '#47338C',
          '#2764B4', '#02B1C4', '#3BBAED'
        ]
      }]
    },
    options: {
      plugins: {
        legend: {
          position: 'right'
        },
        datalabels: {
          display: true,
          formatter: function(value) {
            const percentage = ((value / totalSum) * 100).toFixed(0);
            return percentage + '%';
          },
          color: '#fff',
          font: { weight: 'bold' }
        }
      }
    }
  };
  
  return "https://quickchart.io/chart?w=1200&h=600&c=" + encodeURIComponent(JSON.stringify(config));
}
function generateEmptyChartUrl() {
  const emptyConfig = {
    type: 'outlabeledPie',
    data: {
      labels: ['Нет данных'],
      datasets: [{
        data: [1],
        backgroundColor: ['#E0E0E0']
      }]
    },
    options: {
      plugins: {
        legend: false,
        outlabels: {
          text: 'Нет данных\nо расходах',
          color: '#666666'
        }
      }
    }
  };
  
  return "https://quickchart.io/chart?bkg=white&w=1200&h=600&c=" +
         encodeURIComponent(JSON.stringify(emptyConfig));
}

// =============================================
//           DO GET
// =============================================
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

// =============================================
//               CURRENCY API
// =============================================
function updateCurrencyRates() {
  // Функция оставлена для совместимости, но больше не используется
  // Курсы валют теперь устанавливаются вручную через интерфейс бота
  Logger.log("updateCurrencyRates() вызвана, но больше не используется - курсы устанавливаются вручную");
  return false;
}

function handleUpdateRates(chat_id) {
  const lang = getUserLang(chat_id);
  // Инициализируем курсы для пользователя, если их нет
  initializeUserCurrencyRates(chat_id);
  
  const rates = getCurrentUserCurrencyRates(chat_id);
  
  let ratesInfo;
  if (lang === 'uz') {
    ratesInfo = `💱 Sizning shaxsiy valyuta kurslaringiz:\n\n`;
    ratesInfo += `• 1 USD = ${formatMoney(rates.USD.rate)} so'm\n`;
    ratesInfo += `• 1 EUR = ${formatMoney(rates.EUR.rate)} so'm\n`;
    ratesInfo += `• 1 RUB = ${formatMoney(rates.RUB.rate)} so'm\n\n`;
    ratesInfo += `💡 Valyuta kurslari siz uchun shaxsiy sozlangan. Har bir foydalanuvchi o'z kurslarini sozlashi mumkin.`;
    ratesInfo += `\n\nKursni o'zgartirish uchun valyutani tanlang:`;
  } else {
    ratesInfo = `💱 Ваши личные курсы валют:\n\n`;
    ratesInfo += `• 1 USD = ${formatMoney(rates.USD.rate)} сум\n`;
    ratesInfo += `• 1 EUR = ${formatMoney(rates.EUR.rate)} сум\n`;
    ratesInfo += `• 1 RUB = ${formatMoney(rates.RUB.rate)} сум\n\n`;
    ratesInfo += `💡 Курсы валют настроены лично для вас. Каждый пользователь может настроить свои собственные курсы.`;
    ratesInfo += `\n\nВыберите валюту для изменения курса:`;
  }
  
  sendText(chat_id, ratesInfo, null, currencyRatesKeyboard);
}

function handleMigrateData(chat_id) {
  // Только владелец может запускать миграцию
  if (chat_id !== OWNER_ID) {
    return sendText(chat_id, "❌ Эта функция доступна только владельцу бота.");
  }
  
  sendText(chat_id, "🔄 Запускаю миграцию данных к мультивалютной системе...");
  
  try {
    migrateToMultiCurrency();
    sendText(chat_id, "✅ Миграция данных завершена успешно! Теперь система поддерживает мультивалютность.");
  } catch (error) {
    Logger.log("Ошибка при миграции данных: " + error.toString());
    sendText(chat_id, "❌ Произошла ошибка при миграции данных: " + error.toString());
  }
  
  sendSettingsMenu(chat_id);
}

// =============================================
//               DATA MIGRATION
// =============================================
function migrateToMultiCurrency() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Мигрируем таблицу расходов
  const expenseSheet = ss.getSheetByName(sheetExpense);
  if (expenseSheet) {
    // Добавляем заголовки для новых колонок
    expenseSheet.getRange(1, 6).setValue("Валюта");
    expenseSheet.getRange(1, 7).setValue("Сумма_UZS");
    
    // Заполняем существующие строки
    const lastRow = expenseSheet.getLastRow();
    if (lastRow > 1) {
      for (let i = 2; i <= lastRow; i++) {
        const amount = expenseSheet.getRange(i, 3).getValue();
        expenseSheet.getRange(i, 6).setValue("UZS"); // По умолчанию UZS
        expenseSheet.getRange(i, 7).setValue(amount); // Сумма в UZS = оригинальная сумма
      }
    }
  }
  
  // Мигрируем таблицу доходов
  const incomeSheet = ss.getSheetByName(sheetIncome);
  if (incomeSheet) {
    // Добавляем заголовки для новых колонок
    incomeSheet.getRange(1, 6).setValue("Валюта");
    incomeSheet.getRange(1, 7).setValue("Сумма_UZS");
    
    // Заполняем существующие строки
    const lastRow = incomeSheet.getLastRow();
    if (lastRow > 1) {
      for (let i = 2; i <= lastRow; i++) {
        const amount = incomeSheet.getRange(i, 3).getValue();
        incomeSheet.getRange(i, 6).setValue("UZS"); // По умолчанию UZS
        incomeSheet.getRange(i, 7).setValue(amount); // Сумма в UZS = оригинальная сумма
      }
    }
  }
  
  Logger.log("Миграция к мультивалютной системе завершена");
}

// =============================================
//               MANUAL CURRENCY RATE HANDLERS
// =============================================
function handleSetUsdRate(chat_id) {
  const lang = getUserLang(chat_id);
  Logger.log(`handleSetUsdRate вызвана для chat_id: ${chat_id}`);
  
  // Инициализируем курсы для пользователя, если их нет
  initializeUserCurrencyRates(chat_id);
  
  const userProps = PropertiesService.getUserProperties();
  userProps.setProperty(chat_id + "_state", "awaiting_usd_rate");
  
  const rates = getCurrentUserCurrencyRates(chat_id);
  
  let message;
  if (lang === 'uz') {
    message = `💵 USD kursini kiriting (1 USD uchun qancha so'm):\n\n`;
    message += `Joriy kurs: ${formatMoney(rates.USD.rate)} so'm\n\n`;
    message += `💡 Bu kurs siz uchun shaxsiy saqlanadi.`;
  } else {
    message = `💵 Введите новый курс USD (сколько сум за 1 USD):\n\n`;
    message += `Текущий курс: ${formatMoney(rates.USD.rate)} сум\n\n`;
    message += `💡 Этот курс будет сохранен лично для вас.`;
  }
  
  sendText(chat_id, message);
  Logger.log(`Состояние установлено: awaiting_usd_rate для chat_id: ${chat_id}`);
}

function handleSetEurRate(chat_id) {
  const lang = getUserLang(chat_id);
  Logger.log(`handleSetEurRate вызвана для chat_id: ${chat_id}`);
  
  // Инициализируем курсы для пользователя, если их нет
  initializeUserCurrencyRates(chat_id);
  
  const userProps = PropertiesService.getUserProperties();
  userProps.setProperty(chat_id + "_state", "awaiting_eur_rate");
  
  const rates = getCurrentUserCurrencyRates(chat_id);
  
  let message;
  if (lang === 'uz') {
    message = `💶 EUR kursini kiriting (1 EUR uchun qancha so'm):\n\n`;
    message += `Joriy kurs: ${formatMoney(rates.EUR.rate)} so'm\n\n`;
    message += `💡 Bu kurs siz uchun shaxsiy saqlanadi.`;
  } else {
    message = `💶 Введите новый курс EUR (сколько сум за 1 EUR):\n\n`;
    message += `Текущий курс: ${formatMoney(rates.EUR.rate)} сум\n\n`;
    message += `💡 Этот курс будет сохранен лично для вас.`;
  }
  
  sendText(chat_id, message);
  Logger.log(`Состояние установлено: awaiting_eur_rate для chat_id: ${chat_id}`);
}

function handleSetRubRate(chat_id) {
  const lang = getUserLang(chat_id);
  Logger.log(`handleSetRubRate вызвана для chat_id: ${chat_id}`);
  
  // Инициализируем курсы для пользователя, если их нет
  initializeUserCurrencyRates(chat_id);
  
  const userProps = PropertiesService.getUserProperties();
  userProps.setProperty(chat_id + "_state", "awaiting_rub_rate");
  
  const rates = getCurrentUserCurrencyRates(chat_id);
  
  let message;
  if (lang === 'uz') {
    message = `💷 RUB kursini kiriting (1 RUB uchun qancha so'm):\n\n`;
    message += `Joriy kurs: ${formatMoney(rates.RUB.rate)} so'm\n\n`;
    message += `💡 Bu kurs siz uchun shaxsiy saqlanadi.`;
  } else {
    message = `💷 Введите новый курс RUB (сколько сум за 1 RUB):\n\n`;
    message += `Текущий курс: ${formatMoney(rates.RUB.rate)} сум\n\n`;
    message += `💡 Этот курс будет сохранен лично для вас.`;
  }
  
  sendText(chat_id, message);
  Logger.log(`Состояние установлено: awaiting_rub_rate для chat_id: ${chat_id}`);
}

function handleViewCurrentRates(chat_id) {
  handleUpdateRates(chat_id);
}

// =============================================
//               DEBT HANDLERS
// =============================================
function handleDebtsMenu(chat_id) {
  const lang = getUserLang(chat_id);
  const message = lang === 'uz' ? 
    "💳 Qarzlarni boshqarish:" :
    "💳 Управление долгами:";
  sendText(chat_id, message, null, debtsKeyboard);
}

function handleGiveCredit(chat_id) {
  const lang = getUserLang(chat_id);
  const userProps = PropertiesService.getUserProperties();
  userProps.setProperty(chat_id + "_state", "awaiting_credit_info");
  
  const message = lang === 'uz' ? 
    "📤 Qarzga berish\n\nMa'lumotni quyidagi formatda kiriting:\n`Summa Qarzdor ismi Tavsif`\n\nMisollar:\n• `50000 Alexey ta'mirlash uchun`\n• `5000$ Jasur aka ta'mirlash`\n• `€500 Mariya mashina uchun`" :
    "📤 Дать в долг\n\nВведите информацию в формате:\n`Сумма Имя должника Описание`\n\nПримеры:\n• `50000 Алексей за ремонт`\n• `5000$ Жасур ака ремонт`\n• `€500 Мария за машину`";
  
  sendText(chat_id, message, "Markdown");
}

function handleTakeDebt(chat_id) {
  const lang = getUserLang(chat_id);
  const userProps = PropertiesService.getUserProperties();
  userProps.setProperty(chat_id + "_state", "awaiting_debt_info");
  
  const message = lang === 'uz' ? 
    "📥 Qarzga olish\n\nMa'lumotni quyidagi formatda kiriting:\n`Summa Kreditor ismi Tavsif`\n\nMisollar:\n• `100000 Mariya mashina uchun`\n• `1000$ Alexey ta'mirlash uchun`\n• `€200 Petr xizmatlar uchun`" :
    "📥 Взять в долг\n\nВведите информацию в формате:\n`Сумма Имя кредитора Описание`\n\nПримеры:\n• `100000 Мария за машину`\n• `1000$ Алексей за ремонт`\n• `€200 Петр за услуги`";
  
  sendText(chat_id, message, "Markdown");
}

function handlePayDebt(chat_id) {
  const activeDebts = getActiveDebtsForUser(chat_id);
  
  if (activeDebts.length === 0) {
    return sendText(chat_id, "✅ У вас нет активных долгов для погашения!");
  }
  
  let message = "💰 *Выберите долг для погашения:*\n\n";
  const keyboard = { inline_keyboard: [] };
  
  activeDebts.forEach((debt, index) => {
    const { type, counterparty, amount, currency, amountInUZS, description, remainingAmount } = debt;
    
    if (type === 'Дебет') {
      // Показываем только долги, которые нужно погасить (я должен)
      message += `${index + 1}. 💸 ${counterparty}: ${formatMultiCurrency(amount, currency, amountInUZS)}\n`;
      message += `   📝 ${description}\n`;
      if (remainingAmount < amountInUZS) {
        message += `   💰 Осталось: ${formatMoney(remainingAmount)} сум\n`;
      }
      message += `\n`;
      
      keyboard.inline_keyboard.push([{
        text: `${index + 1}. ${counterparty} (${formatMoney(remainingAmount)} сум)`,
        callback_data: `pay_debt|${debt.rowIndex}`
      }]);
    }
  });
  
  if (keyboard.inline_keyboard.length === 0) {
    return sendText(chat_id, "✅ У вас нет долгов, которые нужно погашать!");
  }
  
  keyboard.inline_keyboard.push([{ text: "⬅️ Назад", callback_data: "back_to_debts" }]);
  
  sendText(chat_id, message, "Markdown", keyboard);
}

function handlePayDebtProcess(chat_id, debtRowIndex) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(debtsSheet);
  
  if (!sheet || debtRowIndex < 2 || debtRowIndex > sheet.getLastRow()) {
    return sendText(chat_id, "❌ Долг не найден.");
  }
  
  // Получаем информацию о долге
  const debtData = sheet.getRange(debtRowIndex, 1, 1, 12).getValues()[0];
  const [date, chatId, type, counterparty, amount, currency, amountInUZS, description, returnDate, status, paidDate, paidAmount] = debtData;
  
  // Проверяем, что это долг пользователя и он активен
  if (String(chatId) !== String(chat_id) || status !== 'Активен' || type !== 'Дебет') {
    return sendText(chat_id, "❌ Этот долг нельзя погасить.");
  }
  
  const currentPaidAmount = parseFloat(paidAmount) || 0;
  const remainingAmount = parseFloat(amountInUZS) - currentPaidAmount;
  
  if (remainingAmount <= 0) {
    return sendText(chat_id, "✅ Этот долг уже полностью погашен!");
  }
  
  // Сохраняем информацию о долге для погашения
  const userProps = PropertiesService.getUserProperties();
  userProps.setProperty(chat_id + "_state", `awaiting_payment|${debtRowIndex}`);
  
  const debtInfo = `💸 *Погашение долга:*\n\n` +
    `👤 Кредитор: ${counterparty}\n` +
    `💰 Общая сумма: ${formatMultiCurrency(amount, currency, amountInUZS)}\n` +
    `📝 Описание: ${description}\n` +
    `💳 Уже погашено: ${formatMoney(currentPaidAmount)} сум\n` +
    `🔥 К доплате: ${formatMoney(remainingAmount)} сум\n\n` +
    `Введите сумму погашения (в любой валюте):\n` +
    `Примеры: \`${Math.min(remainingAmount, 50000)}\`, \`100$\`, \`€50\``;
  
  sendText(chat_id, debtInfo, "Markdown");
}

// =============================================
//             AUTOMATED DEBT REMINDERS
// =============================================
function sendDailyDebtReminders() {
  Logger.log("--- Запуск ежедневных напоминаний о долгах ---");
  
  // Получаем всех пользователей с активными долгами
  const allUserIds = getAllUserIds();
  Logger.log(`Проверяю напоминания для ${allUserIds.length} пользователей`);
  
  allUserIds.forEach(userId => {
    try {
      Logger.log(`Проверяю напоминания для пользователя: ${userId}`);
      
      const notifications = checkDebtNotifications(userId);
      
      if (notifications.length > 0) {
        // Отправляем не больше одного уведомления в день
        const userProps = PropertiesService.getScriptProperties();
        const lastNotificationKey = `last_debt_notification_${userId}`;
        const lastNotification = userProps.getProperty(lastNotificationKey);
        const today = new Date().toDateString();
        
        if (lastNotification !== today) {
          Logger.log(`Отправляю напоминания пользователю ${userId}`);
          
          notifications.forEach(notification => {
            sendText(userId, notification, "Markdown");
          });
          
          // Сохраняем дату последнего уведомления
          userProps.setProperty(lastNotificationKey, today);
          Logger.log(`Напоминания отправлены пользователю: ${userId}`);
        } else {
          Logger.log(`Уведомления уже отправлены сегодня пользователю: ${userId}`);
        }
      } else {
        Logger.log(`Нет напоминаний для пользователя: ${userId}`);
      }
      
    } catch (error) {
      Logger.log(`Ошибка при обработке напоминаний для ${userId}: ${error.toString()}`);
    }
  });
  
  Logger.log("--- Ежедневные напоминания о долгах завершены ---");
}

function createDebtRemindersSchedule() {
  // Создаем триггер для ежедневных напоминаний в 9:00
  ScriptApp.newTrigger('sendDailyDebtReminders')
    .timeBased()
    .everyDays(1)
    .atHour(9)
    .create();
    
  Logger.log("Создан триггер для ежедневных напоминаний о долгах в 9:00");
}

function processDebtPayment(chat_id, debtRowIndex, paymentAmountInUZS, paymentAmount, paymentCurrency) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(debtsSheet);
  
  if (!sheet || debtRowIndex < 2 || debtRowIndex > sheet.getLastRow()) {
    return { success: false, error: "Долг не найден." };
  }
  
  try {
    // Получаем информацию о долге
    const debtData = sheet.getRange(debtRowIndex, 1, 1, 12).getValues()[0];
    const [date, chatId, type, counterparty, amount, currency, amountInUZS, description, returnDate, status, paidDate, paidAmount] = debtData;
    
    // Проверяем, что это долг пользователя
    if (String(chatId) !== String(chat_id) || status !== 'Активен' || type !== 'Дебет') {
      return { success: false, error: "Этот долг нельзя погасить." };
    }
    
    const totalAmount = parseFloat(amountInUZS) || 0;
    const currentPaidAmount = parseFloat(paidAmount) || 0;
    const newPaidAmount = currentPaidAmount + paymentAmountInUZS;
    const remainingAmount = totalAmount - newPaidAmount;
    
    // Проверяем переплату
    if (newPaidAmount > totalAmount) {
      return { success: false, error: `Сумма платежа превышает остаток долга. Осталось доплатить: ${formatMoney(totalAmount - currentPaidAmount)} сум` };
    }
    
    // Обновляем информацию о погашении
    const newStatus = remainingAmount <= 0 ? 'Погашен' : 'Активен';
    const paymentDate = remainingAmount <= 0 ? new Date() : paidDate;
    
    // Обновляем строку в Google Sheets
    sheet.getRange(debtRowIndex, 10).setValue(newStatus); // Статус
    sheet.getRange(debtRowIndex, 11).setValue(paymentDate); // Дата погашения
    sheet.getRange(debtRowIndex, 12).setValue(newPaidAmount); // Сумма погашения
    
    return {
      success: true,
      counterparty: counterparty,
      fullyPaid: remainingAmount <= 0,
      remainingAmount: Math.max(0, remainingAmount)
    };
    
  } catch (error) {
    Logger.log(`Ошибка при погашении долга: ${error.toString()}`);
    return { success: false, error: "Произошла ошибка при обработке платежа." };
  }
}

function handleViewDebts(chat_id) {
  const { totalDebt, totalCredit } = getDebtsAndCredits([chat_id]);
  const overdueDebts = getOverdueDebts(chat_id);
  const upcomingDebts = getUpcomingDebts(chat_id, 7);
  
  let report = "📊 *ДЕТАЛЬНЫЙ ОТЧЕТ ПО ДОЛГАМ:*\n\n";
  
  // Общая статистика
  if (totalCredit > 0) {
    report += `💚 Мне должны: ${formatMoney(totalCredit)} сум\n`;
  }
  
  if (totalDebt > 0) {
    report += `💸 Я должен: ${formatMoney(totalDebt)} сум\n`;
  }
  
  if (totalCredit === 0 && totalDebt === 0) {
    report += "У вас нет активных долгов.";
    sendText(chat_id, report, "Markdown");
    return;
  }
  
    const netBalance = totalCredit - totalDebt;
  report += `\n🏦 Чистый баланс: ${formatMoney(netBalance)} сум\n\n`;
  
  // Просроченные долги
  if (overdueDebts.length > 0) {
    report += `🚨 *ПРОСРОЧЕННЫЕ (${overdueDebts.length}):*\n`;
    overdueDebts.forEach(debt => {
      const typeIcon = debt.type === 'Дебет' ? '💸' : '💚';
      const typeText = debt.type === 'Дебет' ? 'Вы должны' : 'Вам должны';
      report += `${typeIcon} ${debt.counterparty} - ${formatMultiCurrency(debt.amount, debt.currency, debt.amountInUZS)}\n`;
      report += `   📅 Просрочено на ${debt.daysOverdue} дн.\n`;
    });
    report += '\n';
  }
  
  // Приближающиеся долги
  if (upcomingDebts.length > 0) {
    report += `⏰ *БЛИЖАЙШИЕ 7 ДНЕЙ (${upcomingDebts.length}):*\n`;
    upcomingDebts.forEach(debt => {
      const typeIcon = debt.type === 'Дебет' ? '💸' : '💚';
      const typeText = debt.type === 'Дебет' ? 'Вы должны' : 'Вам должны';
      report += `${typeIcon} ${debt.counterparty} - ${formatMultiCurrency(debt.amount, debt.currency, debt.amountInUZS)}\n`;
      report += `   📅 Через ${debt.daysUntilDue} дн.\n`;
    });
    report += '\n';
  }
  
  // Активные долги
  const activeDebts = getActiveDebtsForUser(chat_id);
  const regularDebts = activeDebts.filter(debt => {
    const dueDate = new Date(debt.dueDate);
    const now = new Date();
    const futureDate = new Date(now.getTime() + (7 * 24 * 60 * 60 * 1000));
    return dueDate > futureDate; // Долги со сроком больше 7 дней
  });
  
  if (regularDebts.length > 0) {
    report += `📋 *ОСТАЛЬНЫЕ АКТИВНЫЕ (${regularDebts.length}):*\n`;
    regularDebts.forEach(debt => {
      const typeIcon = debt.type === 'Дебет' ? '💸' : '💚';
      const dueDate = new Date(debt.dueDate);
      const formattedDate = `${String(dueDate.getDate()).padStart(2, '0')}.${String(dueDate.getMonth() + 1).padStart(2, '0')}.${dueDate.getFullYear()}`;
      report += `${typeIcon} ${debt.counterparty} - ${formatMultiCurrency(debt.amount, debt.currency, debt.amountInUZS)}\n`;
      report += `   📅 До ${formattedDate}\n`;
    });
  }
  
  sendText(chat_id, report, "Markdown");
}

function handleCheckOverdue(chat_id) {
  const overdueDebts = getOverdueDebts(chat_id);
  
  if (overdueDebts.length === 0) {
    return sendText(chat_id, "✅ У вас нет просроченных долгов!");
  }
  
  let message = "🚨 *ПРОСРОЧЕННЫЕ ДОЛГИ:*\n\n";
  
  overdueDebts.forEach((debt, index) => {
    const typeIcon = debt.type === 'Дебет' ? '💸' : '💚';
    const typeText = debt.type === 'Дебет' ? 'Вы должны' : 'Вам должны';
    message += `${index + 1}. ${typeIcon} *${debt.counterparty}*\n`;
    message += `💰 ${formatMultiCurrency(debt.amount, debt.currency, debt.amountInUZS)}\n`;
    message += `📝 ${debt.description}\n`;
    message += `📅 Просрочено на *${debt.daysOverdue} дн.*\n\n`;
  });
  
  message += "💡 *Рекомендации:*\n";
  message += "• Свяжитесь с должниками/кредиторами\n";
  message += "• Используйте '📅 Продлить срок' для изменения дедлайна\n";
  message += "• Погасите просроченные долги как можно скорее";
  
  sendText(chat_id, message, "Markdown");
}

function handleExtendDebt(chat_id) {
  const activeDebts = getActiveDebtsForUser(chat_id);
  
  if (activeDebts.length === 0) {
    return sendText(chat_id, "У вас нет активных долгов для изменения срока.");
  }
  
  let message = "📅 *Выберите долг для изменения срока:*\n\n";
  const keyboard = { inline_keyboard: [] };
  
  activeDebts.forEach((debt, index) => {
    const typeIcon = debt.type === 'Дебет' ? '💸' : '💚';
    const dueDate = new Date(debt.dueDate);
    const formattedDate = `${String(dueDate.getDate()).padStart(2, '0')}.${String(dueDate.getMonth() + 1).padStart(2, '0')}.${dueDate.getFullYear()}`;
    
    message += `${index + 1}. ${typeIcon} ${debt.counterparty}\n`;
    message += `💰 ${formatMultiCurrency(debt.amount, debt.currency, debt.amountInUZS)}\n`;
    message += `📅 До ${formattedDate}\n\n`;
    
    keyboard.inline_keyboard.push([{
      text: `${index + 1}. ${debt.counterparty} (${formattedDate})`,
      callback_data: `extend_debt|${debt.rowIndex}`
    }]);
  });
  
  keyboard.inline_keyboard.push([{ text: "⬅️ Назад", callback_data: "back_to_debts" }]);
  
  sendText(chat_id, message, "Markdown", keyboard);
}

function extendDebtDueDate(chat_id, debtRowIndex, newDueDate) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(debtsSheet);
  
  if (!sheet || debtRowIndex < 2 || debtRowIndex > sheet.getLastRow()) {
    return { success: false, error: "Долг не найден." };
  }
  
  try {
    // Получаем информацию о долге
    const debtData = sheet.getRange(debtRowIndex, 1, 1, 12).getValues()[0];
    const [date, chatId, type, counterparty, amount, currency, amountInUZS, description, returnDate, status] = debtData;
    
    // Проверяем, что это долг пользователя
    if (String(chatId) !== String(chat_id) || status !== 'Активен') {
      return { success: false, error: "Этот долг нельзя изменить." };
    }
    
    // Обновляем дату возврата
    sheet.getRange(debtRowIndex, 9).setValue(newDueDate); // Дата_возврата
    
    const formattedDate = `${String(newDueDate.getDate()).padStart(2, '0')}.${String(newDueDate.getMonth() + 1).padStart(2, '0')}.${newDueDate.getFullYear()}`;
    
    return {
      success: true,
      counterparty: counterparty,
      newDate: formattedDate,
      type: type
    };
    
  } catch (error) {
    Logger.log(`Ошибка при изменении срока долга: ${error.toString()}`);
    return { success: false, error: "Произошла ошибка при изменении срока." };
  }
}

function handleExtendDebtProcess(chat_id, debtRowIndex) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(debtsSheet);
  
  if (!sheet || debtRowIndex < 2 || debtRowIndex > sheet.getLastRow()) {
    return sendText(chat_id, "❌ Долг не найден.");
  }
  
  // Получаем информацию о долге
  const debtData = sheet.getRange(debtRowIndex, 1, 1, 12).getValues()[0];
  const [date, chatId, type, counterparty, amount, currency, amountInUZS, description, returnDate, status] = debtData;
  
  // Проверяем, что это долг пользователя и он активен
  if (String(chatId) !== String(chat_id) || status !== 'Активен') {
    return sendText(chat_id, "❌ Этот долг нельзя изменить.");
  }
  
  const currentDueDate = new Date(returnDate);
  const formattedCurrentDate = `${String(currentDueDate.getDate()).padStart(2, '0')}.${String(currentDueDate.getMonth() + 1).padStart(2, '0')}.${currentDueDate.getFullYear()}`;
  
  // Сохраняем информацию о долге для изменения срока
  const userProps = PropertiesService.getUserProperties();
  userProps.setProperty(chat_id + "_state", `awaiting_new_due_date|${debtRowIndex}`);
  
  const typeIcon = type === 'Дебет' ? '💸' : '💚';
  const typeText = type === 'Дебет' ? 'должны' : 'должен';
  
  const debtInfo = `📅 *Изменение срока долга:*\n\n` +
    `${typeIcon} ${counterparty} ${typeText} ${formatMultiCurrency(amount, currency, amountInUZS)}\n` +
    `📝 ${description}\n` +
    `📅 Текущий срок: ${formattedCurrentDate}\n\n` +
    `Введите новую дату в формате ДД.ММ.ГГГГ:\n` +
    `Примеры: \`15.02.2024\`, \`01.03.2024\``;
  
  sendText(chat_id, debtInfo, "Markdown");
}

// =============================================
//             AUTOMATED DEBT REMINDERS
// =============================================
function sendDailyDebtReminders() {
  Logger.log("--- Запуск ежедневных напоминаний о долгах ---");
  
  // Получаем всех пользователей с активными долгами
  const allUserIds = getAllUserIds();
  Logger.log(`Проверяю напоминания для ${allUserIds.length} пользователей`);
  
  allUserIds.forEach(userId => {
    try {
      Logger.log(`Проверяю напоминания для пользователя: ${userId}`);
      
      const notifications = checkDebtNotifications(userId);
      
      if (notifications.length > 0) {
        // Отправляем не больше одного уведомления в день
        const userProps = PropertiesService.getScriptProperties();
        const lastNotificationKey = `last_debt_notification_${userId}`;
        const lastNotification = userProps.getProperty(lastNotificationKey);
        const today = new Date().toDateString();
        
        if (lastNotification !== today) {
          Logger.log(`Отправляю напоминания пользователю ${userId}`);
          
          notifications.forEach(notification => {
            sendText(userId, notification, "Markdown");
          });
          
          // Сохраняем дату последнего уведомления
          userProps.setProperty(lastNotificationKey, today);
          Logger.log(`Напоминания отправлены пользователю: ${userId}`);
        } else {
          Logger.log(`Уведомления уже отправлены сегодня пользователю: ${userId}`);
        }
      } else {
        Logger.log(`Нет напоминаний для пользователя: ${userId}`);
      }
      
    } catch (error) {
      Logger.log(`Ошибка при обработке напоминаний для ${userId}: ${error.toString()}`);
    }
  });
  
  Logger.log("--- Ежедневные напоминания о долгах завершены ---");
}

function createDebtRemindersSchedule() {
  // Создаем триггер для ежедневных напоминаний в 9:00
  ScriptApp.newTrigger('sendDailyDebtReminders')
    .timeBased()
    .everyDays(1)
    .atHour(9)
    .create();
    
  Logger.log("Создан триггер для ежедневных напоминаний о долгах в 9:00");
}

// =============================================
//               MINI-APP API
// =============================================
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