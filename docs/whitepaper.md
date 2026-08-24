---
sidebar_position: 6
title: Whitepaper
description: The full argument for Main's World and SHIP — why the attention economy breaks trust, and the direction Main's World is working toward.
---

# Whitepaper

## What is Main's World?

Main's World is a social app built on a map of the real world. You post captions,
photos, and videos (**moments**) from the places you're actually at,
choose who can see each one, and earn $MAIN when eligible appreciation rewards
your part in a moment or a comment you wrote. A World App sign-in proves control
of a wallet; it does not by itself establish personhood or uniqueness.

That's the whole product in one breath. The rest of this page is the argument
underneath it: why the internet feels the way it does and the future direction
of privacy-preserving human verification. The [Manifesto](/manifesto) says what
we believe, and
[What is SHIP](/what-is-ship) names the category.

It's written to be read by anyone. Nothing here needs a technical background, and
every term is explained where it first appears.

## 1. The problem

Almost everything you read online is paid for by advertising. That's not a
scandal — it's just the business model, and it has a logic that follows from it
with the force of arithmetic.

If a platform earns money when you see an ad, then the number of ads you see is
the number that matters. That number goes up when you stay longer. So the product
gets tuned, relentlessly and rationally, for **time spent**. Not for whether you
felt better afterwards. Not for whether you saw your friends. For duration.

This is worth stating plainly, because it explains a lot that otherwise looks like
incompetence:

- **The feed stopped being your friends** — because your friends aren't
  interesting enough, often enough, to hold you for an hour.
- **Outrage travels further than agreement** — because it holds attention, and
  the system cannot tell the difference between attention you wanted to give and
  attention it took.
- **Nothing is ever finished.** There's no bottom of the feed, because a bottom is
  a place where you leave.

None of this required anyone to be a villain. It only required a metric.

### Then the bots arrived

For most of this history there was a floor under the damage: making a fake person
was expensive. Someone had to sit there and type.

That floor is gone. Generated text is free and fluent. Generated faces are free
and convincing. One person can now run thousands of accounts that argue, flatter,
review, and befriend — well enough that you can't reliably tell.

The consequence isn't just more spam. It's that **you can no longer assume the
thing you're talking to is a someone.** Every review might be paid. Every reply
might be a machine. Every warm comment might be a funnel. And once that doubt is
loose it doesn't stay confined to the fakes — it taints the real ones too. You
start discounting sincerity, because you can't afford to be fooled.

That's the actual crisis. Not that the internet is full of bots, but that **trust
itself has stopped working**, because the cheapest thing in the world to fake is
being a person.

Platforms can't fix this from inside their own model. Fake accounts inflate the
engagement numbers they sell. Deleting them means reporting a smaller audience to
advertisers. They are structurally disinclined to solve the problem that pays
them.

## 2. The insight

Suppose you could know — really know — that every account belonged to a distinct,
living human being.

Not "verified" as in a checkmark someone bought. Not "verified" as in they handed
a company their passport and hoped. Actually, provably: one person, one account.

The obvious way to get there is to make everyone identify themselves. But that
cure is worse than the disease. An internet where you must show your papers to
speak is not one worth having. Anonymity isn't a loophole for bad actors — it's
what lets people ask embarrassing questions, leave bad situations, and be
uncertain in public.

So the requirement is a paradox, and for most of the internet's life it was simply
impossible: **prove there's a real person here, prove there's only one of them,
and reveal nothing about who they are.**

### How the paradox resolves

It resolves through a **zero-knowledge proof** — cryptography that confirms a
statement is true without revealing the information the statement is about.

The everyday version: imagine proving you're over 18 without showing your
birthday, your name, or your face. Not by being trusted. By producing something
that can be checked, that is true, and that carries nothing else with it.

Privacy-preserving personhood systems aim to make that possible without exposing
names, email addresses, or other identity details. Main's World records
verification separately from World App wallet sign-in; do not infer a Main's
verification status from a sign-in alone.

### Why this is a foundation, not a feature

Proof of personhood sounds like a spam filter. It isn't. It could make a
different set of rules *possible*.

Consider what could be built if a privacy-preserving system reliably prevented
multiple accounts per person:

- **You can give people something free, every day** — because "everyone" is a
  countable number of humans, not an unbounded number of registrations.
- **Appreciation can be worth something** — because it can't be manufactured. A
  thousand reactions from a thousand humans is a fact about the world.
- **Actions can cost something** — because there's no supply of fresh accounts to
  reset the cost.
- **You don't need to police speech at scale** — because the volume problem was
  always a fake-account problem.

Those ideas are difficult on an ordinary network because new accounts can be
created cheaply. Proof of human is a future foundation Main's World is exploring,
not a guarantee that every current account has passed a personhood check.

## 3. The model

Main's World is a map of the real world where people can share moments with
privacy. Its longer-term direction is stronger, privacy-preserving human
verification; current wallet sign-in alone is not that verification.

### The worlds

Every moment lives in exactly one of three worlds, and you choose which:

| World        | Who can see it                                   |
| ------------ | ------------------------------------------------ |
| **SKY**      | Public — anyone on Main's World                  |
| **LAND**     | Your connections — only Mains you've friended    |
| **THE DEEP** | Private — yours alone, unless you tag someone in |

Privacy here isn't a settings page you're expected never to find. It's the first
choice you make about anything you post. And it only ever widens by your hand: no
algorithm promotes your private moment into public view, because no algorithm can.
Even the one way a moment travels beyond its world — a view-only **special link**
its creator can mint for a single moment or vibe, and kill at any time — exists
only by that creator's hand.

The map has independent SKY, LAND, and DEEP filters, so you can show any
combination of worlds you are allowed to see. Each moment keeps its world's
color, and the filters never change who can open a moment.

