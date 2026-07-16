FX Treasury Intelligence Cloud
FX Rate Decision Cockpit (Final Interaction & Execution Model Update)
1. Core Behavioral Change (CRITICAL)
🧠 FX Rate Publishing Decision Agent – Execution Cycle

Every 10 seconds, the agent produces a new pricing decision.

1.1 Agent Output Obligation (Every Cycle)

A) No Change Decision
Current client FX rate remains unchanged
B) Rate Update Decision
A specific FX rate is proposed
Either:
immediate publish rate
or transition point (smooth path segment)
1.2 Decision Output Format (Required)
Decision:
  Type: HOLD | PUBLISH | SMOOTH_STEP

  CurrentMarketRate: 40.2050
  CurrentClientRate: 40.1800

  SuggestedClientRate: 40.1900

  If SMOOTH:
    StepPoint: true
    NextTarget: 40.1950

  Confidence: High

  Reason:
    - Market momentum persistent
    - Order pressure skewed to buy-side
    - Liquidity conditions stable
2. UX BEHAVIOR SPECIFICATION
2.1 RIGHT PANEL — AGENT CHAT + DECISION STREAM

This panel becomes a live decision feed + interaction layer

2.1.1 Every 10 seconds system message

Agent writes automatically:

Example message:

🧠 FX Rate Decision Agent

Decision: SMOOTH STEP

Market has increased steadily over last 30 seconds.

Order pressure indicates strong USD BUY interest near 40.21.

Recommended action:
→ Increase client rate to 40.1900 (step transition)

Confidence: High

Expected impact:

Revenue: +3.1%
Conversion: -0.8%
Execution risk: Low
2.1.2 Human Interaction Layer

Every decision message includes:

🟩 [ACCEPT]
🟨 [MODIFY]
🟥 [REJECT]
2.1.3 Accept Behavior

If user clicks ACCEPT:

decision becomes active policy
client rate update is executed
chart immediately reflects new rate path
2.1.4 Modify Behavior (optional extension)

User can:

adjust rate
change speed (smoothness)
override decision type
2.2 LEFT PANEL — REAL-TIME FX CONTROL CHART (UPDATED)
2.2.1 Market Data Layer
3 FX feeds (live)
Median rate highlighted (primary signal)
2.2.2 Client Rate + Decision Overlay
🔴 Client Rate Line
actual published FX rate
🟣 Agent Suggested Point (NEW)

Every 10-second decision generates:

a blinking point marker
plotted on chart at:
current timestamp
suggested rate
Visual behavior:
pulsating dot (5–10 sec)
fades after next decision cycle
2.2.3 Smooth Transition Path Overlay

If decision = SMOOTH:

line segment appears
step-by-step path drawn
updates every 10 seconds

Example:
40.1800 → 40.1850 → 40.1900 → ...

2.2.4 Latency Visualization (UNCHANGED BUT IMPORTANT)
shaded band between:
market rate
client published rate

Shows:

pricing delay + responsiveness gap

2.2.5 Order Pressure Heat Layer
ABOVE price: BUY pressure (demand)
BELOW price: SELL pressure (supply)

Displayed as:

stacked horizontal density bars
aligned to price axis
2.2.6 Alarm Threshold Lines
daily FX deviation limits
volatility trigger lines
alert icons on threshold crossings
2.2.7 Event Timeline (bottom of chart)
macro news
internal events
spikes in order flow
policy changes

All timestamp-aligned with chart

3. SYSTEM LOOP ARCHITECTURE
3.1 10-Second Decision Loop

Every cycle:

Step 1 — Data Snapshot
market feeds
order pressure
positions
velocity
Step 2 — Tool Calls
order pressure engine
volatility analyzer
simulation engine
Step 3 — Decision Synthesis
hold / publish / smooth step
Step 4 — UI Broadcast
chat message
chart marker update
optional smooth path update
4. KEY PRODUCT CONCEPT (VERY IMPORTANT)
🔥 “Live Pricing Policy Engine”

This is no longer a dashboard system.

It is:

a continuously executing FX pricing policy system with human-in-the-loop approval.

5. HUMAN ROLE SHIFT
Before:
trader decides pricing
system supports
Now:
system decides every 10 seconds
human approves / overrides
6. CORE UI INNOVATION SUMMARY
6.1 Blinking Decision Point
every decision becomes a visual event
6.2 Live Pricing Policy Stream
chat = decision log + control surface
6.3 Time-synced market + decision graph
market, client, and agent all in one axis
6.4 One-click decision acceptance
instant policy activation
7. FINAL PRODUCT POSITIONING

FX Treasury Intelligence Cloud is now:

A real-time FX pricing decision system where an AI agent continuously proposes executable FX rate updates every 10 seconds, visualized directly on a live market control chart and governed through human-in-the-loop approval.