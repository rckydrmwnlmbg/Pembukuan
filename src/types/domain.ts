export type Role = 'admin' | 'maker' | 'approver' | 'viewer';

export type PeriodStatus = 'open' | 'locked';

export type UploadKind = 'transfer_proof';

export type UploadStatus =
  | 'uploaded'
  | 'parsed'
  | 'needs_manual'
  | 'failed'
  | 'posted';

export type TransactionKind = 'incoming' | 'outgoing' | 'admin_fee';

export type TransactionStatus = 'posted' | 'void';

/**
 * Kontrak hasil ekstraksi bukti transfer (TECH-STACK.md Bagian 4 & SECURITY.md S-14).
 * Nominal disimpan sebagai string digit agar tidak pernah melewati float, lalu diubah ke bigint.
 */
export interface ExtractedTransferProof {
  txDate: string | null; // 'YYYY-MM-DD'
  referenceNo: string | null;
  amount: string | null; // digit rupiah pokok transfer tanpa pemisah (OI-06)
  senderAccount: string | null;
  recipientAccount: string | null;
  recipientName: string | null;
  recipientBank: string | null;
  memo: string | null;
  rawText: string | null; // transkripsi internal; dilarang dicatat di log
  confidence: Record<string, number>; // 0..1 per field
}
