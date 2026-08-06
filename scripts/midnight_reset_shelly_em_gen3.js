// Скрипт для Shelly EM Gen3 — щоденне гарантоване скидання EM1Data.ResetCounters для каналів 0..1
// Особливості: чекає NTP, компенсує рестарти, одноразове планування до опівночі, retry з backoff.

const CHANNELS = [0, 1];
const VALID_TIME_THRESHOLD = 1609459200; // 2021-01-01 UTC — вважаємо час валідним при більшому значенні
const BOOT_COMPENSATE_WINDOW_MIN = 15; // хвилин: якщо пристрій стартував в межах перших 15 хвилин після опівночі — робити компенсуюче скидання
const MAX_RETRY = 5;
const BASE_RETRY_MS = 5000; // початкова пауза для retry

function nowSec() {
  return Sys.getTime();
}

function log() {
  // зручний wrapper для print
  let args = Array.prototype.slice.call(arguments);
  args.unshift("[midnight-reset]");
  print.apply(null, args);
}

function resetChannelWithRetry(ch, attempt) {
  attempt = attempt || 1;
  Shelly.call("EM1Data.ResetCounters", { id: ch }, function (res, err_code, err_msg) {
    if (err_code === 0) {
      log("Channel", ch, "reset OK (attempt", attempt + ")");
    } else {
      log("Error on channel", ch, "attempt", attempt, ":", err_msg);
      if (attempt < MAX_RETRY) {
        let backoff = BASE_RETRY_MS * Math.pow(2, attempt - 1);
        log("Scheduling retry for channel", ch, "in ms:", backoff);
        Timer.set(backoff, false, function () {
          resetChannelWithRetry(ch, attempt + 1);
        });
      } else {
        log("Channel", ch, "failed after", MAX_RETRY, "attempts");
      }
    }
  });
}

function resetAllCounters() {
  log("Starting resetAllCounters for channels:", CHANNELS);
  for (let i = 0; i < CHANNELS.length; i++) {
    // let у циклі гарантує коректний ch в callback
    let ch = CHANNELS[i];
    resetChannelWithRetry(ch, 1);
  }
}

// Плануємо одиночний таймер на наступну опівніч (локальний час)
function scheduleNextMidnightReset() {
  let t = nowSec();
  if (!t || t < VALID_TIME_THRESHOLD) {
    log("Sys.getTime() not valid yet (", t, "). Повторна перевірка через 10s...");
    Timer.set(10000, false, scheduleNextMidnightReset);
    return;
  }

  let now = new Date(t * 1000);
  // Якщо ми в перших BOOT_COMPENSATE_WINDOW_MIN хвилинах після опівночі — робимо компенсуюче скидання
  if (now.getHours() === 0 && now.getMinutes() < BOOT_COMPENSATE_WINDOW_MIN) {
    log("Boot-time compensation: within first", BOOT_COMPENSATE_WINDOW_MIN, "minutes after midnight — performing immediate reset");
    resetAllCounters();
    // Далі плануємо наступну опівніч як зазвичай
  }

  // Розрахуємо час до наступної опівночі локально
  let next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
  let delayMs = next.getTime() - now.getTime();

  log("Scheduling next midnight reset in (ms):", delayMs, " Next:", next.toString());

  // У деяких середовищах таймери мають обмеження на max delay; ми передбачимо максимально 24 години (досі безпечний)
  Timer.set(delayMs, false, function () {
    log("Midnight reached:", new Date().toString(), "- executing reset");
    resetAllCounters();
    // Після виконання — плануємо наступну опівніч заново (щоб уникнути накопичувального дрейфу)
    scheduleNextMidnightReset();
  });
}

// Початковий запуск
log("Starting midnight reset scheduler...");
scheduleNextMidnightReset();

// Для ручного тесту (розкоментуйте для виклику)
// resetAllCounters();
