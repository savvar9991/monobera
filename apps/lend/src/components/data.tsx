"use client";

import React from "react";
import { usePollReservesDataList } from "@bera/berajs";
import { FormattedNumber } from "@bera/shared-ui";
import { Skeleton } from "@bera/ui/skeleton";

import BGTApy from "./bgt-apy";

export default function Data() {
  const { totalBorrowed, marketSize: totalMarketSize } =
    usePollReservesDataList();
  return (
    <section className="m-auto max-w-[600px] py-24">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <DataCard title="Total Market Size" value={totalMarketSize} />
        <DataCard title="Total borrows" value={totalBorrowed} />
      </div>
      <div className="bg-bg mt-4 flex w-full flex-col items-center gap-4 rounded-sm border border-accent border-opacity-20 py-4">
        <BGTApy />

        <div className="flex flex-col items-center gap-1">
          <div className="text font-semibold leading-7 text-foreground sm:text-xl">
            Honey boosted borrow rates
          </div>
          <div className="text-xs leading-6 text-muted-foreground sm:text-sm">
            Earn BGT by helping the protocol bootstrap Liquidity.
          </div>
        </div>
      </div>
    </section>
  );
}

function DataCard({ title, value }: { title: string; value: number }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-sm border border-border bg-muted p-2">
      <div className="flex items-center gap-3 text-sm">{title}</div>
      {value ? (
        <FormattedNumber
          value={value}
          compact={false}
          compactThreshold={999_999_999_999}
          symbol="USD"
          className="text-2xl font-bold leading-8"
        />
      ) : (
        <Skeleton className="h-8 w-full" />
      )}
    </div>
  );
}
