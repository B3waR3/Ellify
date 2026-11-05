declare module 'sql.js' {
  export interface SqlJsStatic {
    Database: new (data?: ArrayLike<number> | Buffer | null) => Database
  }

  export interface Database {
    run(sql: string, params?: unknown[]): void
    prepare(sql: string): Statement
    export(): Uint8Array
  }

  export interface Statement {
    bind(params?: unknown[]): boolean
    step(): boolean
    getAsObject(): Record<string, unknown>
    free(): void
  }

  export default function initSqlJs(config?: {
    locateFile?: (file: string) => string
  }): Promise<SqlJsStatic>
}

declare module 'pdf-parse' {
  function pdfParse(data: Buffer): Promise<{ text: string }>
  export = pdfParse
}
