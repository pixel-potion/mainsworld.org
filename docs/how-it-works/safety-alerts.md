---
title: Safety Alerts
description: How Main's World finds nearby weather, earthquake and disaster information, what location it uses, and what the connector cannot do.
---

# Safety Alerts

Safety Alerts is an optional connector that adds current weather, earthquake
and major-disaster information to the map. It also checks one selected area for
nearby alerts in your feed. It is separate from Moments: alerts have no author,
reactions, energy cost or $MAIN reward.

This first version works **only while Main's World is open**. It does not send
background emergency notifications.

## Turn it on

Open **Backstage → App Connections → Safety Alerts** and switch it on.

The settings show the one area used for nearby matching:

- **Live while MW is open** follows the phone's current location. MW rounds the
  coordinate to about 1 km and does not save it to your Main.
- **Saved** keeps one rounded area in your connector settings until you update
  it, switch back to live location or turn off the connector.

Choose the nearby radius, minimum severity and alert types you want in the
nearby feed. The radius is a filter, not a claim that an incident affects the
whole circle.

## What appears on the map

The top-right world switcher controls a worldwide Safety Alerts overlay. When
it is on, MW draws all current records with usable map geometry from the
connected sources—not only records near your selected area. You can explore an
earthquake or disaster on the other side of the world without subscribing to
that place.

Your selected area, radius, severity and alert-type settings control the nearby
feed. They do not hide records from the worldwide map. Turning the map overlay
off does not turn the connector or its nearby results off.

Only current active data appears today. Current alerts are hidden when you
rewind the map because historical replay is not available yet.

## Where alerts come from

- [National Weather Service](https://www.weather.gov/documentation/services-web-alerts)
  for active US weather alerts. Some alerts use a warning area; others are
  matched to an NWS zone.
- [USGS](https://earthquake.usgs.gov/earthquakes/feed/) for earthquake event
  information. A marker is an epicenter, not the full affected area.
- [GDACS](https://www.gdacs.org/) for international disaster assessments
  aggregated from multiple sources. GDACS context is not necessarily a local
  government warning.

Every alert keeps its issuer, time, geography description, attribution and a
link to the source details.

## Location and privacy

For a live area, MW sends an authenticated request containing a coordinate
rounded to two decimal places—roughly 1 km. It is used for nearby matching and
an NWS zone lookup. It is not attached to your Main in storage. A short-lived
server cache may keep the rounded lookup for up to 30 minutes.

A saved area uses the same precision but remains in your connector preferences
until you replace or remove it.

## Important limits

Safety Alerts can be delayed, incomplete or temporarily unavailable. Source
outages are labeled, and data that has not refreshed successfully for 30
minutes is hidden rather than presented as current.

Safety Alerts is not a replacement for 911, local emergency services, Wireless
Emergency Alerts or instructions from local authorities. If you are in danger,
call or text the emergency number for your location.

This version does not yet include dedicated AMBER alerts, FEMA IPAWS coverage,
911 dispatch data, responder messaging or civilian photo submissions.

## Planned next

- **Named watch areas:** follow several places such as Home, Parents or School,
  each with its own radius, alert types, severity and notification settings.
- **Historical replay:** show source records appropriate to the date and map
  area being viewed. USGS earthquake history is the clearest starting point;
  weather and disaster archives have different coverage and delay rules.
- **Background notifications:** notify only for watched places after MW has
  durable delivery, deduplication, quiet hours, cancellation handling and an
  auditable opt-in.

Until those ship, Safety Alerts watches one live or saved area and works only
while MW is open.

## If your alert area looks wrong

1. Return to **Backstage → App Connections → Safety Alerts**.
2. Check whether the area says **Live** or **Saved**.
3. For live matching, return to the map and use its location button.
4. For a fixed place, stand there and choose **Save this area**, or update the
   existing saved area to your current location.

Turning the map overlay off hides alert shapes and markers, but the selected
area remains visible in the connector settings.
