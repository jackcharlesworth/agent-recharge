export interface RechargeParams {
  /** Destination chain key (LayerZero string ID, e.g. "base", "arbitrum", "ethereum") */
  toChain: string;
  /** Destination token contract address */
  toToken: string;
  /** Agent's wallet address to receive funds */
  toAddress: string;
  /** Requested amount of destination token (human-readable, e.g. 50 for 50 USDC) */
  toAmount?: number | string;
  /** Display name for the agent shown in the payment UI */
  agentName?: string;
  /** URL of an image/logo shown in the payment UI */
  agentLogo?: string;
  /** Minimum USD value required for the transfer */
  minAmountUSD?: number;
}

// TODO: Update this to your deployed Vercel URL before publishing
const BASE_URL = "https://agent-recharge.vercel.app/pay";

/**
 * Build a payment URL that lets anyone fund an AI agent wallet across any chain.
 * The destination (chain, token, address) is locked in the UI — the payer
 * chooses only their source chain and token.
 *
 * @example
 * const url = recharge({
 *   toChain: "base",
 *   toToken: USDC["base"],
 *   toAddress: "0xYourAgentWallet",
 *   agentName: "TradingBot",
 *   toAmount: 50,
 * });
 */
export function recharge(params: RechargeParams, baseUrl = BASE_URL): string {
  const url = new URL(baseUrl);

  url.searchParams.set("toChain", params.toChain);
  url.searchParams.set("toToken", params.toToken);
  url.searchParams.set("toAddress", params.toAddress);

  if (params.toAmount !== undefined) {
    url.searchParams.set("toAmount", String(params.toAmount));
  }
  if (params.agentName !== undefined) {
    url.searchParams.set("agentName", params.agentName);
  }
  if (params.agentLogo !== undefined) {
    url.searchParams.set("agentLogo", params.agentLogo);
  }
  if (params.minAmountUSD !== undefined) {
    url.searchParams.set("minAmountUSD", String(params.minAmountUSD));
  }

  return url.toString();
}

/**
 * Common USDC addresses by LayerZero chain key.
 * These are the canonical USDC (or USDC.e) addresses for each chain.
 */
export const USDC: Record<string, string> = {
  ethereum: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  base: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  arbitrum: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
  optimism: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
  polygon: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
  avalanche: "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E",
  bsc: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d",
  solana: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
};

/**
 * Common USDT addresses by LayerZero chain key.
 */
export const USDT: Record<string, string> = {
  ethereum: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
  base: "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2",
  arbitrum: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
  optimism: "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58",
  polygon: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
  bsc: "0x55d398326f99059fF775485246999027B3197955",
};

/**
 * Common WETH addresses by LayerZero chain key.
 */
export const WETH: Record<string, string> = {
  ethereum: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
  base: "0x4200000000000000000000000000000000000006",
  arbitrum: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
  optimism: "0x4200000000000000000000000000000000000006",
  polygon: "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619",
};
