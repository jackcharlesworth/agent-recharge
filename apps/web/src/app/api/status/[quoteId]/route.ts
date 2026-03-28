import { NextRequest, NextResponse } from "next/server";

const LZ_API_BASE = "https://transfer.layerzero-api.com/v1";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ quoteId: string }> }
) {
  const { quoteId } = await params;
  const { searchParams } = new URL(req.url);
  const txHash = searchParams.get("txHash");

  const url = new URL(`${LZ_API_BASE}/status/${quoteId}`);
  if (txHash) url.searchParams.set("txHash", txHash);

  const res = await fetch(url.toString(), {
    headers: {
      "x-api-key": process.env.LZ_API_KEY ?? "",
    },
  });

  if (res.status === 404) {
    return NextResponse.json({ status: "UNKNOWN", executionHistory: [] }, { status: 200 });
  }

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
