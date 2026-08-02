// A tiny in-process serialization lock.
//
// Vote application is a read-score -> compute -> write-score sequence that is
// NOT atomic in the database. If two votes touching the same idea run at the
// same time they read the same "before" score and one update silently
// overwrites the other (a lost update). We serialize the whole vote-apply
// critical section here so it runs one-at-a-time within this server process.
//
// NOTE: this is correct for a single backend instance (our setup). If the
// backend is ever run as multiple instances behind a load balancer, this in
// -memory lock no longer serializes across processes and the correct fix is a
// database-level lock (e.g. a Postgres function with SELECT ... FOR UPDATE).
let tail: Promise<unknown> = Promise.resolve();

export function withLock<T>(fn: () => Promise<T>): Promise<T> {
  // queue fn to run after whatever is currently in flight, success or failure
  const result = tail.then(fn, fn);
  // keep the chain alive without leaking rejections into the next waiter
  tail = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}
