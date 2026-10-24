import type {
  PeriodStatus,
  Role,
  TransactionKind,
  TransactionStatus,
  UploadKind,
  UploadStatus,
} from './domain';

export interface OrganizationRow {
  id: string;
  name: string;
  created_at: string;
}

export interface KitchenRow {
  id: string;
  organization_id: string;
  name: string;
  code: string;
  pj_name: string;
  admin_fee_default: string | number;
  high_amount_threshold: string | number;
  status: 'active' | 'archived';
  created_at: string;
}

export interface KitchenMemberRow {
  kitchen_id: string;
  user_id: string;
  role: Role;
  created_at: string;
}

export interface BankAccountRow {
  id: string;
  kitchen_id: string;
  bank_code: string;
  label: string;
  account_no_enc: string;
  account_no_hash: string;
  account_no_last4: string;
  kind: 'operasional' | 'va';
  created_at: string;
}

export interface PeriodRow {
  id: string;
  kitchen_id: string;
  year: number;
  month: number;
  opening_balance: string | number;
  status: PeriodStatus;
  locked_at: string | null;
  locked_by: string | null;
  reopen_reason: string | null;
  created_at: string;
}

export interface UploadRow {
  id: string;
  kitchen_id: string;
  period_id: string | null;
  kind: UploadKind;
  storage_path: string;
  original_name: string;
  mime: 'application/pdf' | 'image/jpeg' | 'image/png';
  size_bytes: number;
  sha256: string;
  status: UploadStatus;
  parser_used: string | null;
  parse_result: Record<string, unknown> | null;
  consistency_flags: string[];
  suggested_kitchen_id: string | null;
  uploaded_by: string;
  created_at: string;
}

export interface CounterpartyRuleRow {
  id: string;
  organization_id: string;
  match_account_no_hash: string;
  counterparty_name: string | null;
  counterparty_bank: string | null;
  description_template: string;
  category_id: string | null;
  times_used: number;
  last_used_at: string;
}

export interface TransactionRow {
  id: string;
  kitchen_id: string;
  period_id: string;
  parent_transaction_id: string | null;
  seq_no: number;
  tx_date: string;
  kind: TransactionKind;
  reference_no: string | null;
  description: string;
  counterparty_account_no_enc: string | null;
  counterparty_account_last4: string | null;
  counterparty_name: string | null;
  counterparty_bank: string | null;
  debit: string | number;
  credit: string | number;
  note: string | null;
  category_id: string | null;
  source_upload_id: string | null;
  status: TransactionStatus;
  version: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface AuditLogRow {
  id: string;
  kitchen_id: string;
  actor_id: string | null;
  action: string;
  entity: string;
  entity_id: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  created_at: string;
}
