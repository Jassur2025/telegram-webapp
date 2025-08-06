function refreshData() {
  alert("Обновление данных...");
  // Здесь можешь подключить API или обновить таблицу
}

function downloadPDF() {
  alert("Скачивание PDF временно не реализовано.");
  // Можно подключить библиотеку html2pdf
}

window.addEventListener('DOMContentLoaded', () => {
  Telegram.WebApp.ready();
});