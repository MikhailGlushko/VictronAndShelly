// Minimal, compatible Shelly EM Gen3 script — daily reset at local midnight

function resetAllCounters() {
  for (var ch = 0; ch <= 1; ch++) {
    (function(c) {
      Shelly.call("EM1Data.ResetCounters", { id: c }, function(res, err_code, err_msg) {
        if (err_code === 0) {
          print("Channel", c, "reset OK");
        } else {
          print("Error on channel", c, ":", err_msg);
        }
      });
    })(ch);
  }
}

function checkAndMaybeReset() {
  var t = Sys.getTime();
  // Check time validity (avoid t == 0 before NTP)
  if (!t || t < 1000000000) {
    print("Time not valid yet:", t);
    return;
  }
  var d = new Date(t * 1000);
  if (d.getHours() === 0 && d.getMinutes() === 0) {
    print("Midnight detected — resetting counters");
    resetAllCounters();
  }
}

// Run once on start (to cover restart just after midnight)
checkAndMaybeReset();

// Timer: check every minute
Timer.set(
  60 * 1000, // 1 minute
  true,
  function () {
    checkAndMaybeReset();
  }
);

// For manual test uncomment:
// resetAllCounters();
