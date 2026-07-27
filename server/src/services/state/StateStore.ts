export interface StateStore<T> {
  get(key: string): T | undefined;
  set(key: string, value: T): void;
  delete(key: string): void;
  values(): IterableIterator<T>;
}

export class InMemoryStateStore<T> implements StateStore<T> {
  private readonly state = new Map<string, T>();

  get(key: string) {
    return this.state.get(key);
  }

  set(key: string, value: T) {
    this.state.set(key, value);
  }

  delete(key: string) {
    this.state.delete(key);
  }

  values() {
    return this.state.values();
  }
}
