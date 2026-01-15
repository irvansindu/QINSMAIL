// No content

declare module 'mailparser' {
  import { AddressObject, Attachment } from 'mailparser';
  export interface ParsedMail {
    from?: AddressObject | null;
    to?: AddressObject | null;
    cc?: AddressObject | null;
    bcc?: AddressObject | null;
    subject?: string;
    date?: Date;
    text?: string;
    html?: string | boolean;
    attachments?: Attachment[];
  }
  export function simpleParser(source: Buffer | string): Promise<ParsedMail>;
}