### Moments

A moment is a post, but the word is doing work. It's a caption and/or photo or
video, at a real place, at a real time — you were *there*, *then*. Not content to
be optimised. A memory with coordinates.

And you can travel back through the map's timeline to find them again, which is
the part that surprises people: the map isn't only *now*. It's every *then* you
were part of.

Personhood verification would not prove the picture, though. A person can still
post an image a generator made, and that would hollow out the claim the word
*moment* is making. So moments bound for SKY are checked, and the ones that
announce themselves as generated — many generators write that into the file — or
that plainly look it, don't land there. They can still go to LAND or THE DEEP:
what this protects is the shared public map, not what you keep among your own
people.

It's a filter, not a proof. The record a generator writes can be stripped out,
and nothing inside a picture reliably establishes that a camera made it. We'd
rather say so than claim a guarantee we can't keep — the public map is
meaningfully more real, not certifiably so.

### Vibes

A vibe is a live gathering on the map that moments feed into. It has one rule that
tells you what we're for:

**No one owns a vibe.** A Main can start one, but another Main normally has to
join before it becomes a live gathering. It ends when everyone leaves. The
mechanic is designed to make it easy for other people to choose to be there.

### Crews

A crew is a named group of Mains. Creating a crew, inviting people, joining, and
leaving are live today. Shared ownership, crew wallets, and member-approved
earnings splits are future work.

### The appreciation economy

Two balances, and they never mix.

|                    | Where it comes from                           | What it's for                            |
| ------------------ | --------------------------------------------- | ---------------------------------------- |
| **Energy credits** | 10 free every day; buy 10 more for $1 anytime | Spending inside the app. Never cashable. |
| **$MAIN**          | _Only_ from other-Main appreciation           | Claimable on-chain through the Vault by Orb-verified wallets. |

Three rules hold the whole thing up.

**Appreciation is the only mint.** An eligible first emoji reaction from another
Main is the only way $MAIN comes into existence. Changing or removing that
reaction does not mint again. This is the rule everything else defends.

**You can't buy your way in.** Money buys credits — the ability to speak — and
credits are never $MAIN. You cannot purchase the thing that measures whether
people valued what you made. You can buy a ticket to play. You cannot buy the
score.

**You can't pay yourself.** Appreciation always costs the giver and never pays
the giver. There is no self-directed loop, anywhere.

Read those together and something unusual falls out: **the only way to gain is to
give, and the only way to be worth anything is for someone else to decide you
were.** Not engagement. Not reach. Not persistence. Somebody else, freely,
spending something real.

Posting costs a credit, so you post less and mean it more. A moment people love
pays you back; a moment nobody wanted is spent energy, gone. Nobody is punished — you
just get a finite number of chances a day to be worth someone's attention, which
is roughly the deal in real life.

## 4. Why it's durable

The obvious question: what stops a large platform from copying this next quarter?

**They'd have to give up the fakes.** Fake accounts inflate the numbers they sell
to advertisers. Purging them means reporting a smaller audience and taking the
revenue hit — something public companies are structurally very bad at doing on
purpose.

**They'd have to stop wanting your time.** Main's World is trying to get you off
the phone and into the world; success looks like a short session. That isn't a
feature an ad-funded product can adopt. It's the opposite of the business.

**They'd have to give up knowing you.** Their model needs a profile — your name,
your interests, your graph — because that's the product being sold. We can't build
one. Not "we promise not to." There's nothing to build it from.

**They'd have to make appreciation cost something.** Free infinite likes are what
make engagement look big. An economy where support costs the giver produces
smaller, truer numbers. Nobody optimising a growth chart ships that.

None of these are technical moats. Any of them could be copied by a competent team
in a quarter. They're **structural**: each one requires giving up the thing that
pays for the company. That's a harder wall than any patent, and it holds precisely
as long as their model does.

The longer-term dependency is privacy-preserving proof of personhood. Today,
Main's World uses World App for wallet sign-in, while verification is recorded
separately and Orb verification gates Vault claims.

## 5. Roadmap

What's here now, and what's coming. We try to be honest about the difference — see
the [Roadmap](/roadmap) for detail.

**Live today:** independent SKY, LAND, and DEEP filters on a real map; moments
with photos and video; time travel through the map's timeline; reactions and
comments; friending and following; RunPal connection; basic crews; Vault claims
for Orb-verified wallets; and vibes — including vibes planned ahead, with a
start, an end, and a place.

**Coming:** invites for people who have not joined Main's World yet; richer Vibe
themes; crew shared ownership, wallets, and member-approved
splits; more app connections; and **SPACE** — a fourth world for gatherings with
no place at all, where distance becomes social rather than physical.

## 6. Open questions

We'd rather write these down than pretend they're settled.

**What does a gathering far away look like?** A vibe on the other side of the
world is real, but you can't walk into it. Our current lean is that it should be
unremarkable — just small, and far — but we're not certain that's right.

**How should standing be shown?** Ranking by lifetime appreciation received is
settled, so that withdrawing your earnings costs you no standing, and standing can
never be bought. What that *looks* like isn't.

**What does a healthy paid event look like?** Hosting a vibe stays free. Whether
and how a host might charge to attend is still being designed, deliberately
slowly — anything touching money can distort everything above it, and we'd rather
be late than wrong.

**How large can this get before it stops feeling like this?** Every network that
became unpleasant was once pleasant. We don't think we're immune. We think the
rules above are our best defence, and we'd like to be argued with.

---

If any of this sounds like the world you want to be part of, there's a place for
you here. Start with the [Manifesto](/manifesto), or just
[come and see](https://mains.world).

_This whitepaper is community-editable, like everything on this site. Help sharpen
it — see [Contribute](/contribute)._
