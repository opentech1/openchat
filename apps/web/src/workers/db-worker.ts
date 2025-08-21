// Database Web Worker
import * as SQLite from 'wa-sqlite';
// @ts-ignore - wa-sqlite types might not be available
import SQLiteESMFactory from 'wa-sqlite/dist/wa-sqlite.mjs';

interface DatabaseOperation {
  type: 'query' | 'run';
  sql: string;
  params: any[];
}

interface WorkerMessage {
  type: string;
  id: string;
  payload?: any;
}

class DatabaseWorker {
  private db: number | null = null;
  private sqlite3: any = null;
  private initialized = false;

  async initialize() {
    if (this.initialized) return;

    try {
      const module = await SQLiteESMFactory();
      this.sqlite3 = SQLite.Factory(module);
      
      // Use OPFS if available, fallback to IndexedDB
      let vfs = 'opfs';
      try {
        await this.sqlite3.vfs_register(vfs);
      } catch {
        vfs = 'idb';
      }

      this.db = await this.sqlite3.open_v2(
        'openchat.db',
        SQLite.SQLITE_OPEN_READWRITE | SQLite.SQLITE_OPEN_CREATE,
        vfs
      );

      await this.createTables();
      this.initialized = true;
      
      this.postMessage({ type: 'INITIALIZED', success: true });
    } catch (error) {
      this.postMessage({ 
        type: 'INITIALIZED', 
        success: false, 
        error: (error as Error).message 
      });
    }
  }

  private async createTables() {
    if (!this.db || !this.sqlite3) return;

    const schemas = [
      `CREATE TABLE IF NOT EXISTS user (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        email_verified INTEGER NOT NULL,
        image TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )`,
      
      `CREATE TABLE IF NOT EXISTS chat (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        user_id TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        is_deleted INTEGER DEFAULT 0,
        FOREIGN KEY (user_id) REFERENCES user(id)
      )`,
      
      `CREATE TABLE IF NOT EXISTS message (
        id TEXT PRIMARY KEY,
        chat_id TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
        content TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        is_deleted INTEGER DEFAULT 0,
        FOREIGN KEY (chat_id) REFERENCES chat(id)
      )`,
      
      `CREATE TABLE IF NOT EXISTS sync_event (
        id TEXT PRIMARY KEY,
        entity_type TEXT NOT NULL CHECK (entity_type IN ('user', 'chat', 'message')),
        entity_id TEXT NOT NULL,
        operation TEXT NOT NULL CHECK (operation IN ('create', 'update', 'delete')),
        data TEXT,
        timestamp INTEGER NOT NULL,
        user_id TEXT NOT NULL,
        device_id TEXT NOT NULL,
        synced INTEGER DEFAULT 0
      )`,
      
      `CREATE TABLE IF NOT EXISTS device (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        fingerprint TEXT NOT NULL UNIQUE,
        last_sync_at INTEGER,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (user_id) REFERENCES user(id)
      )`,
      
      `CREATE TABLE IF NOT EXISTS sync_config (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        mode TEXT NOT NULL DEFAULT 'hybrid' CHECK (mode IN ('local-only', 'cloud-only', 'hybrid')),
        auto_sync INTEGER DEFAULT 1,
        sync_interval INTEGER DEFAULT 30000,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (user_id) REFERENCES user(id)
      )`
    ];

    for (const schema of schemas) {
      this.sqlite3.exec(this.db, schema);
    }

    // Create indexes for better performance
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_chat_user_id ON chat(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_message_chat_id ON message(chat_id)',
      'CREATE INDEX IF NOT EXISTS idx_sync_event_synced ON sync_event(synced)',
      'CREATE INDEX IF NOT EXISTS idx_sync_event_user_id ON sync_event(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_device_user_id ON device(user_id)'
    ];

    for (const index of indexes) {
      this.sqlite3.exec(this.db, index);
    }
  }

  async executeQuery(sql: string, params: any[] = []): Promise<any[]> {
    if (!this.initialized || !this.db || !this.sqlite3) {
      throw new Error('Database not initialized');
    }

    const stmt = this.sqlite3.prepare_v2(this.db, sql);
    const results: any[] = [];
    
    try {
      // Bind parameters
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

      // Execute and collect results
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
  }

  async executeRun(sql: string, params: any[] = []): Promise<{ changes: number; lastInsertRowid: number }> {
    if (!this.initialized || !this.db || !this.sqlite3) {
      throw new Error('Database not initialized');
    }

    const stmt = this.sqlite3.prepare_v2(this.db, sql);
    
    try {
      // Bind parameters
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
      
      this.sqlite3.step(stmt);
      
      return {
        changes: this.sqlite3.changes(this.db),
        lastInsertRowid: this.sqlite3.last_insert_rowid(this.db)
      };
    } finally {
      this.sqlite3.finalize(stmt);
    }
  }

  private postMessage(data: any) {
    if (typeof self !== 'undefined') {
      self.postMessage(data);
    }
  }

  async handleMessage(event: MessageEvent) {
    const { type, payload, id } = event.data;

    try {
      let result;

      switch (type) {
        case 'INITIALIZE':
          await this.initialize();
          return;

        case 'QUERY':
          result = await this.executeQuery(payload.sql, payload.params);
          break;

        case 'RUN':
          result = await this.executeRun(payload.sql, payload.params);
          break;

        case 'EXEC':
          if (this.db && this.sqlite3) {
            this.sqlite3.exec(this.db, payload.sql);
            result = { success: true };
          }
          break;

        case 'TRANSACTION':
          await this.executeTransaction(payload.operations);
          result = { success: true };
          break;

        default:
          throw new Error(`Unknown message type: ${type}`);
      }

      this.postMessage({
        type: `${type}_RESULT`,
        id,
        success: true,
        result
      });

    } catch (error) {
      this.postMessage({
        type: `${type}_RESULT`,
        id,
        success: false,
        error: (error as Error).message
      });
    }
  }

  async executeTransaction(operations: DatabaseOperation[]) {
    if (!this.db || !this.sqlite3) {
      throw new Error('Database not initialized');
    }

    this.sqlite3.exec(this.db, 'BEGIN TRANSACTION');
    
    try {
      for (const op of operations) {
        if (op.type === 'query') {
          await this.executeQuery(op.sql, op.params);
        } else if (op.type === 'run') {
          await this.executeRun(op.sql, op.params);
        }
      }
      this.sqlite3.exec(this.db, 'COMMIT');
    } catch (error) {
      this.sqlite3.exec(this.db, 'ROLLBACK');
      throw error;
    }
  }
}

// Initialize worker
const dbWorker = new DatabaseWorker();

// Listen for messages
if (typeof self !== 'undefined') {
  self.onmessage = (event: MessageEvent) => {
    dbWorker.handleMessage(event);
  };
}

// Auto-initialize
dbWorker.initialize();