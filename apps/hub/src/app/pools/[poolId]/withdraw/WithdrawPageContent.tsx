"use client";

import { useEffect, useState } from "react";
import {
  TokenBalance,
  TransactionActionType,
  formatUsd,
  useBeraJs,
} from "@bera/berajs";
import {
  beraTokenAddress,
  cloudinaryUrl,
  gasTokenName,
  nativeTokenAddress,
} from "@bera/config";
import {
  ActionButton,
  FormattedNumber,
  PreviewToken,
  TokenIcon,
  TokenList,
  TxnPreview,
  useSlippage,
  useTxn,
} from "@bera/shared-ui";

import {
  RemoveLiquidityKind,
  vaultV2Abi,
} from "@berachain-foundation/berancer-sdk";
import { cn } from "@bera/ui";
import { Button } from "@bera/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@bera/ui/card";
import { Icons } from "@bera/ui/icons";
import { Slider } from "@bera/ui/slider";

import { Skeleton } from "@bera/ui/skeleton";
import { usePoolUserPosition } from "~/b-sdk/usePoolUserPosition";
import { useRemoveLiquidity } from "./useWithdrawLiquidity";
import { Address, formatEther, parseEther } from "viem";
import { getPoolUrl } from "../../fetchPools";
import { BigNumber } from "bignumber.js";
import { RadioGroup, RadioGroupItem } from "@bera/ui/radio-group";
import { Label } from "@bera/ui/label";
import { WithdrawLiquidityDetails } from "./WithdrawLiquidityDetails";
import { Checkbox } from "@bera/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "@bera/ui/alert";
import Link from "next/link";
import { nativeToken } from "~/b-sdk/b-sdk";
import { usePool } from "~/b-sdk/usePool";
import { SubgraphPoolFragment } from "@bera/graphql/dex/subgraph";
interface ITokenSummary {
  title: string;
  pool: SubgraphPoolFragment | undefined;
  tokenBalances?: TokenBalance[];
  isLoading: boolean;
}

const TokenSummary = ({
  title,
  pool,
  tokenBalances,
  isLoading,
}: ITokenSummary) => {
  return (
    <div className="flex w-full flex-col items-center justify-center gap-3 rounded-lg border border-border p-6">
      <p className="w-full text-left text-lg font-semibold">{title}</p>
      {pool?.tokens
        ?.filter((t) => t.address !== pool.address)
        .map((token, idx) => {
          return (
            <div
              key={token.address}
              className="flex w-full flex-row items-center justify-between"
            >
              <p className="text-sm text-muted-foreground">
                Pooled {isLoading ? "..." : token?.symbol}
              </p>
              <div className="flex flex-row items-center gap-1 font-medium">
                {isLoading ? (
                  "..."
                ) : tokenBalances?.at(token.index ?? idx)?.formattedBalance ? (
                  <FormattedNumber
                    value={
                      tokenBalances.at(token.index ?? idx)!.formattedBalance
                    }
                    symbol={token?.symbol}
                  />
                ) : (
                  "0"
                )}
                <TokenIcon address={token?.address} symbol={token?.symbol} />
              </div>
            </div>
          );
        })}
    </div>
  );
};

