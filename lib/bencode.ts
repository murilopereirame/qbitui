/**
 * Minimal bencode decoder, enough to read a .torrent file's metadata.
 *
 * Alongside the decoded value it reports the byte range of every entry in the
 * top-level dictionary, which is what makes it possible to hash the `info`
 * dictionary exactly as it appeared on the wire (re-encoding it could change
 * the bytes, and therefore the info hash).
 */

export type BencodeValue = number | Uint8Array | BencodeValue[] | BencodeDict;

export interface BencodeDict {
  [key: string]: BencodeValue;
}

export interface BencodeDocument {
  value: BencodeValue;
  /** Byte range [start, end) of each top-level dictionary value. */
  spans: Map<string, [number, number]>;
}

const CHAR_i = 0x69; // "i"
const CHAR_l = 0x6c; // "l"
const CHAR_d = 0x64; // "d"
const CHAR_e = 0x65; // "e"
const CHAR_COLON = 0x3a;
const CHAR_MINUS = 0x2d;
const CHAR_0 = 0x30;
const CHAR_9 = 0x39;

class BencodeReader {
  position = 0;

  constructor(private readonly data: Uint8Array) {}

  get atEnd(): boolean {
    return this.position >= this.data.length;
  }

  peek(): number {
    if (this.atEnd) throw new Error("Unexpected end of bencoded data");
    return this.data[this.position];
  }

  readValue(): BencodeValue {
    const marker = this.peek();
    if (marker === CHAR_i) return this.readInteger();
    if (marker === CHAR_l) return this.readList();
    if (marker === CHAR_d) return this.readDict();
    if (marker >= CHAR_0 && marker <= CHAR_9) return this.readBytes();
    throw new Error(`Invalid bencode marker at byte ${this.position}`);
  }

  private readInteger(): number {
    this.position++; // "i"
    let negative = false;
    if (this.peek() === CHAR_MINUS) {
      negative = true;
      this.position++;
    }
    let digits = "";
    while (!this.atEnd && this.peek() !== CHAR_e) {
      digits += String.fromCharCode(this.data[this.position++]);
    }
    this.position++; // "e"
    if (digits.length === 0) throw new Error("Empty bencoded integer");
    const value = Number(digits);
    if (!Number.isFinite(value)) throw new Error("Invalid bencoded integer");
    return negative ? -value : value;
  }

  private readBytes(): Uint8Array {
    let digits = "";
    while (!this.atEnd && this.peek() !== CHAR_COLON) {
      digits += String.fromCharCode(this.data[this.position++]);
    }
    this.position++; // ":"
    const length = Number(digits);
    if (!Number.isInteger(length) || length < 0) throw new Error("Invalid bencoded string length");
    const end = this.position + length;
    if (end > this.data.length) throw new Error("Bencoded string runs past end of data");
    const bytes = this.data.subarray(this.position, end);
    this.position = end;
    return bytes;
  }

  private readList(): BencodeValue[] {
    this.position++; // "l"
    const items: BencodeValue[] = [];
    while (!this.atEnd && this.peek() !== CHAR_e) {
      items.push(this.readValue());
    }
    this.position++; // "e"
    return items;
  }

  readDict(spans?: Map<string, [number, number]>): BencodeDict {
    this.position++; // "d"
    const dict: BencodeDict = {};
    while (!this.atEnd && this.peek() !== CHAR_e) {
      const key = decodeText(this.readBytes());
      const start = this.position;
      dict[key] = this.readValue();
      spans?.set(key, [start, this.position]);
    }
    this.position++; // "e"
    return dict;
  }
}

export function decodeBencode(data: Uint8Array): BencodeDocument {
  const reader = new BencodeReader(data);
  const spans = new Map<string, [number, number]>();
  const value = reader.peek() === CHAR_d ? reader.readDict(spans) : reader.readValue();
  return { value, spans };
}

export function isBencodeDict(value: BencodeValue | undefined): value is BencodeDict {
  return typeof value === "object" && value !== null && !Array.isArray(value) && !(value instanceof Uint8Array);
}

export function decodeText(value: BencodeValue | undefined): string {
  if (!(value instanceof Uint8Array)) return "";
  return new TextDecoder("utf-8", { fatal: false }).decode(value);
}

export function decodeNumber(value: BencodeValue | undefined): number {
  return typeof value === "number" ? value : 0;
}
