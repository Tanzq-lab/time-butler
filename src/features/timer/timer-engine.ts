import { createTimerWorker } from "@/features/timer/use-timer-worker";

export interface TimerEngineCallbacks {
  onTick: (remaining: number) => void;
  onDone: () => void;
}

export class TimerEngine {
  private worker: Worker | null = null;
  private callbacks: TimerEngineCallbacks | null = null;

  setCallbacks(cb: TimerEngineCallbacks) {
    this.callbacks = cb;
  }

  start(seconds: number) {
    this.terminate();

    const worker = createTimerWorker();
    worker.onmessage = (e: MessageEvent) => {
      const { type, remaining } = e.data;
      if (type === "tick") this.callbacks?.onTick(remaining);
      if (type === "done") this.callbacks?.onDone();
    };
    worker.postMessage({ command: "start", seconds });
    this.worker = worker;
  }

  pause() {
    this.worker?.postMessage({ command: "pause" });
  }

  resume() {
    this.worker?.postMessage({ command: "resume" });
  }

  addTime(seconds: number) {
    if (this.worker) {
      this.worker.postMessage({ command: "add_time", seconds });
    }
  }

  private terminateWorker() {
    this.worker?.terminate();
    this.worker = null;
  }

  terminate() {
    this.terminateWorker();
  }

  isRunning(): boolean {
    return this.worker !== null;
  }
}
