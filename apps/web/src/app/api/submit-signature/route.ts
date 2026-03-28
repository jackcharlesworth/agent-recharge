import { NextRequest, NextResponse } from "next/server";

const LZ_API_BASE = "https://transfer.layerzero-api.com/v1";

export async function POST(req: NextRequest) {
  const body = await req.json();

  const res = await fetch(`${LZ_API_BASE}/submit-signature`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.LZ_API_KEY ?? "",
    },
    body: JSON.stringify(body),
  });

  // submit-signature returns {} on success
  const data = res.status === 200 ? {} : await res.json();
  return NextResponse.json(data, { status: res.status });
}
