import { useMemo } from "react";
import {
  OrderDirection,
  ProposalStatus,
  Proposal_Filter,
  Proposal_OrderBy,
} from "@bera/graphql/governance";
import { orderBy } from "lodash";
import useSwrInfinite, { SWRInfiniteResponse } from "swr/infinite";

import { getAllProposals } from "~/actions/governance";
import { useBeraJs } from "~/contexts";
import POLLING from "~/enum/polling";
import { DefaultHookOptions } from "~/types";

const DEFAULT_PER_PAGE = 20;

const fromUiStatusToSubgraphStatuses = (
  status: ProposalStatus,
): ProposalStatus[] => {
  switch (status) {
    case ProposalStatus.QuorumNotReached:
      return [ProposalStatus.Active, ProposalStatus.Pending];

    case ProposalStatus.PendingQueue:
    case ProposalStatus.Defeated:
      return [ProposalStatus.Active];

    case ProposalStatus.PendingExecution:
      return [ProposalStatus.InQueue];

    default:
      return [status];
  }
};
type UsePollAllProposalsArgs = {
  topic: string;
  where?: Proposal_Filter;
  perPage?: number;
  orderBy?: Proposal_OrderBy;
  orderDirection?: OrderDirection;
  status_in?: ProposalStatus[];
  text?: string;
};
export const usePollAllProposals = (
  args: UsePollAllProposalsArgs,
  options?: DefaultHookOptions,
): SWRInfiniteResponse<Awaited<ReturnType<typeof getAllProposals>>> & {
  hasMore: boolean;
} => {
  const { config: beraConfig } = useBeraJs();
  const config = options?.beraConfigOverride ?? beraConfig;

  const res = useSwrInfinite<
    Awaited<ReturnType<typeof getAllProposals>>,
    typeof usePollAllProposalsQueryKey
  >(
    usePollAllProposalsQueryKey(args.topic, args),
    async ([key, page]: [string, number]) => {
      const statuses = args.status_in
        ?.flatMap((status) => fromUiStatusToSubgraphStatuses(status))
        .filter((s, i, arr) => arr.indexOf(s) === i);
      return await getAllProposals({
        where: {
          topics_contains: [args.topic],
          status_in: statuses?.length ? statuses : undefined,
          ...args.where,
        },
        orderBy: args.orderBy,
        orderDirection: args.orderDirection,
        config,
        text: args.text,
        offset: page * (args.perPage ?? DEFAULT_PER_PAGE),
      });
    },
    {
      ...options?.opts,
      initialSize: 2,
      refreshInterval: options?.opts?.refreshInterval ?? POLLING.SLOW,
    },
  );

  const data = useMemo(() => {
    return res.data
      ?.flat()
      .filter((proposal) => {
        if (!proposal) {
          return false;
        }

        if (!args.status_in || args.status_in.length === 0) {
          return true;
        }

        return args.status_in?.includes(proposal.status);
      })
      .sort((a, b) => {
        // fulltext search does not support order in graphql.
        // no need to compute this if there is no search
        if (!args.text) {
          return 0;
        }

        let result = 0;
        if (args.orderBy === Proposal_OrderBy.CreatedAt) {
          result = Number(b?.createdAt) - Number(a?.createdAt);
        }
        return args.orderDirection === "asc" ? result : -result;
      })
      .reduce<typeof res.data>((acc, curr) => {
        if (!curr) {
          return acc;
        }

        const currSection = acc.at(-1);

        if (
          !currSection ||
          currSection?.length === (args.perPage ?? DEFAULT_PER_PAGE)
        ) {
          return [...acc, [curr]];
        }

        currSection.push(curr);

        return acc;
      }, []);
  }, [res.data, args]);

  return {
    ...res,
    data,
    hasMore: data?.at(-1)?.length === (args.perPage ?? DEFAULT_PER_PAGE),
  };
};

export const usePollAllProposalsQueryKey =
  (
    topic: string,
    {
      orderBy,
      orderDirection,
      where,
      perPage,
      text,
      status_in,
    }: Partial<UsePollAllProposalsArgs> = {},
  ) =>
  (page: number, previousPageData?: any): [string, number, ...any[]] | null => {
    if (!previousPageData && page !== 0) {
      return null;
    }

    return [
      "usePollAllProposals",
      page,
      topic,
      where,
      status_in
        ?.flatMap((status) => fromUiStatusToSubgraphStatuses(status))
        .filter((s, i, arr) => arr.indexOf(s) === i),
      orderBy,
      orderDirection,
      perPage,
      text,
    ];
  };
