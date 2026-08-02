import type { DashboardError, Result } from "./data";

export class LastGood<T> {
  private valueState = $state.raw<T | undefined>(undefined);
  private errorState = $state.raw<DashboardError | undefined>(undefined);

  constructor(initial?: Result<T>) {
    if (initial) this.update(initial);
  }

  get value(): T | undefined {
    return this.valueState;
  }

  get error(): DashboardError | undefined {
    return this.errorState;
  }

  update(result: Result<T>): void {
    if (result.ok) {
      this.valueState = result.data;
      this.errorState = undefined;
    } else {
      this.errorState = result;
    }
  }
}

export function createLastGood<T>(initial?: Result<T>): LastGood<T> {
  return new LastGood<T>(initial);
}
