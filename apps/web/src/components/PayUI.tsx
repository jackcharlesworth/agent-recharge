"use client";

import { useState, useEffect, useCallback } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import {
  useAccount,
  useSendTransaction,
  useSignTypedData,
  useSwitchChain,
} from "wagmi";
import { parseUnits, formatUnits } from "viem";
import type {
  LZToken,
  LZQuote,
  UserStepTransaction,
  UserStepSignature,
  TransferStatus,
  PayParams,
} from "@/lib/types";
import { LZ_CHAIN_KEY_TO_ID, CHAIN_ID_TO_LZ_KEY } from "@/lib/wagmi";
import Image from "next/image";

// Popular stablecoin/token symbols to show first in the list
const PRIORITY_SYMBOLS = ["USDC", "USDT", "WETH", "ETH", "WBTC"];

function sortTokens(tokens: LZToken[]): LZToken[] {
  return [...tokens].sort((a, b) => {
    const ai = PRIORITY_SYMBOLS.indexOf(a.symbol);
    const bi = PRIORITY_SYMBOLS.indexOf(b.symbol);
    if (ai !== -1 && bi !== -1) return ai - bi;
    if (ai !== -1) return -1;
    if (bi !== -1) return 1;
    return a.symbol.localeCompare(b.symbol);
  });
}