export default function WithdrawLiquidityContent({
  poolId,
}: {
  poolId: string;
}) {
  const { isConnected } = useBeraJs();

  const { data, isLoading: isPoolLoading } = usePool({ poolId: poolId });
  const [pool, v3Pool] = data ?? [];

  const reset = () => {
    setPreviewOpen(false);
    setPercentage(0);
  };

  const [previewOpen, setPreviewOpen] = useState(false);
  const [percentage, setPercentage] = useState<number>(0);

  const slippage = useSlippage();

  const {
    data: userPositionBreakdown,
    isLoading: isPositionBreakdownLoading,
    refresh,
  } = usePoolUserPosition({ pool: pool });

  const {
    queryOutput,
    error,
    isLoading: isWithdrawLoading,
    getCallData,
    setBptIn,
    kind,
    setKind,
    priceImpact,
    tokenOut,
    setTokenOut,
    wethIsEth,
    setWethIsEth,
  } = useRemoveLiquidity({
    pool: v3Pool,
  });

  const isLoading = isPoolLoading || isWithdrawLoading;

  const { write, ModalPortal } = useTxn({
    message: `Withdraw liquidity from ${pool?.name}`,
    onSuccess: () => {
      reset();
      refresh();
    },
    actionType: TransactionActionType.WITHDRAW_LIQUIDITY,
  });

  const notDeposited =
    userPositionBreakdown === undefined ||
    userPositionBreakdown?.lpBalance?.balance === 0n;

  useEffect(() => {
    if (!userPositionBreakdown?.lpBalance) {
      return;
    }
    if (percentage === 100) setBptIn(userPositionBreakdown.lpBalance.balance);
    const share = BigNumber(
      userPositionBreakdown?.lpBalance?.formattedBalance,
    ).times(percentage / 100);

    setBptIn(parseEther(share.toFixed(18)));
  }, [v3Pool, userPositionBreakdown, percentage]);

  useEffect(() => {
    console.log({ queryOutput });
  }, [queryOutput]);

  const kinds: {
    kind: RemoveLiquidityKind;
    title: string;
    description: string;
  }[] = [
    {
      kind: RemoveLiquidityKind.Proportional,
      title: "Proportional",
      description: "Withdraw tokens proportionally",
    },
    {
      kind: RemoveLiquidityKind.SingleTokenExactIn,
      title: "Single Token",
      description: "Select a single token to withdraw into",
    },
  ];

  return (
    <div className="mt-16 flex w-full flex-col items-center justify-center gap-4">
      {ModalPortal}
      <Card className="mx-6 w-full items-center bg-background p-4 sm:mx-0 sm:w-[480px] flex flex-col">
        {!pool && isPoolLoading ? (
          <Skeleton className="h-8 w-40 self-center" />
        ) : (
          <p className="text-center text-2xl font-semibold">{pool?.name}</p>
        )}
        <div className="flex w-full flex-row items-center justify-center rounded-lg p-4">
          {!pool && isPoolLoading ? (
            <Skeleton className="h-12 w-24" />
          ) : (
            pool?.tokens
              ?.filter((t) => t.address !== pool.address)
              .map((token, i) => {
                return (
                  <TokenIcon
                    address={token.address}
                    symbol={token.symbol}
                    className={cn("h-12 w-12", i !== 0 && "ml-[-16px]")}
                    key={token.address}
                  />
                );
              })
          )}
        </div>
        <Link
          href={pool ? getPoolUrl(pool) : "#"}
          className="flex items-center justify-center text-sm font-normal leading-tight text-muted-foreground hover:cursor-pointer hover:underline"
        >
          View Pool Details
          <Icons.arrowRight className="w-4 h-4" />
        </Link>
      </Card>
      <Card className="mx-6 w-full sm:w-[480px] md:mx-0 ">
        <CardHeader>
          <CardTitle className="center flex justify-between font-bold">
            Withdraw Liquidity
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4 w-full">
            {kinds.map((item) => (
              <Card
                onClick={() => setKind(item.kind)}
                className={cn(
                  "flex w-full cursor-pointer flex-col gap-0 border border-border p-4",
                  item.kind === kind && "border-info-foreground ",
                )}
              >
                <span className="text-lg font-semibold">{item.title}</span>
                <span className="text-sm text-muted-foreground">
                  {item.description}
                </span>
              </Card>
            ))}
          </div>
          <RadioGroup
            value={tokenOut}
            defaultValue={v3Pool?.tokens.at(0)?.address}
            onValueChange={(value) => setTokenOut(value as Address)}
            className="grid grid-cols-1 gap-2"
          >
            {pool?.tokens
              ?.filter((t) => t.address !== pool.address)
              .map((token) => (
                <div
                  className="flex items-center gap-3 font-medium"
                  key={token.index}
                >
                  {kind === RemoveLiquidityKind.Proportional ? (
                    <div className="flex items-center justify-between w-full gap-2">
                      <span className="flex gap-2 items-center">
                        <TokenIcon
                          address={
                            wethIsEth &&
                            token.address === beraTokenAddress.toLowerCase()
                              ? nativeTokenAddress
                              : token.symbol
                          }
                          symbol={
                            wethIsEth &&
                            token.address === beraTokenAddress.toLowerCase()
                              ? nativeToken.symbol?.toUpperCase()
                              : token.symbol
                          }
                        />
                        <FormattedNumber
                          value={formatEther(
                            queryOutput?.amountsOut.at(token.index ?? -1)
                              ?.scale18 ?? 0n,
                          )}
                          symbol={
                            wethIsEth &&
                            token.address === beraTokenAddress.toLowerCase()
                              ? nativeToken.symbol?.toUpperCase()
                              : token.symbol
                          }
                        />
                      </span>
                      <span className="text-muted-foreground">
                        {token.token.latestUSDPrice
                          ? formatUsd(
                              Number(
                                formatEther(
                                  queryOutput?.amountsOut.at(token.index ?? -1)
                                    ?.scale18 ?? 0n,
                                ),
                              ) * token.token.latestUSDPrice,
                            )
                          : null}
                      </span>
                    </div>
                  ) : (
                    <>
                      <div
                        className={cn(
                          "w-4 h-4 border border-foreground rounded-full flex items-center justify-center",
                          tokenOut !== token.address && "opacity-50",
                        )}
                      >
                        <RadioGroupItem
                          id={`${token.address}-radio`}
                          value={token.address}
                          className="w-3 h-3 aria-checked:bg-foreground rounded-full"
                        />
                      </div>
                      <Label
                        htmlFor={`${token.address}-radio`}
                        className="text-sm font-semibold flex gap-1 items-center cursor-pointer"
                      >
                        <TokenIcon
                          address={token.address}
                          symbol={token.symbol}
                        />
                        <span>{token.symbol}</span>
                      </Label>
                    </>
                  )}
                </div>
              ))}
          </RadioGroup>
          <div className="w-full rounded-lg border p-4">
            <div className="flex w-full flex-row items-center justify-between gap-1">
              <p className="text-sm font-semibold sm:text-lg">
                {percentage.toFixed(2)}%
              </p>
              <div className="flex flex-row gap-2">
                {[25, 50, 75, 100].map((percent) => {
                  return (
                    <Button
                      key={percent.toString()}
                      variant={"secondary"}
                      disabled={notDeposited}
                      size={"sm"}
                      className="w-full text-foreground"
                      onClick={() => setPercentage(percent)}
                    >
                      {percent.toString()}%
                    </Button>
                  );
                })}
              </div>
            </div>
            <Slider
              defaultValue={[0]}
              value={[percentage]}
              disabled={notDeposited}
              max={100}
              min={0}
              onValueChange={(value: number[]) => {
                setPercentage(value[0] ?? 0);
              }}
            />
          </div>
          {kind === RemoveLiquidityKind.SingleTokenExactIn && (
            <div>
              <h3 className="text-muted-foreground font-semibold text-sm mb-4">
                Receive
              </h3>

              {v3Pool?.tokens
                .filter((tk) => tk.address === tokenOut?.toLowerCase())
                .map((tk) => {
                  const amount = queryOutput?.amountsOut.find(
                    (t) => t.token.address === tk.address,
                  );

                  const isWrappedBera =
                    tk.address === beraTokenAddress.toLowerCase();

                  const tokenUSDPrice = pool?.tokens?.find(
                    (t) => t.address === tk.address.toLowerCase(),
                  )?.token.latestUSDPrice;

                  const amountUSD =
                    Number(formatEther(amount?.scale18 ?? 0n)) * tokenUSDPrice;

                  return (
                    <div className="flex justify-between items-center">
                      <div className="flex flex-row items-center text-sm gap-2 text-foreground font-medium">
                        <TokenIcon
                          address={
                            isWrappedBera && wethIsEth
                              ? nativeTokenAddress
                              : tk.address
                          }
                        />
                        {isWithdrawLoading ? (
                          <Skeleton className="w-3 h-4" />
                        ) : (
                          <FormattedNumber
                            value={formatEther(amount?.scale18 ?? 0n)}
                            symbol={
                              isWrappedBera && wethIsEth
                                ? gasTokenName.toUpperCase()
                                : tk.symbol
                            }
                          />
                        )}
                      </div>
                      <div className="text-muted-foreground">
                        {amountUSD ? (
                          <FormattedNumber value={amountUSD} symbol={"USD"} />
                        ) : (
                          <span />
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
          <WithdrawLiquidityDetails
            exchangeRate={"Price impact"}
            priceImpact={priceImpact}
          />
          {(tokenOut === beraTokenAddress.toLowerCase() ||
            queryOutput?.amountsOut.find(
              (t) => t.token.wrapped === beraTokenAddress.toLowerCase(),
            )?.amount) && (
            <div className="flex flex-row items-center gap-2 text-sm">
              <Checkbox
                id="weth-is-eth"
                checked={wethIsEth}
                onClick={() => setWethIsEth((t) => !t)}
              />
              <Label
                htmlFor="weth-is-eth"
                className="text-sm text-muted-foreground"
              >
                Withdraw as native BERA
              </Label>
            </div>
          )}
          {error && (
            <Alert variant="destructive">
              <AlertTitle>
                <Icons.tooltip className="mt-[-4px] inline h-4 w-4" /> Error
              </AlertTitle>
              <AlertDescription className="text-xs">
                {error.balanceError
                  ? `Balancer error ${error.balanceError}`
                  : error.message}
              </AlertDescription>
            </Alert>
          )}
          <TxnPreview
            open={previewOpen}
            title={"Confirm LP Withdrawal Details"}
            imgURI={`${cloudinaryUrl}/placeholder/preview-swap-img_ucrnla`}
            triggerText={"Preview"}
            setOpen={setPreviewOpen}
            disabled={
              isLoading ||
              !!error ||
              percentage === 0 ||
              isPositionBreakdownLoading ||
              userPositionBreakdown === undefined
            }
          >
            <TokenList className="divide-muted bg-muted">
              {pool?.tokens
                ?.filter((t) => t.address !== pool.address.toLowerCase())
                .map((token) => (
                  <PreviewToken
                    key={token.address}
                    // @ts-ignore
                    token={
                      wethIsEth &&
                      token.address === beraTokenAddress.toLowerCase()
                        ? {
                            ...nativeToken,
                            symbol: nativeToken.symbol?.toUpperCase(),
                          }
                        : token
                    }
                    // price={token.token.latestUSDPrice}
                    value={formatEther(
                      queryOutput?.amountsOut.at(token.index ?? -1)?.scale18 ??
                        0n,
                    )}
                  />
                ))}
            </TokenList>
            <ActionButton>
              <Button
                className="w-full"
                onClick={() => {
                  const data = getCallData(slippage ?? 1);

                  write({
                    address: data.to,
                    abi: vaultV2Abi,
                    params: data.args!,
                    functionName: "exitPool",
                    value: data.value,
                  });
                }}
              >
                Withdraw Liquidity
              </Button>
            </ActionButton>
          </TxnPreview>
        </CardContent>
      </Card>
      {isConnected ? (
        <div className="sm:w-[480px] mx-auto">
          <TokenSummary
            pool={pool}
            tokenBalances={userPositionBreakdown?.tokenBalances}
            title="Your Tokens In the Pool"
            isLoading={isPositionBreakdownLoading}
          />
        </div>
      ) : null}
    </div>
  );
}
