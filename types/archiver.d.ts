declare module "archiver" {
  interface Archiver {
    pipe<T extends NodeJS.WritableStream>(target: T): T;
    append(
      source: string | Buffer | NodeJS.ReadableStream,
      data?: { name: string }
    ): Archiver;
    directory(dirPath: string, destPath?: string): Archiver;
    finalize(): Promise<void>;
    on(event: string, callback: (...args: unknown[]) => void): Archiver;
  }
  function archiver(format: string, options?: Record<string, unknown>): Archiver;
  export default archiver;
}
