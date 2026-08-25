---
title: Connect your app
description:
  How an app can send what its people do to the Main's World map, without asking
  anyone to move.
---

# Connect your app

Main's World is a map of **moments** — the things people record, pinned to the
place and the time they actually happened. A lot of those things start somewhere
else: in a running app, a ticketing app, a travel app, a music app.

A **connection** lets one of those apps send that activity to the map on its
user's behalf, so nobody has to post the same thing twice.

## Come as you are

We are not asking anyone to migrate.

Moving the world's content into one more super-app is expensive, risky, and we
think beside the point. The problem was never that your app is bad. It is that
one person's life is scattered across dozens of apps, and none of them meet.

So a connection does not move anything and does not take anyone. Your users stay
yours. Their activity simply also has a place on a shared map, where the people
who were actually there can find it.

## What a connection can carry

Three kinds of thing live on the map. Today a connected app can create the
first; the other two are what we are building next.

### Moments — available now

A **moment** is one thing that happened: a run, a set, a meal, a trip. It is
pinned to the exact place and time it took place, and the app that sent it is
named on it.

This is the part that works today. The first connection — with a running app
called RunPal — is live: a finished run arrives as a moment with its route
drawn on the map.

### Vibes — not built yet

A **vibe** is a live gathering on the map that lots of people add to at once.
If you run events, ticketing, races, or a venue, the natural shape is for your
event to become the vibe that everyone who was there records into, so the night
has one home instead of being scattered.

Partner-created vibes do not exist yet. If this is the one you need, we would
like to build it with you rather than have you wait for it.

### Crews — not built yet

A **crew** is a group of Mains who make something together. Where an app has
teams, bands, clubs, or collaborators, the appreciation for what the group makes
could land on the group rather than on whoever happened to post it.

Partner-created crews do not exist yet either.

## How a connection works

1. **Your server opens the door.** It sends your user into Main's World with a
   short-lived link. That link carries no account id, no email address, and no
   wallet address — only a random reference that your own server can map back.
2. **Your user agrees.** They see exactly what you will send and what comes
   back, in English or Spanish, and approve it themselves. Without their
   approval there is no connection.
3. **You send activity.** Your server sends the thing that happened, and it
   becomes a moment on that person's map.
4. **Either side can end it.** You can revoke the connection. The Main can
   disconnect it from inside the app. Moments that were already recorded stay
   theirs.

## What we never see

- **Who your users are.** We receive a random reference and nothing more. Their
  identity inside your app stays inside your app.
- **Anything we did not ask for.** A connection only runs inward. Main's World
  never calls your app, never crawls it, and never polls it. You send; we
  receive.
- **Anyone's wallet address.** Inside Main's World a person is only ever a public
  id, never an address, and that holds for everything we send back to you.

## What it costs

Nothing, and that is not an introductory offer.

We will not charge you for connecting, and your users will never pay money to
bring in something they already made. Every Main gets ten free posts a day; an
import uses one of those, exactly as any other moment would, and repeats and
corrections of the same item are free. Nothing touches your billing.

Building the map is not where our business is. How Main's World eventually
supports itself is a question we are still working through in the open, and the
answer will not be charging the people who help build it.

## Where this honestly stands

We would rather you hear this from us than find out later.

- **There is no public interface yet.** No developer documentation, no
  self-service keys. Every connection today is built by hand, with us, against
  your stack. That is slower for us and better for you — you get a person, not a
  support queue.
- **RunPal is the first one**, and it is live. The flow above is built and
  running against it, for moments.
- **We are small.** The live numbers are on the Stats screen inside the app, and
  they are not big ones. Connecting now means shaping how this works, not
  renting an audience.

## Start one

Tell us what your app makes and what a moment looks like inside it. If it fits,
we will build the connection with you.

Write to [hello@mains.world](mailto:hello@mains.world).
