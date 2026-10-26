/** Simple free-list object pool for frequently spawned entities. */
export class Pool<T extends { alive: boolean }> {
  readonly items: T[] = [];
  constructor(private factory: () => T) {}
  acquire(): T {
    for (const it of this.items) if (!it.alive) return it;
    const it = this.factory();
    this.items.push(it);
    return it;
  }
  get activeCount() {
    let n = 0;
    for (const it of this.items) if (it.alive) n++;
    return n;
  }
  forEachAlive(fn: (t: T) => void) {
    for (const it of this.items) if (it.alive) fn(it);
  }
  clear() {
    for (const it of this.items) it.alive = false;
  }
}
