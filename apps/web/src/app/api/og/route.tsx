import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";

export const runtime = "edge";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const agentName = searchParams.get("agentName") ?? "AI Agent";
  const toChain = searchParams.get("toChain") ?? "base";
  const agentLogo = searchParams.get("agentLogo");

  const chainLabel = toChain.charAt(0).toUpperCase() + toChain.slice(1);

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          background: "linear-gradient(135deg, #0a0a0f 0%, #13101f 100%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          position: "relative",
        }}
      >
        {/* Purple glow */}
        <div
          style={{
            position: "absolute",
            width: "500px",
            height: "500px",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(123,92,240,0.15) 0%, transparent 70%)",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
          }}
        />

        {agentLogo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={agentLogo}
            alt={agentName}
            width={80}
            height={80}
            style={{
              borderRadius: "50%",
              marginBottom: "24px",
              border: "2px solid rgba(123,92,240,0.5)",
            }}
          />
        )}

        <p
          style={{
            fontSize: "20px",
            color: "rgba(255,255,255,0.4)",
            margin: "0 0 12px 0",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
          }}
        >
          Agent Recharge
        </p>

        <h1
          style={{
            fontSize: "64px",
            fontWeight: 600,
            color: "white",
            margin: "0 0 16px 0",
            textAlign: "center",
            lineHeight: 1.1,
          }}
        >
          Fund {agentName}
        </h1>

        <p
          style={{
            fontSize: "24px",
            color: "rgba(255,255,255,0.5)",
            margin: 0,
          }}
        >
          Any chain → {chainLabel} · Powered by LayerZero
        </p>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
