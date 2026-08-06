// Minimal, compatible Shelly EM Gen3 script — daily reset at local midnight

function resetAllCounters() {
  for (let ch = 0; ch <= 1; ch++) {
    Shelly.call("EM1Data.ResetCounters", {id: ch}, function(res, err_code, err_msg) {
      if (err_code === 0) {
        print("Channel", ch, "reset OK");
      } else {
        print("Error on channel", ch, ":", err_msg);
      }
    });
  }

  // 1. Отримуємо поточний час (Unix Epoch в секундах) з системи
  let sysStatus = Shelly.getComponentStatus("sys");
  let now = sysStatus.unixtime; 

  // 2. Беремо "важіль" (handle) для керування компонентом
  let lastReset = Virtual.getHandle("number:207");

  // 3. ОБОВ'ЯЗКОВО перевіряємо, чи компонент взагалі існує
  if (lastReset !== null) {
    lastReset.setValue(now);
    print("Час успішно оновлено на: " + now);
  } else {
    print("Помилка: Віртуальний компонент number:207 не знайдено!");
  }
}

// Таймер: перев����ряє час кожну хвилину

Timer.set(
  60 * 1000,   // Перевірка кожну хвилину (60000 мс)
  true,        // Повторюваний таймер
  function () {
    // 1. Отримуємо поточний системний статус
    let sysStatus = Shelly.getComponentStatus("sys");
    
    // Перевіряємо, чи годинник Shelly взагалі синхронізовано з інтернетом
    if (!sysStatus.time || sysStatus.time === "00:00") {
      print("Очікування синхронізації часу...");
      return; 
    }

    // 2. Отримуємо поточну дату (рядок виду "2026-08-06") та Unix-час
    let currentDateStr = sysStatus.date; // Поточна дата пристрою
    let nowEpoch = sysStatus.unixtime;   // Поточний Unix-час у секундах

    // 3. Зчитуємо Unix-час останнього успішного скидання з компонента
    let lastResetHandle = Virtual.getHandle("number:207");
    if (lastResetHandle === null) {
      print("Помилка: Компонент number:207 не знайдено!");
      return;
    }
    let lastResetEpoch = lastResetHandle.getValue();

    // 4. Перетворюємо Unix-час минулого скидання у дату, щоб порівняти дні
    // Для цього використовуємо вбудовану в Shelly функцію Shelly.getDateTimeString
    let lastResetDateStr = Shelly.getDateTimeString(lastResetEpoch).substring(0, 10);

    // 5. ЛОГІКА СКИНУТТЯ:
    // Якщо поточна дата НЕ збігається з датою останнього скидання,
    // значить настав новий день (навіть якщо Shelly був вимкнений всю ніч і увімкнувся вранці)
    if (currentDateStr !== lastResetDateStr) {
      
      // Викликаємо вашу функцію скидання
      resetAllCounters();
      
      // ОБОВ'ЯЗКОВО записуємо НОВИЙ Unix-час у компонент, щоб зафіксувати скидання
      lastResetHandle.setValue(nowEpoch);
      print("Новий день виявлено! Лічильники скинуто для дати: " + currentDateStr);
    }
  }
);

// Для ручного тесту можна викликати одразу:
//resetAllCounters();
