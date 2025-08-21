import * as SQLite from 'wa-sqlite';
import SQLiteESMFactory from 'wa-sqlite/dist/wa-sqlite.mjs';
import { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';

interface WASQLiteDatabase {
  exec(sql: string): void;
  run(sql: string, ...params: any[]): { changes: number; lastInsertRowid: number };
  all(sql: string, ...params: any[]): any[];
  get(sql: string, ...params: any[]): any;
  close(): void;
}

class WASQLiteAdapter {
  private db: WASQLiteDatabase | null = null;
  private sqlite3: any = null;

  async initialize(filename: string = 'openchat.db'): Promise<void> {
    const module = await SQLiteESMFactory();
    this.sqlite3 = SQLite.Factory(module);
    
    // Use OPFS if available, fallback to IndexedDB
    let vfs: string;
    try {
      vfs = 'opfs';
      await this.sqlite3.vfs_register(vfs);
    } catch {
      vfs = 'idb';
    }

    const db = await this.sqlite3.open_v2(
      filename,
      SQLite.SQLITE_OPEN_READWRITE | SQLite.SQLITE_OPEN_CREATE,
      vfs
    );

    this.db = {
      exec: (sql: string) => {
        this.sqlite3.exec(db, sql);
      },
      
      run: (sql: string, ...params: any[]) => {
        const stmt = this.sqlite3.prepare_v2(db, sql);
        try {
          if (params.length > 0) {
            params.forEach((param, index) => {
              if (typeof param === 'string') {
                this.sqlite3.bind_text(stmt, index + 1, param);
              } else if (typeof param === 'number') {
                this.sqlite3.bind_double(stmt, index + 1, param);
              } else if (param === null || param === undefined) {
                this.sqlite3.bind_null(stmt, index + 1);
              } else {
                this.sqlite3.bind_text(stmt, index + 1, JSON.stringify(param));
              }
            });
          }
          
          const result = this.sqlite3.step(stmt);
          return {
            changes: this.sqlite3.changes(db),
            lastInsertRowid: this.sqlite3.last_insert_rowid(db)
          };
        } finally {
          this.sqlite3.finalize(stmt);
        }
      },

      all: (sql: string, ...params: any[]) => {
        const stmt = this.sqlite3.prepare_v2(db, sql);
        const results: any[] = [];
        
        try {
          if (params.length > 0) {
            params.forEach((param, index) => {
              if (typeof param === 'string') {
                this.sqlite3.bind_text(stmt, index + 1, param);
              } else if (typeof param === 'number') {
                this.sqlite3.bind_double(stmt, index + 1, param);
              } else if (param === null || param === undefined) {
                this.sqlite3.bind_null(stmt, index + 1);
              } else {
                this.sqlite3.bind_text(stmt, index + 1, JSON.stringify(param));
              }
            });
          }

          while (this.sqlite3.step(stmt) === SQLite.SQLITE_ROW) {
            const row: any = {};
            const columnCount = this.sqlite3.column_count(stmt);
            
            for (let i = 0; i < columnCount; i++) {
              const name = this.sqlite3.column_name(stmt, i);
              const type = this.sqlite3.column_type(stmt, i);
              
              switch (type) {
                case SQLite.SQLITE_INTEGER:
                  row[name] = this.sqlite3.column_int64(stmt, i);
                  break;
                case SQLite.SQLITE_FLOAT:
                  row[name] = this.sqlite3.column_double(stmt, i);
                  break;
                case SQLite.SQLITE_TEXT:
                  row[name] = this.sqlite3.column_text(stmt, i);
                  break;
                case SQLite.SQLITE_BLOB:
                  row[name] = this.sqlite3.column_blob(stmt, i);
                  break;
                case SQLite.SQLITE_NULL:
                  row[name] = null;
                  break;
              }
            }
            results.push(row);
          }
          
          return results;
        } finally {
          this.sqlite3.finalize(stmt);
        }
      },

      get: (sql: string, ...params: any[]) => {
        const results = this.db!.all(sql, ...params);
        return results.length > 0 ? results[0] : undefined;
      },

      close: () => {
        if (this.db && this.sqlite3) {
          this.sqlite3.close(db);
        }
      }
    };
  }

  getDatabase(): WASQLiteDatabase {
    if (!this.db) {
      throw new Error('Database not initialized. Call initialize() first.');
    }
    return this.db;
  }
}

// Create a Drizzle-compatible interface
export class DrizzleWASQLite extends BaseSQLiteDatabase<'sync', void> {
  private adapter: WASQLiteAdapter;

  constructor() {
    super('sync', undefined, undefined);
    this.adapter = new WASQLiteAdapter();
  }

  async initialize(filename?: string): Promise<void> {
    await this.adapter.initialize(filename);
  }

  async query(sql: string, params: unknown[] = []): Promise<any[]> {
    const db = this.adapter.getDatabase();
    return db.all(sql, ...params);
  }

  async run(sql: string, params: unknown[] = []): Promise<{ changes: number; lastInsertRowid: number }> {
    const db = this.adapter.getDatabase();
    return db.run(sql, ...params);
  }

  async get(sql: string, params: unknown[] = []): Promise<any> {
    const db = this.adapter.getDatabase();
    return db.get(sql, ...params);
  }

  async exec(sql: string): Promise<void> {
    const db = this.adapter.getDatabase();
    db.exec(sql);
  }

  close(): void {
    this.adapter.getDatabase().close();
  }
}

export { WASQLiteAdapter };