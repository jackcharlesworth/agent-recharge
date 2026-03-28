import { NextRequest, NextResponse } from "next/server";

const LZ_API_BASE = "https://transfer.layerzero-api.com/v1";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const url = new URL(`${LZ_API_BASE}/tokens`);
  const chainKey = searchParams.get("transferrableFromChainKey");
  const tokenAddress = searchParams.get("transferrableFromTokenAddress");
  const nextToken = searchParams.get("pagination[nextToken]");

  if (chainKey) url.searchParams.set("transferrableFromChainKey", chainKey);
  if (tokenAddress) url.searchParams.set("transferrableFromTokenAddress", tokenAddress);
  if (nextToken) url.searchParams.set("pagination[nextToken]", nextToken);

  const res = await fetch(url.toString());
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
