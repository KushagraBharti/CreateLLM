export interface CompletionResult<T> {
  index: number;
  value?: T;
  error?: Error;
}

export async function* inCompletionOrder<T>(
  tasks: Promise<T>[]
): AsyncGenerator<CompletionResult<T>> {
  const queue: CompletionResult<T>[] = [];
  let resolved = 0;
  let notify: (() => void) | null = null;

  tasks.forEach((task, index) => {
    task
      .then((value) => {
        queue.push({ index, value });
      })
      .catch((error) => {
        queue.push({
          index,
          error: error instanceof Error ? error : new Error(String(error)),
        });
      })
      .finally(() => {
        resolved += 1;
        notify?.();
      });
  });

  while (resolved < tasks.length || queue.length > 0) {
    if (queue.length === 0) {
      await new Promise<void>((resolve) => {
        notify = resolve;
      });
      notify = null;
    }

    while (queue.length > 0) {
      const item = queue.shift();
      if (item) yield item;
    }
  }
}
