---
name: agent-recharge
description: Fund this agent's USDC wallet on Base using Agent Recharge
---

# Agent Recharge

When the user asks to recharge, refill, fund, or top up the agent wallet, generate a payment link using the `agent-recharge` package.

## This agent's wallet

- **Address**: `0xF3F714bb0037D5A6ea806009bACA474E039ccA06`
- **Chain**: base
- **Token**: USDC

## Steps

1. Generate the URL:

```typescript
import { recharge, USDC } from "agent-recharge";

const url = recharge({
  toChain: "base",
  toToken: USDC["base"],
  toAddress: "0xF3F714bb0037D5A6ea806009bACA474E039ccA06",
  agentName: "Agent Wallet",
});
```

2. Return the URL with a message like:
   "Here's your recharge link: [url] — open it to send USDC from any chain."

## Notes

- The payer connects their own EVM wallet and sends from any supported chain
- The destination (chain, token, address) is locked — only the source is chosen by the payer
- Optionally pass `toAmount` to pre-fill a suggested amount