interface Props {
  params: PayParams;
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

export function PayUI({ params }: Props) {
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

  // Derive the current LZ chain key from connected wallet chain
  const srcChainKey = chainId ? CHAIN_ID_TO_LZ_KEY[chainId] : undefined;

  // Fetch available source tokens when chain changes
  useEffect(() => {
    if (!srcChainKey) return;
    setStep("fetching-tokens");
    setSelectedToken(null);
    setQuote(null);

    fetch(`/api/tokens?transferrableFromChainKey=${srcChainKey}`)
      .then((r) => r.json())
      .then((data) => {
        const tokens: LZToken[] = (data.tokens ?? []).filter(
          (t: LZToken) => t.isSupported
        );
        setSrcTokens(sortTokens(tokens));
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

    const amountInSmallestUnits = parseUnits(amount, selectedToken.decimals).toString();

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
          amount: amountInSmallestUnits,
        }),
      });
      const data = await res.json();

      if (!res.ok || data.error) {
        const msg =
          data.error?.message ??
          data.message ??
          `Quote failed (HTTP ${res.status}).`;
        setErrorMsg(msg);
        setStep("error");
        return;
      }

      const best: LZQuote = data.quotes?.[0];
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

    // Ensure wallet is on the right chain
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

          // Numeric fields in AORI messages must be BigInt
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
      if (msg.includes("User rejected") || msg.includes("user rejected")) {
        setErrorMsg("Transaction rejected.");
      } else {
        setErrorMsg(msg);
      }
      setStep("quoted");
    }
  }, [quote, address, srcChainKey, chainId, sendTransactionAsync, signTypedDataAsync, switchChainAsync]);

  function pollStatus(quoteId: string, hash: string | null) {
    const interval = setInterval(async () => {
      try {
        const url = `/api/status/${quoteId}${hash ? `?txHash=${hash}` : ""}`;
        const res = await fetch(url);
        const data = await res.json();
        const status: TransferStatus = data.status;

        setTransferStatus(status);

        if (status === "SUCCEEDED" || status === "FAILED") {
          clearInterval(interval);
          setStep(status === "SUCCEEDED" ? "success" : "error");
          if (status === "FAILED") setErrorMsg("Transfer failed on-chain.");
        }
      } catch {
        // keep polling
      }
    }, 5000);
  }

  // ── Destination info ──────────────────────────────────────────────────────

  const dstChainLabel = params.toChain.charAt(0).toUpperCase() + params.toChain.slice(1);
  const shortAddress = params.toAddress
    ? `${params.toAddress.slice(0, 6)}…${params.toAddress.slice(-4)}`
    : "";

  // ── Quote display helpers ─────────────────────────────────────────────────

  function fmtUsd(val: string) {
    const n = parseFloat(val);
    return isNaN(n) ? "—" : `$${n.toFixed(2)}`;
  }

  function fmtDuration(ms: string | null) {
    if (!ms) return "~1 min";
    const s = Math.round(parseInt(ms) / 1000);
    return s < 60 ? `~${s}s` : `~${Math.round(s / 60)}min`;
  }

  function fmtDstAmount(quote: LZQuote) {
    // Find the dst token decimals from the response
    const tok = quote.userSteps[0] as UserStepTransaction | undefined;
    if (!tok) return quote.dstAmount;
    try {
      return formatUnits(BigInt(quote.dstAmount), 6); // USDC default
    } catch {
      return quote.dstAmount;
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          {params.agentLogo && (
            <div className="mx-auto mb-4 w-16 h-16 rounded-full overflow-hidden border border-white/10">
              <Image
                src={params.agentLogo}
                alt={params.agentName ?? "Agent"}
                width={64}
                height={64}
                className="w-full h-full object-cover"
              />
            </div>
          )}
          <h1 className="text-2xl font-semibold text-white">
            {params.agentName ? `Fund ${params.agentName}` : "Fund Agent"}
          </h1>
          <p className="text-sm text-white/50 mt-1">
            Send from any chain — arrives on {dstChainLabel}
          </p>
        </div>

        {/* Card */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-5">
          {/* Destination locked info */}
          <div className="bg-white/5 rounded-xl p-4 space-y-1">
            <p className="text-xs text-white/40 uppercase tracking-wide">Destination</p>
            <p className="text-sm text-white font-mono">{shortAddress}</p>
            <p className="text-xs text-white/50">on {dstChainLabel}</p>
          </div>

          {/* Wallet connect */}
          <div className="flex justify-center">
            <ConnectButton />
          </div>

          {address && (
            <>
              {/* Amount input */}
              <div>
                <label className="block text-xs text-white/40 uppercase tracking-wide mb-2">
                  Amount
                </label>
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
                  placeholder="0.00"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-brand"
                />
                {params.minAmountUSD && (
                  <p className="text-xs text-white/40 mt-1">
                    Min ${params.minAmountUSD} USD
                  </p>
                )}
              </div>

              {/* Source token selector */}
              {step === "fetching-tokens" && (
                <p className="text-sm text-white/40 text-center">Loading tokens…</p>
              )}
              {srcTokens.length > 0 && (
                <div>
                  <label className="block text-xs text-white/40 uppercase tracking-wide mb-2">
                    Pay with
                  </label>
                  <select
                    value={selectedToken?.address ?? ""}
                    onChange={(e) => {
                      const tok = srcTokens.find((t) => t.address === e.target.value) ?? null;
                      setSelectedToken(tok);
                      setQuote(null);
                      if (step === "quoted" || step === "error") setStep("ready");
                    }}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-brand appearance-none"
                  >
                    <option value="" disabled>
                      Select token
                    </option>
                    {srcTokens.map((t) => (
                      <option key={t.address} value={t.address}>
                        {t.symbol}
                        {t.price?.usd ? ` — $${t.price.usd.toFixed(2)}` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Quote display */}
              {quote && step === "quoted" && (
                <div className="bg-brand/10 border border-brand/30 rounded-xl p-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-white/50">You send</span>
                    <span className="text-white">{fmtUsd(quote.srcAmountUsd)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/50">Agent receives</span>
                    <span className="text-white">{fmtUsd(quote.dstAmountUsd)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/50">Bridge fee</span>
                    <span className="text-white">{fmtUsd(quote.feeUsd)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/50">Estimated time</span>
                    <span className="text-white">
                      {fmtDuration(quote.duration.estimated)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/50">Route</span>
                    <span className="text-white/80 text-xs">
                      {quote.routeSteps.map((s) => s.type).join(" → ")}
                    </span>
                  </div>
                </div>
              )}

              {/* Status display */}
              {step === "polling" && (
                <div className="text-center py-2 space-y-1">
                  <div className="inline-flex items-center gap-2 text-white/60">
                    <Spinner />
                    <span className="text-sm">
                      {transferStatus === "PROCESSING" ? "Processing…" : "Waiting for confirmation…"}
                    </span>
                  </div>
                  {txHash && (
                    <p className="text-xs text-white/30 font-mono">
                      {txHash.slice(0, 10)}…{txHash.slice(-8)}
                    </p>
                  )}
                </div>
              )}

              {step === "success" && (
                <div className="text-center py-2 space-y-1">
                  <p className="text-green-400 font-medium">Transfer complete</p>
                  <p className="text-xs text-white/40">
                    Funds have arrived at {shortAddress}
                  </p>
                </div>
              )}

              {errorMsg && step === "error" && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-sm text-red-400">
                  {errorMsg}
                </div>
              )}

              {/* CTA button */}
              {step !== "success" && step !== "polling" && (
                <ActionButton
                  step={step}
                  canGetQuote={!!selectedToken && !!amount && parseFloat(amount) > 0}
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
            </>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-white/20 mt-6">
          Powered by{" "}
          <a
            href="https://layerzero.network"
            target="_blank"
            rel="noopener noreferrer"
            className="text-white/40 hover:text-white/60 transition-colors"
          >
            LayerZero
          </a>
        </p>
      </div>
    </div>
  );
}

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
  if (step === "error") {
    return (
      <button
        onClick={onRetry}
        className="w-full py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium transition-colors"
      >
        Try again
      </button>
    );
  }

  if (step === "fetching-quote") {
    return (
      <button
        disabled
        className="w-full py-3 rounded-xl bg-brand/50 text-white font-medium flex items-center justify-center gap-2"
      >
        <Spinner /> Getting quote…
      </button>
    );
  }

  if (step === "executing") {
    return (
      <button
        disabled
        className="w-full py-3 rounded-xl bg-brand/50 text-white font-medium flex items-center justify-center gap-2"
      >
        <Spinner /> Confirm in wallet…
      </button>
    );
  }

  if (canSend) {
    return (
      <button
        onClick={onSend}
        className="w-full py-3 rounded-xl bg-brand hover:bg-brand-dark text-white font-medium transition-colors"
      >
        Send
      </button>
    );
  }

  return (
    <button
      onClick={onGetQuote}
      disabled={!canGetQuote}
      className="w-full py-3 rounded-xl bg-brand hover:bg-brand-dark disabled:opacity-30 disabled:cursor-not-allowed text-white font-medium transition-colors"
    >
      Get quote
    </button>
  );
}

function Spinner() {
  return (
    <svg
      className="animate-spin h-4 w-4"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v8H4z"
      />
    </svg>
  );
}
