export class QueueFullError extends Error {
  constructor() {
    super("inference queue is full");
    this.name = "QueueFullError";
  }
}

type Job<T> = {
  run: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
};

export class InferenceQueue {
  private active = 0;
  private readonly pending: Job<unknown>[] = [];

  constructor(
    private readonly concurrency: number,
    private readonly maxPending: number,
  ) {}

  get activeCount(): number {
    return this.active;
  }

  get pendingCount(): number {
    return this.pending.length;
  }

  run<T>(job: () => Promise<T>): Promise<T> {
    if (this.active >= this.concurrency && this.pending.length >= this.maxPending) {
      throw new QueueFullError();
    }

    return new Promise<T>((resolve, reject) => {
      this.pending.push({
        run: job,
        resolve: resolve as (value: unknown) => void,
        reject,
      });
      this.drain();
    });
  }

  private drain(): void {
    while (this.active < this.concurrency && this.pending.length > 0) {
      const job = this.pending.shift();
      if (!job) return;

      this.active += 1;
      job
        .run()
        .then(job.resolve, job.reject)
        .finally(() => {
          this.active -= 1;
          this.drain();
        });
    }
  }
}

export const inferenceQueue = new InferenceQueue(
  Number.parseInt(process.env.INFERENCE_CONCURRENCY || "1", 10),
  // 排队容量调大到 64：推理严格串行（内存安全的关键），
  // 突发请求排队等待而不是返回 503 server_overloaded 打挂上游批次。
  // 单个请求只是 prompt/URL 字符串，64 个排队的内存开销可忽略。
  Number.parseInt(process.env.INFERENCE_MAX_QUEUE || "64", 10),
);
