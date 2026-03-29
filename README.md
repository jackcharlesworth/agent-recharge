# Agent Recharge

Fund AI agent wallets across any chain using LayerZero cross-chain infrastructure.

Agent Recharge lets you generate a payment link for an agent wallet. The destination chain, token, and address are locked — the payer just connects their wallet, picks a source token, and sends. LayerZero handles the cross-chain transfer.

## How it works

1. Generate a payment link with the `agent-recharge` npm package
2. Share the link with whoever needs to fund the agent
3. They open it, connect their EVM wallet, and send from any supported chain
4. The agent receives the specified token on the destination chain

## npm package

```bash
npm install agent-recharge
```

```typescript
import { recharge, USDC } from "agent-recharge";

const url = recharge({
  toChain: "base",
  toToken: USDC["base"],
  toAddress: "0xYourAgentWallet",
  agentName: "Trading Agent",
  toAmount: 100,        // optional: pre-fill amount
  minAmountUSD: 10,     // optional: enforce minimum
});
// → https://agent-recharge-web.vercel.app/pay?toChain=base&toToken=0x833...&toAddress=0x...
```

### URL parameters

| Parameter | Required | Description |
|---|---|---|
| `toChain` | yes | LayerZero chain key e.g. `base`, `arbitrum`, `ethereum` |
| `toToken` | yes | Token contract address on the destination chain |
| `toAddress` | yes | Agent wallet address to receive funds |
| `toAmount` | no | Pre-filled send amount (human-readable) |
| `agentName` | no | Display name shown in the payment UI |
| `agentLogo` | no | Logo URL shown in the payment UI |
| `minAmountUSD` | no | Minimum transfer value in USD |

### Built-in token addresses

```typescript
import { USDC, USDT, WETH } from "agent-recharge";

USDC["base"]      // 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
USDC["arbitrum"]  // 0xaf88d065e77c8cC2239327C5EDb3A432268e5831
USDC["ethereum"]  // 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48
// + optimism, polygon, avalanche, bsc, solana
```

## Supported chains

`ethereum`, `base`, `arbitrum`, `optimism`, `polygon`, `bsc`, `avalanche`, `linea`, `scroll`, `zksync-era`, `mantle`, and 100+ more via LayerZero.

## Claude Code skill

If you're using Claude Code, you can ask your agent to recharge its own wallet. Add the skill to your project:

```
.claude/skills/agent-recharge/SKILL.md
```

Then say: **"recharge your agent wallet"** and Claude will generate the payment link.

## Repo structure

```
agent-recharge/
├── packages/
│   └── agent-recharge/     # npm package — recharge() URL builder
└── apps/
    └── web/                # Next.js payment UI (deployed to Vercel)
```

## Tech

- [LayerZero Value Transfer API](https://transfer.layerzero-api.com) — cross-chain routing and execution
- [RainbowKit](https://rainbowkit.com) + [wagmi](https://wagmi.sh) — wallet connection
- [Next.js](https://nextjs.org) — payment UI
- [Turborepo](https://turbo.build) — monorepo
