import React from 'react';
import { PeriodEquation } from './PeriodEquation';

export interface PeriodBalanceStripProps {
  kitchenId?: string;
  periodLabel?: string;
  periodStatus: 'open' | 'locked';
  openingBalance: bigint;
  totalDebit: bigint;
  totalCredit: bigint;
  closingBalance: bigint;
  compact?: boolean;
  draftCount?: number;
  incomingCount?: number;
  outgoingCount?: number;
}

/**
 * Strip persamaan saldo periode satu dapur (`DESIGN.md` §8.1).
 * Mengdelegasikan tampilan ke komponen resmi `PeriodEquation`.
 */
export function PeriodBalanceStrip({
  kitchenId = '',
  periodStatus,
  openingBalance,
  totalDebit,
  totalCredit,
  closingBalance,
  compact = false,
  draftCount = 0,
  incomingCount = 0,
  outgoingCount = 0,
}: PeriodBalanceStripProps) {
  return (
    <PeriodEquation
      kitchenId={kitchenId}
      periodStatus={periodStatus}
      openingBalance={openingBalance}
      totalIncoming={totalDebit}
      totalOutgoing={totalCredit}
      closingBalance={closingBalance}
      incomingCount={incomingCount}
      outgoingCount={outgoingCount}
      draftCount={draftCount}
      variant={compact ? 'compact' : 'full'}
    />
  );
}
