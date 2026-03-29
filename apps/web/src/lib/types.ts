export interface LZChain {
  name: string;
  shortName: string;
  chainKey: string;
  chainType: "EVM" | "SOLANA" | "STARKNET";
  nativeCurrency: {
    chainKey: string;
    address: string;
    decimals: number;
    symbol: string;
    name: string;
  };
}

export interface LZToken {
  isSupported: boolean;
  chainKey: string;
  address: string;
  decimals: number;
  symbol: string;
  name: string;
  logoUrl?: string;
  price?: { usd?: number };
}

export interface LZFee {
  chainKey: string;
  type: "MESSAGE" | "GENERAL" | "DST_NATIVE_DROP" | "CCTP_RECEIVE";
  description: string;
  amount: string;
  address: string;
}

export type UserStepType = "TRANSACTION" | "SIGNATURE";

export interface UserStepTransaction {
  type: "TRANSACTION";
  description: string;
  chainKey: string;
  chainType: "EVM" | "SOLANA" | "STARKNET";
  signerAddress: string;
  transaction: {
    encoded: {
      to: string;
      data: string;
      value?: string;
      from?: string;
      chainId: number;
      gasLimit?: string;
    };
  };
}

export interface UserStepSignature {
  type: "SIGNATURE";
  description: string;
  chainKey: string;
  chainType: "EVM" | "SOLANA" | "STARKNET";
  signerAddress: string;
  signature: {
    type: "EIP712";
    typedData: {
      domain: Record<string, unknown>;
      types: Record<string, unknown>;
      message: Record<string, unknown>;
    };
  };
}

export type UserStep = UserStepTransaction | UserStepSignature;

export interface LZQuote {
  id: string;
  routeSteps: Array<{
    type: string;
    srcChainKey: string;
    description: string;
  }>;
  fees: LZFee[];
  duration: { estimated: string | null };
  feeUsd: string;
  feePercent: string;
  srcAmount: string;
  dstAmount: string;
  dstAmountMin: string;
  srcAmountUsd: string;
  dstAmountUsd: string;
  userSteps: UserStep[];
  options: { dstNativeDropAmount: string };
  expiresAt?: string;
}

export interface QuoteResponse {
  error: null | { message: string };
  quotes: LZQuote[];
  rejectedQuotes: unknown[];
  tokens: LZToken[];
}

export type TransferStatus =
  | "PENDING"
  | "PROCESSING"
  | "SUCCEEDED"
  | "FAILED"
  | "UNKNOWN";

export interface StatusResponse {
  status: TransferStatus;
  explorerUrl?: string;
  executionHistory: Array<{
    event: string;
    transaction: {
      chainKey: string;
      hash: string;
      timestamp: number;
    };
  }>;
}

export interface WalletBalance {
  symbol: string;
  amount: number;
  usdValue: number | null;
}

export interface PayParams {
  toChain: string;
  toToken: string;
  toAddress: string;
  toAmount?: string;
  agentName?: string;
  agentLogo?: string;
  minAmountUSD?: string;
}
