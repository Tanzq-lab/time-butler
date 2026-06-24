const workerCode = `
  let interval = null;
  let remaining = 0;
  let targetEndTime = 0;

  function computeRemaining() {
    return Math.max(0, Math.ceil((targetEndTime - Date.now()) / 1000));
  }

  function startCountdown() {
    clearInterval(interval);
    interval = setInterval(() => {
      remaining = computeRemaining();
      if (remaining <= 0) {
        clearInterval(interval);
        interval = null;
        self.postMessage({ type: "done", remaining: 0 });
      } else {
        self.postMessage({ type: "tick", remaining });
      }
    }, 1000);
  }

  self.onmessage = (e) => {
    if (e.data.command === "start") {
      remaining = e.data.seconds;
      targetEndTime = e.data.deadlineAtMs ?? Date.now() + remaining * 1000;
      startCountdown();
    }

    if (e.data.command === "pause") {
      remaining = computeRemaining();
      clearInterval(interval);
      interval = null;
    }

    if (e.data.command === "resume") {
      if (typeof e.data.seconds === "number") {
        remaining = e.data.seconds;
      }
      targetEndTime = e.data.deadlineAtMs ?? Date.now() + remaining * 1000;
      startCountdown();
    }

    if (e.data.command === "stop") {
      clearInterval(interval);
      interval = null;
      remaining = 0;
      targetEndTime = 0;
    }

    if (e.data.command === "add_time") {
      targetEndTime += e.data.seconds * 1000;
      remaining = computeRemaining();
      if (!interval) {
        startCountdown();
      }
      self.postMessage({ type: "tick", remaining });
    }
  };
`;

const blob = new Blob([workerCode], { type: "application/javascript" });

export function createTimerWorker(): Worker {
  const url = URL.createObjectURL(blob);
  const worker = new Worker(url);
  URL.revokeObjectURL(url);
  return worker;
}
