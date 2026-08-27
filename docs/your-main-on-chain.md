---
sidebar_position: 6
title: Your $MAIN on-chain
description: What happens after you claim $MAIN to your wallet — seeing it, swapping it, sending it, and using it outside Main's World.
---

# Your $MAIN on-chain

Claiming turns the $MAIN you earned inside Main's World into a real token in
your own wallet, on a public blockchain called World Chain. From that moment it
is yours in the fullest sense: Main's World cannot take it back, freeze it, or
see anything special about it. It also means Main's World can no longer help
you if it goes somewhere you didn't intend — on a blockchain there is no "undo"
and no customer support line that can reverse a transfer.

This page is the map for that territory. Everything below is factual and
verifiable; none of it is financial advice. What you do with your $MAIN —
spend, save, swap, or simply hold it — is your decision to make, and the point
of this page is that you make it knowing how the pieces work.

## The addresses that matter

Every fact on this page hangs off a handful of addresses. Verify anything you
see elsewhere against this table — it is the official source.

| Thing | Value |
| --- | --- |
| Network | World Chain (chain ID **480**) |
| $MAIN token contract | `0xe734c938260e5E96088EE36110b0dFf1AeFF528e` |
| $MAIN decimals | 18 |
| USDC token contract (bridged; often shown as "USDC.e") | `0x79A02482A880bCE3F13e09Da970dC34db4CD24d1` |
| USDC decimals | 6 |
| Block explorer | [worldscan.org](https://worldscan.org/token/0xe734c938260e5E96088EE36110b0dFf1AeFF528e) |
| Public RPC endpoint | `https://worldchain-mainnet.g.alchemy.com/public` |

A block explorer is a public website that shows every transaction on a
blockchain. Anyone can look up any address — including yours. That cuts both
ways, and the privacy section below explains how.

## Where your balance lives

**In World App.** Your claimed $MAIN sits in your World App wallet — the same
wallet you use to sign in to Main's World. Open the Wallet tab to see your
tokens. World App curates which tokens it displays by name and logo, and a
newly launched token may appear as an unrecognized token, or not appear in the
list at all, until World adds it. Your balance is real either way — the wallet
display is a label, not the ledger.

**On the explorer.** The ground truth is always the explorer: search for your
wallet address on [worldscan.org](https://worldscan.org) and the token balance
is there, whatever any app chooses to display.

## Swapping $MAIN

Swapping means trading one token for another through a liquidity pool — a pot
of two tokens that anyone can trade against, with the price set automatically
by the ratio between them.

A $MAIN pool exists on Uniswap, the most widely used decentralized exchange:

| Pool | Detail |
| --- | --- |
| Pair | MAIN / USDC |
| Venue | Uniswap v4 on World Chain |
| Fee tier | 0.038% |
| Pool ID | `0x3bdd52d0f613331250ebedc80746b9f42fe45e0551805443cb487efeace0c45f` |
| Live stats | [GeckoTerminal](https://www.geckoterminal.com/world-chain/pools/0x3bdd52d0f613331250ebedc80746b9f42fe45e0551805443cb487efeace0c45f) |

**The one thing to understand before your first swap: this pool is young and
small.** In a small pool, even a modest trade moves the price against you —
this is called price impact, and the swap screen shows it before you confirm.
Swap a little at a time, read the price impact number, and never confirm a
swap whose received amount surprises you.

Two ways to swap:

- **Inside World App, using a swap mini app.** This works today, and Mains have
  already done it. World App's own built-in Swap will not find $MAIN — that
  feature carries a fixed list of four tokens (WBTC, WLD, WETH and USDC), has no
  place to type a contract address, and cannot reach the kind of pool $MAIN
  trades in. Several independent swap mini apps inside World App can, because
  they accept a contract address and route to the pool directly. Open one from
  the World App store, paste the $MAIN contract address from the table above,
  and swap as you would any other token.
- **On Uniswap directly.** [app.uniswap.org](https://app.uniswap.org) supports
  World Chain. Connect a wallet, choose World Chain as the network, and paste
  the $MAIN contract address into the token selector the first time — Uniswap
  will remember it afterwards.

A mini app that swaps for you is a third party, not Main's World. Check that the
token you are about to receive is the contract address on this page before you
confirm anything, and start with an amount you would not mind losing while you
learn a new tool.

Turning $MAIN into money you can spend generally takes two steps: swap $MAIN
for USDC (a stablecoin pegged to the US dollar), then move the USDC wherever
you off-ramp — an exchange, a card, or a service that pays out to your bank.
Which off-ramp fits you depends on your country and is beyond what this page
can decide for you; the FAQ's
[country availability](/country-availability) page is a starting point.

## Sending $MAIN

You can send $MAIN to any World Chain address: another Main, your own second
wallet, or an exchange deposit address.

- **From World App**, use the wallet's send flow as you would for any token.
- **The first time you send to any new address, send a tiny test amount
  first** and confirm it arrives before sending the rest. A blockchain
  transfer to a wrong address is gone — there is nobody who can bring it back.
- **Only send to addresses on World Chain.** An exchange's Ethereum deposit
  address is not automatically a World Chain address; sending tokens on the
  wrong network is one of the most common ways people lose them. Check that
  the destination explicitly supports World Chain before sending.

## Using MetaMask (or another external wallet)

MetaMask does not know about World Chain out of the box. Two one-time steps
fix that: add the network, then import the tokens.

**Add World Chain to MetaMask.** In MetaMask choose *Add network* → *Add a
network manually* and enter:

| Field | Value |
| --- | --- |
| Network name | World Chain |
| RPC URL | `https://worldchain-mainnet.g.alchemy.com/public` |
| Chain ID | `480` |
| Currency symbol | `ETH` |
| Block explorer URL | `https://worldscan.org` |

**Import the tokens.** MetaMask only shows tokens it has been told about. On
the World Chain network, choose *Import tokens* and paste the $MAIN contract
address from the table above; the symbol and decimals fill in by themselves.
Do the same with the USDC address if you plan to hold USDC there. You can
copy both addresses from this page or from the token's page on
[worldscan.org](https://worldscan.org/token/0xe734c938260e5E96088EE36110b0dFf1AeFF528e) —
never from a search result or a message someone sent you.

**Gas.** Transactions on World Chain cost a small fee paid in ETH — the
network's native currency, listed in the table above. World App covers this
for you invisibly; an external wallet like MetaMask does not, so you need a
small amount of ETH on World Chain (a few dollars' worth is plenty) before
MetaMask can send anything. You can bridge ETH to World Chain with the
[Superbridge](https://superbridge.app/world-chain) or buy it on an exchange
that supports World Chain withdrawals.

## Privacy: what claiming reveals

Inside Main's World you are only ever a pseudonym — the app never shows anyone
your wallet address. The blockchain works the other way: **every transfer,
swap, and balance on World Chain is public, forever, attached to your
address.** Nobody looking at the chain knows the address is you — until you
connect it to your identity somewhere, for example by posting it publicly or
using it with a service that knows your name.

If that matters to you, treat your address like a return address on an
envelope: fine to share deliberately, unwise to broadcast. Claiming itself
does not announce anything — but what you do on-chain afterwards is visible
to anyone who looks.

## Providing liquidity

The MAIN/USDC pool is not owned by anyone — Uniswap pools are open
infrastructure. Anyone can deposit tokens into the pool and earn a share of
the 0.038% fee on every swap that routes through it, proportional to their
share of the pool. Deepening the pool makes prices steadier for everyone:
the more liquidity, the less any single trade moves the price.

To add liquidity: open [app.uniswap.org](https://app.uniswap.org), switch to
World Chain, choose *Pool* → *New position*, select USDC and $MAIN (pasting
the contract addresses from the table the first time), pick the 0.038% fee
tier to join the existing pool, and choose a price range your deposit will be
active in.

Understand what you are signing up for before you do:

- **Liquidity providing has its own risk**, separate from simply holding.
  When the price moves, the pool automatically sells the token that rose and
  accumulates the one that fell — so you can end up worse off than if you had
  just held both tokens. This is usually called impermanent loss, and it is
  larger the more the price moves.
- **This pool is new and small**, and $MAIN's price history is days old.
  Fee income depends entirely on trading volume, which nobody can promise.
- Anyone can also create *additional* pools — other fee tiers, other pairs —
  permissionlessly on Uniswap. A new pool competes for the same trades, so
  most tokens are best served by liquidity concentrating in one pool rather
  than spreading across many.

Main's World itself never mints $MAIN for liquidity and never sells $MAIN —
every token in every pool was first earned by a Main and claimed. That is
verifiable on the explorer: the contract's full mint history is public.

## Safety checklist

- Your wallet's **recovery phrase is the wallet**. Anyone who has it has your
  tokens. No app, admin, or support person will ever legitimately ask for it.
- **Verify contract addresses from this page or the explorer**, never from
  messages, search ads, or people offering help you didn't ask for. Scam
  tokens with familiar names are cheap to create.
- **Test sends with small amounts** to every new address.
- **Read the price impact** before confirming a swap in a small pool.
- If someone contacts you first about your $MAIN — to help you claim, swap,
  or "verify" it — assume it is a scam. Main's World will never contact you
  about your tokens.
