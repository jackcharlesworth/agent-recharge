"use client";

import { useState, useEffect, useCallback } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useSendTransaction, useSignTypedData, useSwitchChain } from "wagmi";
import { parseUnits } from "viem";
import Image from "next/image";
import type {
  LZToken,
  LZQuote,
  UserStepTransaction,
  UserStepSignature,
  TransferStatus,
  PayParams,
  WalletBalance,
} from "@/lib/types";
import { LZ_CHAIN_KEY_TO_ID, CHAIN_ID_TO_LZ_KEY } from "@/lib/wagmi";

// ── Constants ──────────────────────────────────────────────────────────────

const PRIORITY_SYMBOLS = ["USDC", "USDT", "WETH", "ETH", "WBTC"];

const CHAIN_NAMES: Record<string, string> = {
  ethereum: "Ethereum",
  base: "Base",
  arbitrum: "Arbitrum",
  optimism: "Optimism",
  polygon: "Polygon",
  bsc: "BNB Chain",
  avalanche: "Avalanche",
  linea: "Linea",
  scroll: "Scroll",
  "zksync-era": "zkSync Era",
  mantle: "Mantle",
};

const KNOWN_TOKEN_SYMBOLS: Record<string, string> = {
  "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913": "USDC",
  "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48": "USDC",
  "0xaf88d065e77c8cc2239327c5edb3a432268e5831": "USDC",
  "0x0b2c639c533813f4aa9d7837caf62653d097ff85": "USDC",
  "0x3c499c542cef5e3811e1192ce70d8cc03d5c3359": "USDC",
  "0xdac17f958d2ee523a2206206994597c13d831ec7": "USDT",
  "0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9": "USDT",
  "0x94b008aa00579c1307b0ef2c499ad98a8ce58e58": "USDT",
  "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2": "WETH",
  "0x82af49447d8a07e3bd95bd0d56f35241523fbab1": "WETH",
  "0x4200000000000000000000000000000000000006": "WETH",
  "0x7ceb23fd6bc0add59e62ac25578270cff1b9f619": "WETH",
};

function getDstTokenSymbol(address: string): string {
  return KNOWN_TOKEN_SYMBOLS[address.toLowerCase()] ?? "Token";
}

function sortAndFilterTokens(tokens: LZToken[]): LZToken[] {
  const priority = tokens.filter(
    (t) => t.isSupported && PRIORITY_SYMBOLS.includes(t.symbol)
  );
  return [...priority].sort((a, b) => {
    const ai = PRIORITY_SYMBOLS.indexOf(a.symbol);
    const bi = PRIORITY_SYMBOLS.indexOf(b.symbol);
    if (ai !== -1 && bi !== -1) return ai - bi;
    if (ai !== -1) return -1;
    if (bi !== -1) return 1;
    return a.symbol.localeCompare(b.symbol);
  });
}

type Step =
  | "idle"
  | "fetching-tokens"
  | "ready"
  | "fetching-quote"
  | "quoted"
  | "executing"
  | "polling"
  | "success"
  | "error";

// ── Component ──────────────────────────────────────────────────────────────

