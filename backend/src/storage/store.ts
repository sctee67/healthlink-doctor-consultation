import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import type { Consultation, Doctor, IdempotencyRecord, Patient } from '../domain/models.js';

export interface DbSchema {
  doctors: Doctor[];
  patients: Patient[];
  consultations: Consultation[];
  idempotency: IdempotencyRecord[];
}

/**
 * The whole dataset lives in memory; `persist()` flushes it.
 * Repositories mutate synchronously, so check-then-insert sequences in a
 * service are atomic with respect to other requests (single event loop).
 */
export interface Store {
  readonly db: DbSchema;
  persist(): Promise<void>;
}

export class MemoryStore implements Store {
  constructor(readonly db: DbSchema) {}
  async persist(): Promise<void> {}
}

export class JsonFileStore implements Store {
  private queue: Promise<void> = Promise.resolve();

  private constructor(
    readonly db: DbSchema,
    private readonly file: string,
  ) {}

  static open(file: string, seed: () => DbSchema): JsonFileStore {
    let db: DbSchema;
    if (fs.existsSync(file)) {
      db = JSON.parse(fs.readFileSync(file, 'utf8')) as DbSchema;
    } else {
      db = seed();
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, JSON.stringify(db, null, 2));
    }
    return new JsonFileStore(db, file);
  }

  /** Writes are serialized and atomic (temp file + rename) so a crash never leaves a torn file. */
  persist(): Promise<void> {
    const snapshot = JSON.stringify(this.db, null, 2);
    const tmp = `${this.file}.tmp`;
    this.queue = this.queue
      .catch(() => undefined)
      .then(async () => {
        await fsp.writeFile(tmp, snapshot);
        await fsp.rename(tmp, this.file);
      });
    return this.queue;
  }
}
