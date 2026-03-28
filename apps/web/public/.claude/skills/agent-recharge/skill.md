# agent-recharge skill

Generate a payment link to fund an AI agent wallet across chains using LayerZero.

## Usage

When the user asks to "recharge" or "fund" an agent wallet, or wants to create a payment link for an agent, use this skill.

## Steps

1. Ask for (or infer from context):
   - `toAddress` — the agent's wallet address
   - `toChain` — destination chain (default: "base")
   - `toToken` — token address on destination chain (default: USDC on that chain)
   - `agentName` — optional display name
   - `toAmount` — optional suggested amount

2. Generate the URL using the `agent-recharge` npm package:

```typescript
import { recharge, USDC } from "agent-recharge";

const url = recharge({
  toChain: "base",
  toToken: USDC["base"],
  toAddress: "0x...",
  agentName: "My Agent",
  toAmount: 100,
});
```

3. Return the URL. The link opens a UI where the payer connects their EVM wallet and sends from any chain.

## Common USDC addresses

- base: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
- arbitrum: `0xaf88d065e77c8cC2239327C5EDb3A432268e5831`
- ethereum: `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48`
- optimism: `0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85`
- polygon: `0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359`

## Supported LZ chain keys

`ethereum`, `base`, `arbitrum`, `optimism`, `polygon`, `bsc`, `avalanche`, `linea`, `scroll`, `zksync-era`, `mantle`
