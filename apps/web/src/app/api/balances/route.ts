import { NextRequest, NextResponse } from "next/server";

const CHAIN_CONFIG: Record<
  string,
  {
    rpc: string;
    nativeSymbol: string;
    tokens: Array<{ symbol: string; address: string; decimals: number }>;
  }
> = {
  base: {
    rpc: "https://mainnet.base.org",
    nativeSymbol: "ETH",
    tokens: [
      { symbol: "USDC", address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", decimals: 6 },
      { symbol: "USDT", address: "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2", decimals: 6 },
      { symbol: "WETH", address: "0x4200000000000000000000000000000000000006", decimals: 18 },
    ],
  },
  ethereum: {
    rpc: "https://ethereum.publicnode.com",
    nativeSymbol: "ETH",
    tokens: [
      { symbol: "USDC", address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", decimals: 6 },
      { symbol: "USDT", address: "0xdAC17F958D2ee523a2206206994597C13D831ec7", decimals: 6 },
      { symbol: "WETH", address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", decimals: 18 },
    ],
  },
  arbitrum: {
    rpc: "https://arb1.arbitrum.io/rpc",
    nativeSymbol: "ETH",
    tokens: [
      { symbol: "USDC", address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", decimals: 6 },
      { symbol: "USDT", address: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9", decimals: 6 },
      { symbol: "WETH", address: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1", decimals: 18 },
    ],
  },
  optimism: {
    rpc: "https://mainnet.optimism.io",
    nativeSymbol: "ETH",
    tokens: [
      { symbol: "USDC", address: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85", decimals: 6 },
      { symbol: "USDT", address: "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58", decimals: 6 },
      { symbol: "WETH", address: "0x4200000000000000000000000000000000000006", decimals: 18 },
    ],
  },
  polygon: {
    rpc: "https://polygon-rpc.com",
    nativeSymbol: "POL",
    tokens: [
      { symbol: "USDC", address: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359", decimals: 6 },
      { symbol: "USDT", address: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F", decimals: 6 },
      { symbol: "WETH", address: "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619", decimals: 18 },
    ],
  },
};

const STABLE_SYMBOLS = new Set(["USDC", "USDT", "DAI", "USDC.e"]);

function balanceOfData(address: string): string {
  const padded = address.toLowerCase().replace("0x", "").padStart(64, "0");
  return `0x70a08231${padded}`;
}

function parseHexBalance(hex: string, decimals: number): number {
  if (!hex || hex === "0x" || hex === "0x0") return 0;
  try {
    const raw = BigInt(hex);
    const divisor = BigInt(10) ** BigInt(decimals);
    const whole = Number(raw / divisor);
    const frac = Number(raw % divisor) / 10 ** decimals;
    return whole + frac;
  } catch {
    return 0;
  }
}

async function jsonRpc(rpc: string, method: string, params: unknown[]): Promise<string> {
  const res = await fetch(rpc, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const data = await res.json() as { result?: string };
  return data.result ?? "0x0";
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const address = searchParams.get("address");
  const chainKey = searchParams.get("chainKey");

  if (!address || !chainKey) {
    return NextResponse.json({ error: "Missing address or chainKey" }, { status: 400 });
  }

  const chain = CHAIN_CONFIG[chainKey];
  if (!chain) {
    return NextResponse.json({ balances: [], totalUsd: 0 });
  }

  // Fetch ETH price for WETH / native ETH USD value
  let ethPrice = 0;
  try {
    const priceRes = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd",
      { next: { revalidate: 60 } }
    );
    const priceData = await priceRes.json() as { ethereum?: { usd?: number } };
    ethPrice = priceData?.ethereum?.usd ?? 0;
  } catch {
    // non-fatal — proceed without ETH price
  }

  // Fetch native + all ERC-20 balances in parallel
  const [nativeHex, ...tokenHexes] = await Promise.all([
    jsonRpc(chain.rpc, "eth_getBalance", [address, "latest"]),
    ...chain.tokens.map((t) =>
      jsonRpc(chain.rpc, "eth_call", [
        { to: t.address, data: balanceOfData(address) },
        "latest",
      ])
    ),
  ]);

  const entries: Array<{ symbol: string; amount: number; usdValue: number | null }> = [
    ...chain.tokens.map((t, i) => {
      const amount = parseHexBalance(tokenHexes[i], t.decimals);
      const usdValue = STABLE_SYMBOLS.has(t.symbol)
        ? amount
        : t.symbol === "WETH"
        ? amount * ethPrice
        : null;
      return { symbol: t.symbol, amount, usdValue };
    }),
  ];

  const nativeAmount = parseHexBalance(nativeHex, 18);
  if (nativeAmount > 0.0001) {
    entries.push({
      symbol: chain.nativeSymbol,
      amount: nativeAmount,
      usdValue: chain.nativeSymbol === "ETH" ? nativeAmount * ethPrice : null,
    });
  }

  const balances = entries.filter((b) => b.amount > 0.000001);
  const totalUsd = balances.reduce((sum, b) => sum + (b.usdValue ?? 0), 0);

  return NextResponse.json({ balances, totalUsd });
}
