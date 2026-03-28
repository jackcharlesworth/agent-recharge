import type { Metadata } from "next";
import { PayUI } from "@/components/PayUI";
import type { PayParams } from "@/lib/types";

interface Props {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const resolvedParams = await searchParams;
  const agentName = resolvedParams.agentName as string | undefined;
  const toChain = resolvedParams.toChain as string | undefined;

  const title = agentName ? `Fund ${agentName}` : "Fund Agent";
  const description = toChain
    ? `Send tokens to this AI agent's wallet on ${toChain} — from any chain, powered by LayerZero.`
    : "Send tokens to this AI agent's wallet from any chain, powered by LayerZero.";

  const ogImageParams = new URLSearchParams();
  if (agentName) ogImageParams.set("agentName", agentName);
  if (resolvedParams.agentLogo) ogImageParams.set("agentLogo", resolvedParams.agentLogo as string);
  if (toChain) ogImageParams.set("toChain", toChain);

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      images: [
        {
          url: `/api/og?${ogImageParams.toString()}`,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default async function PayPage({ searchParams }: Props) {
  const resolvedParams = await searchParams;
  const params: PayParams = {
    toChain: (resolvedParams.toChain as string) ?? "base",
    toToken: (resolvedParams.toToken as string) ?? "",
    toAddress: (resolvedParams.toAddress as string) ?? "",
    toAmount: resolvedParams.toAmount as string | undefined,
    agentName: resolvedParams.agentName as string | undefined,
    agentLogo: resolvedParams.agentLogo as string | undefined,
    minAmountUSD: resolvedParams.minAmountUSD as string | undefined,
  };

  if (!params.toAddress || !params.toToken) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center space-y-2">
          <h1 className="text-xl font-semibold text-white">Invalid link</h1>
          <p className="text-white/50 text-sm">
            This payment link is missing required parameters.
          </p>
        </div>
      </div>
    );
  }

  return <PayUI params={params} />;
}
