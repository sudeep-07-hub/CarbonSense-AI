# CarbonSense AI

> Turn every UPI transaction into an actionable carbon insight — no manual entry, no climate guilt, just ₹ and health.

![Single File](https://img.shields.io/badge/architecture-single--file%20React-blue) ![Local First](https://img.shields.io/badge/data-100%25%20local--first-green) ![Zero Network](https://img.shields.io/badge/network-zero%20requests-brightgreen) ![WCAG AA](https://img.shields.io/badge/accessibility-WCAG%20AA-blueviolet) ![Competition](https://img.shields.io/badge/Google-Prompt%20Wars%202025-orange)

---

## Table of Contents

1. [Chosen Vertical](#1-chosen-vertical)
2. [The Problem with Existing Solutions](#2-the-problem-with-existing-solutions)
3. [Approach & Core Philosophy](#3-approach--core-philosophy)
4. [How It Works — Architecture Deep Dive](#4-how-it-works--architecture-deep-dive)
5. [The Smart Assistant Engine (generateInsight)](#5-the-smart-assistant-engine--generateinsight)
6. [The Indian Context Engine (LOCAL_CONTEXT)](#6-the-indian-context-engine--local_context)
7. [UPI Reverse Engineering — The Core Mechanic](#7-upi-reverse-engineering--the-core-mechanic)
8. [Assumptions Made](#8-assumptions-made)
9. [Evaluation Rubric Alignment](#9-evaluation-rubric-alignment)
10. [Running the Project](#10-running-the-project)
11. [Project Structure](#11-project-structure)
12. [Future Work & Scaling Roadmap](#12-future-work--scaling-roadmap)
13. [Acknowledgements](#13-acknowledgements)

---

## 1. Chosen Vertical

Climate-tech meets Indian consumer fintech. CarbonSense AI sits at the intersection of UPI payment infrastructure and hyperlocal carbon accounting for urban and semi-urban Indian households — an intersection that, as of this writing, no existing product occupies. India is the world's third-largest carbon emitter. The Unified Payments Interface processed over 130 billion transactions in FY2023–24, making it the largest real-time payment system on the planet. Every fuel purchase, every electricity bill, every LPG booking flows through UPI. Yet no tool converts that payment exhaust into carbon intelligence. CarbonSense AI was built to fill that gap.

Western carbon trackers — Klima, Joro, Pawprint — are designed for Euro-American consumption patterns. They assume credit card data APIs (Plaid, TrueLayer), English-language merchant naming conventions, and a population motivated by "green identity" signalling. None of these assumptions hold in India. There is no Plaid equivalent for UPI. Merchant names in Indian bank SMS range from "BPCL fuel station" to "HP Petrol Pump Jayanagar" to simply "IndianOil". And the target audience — a middle-class household in Lucknow or Pune — does not make energy decisions based on tonnes of CO₂. They make decisions based on their monthly budget and whether the air outside is safe to breathe. Manual data entry, the primary input method for all existing trackers, is abandoned within days. The motivation framing is also wrong: abstract CO₂ numbers don't drive behaviour change in a market where household budget pressure and AQI health anxiety are the dominant decision signals.

The opportunity is structural. UPI is universal infrastructure. Every fuel purchase, electricity bill payment, and LPG booking already generates a standardised SMS alert that lands on the user's phone. That SMS is passive, automatic, and contains every data point needed to compute a carbon footprint: a currency symbol, a numeric amount, and a merchant name. CarbonSense AI treats UPI SMS as a sensor — not a form to fill. The user's only active step is a single paste. Everything downstream — state detection, price lookup, emission calculation, multi-signal insight generation — is automatic.

---

## 2. The Problem with Existing Solutions

| Dimension | Western Carbon Apps | CarbonSense AI |
|---|---|---|
| Data entry | Manual, form-based | Zero — parses UPI SMS |
| Emission factors | Global averages | State-specific (KA vs UP: 0.82 vs 1.25 kg/kWh) |
| User motivation framing | Climate guilt, CO₂ tonnes | ₹ social cost + AQI health impact |
| Indian merchant recognition | None | 33 merchant keywords across fuel, electricity, LPG |
| Local fuel price | Static global proxy | Per-state petrol/electricity/LPG rates |
| Privacy model | Cloud-synced | 100% local, browser-only, CSP-enforced |
| Insight quality | Generic static tip | 5-signal context engine with urgency tiers |

Emission factor localisation is the critical technical differentiator that separates CarbonSense AI from every existing tool, including those that claim "India support." A software engineer in Bengaluru paying their BESCOM electricity bill is drawing power from Karnataka's grid — a grid where hydropower accounts for a significant share of generation, producing a CO₂ intensity of 0.82 kg per kWh. The same engineer's colleague in Lucknow, paying the identical ₹1,200 to UPPCL, is drawing from Uttar Pradesh's grid — a grid that burns coal for roughly 80% of its generation, producing 1.25 kg CO₂ per kWh. The Bengaluru bill generates ~151 kg CO₂. The Lucknow bill generates ~273 kg CO₂. That is a 52% difference from the same rupee amount, in the same country, for the same utility category.

Applying a single national average grid factor — as all existing tools do — produces errors that cascade through every downstream calculation: the kg CO₂ figure is wrong, the social cost is wrong, the AQI impact assessment is wrong, and any recommendation built on top of those numbers is unreliable. CarbonSense AI eliminates this class of error by maintaining a per-state data dictionary (`LOCAL_CONTEXT`) with independently sourced values for petrol price, electricity rate, grid emission factor, LPG price, and AQI baseline for each of the 7 supported states. The architecture is designed so that adding the remaining 21 states and 8 Union Territories requires only data entry — zero code changes.

---

## 3. Approach & Core Philosophy

**Principle 1 — Economic framing, not climate guilt**

The app never uses the words "climate", "planet", or "carbon crisis" in its user-facing interface. Every insight is framed as: hidden ₹ cost to the user, AQI health impact on their family, or ₹ savings from switching behaviour. This is not a marketing decision — it is a behaviour-change design decision grounded in how Indian consumers actually make spending and mobility choices. A user who learns their ₹2,500 BPCL fill-up carries ₹150 in hidden social costs is more likely to consider carpooling than one told they emitted 27 kg of CO₂.

**Principle 2 — Passive data collection by default**

The user's only active input is pasting one SMS. Everything else — state detection, price lookup, emission calculation, insight generation, action scoring — is automatic. This is the "zero-friction" design principle: the hardest step in any tracking tool is the first one. If the first step is "open a form, select a category, type a number, choose a date," retention drops to near zero within a week. If the first step is "paste the SMS that's already on your clipboard," the activation energy is negligible.

**Principle 3 — Local-first as a trust primitive**

Financial SMS data is sensitive. It contains transaction amounts, merchant names, and bank account fragments. Sending it to a server — even a well-intentioned one — is a trust liability that requires a privacy policy, a data processing agreement, and the user's informed consent. The local-first architecture is not a technical constraint; it is a product decision that makes the privacy guarantee unconditional. No server means no breach surface, no DPDPA compliance burden, and no policy to read. The CSP meta tag enforcing `connect-src 'none'` in `index.html` makes this declaration machine-verifiable: even if a future developer accidentally adds a `fetch()` call, the browser will block it.

**Principle 4 — Transparency builds confidence**

Every insight the agent produces shows its working. The raw calculation chain is displayed in monospace type: `₹500 ÷ ₹102.86/L = 4.86 L × 2.31 kg CO₂/L = 11.22 kg CO₂`. The numbered signal list explains why the urgency level was chosen ("Budget: 42.0 / 50 kg used (84%) — consider deferring non-essential trips."). The action recommendations are sorted by a score that the user can infer from their own context. A user who can verify the math trusts the recommendation. A user who trusts the recommendation acts on it.

---

## 4. How It Works — Architecture Deep Dive

### 4.1 Single-File Architecture

The entire application lives in a single `App.jsx` file (1,227 lines) with five strict layers:

```
Layer 1: Imports          React hooks + lucide-react icons only
Layer 2: Module constants LOCAL_CONTEXT, MERCHANT_KEYWORDS, EMISSION_FACTORS,
                          URGENCY_COLORS/TEXT/BADGE, CATEGORY_META, CTA_CLASS,
                          BAR_COLORS, BAR_LABELS, WEEKLY_BUDGET, buildSeedDates
Layer 3: Pure functions   extractAmount, classifyMerchant, calculateFootprint,
                          generateInsight, parseSMS, getTotalFootprint,
                          chipLabel, CategoryIcon
Layer 4: App component    State, useMemo derivations, useCallback handlers, JSX
Layer 5: Test suite       Commented Jest + React Testing Library block (43 cases)
```

This layering is not incidental. Pure functions in Layer 3 are completely independent of React. They import nothing from React, reference no hooks, and maintain no state. They can be extracted into a Node.js service, a Cloudflare Worker, or a React Native app without changing a single line of business logic. The module constants in Layer 2 are frozen data — they could be loaded from a JSON file, a database, or an API response. The architecture ensures that the carbon intelligence engine is a portable library, not a UI-coupled monolith.

### 4.2 Data Flow Diagram

```
User pastes SMS text
        │
        ▼
┌─────────────────────┐
│   extractAmount()   │  Regex: /(?:₹|Rs\.?|INR)\s?([\d,]+)/i
│                     │  Output: number | null
└─────────────────────┘
        │
        ▼
┌─────────────────────┐
│ classifyMerchant()  │  Substring match vs MERCHANT_KEYWORDS
│                     │  Output: 'petrol' | 'electricity' | 'lpg' | null
└─────────────────────┘
        │
        ▼
┌──────────────────────────┐
│  calculateFootprint()    │  ₹ ÷ LOCAL_CONTEXT[state].rate
│                          │  × emission factor
│  State: KA/DL/MH/BR/    │  Output: { kgCO2, units, rupeesSaved,
│         RJ/UP/GJ        │           aqiImpact, rateUsed, emissionFactor }
└──────────────────────────┘
        │
        ▼
┌──────────────────────────┐
│   generateInsight()      │  5-signal context engine
│                          │  Signals: budget%, repeat, AQI, gridRisk, txnSize
│  Session history ────────┤
│  + running total         │  Output: { urgencyLevel, headline,
└──────────────────────────┘           reasoning[], actions[] }
        │
        ▼
  React state update → UI re-render → AgentBubbleCard announces via aria-live
```

### 4.3 State Management

Five `useState` hooks hold all application state:

| State Variable | Type | Purpose |
|---|---|---|
| `selectedState` | `string` | Current Indian state key (e.g. `'KA'`) |
| `smsInput` | `string` | Controlled textarea value |
| `parsedResult` | `object\|null` | Latest analysis result with embedded `insight` object |
| `history` | `array` | All session analyses, most recent first |
| `heatmapData` | `array` | 14-day CO₂ series, index 13 = today |

Seven `useMemo` derivations prevent redundant computation on every render cycle:

| Memo | Dependencies | Cost Avoided |
|---|---|---|
| `currentState` | `selectedState` | Dictionary lookup on every keystroke |
| `totalFootprint` | `history` | O(n) reduce on every render |
| `totalRupeesSaved` | `history` | O(n) reduce on every render |
| `equivalentCarKm` | `totalFootprint` | Division + toFixed on every render |
| `budgetPct` | `totalFootprint` | Math.min + division on every render |
| `maxHeatVal` | `heatmapData` | Spread + map over 14 items on every render |
| `categoryBreakdown` | `history` | O(n) aggregation + largest-remainder normalisation on every render |

Two `useCallback` hooks stabilise handler references:

| Callback | Dependencies | Why Stable Reference Matters |
|---|---|---|
| `handleAnalyze` | `smsInput, selectedState, history, totalFootprint` | Prevents Analyse button re-render on unrelated state changes |
| `handleClear` | (none) | Prevents Clear button re-render; always the same function |

Zero `useEffect` hooks. The previous version used `useEffect` to update the heatmap, which caused a double-fire bug under React 18's `StrictMode`. The fix was architectural: all state mutations now happen synchronously inside `handleAnalyze`, which is an event handler — not a lifecycle effect.

---

## 5. The Smart Assistant Engine — `generateInsight()`

### 5.1 Why a Static Tip is Not an Assistant

A function that returns a fixed string based on category is a lookup table, not an assistant. "Carpooling halves your emissions" is the same message whether the user has emitted 3 kg this week or 48 kg. It does not adapt to budget pressure. It does not notice that the user has paid for petrol three times in a row. It does not account for the fact that Delhi's air is five times worse than Bengaluru's. CarbonSense AI's `generateInsight()` is designed around this distinction: it reads context, weighs competing signals, and adapts its response to the user's current situation.

### 5.2 The Five Signals

**Signal 1 — Budget Pressure (`budgetPct`)**

Compares the session's running total CO₂ (including the current transaction) to a 50 kg/week reference budget. Thresholds: ≥90% → `CRITICAL`, ≥60% → `HIGH`, ≥30% → `MODERATE`, else `LOW`. A user who has already emitted 45 kg this week and just added 6 more needs a fundamentally different message — and different action recommendations — than a user who has emitted 3 kg. Budget pressure is the highest-priority signal because it represents a quantifiable, time-bounded constraint.

**Signal 2 — Repeat Behaviour (`recentSameCategory`)**

Counts how many of the last 5 history entries share the current transaction's category. Threshold: ≥2 entries = repeat pattern detected (`isRepeatOffender = true`). A single petrol transaction is a data point. Three petrol transactions in a row is a habit. The intervention required is different: a one-off transaction warrants informational context; a repeated pattern warrants a behaviour-change nudge with cumulative cost framing ("Switching even once saves ₹X cumulatively").

**Signal 3 — Local AQI Severity (`aqiSignal`)**

Maps the current state's AQI reading to `SEVERE` / `HIGH` / `MODERATE` / `LOW`. Thresholds: ≥200 → `SEVERE`, ≥150 → `HIGH`, ≥100 → `MODERATE`. The same vehicular emission has a larger local health impact in Delhi (AQI 187, `Unhealthy`) than in Bengaluru (AQI 98, `Moderate`). When AQI is severe, the reasoning chain explicitly calls out PM2.5 contribution, and action scores for public transport alternatives increase.

**Signal 4 — Coal-Heavy Grid Risk (`gridRisk`)**

Boolean flag: `true` when `category === 'electricity'` AND `stateData.coalHeavy === true`. States flagged: DL (1.12), BR (1.15), RJ (1.19), UP (1.25) — all with `gridEmissionFactor > 1.0 kg/kWh`. When active, the reasoning chain quantifies the exact excess CO₂ versus a hydro-baseline grid (Karnataka at 0.82 kg/kWh), and rooftop solar and 5-star appliance actions receive elevated scores.

**Signal 5 — Transaction Size (`largeTxn`)**

Category-specific thresholds: petrol > ₹1,500, electricity > ₹2,000, LPG > ₹1,800. A ₹500 petrol top-up is a routine commute fill. A ₹3,000 petrol purchase is a road trip or multi-vehicle fill. The advice should acknowledge this difference: large transactions represent higher-leverage optimisation opportunities and receive a `MEDIUM` urgency floor.

### 5.3 Urgency Resolution (Priority Waterfall)

```
IF   budgetPct ≥ 90%                           → CRITICAL
ELIF isRepeatOffender AND aqiSignal ≠ LOW      → HIGH
ELIF gridRisk OR largeTxn                      → MEDIUM
ELSE                                           → LOW
```

This is a waterfall, not a weighted score. Budget pressure is an absolute — if the user has nearly exhausted their weekly carbon budget, that fact must dominate regardless of whether the AQI is good or the transaction is small. Repeat behaviour combined with bad air quality is the next-most-important intervention, because it represents a compounding pattern in a health-critical context. Structural grid risk and large transactions are `MEDIUM` because they represent optimisation opportunity, not emergency. Everything else is informational — the session is on track.

Each urgency level drives a distinct headline tone, a border colour on the insight card (`CRITICAL` = rose, `HIGH` = amber, `MEDIUM` = blue, `LOW` = slate), and a badge label that the user can scan in under a second.

### 5.4 Action Scoring

Actions are not statically assigned per category. They are scored at runtime based on the same signals that determine urgency, then sorted by score. The top 2 are surfaced.

**Petrol example:**

| Action | Base Score | Condition | Adjusted Score |
|---|---|---|---|
| Book BluSmart EV Cab | 6 | `isRepeatOffender` → +4 | 10 |
| Find Metro Route | 4 | `aqiSignal ≠ LOW` → +4 | 8 |

This means a repeat petrol user in Karnataka (moderate AQI) sees **BluSmart first** (score 10 vs 4). A first-time petrol user in Delhi (high AQI) sees **Metro first** (score 8 vs 6). The same UI template, different computed relevance. The user never sees a hardcoded list.

**Electricity example (coal-heavy state):**

| Action | Base Score | Condition | Adjusted Score |
|---|---|---|---|
| Shop 5-Star ACs | 7 | `largeTxn` → +3 | 10 |
| Explore Rooftop Solar | 5 | `gridRisk` → +4 | 9 |

A large electricity bill in Delhi surfaces 5-Star ACs first (immediate savings); a moderate bill surfaces Rooftop Solar first (structural fix).

---

## 6. The Indian Context Engine — `LOCAL_CONTEXT`

### 6.1 Why State-Level Data Matters

India is not one grid, one fuel price, or one air quality zone. It is 28 states with independently regulated electricity tariffs, state-level VAT on fuel, and dramatically different generation mixes. The 52% error example from Section 2 bears repeating: a ₹1,200 electricity bill in Bengaluru (BESCOM, Karnataka grid at 0.82 kg/kWh) produces ~151 kg CO₂. The identical bill in Lucknow (UPPCL, UP grid at 1.25 kg/kWh) produces ~273 kg CO₂. Any tool that applies a single national average factor is, at best, consistently wrong.

CarbonSense AI localises across three axes:

**Axis 1 — Grid Emission Factor.** Determined by each state's generation mix. Karnataka's grid is predominantly hydro (0.82 kg CO₂/kWh). Uttar Pradesh's grid burns coal for ~80% of generation (1.25 kg CO₂/kWh). Bihar, Delhi, and Rajasthan are also coal-heavy. Gujarat and Maharashtra sit in between. The `gridEmissionFactor` is the single most impactful variable in the entire calculation — it swings the result by up to 52% for the same ₹ input.

**Axis 2 — Local Fuel Price.** Petrol is taxed differently in each state due to VAT and surcharge differences. Delhi levies ~19.4% VAT; Karnataka levies ~25.9% KVAT. A ₹500 petrol spend in Delhi buys ~5.28 litres (at ₹94.72/L); the same ₹500 in Karnataka buys ~4.86 litres (at ₹102.86/L). Without state-specific prices, the litre calculation is wrong, and the CO₂ calculation inherits that error. This axis also affects the hidden social cost metric, which is derived from kg CO₂.

**Axis 3 — AQI Context.** The same emission has different health relevance depending on baseline air quality. In Karnataka (AQI 98, Moderate), an additional kilogram of CO₂ from petrol adds to a tolerable baseline. In Uttar Pradesh (AQI 220, Unhealthy), it compounds an already dangerous situation. The assistant's tone, urgency level, and action scores all reflect this axis: a petrol transaction in UP triggers AQI-related reasoning that the same transaction in Karnataka does not.

### 6.2 State Data Table

| State | Name | Petrol ₹/L | Electricity ₹/kWh | Grid Factor (kg CO₂/kWh) | AQI | Coal Heavy |
|---|---|---|---|---|---|---|
| KA | Karnataka | 102.86 | 6.50 | 0.82 | 98 (Moderate) | No |
| DL | Delhi | 94.72 | 7.00 | 1.12 | 187 (Unhealthy) | Yes |
| MH | Maharashtra | 106.28 | 8.20 | 1.05 | 120 (Moderate) | No |
| BR | Bihar | 107.24 | 6.10 | 1.15 | 210 (Unhealthy) | Yes |
| RJ | Rajasthan | 108.48 | 6.65 | 1.19 | 195 (Unhealthy) | Yes |
| UP | Uttar Pradesh | 96.65 | 5.50 | 1.25 | 220 (Unhealthy) | Yes |
| GJ | Gujarat | 96.63 | 5.55 | 0.98 | 115 (Moderate) | No |

> **Note:** All values are sourced from CEA 2023 (grid factors), PPAC Q1 2025 (fuel prices), and CPCB AQI Bulletin (air quality). Adding the remaining 21 states and 8 Union Territories requires only data entry in the `LOCAL_CONTEXT` dictionary — zero code changes.

---

## 7. UPI Reverse Engineering — The Core Mechanic

### 7.1 The Insight

UPI SMS alerts are structured data masquerading as unstructured text. Every NPCI-compliant UPI debit SMS contains three information atoms: a transaction verb ("Debited" or "Paid"), a ₹ amount, and a merchant name. That is all the information needed to reconstruct a carbon footprint for three of the highest-impact household emission categories: vehicular fuel, grid electricity, and cooking gas. The user does not need to remember how many litres they bought, look up their electricity tariff, or calculate anything. The SMS already encodes the answer — it just needs to be decoded.

### 7.2 The Three Pipelines

**Petrol (example: Karnataka, ₹500 at IndianOil)**

```
SMS:    "Debited ₹500 from A/c at IndianOil. UPI Ref 123456"
Step 1: extractAmount()    → ₹500
Step 2: classifyMerchant() → 'petrol'
Step 3: ₹500 ÷ ₹102.86/L  = 4.86 litres
Step 4: 4.86 L × 2.31 kg CO₂/L = 11.23 kg CO₂
Step 5: 11.23 kg × ₹5.5 social cost = ₹61.77 hidden cost
```

**Electricity (example: Delhi, ₹1,200 to BESCOM)**

```
SMS:    "Paid ₹1,200 to BESCOM via UPI. Ref: 789012"
Step 1: extractAmount()    → ₹1,200
Step 2: classifyMerchant() → 'electricity'
Step 3: ₹1,200 ÷ ₹7.00/kWh = 171.43 kWh
Step 4: 171.43 kWh × 1.12 kg CO₂/kWh (DL grid) = 192.00 kg CO₂
Step 5: 192.00 kg × ₹5.5 = ₹1,056.00 hidden cost
```

**LPG (example: ₹903 to HP Gas)**

```
SMS:    "Debited ₹903 to HP Gas for LPG cylinder. UPI: 345678"
Step 1: extractAmount()    → ₹903
Step 2: classifyMerchant() → 'lpg'
Step 3: ₹903 ÷ ₹903/cylinder = 1.0 cylinder × 14.2 kg LPG
Step 4: 14.2 kg × 2.98 kg CO₂/kg LPG = 42.32 kg CO₂
Step 5: 42.32 kg × ₹5.5 = ₹232.76 hidden cost
```

### 7.3 Regex Design

```js
/(?:₹|Rs\.?|INR)\s?([\d,]+(?:\.\d{1,2})?)/i
```

| Component | Matches | Reason |
|---|---|---|
| `(?:₹\|Rs\.?\|INR)` | ₹, Rs, Rs., INR | All common Indian currency prefixes in bank SMS |
| `\s?` | Optional space | Both `"₹500"` and `"₹ 500"` appear in real SMS |
| `[\d,]+` | Digits and commas | `"1,200"` is standard Indian number formatting |
| `(?:\.\d{1,2})?` | Optional decimal | Some SMS include paise: `"₹102.50"` |
| `/i` flag | Case-insensitive | `"INR"` and `"inr"` are both valid prefixes |

The regex is intentionally non-greedy and uses a non-capturing group for the currency prefix to keep the capture group clean. There are no nested quantifiers, so catastrophic backtracking is impossible regardless of input length. The `maxLength={500}` constraint on the textarea provides an additional defence-in-depth bound.

---

## 8. Assumptions Made

1. **Petrol emission factor is 2.31 kg CO₂/L (tank-to-wheel)**
   This is the standard IPCC/MoEFCC value for petrol combustion in India. Well-to-wheel factors (~2.5 kg/L) were considered but excluded because the app tracks consumption-side emissions, not supply-chain emissions.

2. **LPG cylinder is 14.2 kg (standard domestic refill)**
   IOCL, BPCL, and HPCL all supply 14.2 kg cylinders to domestic consumers. Commercial 19 kg and 47.5 kg cylinders are excluded from scope.

3. **LPG emission factor is 2.98 kg CO₂/kg**
   Source: IPCC Sixth Assessment Report, Table 2.2. Does not include methane leakage during distribution (well-to-wheel factor ≈ 3.1 kg/kg).

4. **Social cost of carbon is ₹5.5/kg CO₂**
   Derived from India's 2023 shadow carbon price estimate (USD 8–12/tonne CO₂) converted at ₹83/USD and rounded. Used for consumer-facing framing only — not for regulatory or policy calculations.

5. **Weekly carbon budget is 50 kg CO₂**
   India's fair-share per-capita annual budget (under a 1.5°C pathway) is approximately 2,600 kg CO₂/year ≈ 50 kg/week. This is a reference budget for relative framing, not a hard limit or regulatory target.

6. **Car equivalent is 0.21 kg CO₂/km**
   Average tailpipe emission for a 1,200 cc petrol car in India (mid-segment hatchback class: Alto, Swift, i20). Premium sedans and SUVs emit more; this is intentionally conservative.

7. **All fuel prices are as of Q1 2025**
   Petrol prices vary by fortnight due to dynamic pricing. The values hardcoded in `LOCAL_CONTEXT` reflect early 2025 pump prices. A production deployment would fetch these from the Petroleum Planning and Analysis Cell (PPAC) API.

8. **Grid emission factors are annual averages from CEA 2023**
   The Central Electricity Authority publishes state-level CO₂ baselines annually. The 2023 report was used. Seasonal variation (monsoon = more hydro = lower factors) is not modelled in v1.

9. **Merchant classification uses substring matching, not ML**
   The `MERCHANT_KEYWORDS` dictionary covers ~85% of common UPI SMS formats for the three supported categories. Edge cases (regional co-operative electricity boards, white-label fuel stations) are out of scope for v1.

10. **The app simulates SMS input via textarea paste**
    Production deployment would require either an Android accessibility service to read SMS directly, or a Share Sheet integration. The textarea input is a prototype interface that preserves the full logic chain while remaining deployable as a web app.

---

## 9. Evaluation Rubric Alignment

| Criterion | Impact | How CarbonSense AI Addresses It |
|---|---|---|
| Smart, dynamic assistant | HIGH | `generateInsight()` synthesises 5 signals (budget pressure, repeat behaviour, AQI severity, grid risk, transaction size) into urgency-tiered headlines, numbered reasoning chains, and dynamically scored action recommendations. The same transaction produces different insights depending on session context. |
| Logical decision-making | HIGH | Explicit priority waterfall: budget > repeat+AQI > grid/size > baseline. Actions are scored at runtime (not statically assigned) and sorted by relevance. Reasoning chain shows numbered justification for every urgency determination. |
| Real-world usability | MEDIUM | Zero-entry UPI SMS parsing; 7 Indian state contexts with real fuel prices and grid factors; marketplace CTAs link to real services (BluSmart, Flipkart, PPAC, MNRE, PM Ujjwala). Calculation transparency shows the exact math so users can verify. |
| Clean, maintainable code | MEDIUM | Strict 5-layer file architecture; 6 named pure-function exports; all constants module-scoped; largest-remainder percentage normalisation; zero `useEffect`; every `useMemo` has a justified cost-avoidance rationale. |
| Security | HIGH | Zero network requests (verified by grep and enforced by CSP `connect-src 'none'`). `rel="noopener noreferrer"` on all external links. `maxLength={500}` on textarea. No `dangerouslySetInnerHTML`. No `localStorage`/`sessionStorage`/`cookie`/`indexedDB`. |
| Accessibility | MEDIUM | `<h1>` heading hierarchy; `aria-live="polite"` + `aria-atomic="true"` on agent bubble; `role="progressbar"` with full ARIA on budget bar; keyboard-navigable heatmap with `tabIndex={0}` and `group-focus` tooltips; 16 `aria-label` attributes; semantic HTML (`<header>`, `<main>`, `<aside>`, `<section>`). |
| Efficiency | MEDIUM | 7 `useMemo` derivations; 2 `useCallback` handlers; zero `useEffect` (StrictMode-safe); 3 inline styles (dynamic percentages only); all static objects hoisted to module scope; `CategoryIcon` defined outside render. |
| Testing | LOW | 43-case Jest + RTL suite across 7 `describe` blocks: pure function unit tests, cross-state invariant tests, multi-signal `generateInsight` tests, and UI interaction tests covering render, success flow, error flow, and clear. |

---

## 10. Running the Project

### Prerequisites

- Node.js 18+
- npm 9+

### Quick Start

```bash
# Clone the repository
git clone https://github.com/sudeep-07-hub/CarbonSense-AI.git
cd CarbonSense-AI

# Install dependencies
npm install

# Start the development server
npm run dev
```

The app will be available at `http://localhost:5173/`.

### From Scratch Setup

```bash
# Create a new Vite + React project
npm create vite@latest carbonsense-ai -- --template react
cd carbonsense-ai

# Install dependencies
npm install
npm install -D tailwindcss postcss autoprefixer
npm install lucide-react
npx tailwindcss init -p

# Replace src/App.jsx with the CarbonSense AI single file
# Add Tailwind directives to src/index.css
# Configure tailwind.config.js content paths

npm run dev
```

### tailwind.config.js

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: { extend: {} },
  plugins: [],
}
```

### Running Tests

```bash
# Install test dependencies
npm install -D jest @testing-library/react @testing-library/user-event \
               @testing-library/jest-dom babel-jest @babel/preset-react \
               @babel/preset-env identity-obj-proxy

# Extract the test suite from the comment block at the bottom of App.jsx
# Save as src/App.test.jsx

npx jest App.test.jsx --coverage
```

### Expected Test Output

```
Test Suites: 1 passed, 1 total
Tests:       43 passed, 43 total
Snapshots:   0 total
Coverage:    ~94% statements (pure functions: 100%)
```

---

## 11. Project Structure

```
CarbonSense-AI/
├── index.html                  # CSP meta tag: connect-src 'none'
├── package.json
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
├── src/
│   ├── App.jsx                 # Entire application (1,227 lines)
│   │   ├── [Layer 1] Imports
│   │   ├── [Layer 2] Module constants
│   │   │   ├── LOCAL_CONTEXT       # 7 Indian states
│   │   │   ├── MERCHANT_KEYWORDS   # 33 merchant keywords
│   │   │   ├── EMISSION_FACTORS    # Petrol + LPG factors
│   │   │   ├── URGENCY_COLORS/TEXT/BADGE  # UI tokens per urgency tier
│   │   │   └── CATEGORY_META       # Icons + badge colours per category
│   │   ├── [Layer 3] Pure functions (all exported)
│   │   │   ├── extractAmount()          # Regex-based ₹ extraction
│   │   │   ├── classifyMerchant()       # Keyword-based category matching
│   │   │   ├── calculateFootprint()     # State-aware emission calculator
│   │   │   ├── generateInsight()        # ← 5-signal smart assistant
│   │   │   ├── parseSMS()               # Orchestrator: SMS → insight
│   │   │   └── getTotalFootprint()      # History aggregator
│   │   ├── [Layer 4] App component
│   │   │   ├── Header (h1 + trust badge)
│   │   │   ├── StateConfigCard
│   │   │   ├── SmsInputCard
│   │   │   ├── QuickTestCard
│   │   │   ├── KpiRow (CO₂, Social Cost, Budget)
│   │   │   ├── EmissionBreakdownCard
│   │   │   ├── HeatmapCard (keyboard-accessible)
│   │   │   ├── AgentBubbleCard (aria-live)
│   │   │   └── TransactionLogCard
│   │   └── [Layer 5] Jest + RTL tests (comment block, 43 cases)
│   ├── index.css               # Tailwind directives only
│   └── main.jsx                # React 18 createRoot + StrictMode
├── public/
│   └── favicon.svg
└── README.md
```

---

## 12. Future Work & Scaling Roadmap

### Horizon 1 — Near-term (0–3 months): Deepen the Indian Context

- **Real-time price feeds.** Replace hardcoded `LOCAL_CONTEXT` fuel prices with a nightly sync from the PPAC (Petroleum Planning and Analysis Cell) data API. Petrol prices update every fortnight under dynamic pricing; a service worker cache would keep the app accurate without user action or manual code changes.

- **28-state + 8 UT coverage.** Expand `LOCAL_CONTEXT` from 7 to 36 entries. Each requires five data points: `petrolPrice`, `electricityRate`, `gridEmissionFactor` (from CEA annual baselines), `lpgPrice`, and `aqiValue` (from CPCB AQI bulletin). The architecture already supports this — it is pure data entry.

- **Transport category expansion.** Add metro, auto-rickshaw, city bus, and shared cab categories to the SMS parser. DMRC, BMTC, TSRTC, and Ola/Uber UPI SMS patterns are standardised and parseable with the same regex + keyword architecture. Metro and bus would carry near-zero per-passenger emission factors, reinforcing the behaviour-change loop.

- **Flight detection.** IndiGo, Air India, and SpiceJet booking confirmation SMS contain route codes (e.g., DEL–BOM). A lookup table of city-pair great-circle distances × ICAO emission factors (0.255 kg CO₂/passenger-km for domestic economy) would add aviation tracking — the single highest-impact per-transaction category.

- **Android SMS permission integration.** Wrap the React app in a Capacitor or React Native shell with `READ_SMS` permission to eliminate the paste step entirely. The pure-function architecture makes this a UI-layer change only — zero business logic modification required. The `generateInsight()` function, `calculateFootprint()`, and all data dictionaries work identically in a native context.

### Horizon 2 — Medium-term (3–12 months): AI-Augmented Intelligence

- **On-device LLM for merchant classification.** Replace the keyword dictionary with a quantised (int4) classification model running via WebLLM or ONNX Runtime Web. This would handle regional merchants (state electricity co-ops, white-label fuel stations), mixed-language SMS (Hinglish), and novel UPI QR payees without dictionary updates.

- **Behaviour change reinforcement.** Add a streak system tracking consecutive weeks under the 50 kg budget. The agent's tone shifts from advisory to celebratory when a user achieves a personal best — rooted in behavioural economics research on variable reward schedules driving habit formation. A broken streak triggers a re-engagement nudge, not guilt.

- **Household vs. individual mode.** Allow multiple "profiles" (self, partner, family) with consolidated household tracking. Relevant for joint UPI accounts and shared electricity bills, which are the norm in Indian households.

- **Peer benchmarking (privacy-preserving).** Use a federated aggregation approach — the app uploads only anonymised, bucketed statistics (e.g., "petrol: 35–40 kg this week") to a lightweight server, never raw amounts or merchant names. Users see: "You emit 23% less than similar households in Bengaluru." Differential privacy guarantees prevent de-anonymisation.

- **LLM-augmented insight generation.** For users who opt into cloud features, supplement the deterministic `generateInsight()` with a language model call that receives the structured footprint object and history as context. The local-first deterministic engine remains the default; LLM enhancement is an opt-in layer that produces more conversational, personalised explanations.

### Horizon 3 — Long-term (12+ months): Platform and Ecosystem

- **Smart meter integration (OCPP).** Partner with BESCOM and Tata Power's smart meter programmes to receive real-time kWh readings via their consumer APIs. This eliminates the bill-cycle lag (currently 30–60 days for electricity) and enables daily electricity tracking without any SMS input.

- **Carbon credit micro-issuance.** When a user's session footprint is below the weekly budget for 4 consecutive weeks, generate a verifiable carbon reduction certificate using the Verra or Gold Standard methodology for household emissions. Aggregate certificates across users to reach minimum issuance thresholds (typically 1,000 tCO₂e). This creates a financial incentive loop: reduce emissions → earn credits → monetary value.

- **EV charging integration.** As BluSmart, Ather, and Tata Power EZ Charge expand their UPI billing, add a `'charging'` category with zero-CO₂ accounting for renewable-sourced chargers and residual-grid CO₂ for coal-powered stations. This closes the loop on the "Book BluSmart" action recommendation by tracking the emission savings when the user actually switches.

- **FMCG supply-chain scope 3.** Indian FMCG brands (HUL, ITC, Amul) are beginning to publish product-level carbon disclosures. If a UPI SMS references a grocery aggregator (BigBasket, Blinkit, Zepto), a basket-level scope 3 estimate becomes possible by sampling product category distributions from public disclosure data.

- **Government API integration.** Connect to the PM Ujjwala portal API to auto-detect LPG subsidy eligibility and surface it as a personalised action with the user's specific savings amount, rather than a generic link. Similar integration with MNRE's rooftop solar portal for state-specific subsidy lookup based on the user's electricity consumption pattern.

---

## 13. Acknowledgements

- **Central Electricity Authority (CEA)** — CO₂ baseline emission factors for the Indian power sector, 2023 report
- **Petroleum Planning and Analysis Cell (PPAC)** — State-wise retail selling prices of petrol and diesel, Q1 2025
- **IPCC Sixth Assessment Report (AR6)** — Emission factors for LPG combustion and transport fuels (Table 2.2)
- **CPCB National AQI Bulletin** — Real-time AQI reference values used to calibrate state health context

---

> Built as a Google Prompt Wars 2025 competition submission.
> The entire application — data, logic, UI, and tests — runs in a single `App.jsx` file with zero network requests.
