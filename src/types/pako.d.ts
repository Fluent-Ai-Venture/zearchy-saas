declare module 'pako' {
  interface DeflateOptions {
    level?: number;
    windowBits?: number;
    memLevel?: number;
    strategy?: number;
    dictionary?: Uint8Array | null;
    raw?: boolean;
    to?: 'string' | undefined;
  }

  interface InflateOptions {
    windowBits?: number;
    raw?: boolean;
    to?: 'string' | undefined;
    dictionary?: Uint8Array | null;
  }

  export function deflate(data: string | Uint8Array, options?: DeflateOptions): Uint8Array;
  export function inflate(data: Uint8Array, options?: InflateOptions): Uint8Array;
  export function gzip(data: string | Uint8Array, options?: DeflateOptions): Uint8Array;
  export function ungzip(data: Uint8Array, options?: InflateOptions): Uint8Array;
  export function deflateRaw(data: string | Uint8Array, options?: DeflateOptions): Uint8Array;
  export function inflateRaw(data: Uint8Array, options?: InflateOptions): Uint8Array;
}
