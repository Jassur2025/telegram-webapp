// =============================================
//          YANDEX SPEECHKIT HELPERS
// =============================================
/**
 * Отправляет звук в Yandex SpeechKit для распознавания и
 * возвращает распознанный текст (или пустую строку в случае ошибки).
 *
 * @param {Blob} blob      Голосовой файл в формате OGG/Opus
 * @param {string} lang    Язык в формате ru-RU / uz-UZ / en-US
 * @return {string}        Распознанный текст
 */
function callYandexStt(blob, lang) {
  const folderId = SCRIPT_PROPS.getProperty('SPEECHKIT_FOLDER_ID');
  const apiUrl = `https://stt.api.cloud.yandex.net/speech/v1/stt:recognize?lang=${lang}&format=oggopus&sampleRateHertz=48000&folderId=${folderId}`;
  const options = {
    method: 'post',
    contentType: 'application/ogg',
    payload: blob,
    headers: {
      'Authorization': 'Api-Key ' + SPEECHKIT_KEY
    },
    muteHttpExceptions: true
  };
  try {
    const response = UrlFetchApp.fetch(apiUrl, options);
    const code = response.getResponseCode();
    const body = response.getContentText();
    Logger.log('Yandex STT resp ' + code + ': ' + body);
    if (code === 200) {
      const data = JSON.parse(body);
      return data.result || '';
    }
  } catch (e) {
    Logger.log('Yandex STT exception: ' + e);
  }
  return '';
}
