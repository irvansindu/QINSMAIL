declare module 'better-sqlite3' {
  export type RunResult = { lastInsertRowid: number };
  export type Statement = {
    run: (...args: unknown[]) => RunResult;
    all: (...args: unknown[]) => unknown[];
    get: (...args: unknown[]) => unknown;
  };
  export interface Database {
    pragma(sql: string): void;
    exec(sql: string): void;
    prepare(sql: string): Statement;
  }
  const DatabaseCtor: {
    new (file: string): Database;
  };
  export default DatabaseCtor;
}
