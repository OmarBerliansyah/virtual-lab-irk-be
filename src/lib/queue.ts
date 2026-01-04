export class KeyedMutex {
  private locks: Map<string, Promise<void>> = new Map();

  async run<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const currentLock = this.locks.get(key) || Promise.resolve();

    let resolveNext: () => void;
    const nextLock = new Promise<void>((resolve) => {
      resolveNext = resolve;
    });

    this.locks.set(key, nextLock);

    try {
      await currentLock;
      return await fn();
    } finally {
      resolveNext!();
      if (this.locks.get(key) === nextLock) {
        this.locks.delete(key);
      }
    }
  }

  isLocked(key: string): boolean {
    return this.locks.has(key);
  }

  getActiveLocksCount(): number {
    return this.locks.size;
  }
}

export const taskMutex = new KeyedMutex();
export const eventMutex = new KeyedMutex();
