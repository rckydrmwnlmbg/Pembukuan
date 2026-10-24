import { kitchenRoute } from '@/server/http/kitchen-route';
import {
  CreateTransactionBodySchema,
  LedgerQuerySchema,
} from '@/lib/schemas/transaction';
import { defaultLedgerStore } from '@/server/ledger/service';

function serializeRow(
  row: {
    id: string;
    kitchenId?: string;
    periodId?: string;
    parentTransactionId?: string | null;
    seqNo: number;
    txDate: string;
    kind: string;
    referenceNo: string | null;
    description: string;
    counterpartyAccount?: string | null;
    counterpartyAccountLast4?: string | null;
    counterpartyName?: string | null;
    counterpartyBank?: string | null;
    debit: bigint;
    credit: bigint;
    runningBalance: bigint;
    note?: string | null;
    status: string;
    version?: number;
  },
  rowNo: number,
) {
  return {
    ...row,
    rowNo,
    debit: row.debit.toString(),
    credit: row.credit.toString(),
    runningBalance: row.runningBalance.toString(),
    version: row.version ?? 1,
  };
}

export const GET = kitchenRoute(
  ['admin', 'maker', 'approver', 'viewer'],
  LedgerQuerySchema,
  async ({ kitchenId, input }) => {
    const result = defaultLedgerStore.getKitchenLedger(kitchenId, {
      periodId: input.periodId,
      q: input.q,
      status: input.status,
    });

    return Response.json({
      kitchenId,
      periodId: result.kitchen.periodId,
      periodStatus: result.kitchen.periodStatus,
      summary: {
        openingBalance: result.summary.openingBalance.toString(),
        totalIncoming: result.summary.totalIncoming.toString(),
        totalOutgoing: result.summary.totalOutgoing.toString(),
        closingBalance: result.summary.closingBalance.toString(),
        incomingCount: result.summary.incomingCount,
        outgoingCount: result.summary.outgoingCount,
      },
      rows: result.filteredRows.map((row, idx) => serializeRow(row, idx + 1)),
    });
  },
);

export const POST = kitchenRoute(
  ['admin', 'maker'],
  CreateTransactionBodySchema,
  async ({ kitchenId, user, input }) => {
    const result = defaultLedgerStore.createTransaction(
      kitchenId,
      user.id,
      input,
    );

    return Response.json(
      {
        created: result.created.map((row, idx) => serializeRow(row, idx + 1)),
        summary: {
          openingBalance: result.summary.openingBalance.toString(),
          totalIncoming: result.summary.totalIncoming.toString(),
          totalOutgoing: result.summary.totalOutgoing.toString(),
          closingBalance: result.summary.closingBalance.toString(),
          incomingCount: result.summary.incomingCount,
          outgoingCount: result.summary.outgoingCount,
        },
      },
      { status: 201 },
    );
  },
);
