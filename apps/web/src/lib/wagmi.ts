import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import {
  mainnet,
  base,
  arbitrum,
  optimism,
  polygon,
  bsc,
  avalanche,
  linea,
  scroll,
  zkSync,
  mantle,
} from "wagmi/chains";

export const wagmiConfig = getDefaultConfig({
  appName: "Agent Recharge",
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "YOUR_PROJECT_ID",
  chains: [mainnet, base, arbitrum, optimism, polygon, bsc, avalanche, linea, scroll, zkSync, mantle],
  ssr: true,
});

/** Map from LZ chainKey → wagmi chain id */
export const LZ_CHAIN_KEY_TO_ID: Record<string, number> = {
  ethereum: mainnet.id,
  base: base.id,
  arbitrum: arbitrum.id,
  optimism: optimism.id,
  polygon: polygon.id,
  bsc: bsc.id,
  avalanche: avalanche.id,
  linea: linea.id,
  scroll: scroll.id,
  "zksync-era": zkSync.id,
  mantle: mantle.id,
};

/** Map from wagmi chain id → LZ chainKey */
export const CHAIN_ID_TO_LZ_KEY: Record<number, string> = Object.fromEntries(
  Object.entries(LZ_CHAIN_KEY_TO_ID).map(([k, v]) => [v, k])
);