export function PayUI({ params }: { params: PayParams }) {
  const { address, chainId } = useAccount();
  const { sendTransactionAsync } = useSendTransaction();
  const { signTypedDataAsync } = useSignTypedData();
  const { switchChainAsync } = useSwitchChain();

  const [step, setStep] = useState<Step>("idle");
  const [srcTokens, setSrcTokens] = useState<LZToken[]>([]);
  const [selectedToken, setSelectedToken] = useState<LZToken | null>(null);
  const [amount, setAmount] = useState(params.toAmount ?? "");
  const [quote, setQuote] = useState<LZQuote | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [transferStatus, setTransferStatus] = useState<TransferStatus | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [balances, setBalances] = useState<WalletBalance[]>([]);
  const [totalUsd, setTotalUsd] = useState<number | null>(null);
  const [balancesLoading, setBalancesLoading] = useState(true);

  const srcChainKey = chainId ? CHAIN_ID_TO_LZ_KEY[chainId] : undefined;
  const srcChainName = srcChainKey ? (CHAIN_NAMES[srcChainKey] ?? srcChainKey) : null;
  const dstChainLabel = CHAIN_NAMES[params.toChain] ?? params.toChain;
  const dstTokenSymbol = getDstTokenSymbol(params.toToken);
  const isZeroAddress = params.toAddress === "0x0000000000000000000000000000000000000000";
  const shortAddress = params.toAddress
    ? `${params.toAddress.slice(0, 6)}…${params.toAddress.slice(-4)}`
    : "—";

  // Fetch agent wallet balances
  useEffect(() => {
    if (!params.toAddress || isZeroAddress) {
      setBalancesLoading(false);
      return;
    }
    setBalancesLoading(true);
    fetch(`/api/balances?address=${params.toAddress}&chainKey=${params.toChain}`)
      .then((r) => r.json())
      .then((data: { balances?: WalletBalance[]; totalUsd?: number }) => {
        setBalances(data.balances ?? []);
        setTotalUsd(typeof data.totalUsd === "number" ? data.totalUsd : null);
      })
      .catch(() => {/* non-critical */})
      .finally(() => setBalancesLoading(false));
  }, [params.toAddress, params.toChain, isZeroAddress]);

  // Fetch source tokens when connected chain changes
  useEffect(() => {
    if (!srcChainKey) return;
    setStep("fetching-tokens");
    setSelectedToken(null);
    setQuote(null);
    fetch(`/api/tokens?transferrableFromChainKey=${srcChainKey}`)
      .then((r) => r.json())
      .then((data: { tokens?: LZToken[] }) => {
        const tokens = (data.tokens ?? []).filter(
          (t: LZToken) => t.isSupported && t.chainKey === srcChainKey
        );
        setSrcTokens(sortAndFilterTokens(tokens));
        setStep("ready");
      })
      .catch(() => {
        setErrorMsg("Failed to load tokens for this chain.");
        setStep("error");
      });
  }, [srcChainKey]);

  const fetchQuote = useCallback(async () => {
    if (!address || !srcChainKey || !selectedToken || !amount) return;
    setStep("fetching-quote");
    setErrorMsg(null);
    const amountRaw = parseUnits(amount, selectedToken.decimals).toString();
    try {
      const res = await fetch("/api/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          srcChainKey,
          dstChainKey: params.toChain,
          srcTokenAddress: selectedToken.address,
          dstTokenAddress: params.toToken,
          srcWalletAddress: address,
          dstWalletAddress: params.toAddress,
          amount: amountRaw,
        }),
      });
      const data = await res.json() as { error?: { message?: string }; message?: string; quotes?: LZQuote[] };
      if (!res.ok || data.error) {
        setErrorMsg(data.error?.message ?? data.message ?? `Quote failed (HTTP ${res.status}).`);
        setStep("error");
        return;
      }
      const best = data.quotes?.[0];
      if (!best) {
        setErrorMsg("No route found for this transfer.");
        setStep("error");
        return;
      }
      setQuote(best);
      setStep("quoted");
    } catch {
      setErrorMsg("Network error fetching quote.");
      setStep("error");
    }
  }, [address, srcChainKey, selectedToken, amount, params]);

  const executeTransfer = useCallback(async () => {
    if (!quote || !address || !srcChainKey) return;
    setStep("executing");
    setErrorMsg(null);
    const targetChainId = LZ_CHAIN_KEY_TO_ID[srcChainKey];
    if (chainId !== targetChainId && targetChainId) {
      try {
        await switchChainAsync({ chainId: targetChainId });
      } catch {
        setErrorMsg("Please switch your wallet to the source chain.");
        setStep("quoted");
        return;
      }
    }
    let lastTxHash: string | null = null;
    try {
      for (const userStep of quote.userSteps) {
        if (userStep.type === "TRANSACTION") {
          const s = userStep as UserStepTransaction;
          const { to, data, value, gasLimit } = s.transaction.encoded;
          const hash = await sendTransactionAsync({
            to: to as `0x${string}`,
            data: data as `0x${string}`,
            value: value ? BigInt(value) : undefined,
            gas: gasLimit ? BigInt(gasLimit) : undefined,
          });
          lastTxHash = hash;
        } else if (userStep.type === "SIGNATURE") {
          const s = userStep as UserStepSignature;
          const { domain, types, message } = s.signature.typedData;
          const coercedMessage = Object.fromEntries(
            Object.entries(message as Record<string, unknown>).map(([k, v]) => [
              k,
              typeof v === "string" && /^\d+$/.test(v) ? BigInt(v) : v,
            ])
          );
          const signature = await signTypedDataAsync({
            domain: domain as Parameters<typeof signTypedDataAsync>[0]["domain"],
            types: types as Parameters<typeof signTypedDataAsync>[0]["types"],
            primaryType: Object.keys(types as object).find((k) => k !== "EIP712Domain") ?? "",
            message: coercedMessage,
          });
          await fetch("/api/submit-signature", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ quoteId: quote.id, signatures: signature }),
          });
        }
      }
      setTxHash(lastTxHash);
      setStep("polling");
      pollStatus(quote.id, lastTxHash);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Transaction failed.";
      setErrorMsg(msg.toLowerCase().includes("user rejected") ? "Transaction rejected." : msg);
      setStep("quoted");
    }
  }, [quote, address, srcChainKey, chainId, sendTransactionAsync, signTypedDataAsync, switchChainAsync]);

  function pollStatus(quoteId: string, hash: string | null) {
    const interval = setInterval(async () => {
      try {
        const url = `/api/status/${quoteId}${hash ? `?txHash=${hash}` : ""}`;
        const res = await fetch(url);
        const data = await res.json() as { status: TransferStatus };
        const status = data.status;
        setTransferStatus(status);
        if (status === "SUCCEEDED" || status === "FAILED") {
          clearInterval(interval);
          setStep(status === "SUCCEEDED" ? "success" : "error");
          if (status === "FAILED") setErrorMsg("Transfer failed on-chain.");
        }
      } catch {/* keep polling */}
    }, 5000);
  }

  function fmtUsd(val: string | number) {
    const n = typeof val === "string" ? parseFloat(val) : val;
    return isNaN(n) ? "—" : `$${n.toFixed(2)}`;
  }

  function fmtDuration(ms: string | null) {
    if (!ms) return "~1 min";
    const s = Math.round(parseInt(ms) / 1000);
    return s < 60 ? `~${s}s` : `~${Math.round(s / 60)}min`;
  }

  const canGetQuote =
    !!address && !!srcChainKey && !!selectedToken && !!amount && parseFloat(amount) > 0;
  const amountUsdEst =
    selectedToken?.price?.usd && amount ? parseFloat(amount) * selectedToken.price.usd : null;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4 md:p-8">
      <div className="w-full max-w-[820px]">

        {/* Page header */}
        <div className="mb-5">
          <h1 className="text-[28px] font-normal text-[#f5f5f5] leading-[32px] tracking-[-0.56px]">
            {params.agentName ? `Feed ${params.agentName}` : "Feed Your Agent"}
          </h1>
          <p className="text-[14px] text-[#797979] mt-1 leading-[20px]">
            Add {dstTokenSymbol} to {params.agentName ? `${params.agentName}'s` : "this agent's"} wallet on {dstChainLabel}
          </p>
        </div>

        {/* Two-panel container */}
        <div className="border border-[#2b2b2b] grid md:grid-cols-[280px_1fr]">

          {/* ── LEFT PANEL ── */}
          <div className="bg-[#171717] p-6 space-y-5 border-b border-[#2b2b2b] md:border-b-0 md:border-r">

            {/* Agent identity */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 flex-shrink-0 overflow-hidden bg-[#1c1c1c] border border-[#2b2b2b] flex items-center justify-center">
                {params.agentLogo ? (
                  <Image
                    src={params.agentLogo}
                    alt={params.agentName ?? "Agent"}
                    width={40}
                    height={40}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-[#5c5c5c] text-base">⚡</span>
                )}
              </div>
              <div>
                <p className="text-[16px] font-normal text-[#f5f5f5] leading-[24px]">
                  {params.agentName ?? "AI Agent"}
                </p>
                <p className="text-[12px] text-[#797979] leading-[16px]">{dstChainLabel}</p>
              </div>
            </div>

            <div className="border-t border-[#2b2b2b]" />

            {/* Destination address */}
            <div>
              <p className="text-[11px] font-mono uppercase tracking-[0.5px] text-[#5c5c5c] mb-2">
                Destination
              </p>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => navigator.clipboard.writeText(params.toAddress)}
                  title="Copy address"
                  className="flex items-center gap-1.5 text-[12px] font-mono text-[#a3a3a3] hover:text-[#f5f5f5] transition-colors"
                >
                  {shortAddress}
                  <svg className="w-3 h-3 text-[#5c5c5c]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </button>
                <span className="inline-flex items-center gap-1 text-[11px] font-mono text-brand bg-brand-8p border border-brand-25p rounded-full px-2.5 py-0.5">
                  <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                  </svg>
                  locked
                </span>
              </div>
            </div>

            <div className="border-t border-[#2b2b2b]" />

            {/* Total balance */}
            {balancesLoading ? (
              <div className="space-y-1">
                <div className="h-8 w-28 bg-[#2b2b2b] animate-pulse" />
                <div className="h-3.5 w-20 bg-[#2b2b2b] animate-pulse mt-1.5" />
              </div>
            ) : (
              <div>
                <p className="text-[32px] font-normal text-[#f5f5f5] leading-[36px] tracking-[-0.64px]">
                  {totalUsd !== null && totalUsd > 0
                    ? fmtUsd(totalUsd)
                    : isZeroAddress
                    ? "—"
                    : "$0.00"}
                </p>
                <p className="text-[12px] text-[#5c5c5c] mt-1">Total balance</p>
              </div>
            )}

            {/* Token list */}
            <div>
              <p className="text-[11px] font-mono uppercase tracking-[0.5px] text-[#5c5c5c] mb-3">
                Balances
              </p>
              {balancesLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-[#2b2b2b] animate-pulse" />
                        <div className="w-12 h-3 bg-[#2b2b2b] animate-pulse" />
                      </div>
                      <div className="w-14 h-3 bg-[#2b2b2b] animate-pulse" />
                    </div>
                  ))}
                </div>
              ) : balances.length === 0 ? (
                <p className="text-[12px] text-[#5c5c5c]">No balances found</p>
              ) : (
                <div className="space-y-3">
                  {balances.map((b) => (
                    <div key={b.symbol} className="flex justify-between items-center">
                      <div className="flex items-center gap-2.5">
                        <div className="w-6 h-6 rounded-full bg-brand-8p border border-brand-25p flex items-center justify-center flex-shrink-0">
                          <span className="text-[9px] font-mono text-brand uppercase leading-none">
                            {b.symbol.slice(0, 2)}
                          </span>
                        </div>
                        <span className="text-[13px] text-[#a3a3a3]">{b.symbol}</span>
                      </div>
                      <span className="text-[13px] font-mono text-[#f5f5f5]">
                        {b.usdValue !== null ? fmtUsd(b.usdValue) : b.amount.toFixed(4)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── RIGHT PANEL ── */}
          <div className="bg-[#171717] p-6 space-y-4">

            {/* Panel header */}
            <div className="flex items-center justify-between">
              <h2 className="text-[16px] font-normal text-[#f5f5f5]">Exchange</h2>
              {address && (
                <ConnectButton showBalance={false} accountStatus="address" chainStatus="none" />
              )}
            </div>

            {/* FROM */}
            <div>
              <p className="text-[11px] font-mono uppercase tracking-[0.5px] text-[#5c5c5c] mb-2">From</p>
              <div className="bg-[#1c1c1c] border border-[#2b2b2b] p-4">
                {!address ? (
                  <div className="flex items-center justify-center py-3">
                    <ConnectButton />
                  </div>
                ) : !srcChainKey ? (
                  <p className="text-[13px] text-[#f1df38] text-center py-2">
                    Switch to a supported chain
                  </p>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-brand flex-shrink-0" />
                      <span className="text-[13px] text-[#a3a3a3]">{srcChainName}</span>
                    </div>
                    {step === "fetching-tokens" ? (
                      <div className="h-8 bg-[#2b2b2b] animate-pulse" />
                    ) : (
                      <select
                        value={selectedToken?.address ?? ""}
                        onChange={(e) => {
                          const tok = srcTokens.find((t) => t.address === e.target.value) ?? null;
                          setSelectedToken(tok);
                          setQuote(null);
                          if (step === "quoted" || step === "error") setStep("ready");
                        }}
                        style={{ borderRadius: 0 }}
                        className="w-full bg-[#2b2b2b] border border-[#404040] px-3 py-2 text-[13px] text-[#f5f5f5] focus:outline-none focus:border-brand cursor-pointer appearance-none transition-colors"
                      >
                        <option value="" disabled className="bg-[#1c1c1c]">
                          Select token
                        </option>
                        {srcTokens.map((t) => (
                          <option key={t.address} value={t.address} className="bg-[#1c1c1c]">
                            {t.symbol}
                            {t.price?.usd ? ` — $${t.price.usd.toFixed(2)}` : ""}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Down arrow */}
            <div className="flex justify-center">
              <div className="w-8 h-8 bg-[#1c1c1c] border border-[#2b2b2b] flex items-center justify-center">
                <svg className="w-3.5 h-3.5 text-[#5c5c5c]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
              </div>
            </div>

            {/* TO */}
            <div>
              <p className="text-[11px] font-mono uppercase tracking-[0.5px] text-[#5c5c5c] mb-2">To</p>
              <div className="bg-[#1c1c1c] border border-[#2b2b2b] p-4 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-brand-8p border border-brand-25p flex items-center justify-center flex-shrink-0">
                  <span className="text-[11px] font-mono text-brand leading-none">
                    {dstTokenSymbol.slice(0, 2)}
                  </span>
                </div>
                <div>
                  <p className="text-[14px] text-[#f5f5f5] leading-[20px]">{dstTokenSymbol}</p>
                  <p className="text-[12px] text-[#797979]">{dstChainLabel}</p>
                </div>
                <span className="ml-auto inline-flex items-center gap-1 text-[11px] font-mono text-brand bg-brand-8p border border-brand-25p rounded-full px-2.5 py-0.5 flex-shrink-0">
                  <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                  </svg>
                  locked
                </span>
              </div>
            </div>

            {/* SEND (amount input) */}
            {address && (
              <div>
                <p className="text-[11px] font-mono uppercase tracking-[0.5px] text-[#5c5c5c] mb-2">Send</p>
                <div className="bg-[#1c1c1c] border border-[#2b2b2b] p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#2b2b2b] flex items-center justify-center flex-shrink-0">
                      <span className="text-[11px] font-mono text-[#797979] leading-none">
                        {selectedToken?.symbol.slice(0, 2) ?? "—"}
                      </span>
                    </div>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={amount}
                      onChange={(e) => {
                        setAmount(e.target.value);
                        setQuote(null);
                        if (step === "quoted" || step === "error") setStep("ready");
                      }}
                      placeholder="0"
                      style={{ borderRadius: 0 }}
                      className="flex-1 bg-transparent text-[28px] font-normal text-[#f5f5f5] placeholder-[#2b2b2b] focus:outline-none min-w-0 leading-none tracking-[-0.56px]"
                    />
                    {selectedToken && (
                      <span className="text-[13px] font-mono text-[#797979] flex-shrink-0">
                        {selectedToken.symbol}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between mt-2 pl-11">
                    <span className="text-[12px] text-[#5c5c5c]">
                      {amountUsdEst ? fmtUsd(amountUsdEst) : "$0.00"}
                    </span>
                    {params.minAmountUSD && (
                      <span className="text-[11px] text-[#5c5c5c]">
                        Min ${params.minAmountUSD}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* SEND TO WALLET */}
            {address && (
              <div>
                <p className="text-[11px] font-mono uppercase tracking-[0.5px] text-[#5c5c5c] mb-2">
                  Send to wallet <span className="text-brand">*</span>
                </p>
                <div className="bg-[#1c1c1c] border border-[#2b2b2b] p-4 flex items-center gap-3">
                  <div className="w-8 h-8 bg-[#2b2b2b] flex items-center justify-center flex-shrink-0">
                    <span className="text-[#5c5c5c] text-sm">⚡</span>
                  </div>
                  <div>
                    <p className="text-[14px] text-[#f5f5f5] leading-[20px]">
                      {params.agentName ?? "AI Agent"}
                    </p>
                    <p className="text-[12px] font-mono text-[#797979]">{shortAddress}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Quote breakdown */}
            {quote && step === "quoted" && (
              <div className="bg-brand-8p border border-brand-25p p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-[12px] text-[#797979]">Agent receives</span>
                  <span className="text-[12px] text-[#f5f5f5]">{fmtUsd(quote.dstAmountUsd)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[12px] text-[#797979]">Bridge fee</span>
                  <span className="text-[12px] text-[#a3a3a3]">{fmtUsd(quote.feeUsd)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[12px] text-[#797979]">Estimated time</span>
                  <span className="text-[12px] text-[#a3a3a3]">
                    {fmtDuration(quote.duration.estimated)}
                  </span>
                </div>
              </div>
            )}

            {/* Polling status */}
            {step === "polling" && (
              <div className="bg-[#1c1c1c] border border-[#2b2b2b] p-4 flex items-center gap-3">
                <Spinner />
                <div>
                  <p className="text-[13px] text-[#a3a3a3]">
                    {transferStatus === "PROCESSING"
                      ? "Processing transfer…"
                      : "Awaiting confirmation…"}
                  </p>
                  {txHash && (
                    <p className="text-[11px] font-mono text-[#5c5c5c] mt-0.5">
                      {txHash.slice(0, 10)}…{txHash.slice(-8)}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Success */}
            {step === "success" && (
              <div className="bg-[#141b12] border border-[#293f22] p-4 text-center">
                <p className="text-[14px] text-[#8ae06c]">Transfer complete</p>
                <p className="text-[12px] text-[#5c5c5c] mt-1">
                  Funds have arrived at {shortAddress}
                </p>
              </div>
            )}

            {/* Error */}
            {errorMsg && step === "error" && (
              <div className="bg-[#1d1111] border border-[#442121] p-3">
                <p className="text-[12px] text-[#f56868]">{errorMsg}</p>
              </div>
            )}

            {/* CTA button */}
            {step !== "success" && step !== "polling" && address && (
              <ActionButton
                step={step}
                canGetQuote={canGetQuote}
                canSend={!!quote && step === "quoted"}
                onGetQuote={fetchQuote}
                onSend={executeTransfer}
                onRetry={() => {
                  setErrorMsg(null);
                  setStep("ready");
                  setQuote(null);
                }}
              />
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-4 pt-4 border-t border-[#2b2b2b] flex items-center justify-between">
          <span className="text-[11px] font-mono uppercase tracking-[0.5px] text-[#5c5c5c]">
            Agent Recharge
          </span>
          <a
            href="https://layerzero.network"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] font-mono uppercase tracking-[0.5px] text-[#5c5c5c] hover:text-[#a3a3a3] transition-colors"
          >
            Powered by LayerZero
          </a>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function ActionButton({
  step,
  canGetQuote,
  canSend,
  onGetQuote,
  onSend,
  onRetry,
}: {
  step: Step;
  canGetQuote: boolean;
  canSend: boolean;
  onGetQuote: () => void;
  onSend: () => void;
  onRetry: () => void;
}) {
  const base = "w-full py-3.5 text-[14px] font-normal transition-colors tracking-[0.2px]";

  if (step === "error") {
    return (
      <button
        onClick={onRetry}
        style={{ borderRadius: 0 }}
        className={`${base} bg-[#2b2b2b] hover:bg-[#404040] text-[#a3a3a3]`}
      >
        Try again
      </button>
    );
  }

  if (step === "fetching-quote") {
    return (
      <button
        disabled
        style={{ borderRadius: 0 }}
        className={`${base} bg-[#2b2b2b] text-[#5c5c5c] flex items-center justify-center gap-2 cursor-not-allowed`}
      >
        <Spinner /> Getting quote…
      </button>
    );
  }

  if (step === "executing") {
    return (
      <button
        disabled
        style={{ borderRadius: 0 }}
        className={`${base} bg-[#2b2b2b] text-[#5c5c5c] flex items-center justify-center gap-2 cursor-not-allowed`}
      >
        <Spinner /> Confirm in wallet…
      </button>
    );
  }

  if (canSend) {
    return (
      <button
        onClick={onSend}
        style={{ borderRadius: 0 }}
        className={`${base} bg-[#fcfcfc] hover:bg-[#e5e5e5] text-[#0a0a0a]`}
      >
        Exchange
      </button>
    );
  }

  return (
    <button
      onClick={onGetQuote}
      disabled={!canGetQuote}
      style={{ borderRadius: 0 }}
      className={`${base} bg-[#fcfcfc] hover:bg-[#e5e5e5] text-[#0a0a0a] disabled:bg-[#2b2b2b] disabled:text-[#5c5c5c] disabled:cursor-not-allowed`}
    >
      Preview transfer
    </button>
  );
}

function Spinner() {
  return (
    <svg
      className="animate-spin h-4 w-4 flex-shrink-0"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
  );
}
