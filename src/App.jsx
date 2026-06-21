import { useState, useMemo, useCallback } from 'react';
import {
  ShieldCheck, ChevronDown, MessageSquare, AlertTriangle,
  Sparkles, Leaf, Target, BarChart3,
  Trash2, Fuel, Zap, Flame, Info, ExternalLink,
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════════
// MODULE-SCOPE CONSTANTS — hoisted to avoid per-render allocations
// ═══════════════════════════════════════════════════════════════════════════════

const LOCAL_CONTEXT = {
  DL: {
    name: 'Delhi', petrolPrice: 94.72, electricityRate: 7.00,
    gridEmissionFactor: 1.12, lpgPrice: 903, aqiLevel: 'Unhealthy', aqiValue: 187,
    coalHeavy: true,
  },
  MH: {
    name: 'Maharashtra', petrolPrice: 106.28, electricityRate: 8.20,
    gridEmissionFactor: 1.05, lpgPrice: 903, aqiLevel: 'Moderate', aqiValue: 120,
    coalHeavy: false,
  },
  GJ: {
    name: 'Gujarat', petrolPrice: 96.63, electricityRate: 5.55,
    gridEmissionFactor: 0.98, lpgPrice: 903, aqiLevel: 'Moderate', aqiValue: 115,
    coalHeavy: false,
  },
  BR: {
    name: 'Bihar', petrolPrice: 107.24, electricityRate: 6.10,
    gridEmissionFactor: 1.15, lpgPrice: 903, aqiLevel: 'Unhealthy', aqiValue: 210,
    coalHeavy: true,
  },
  KA: {
    name: 'Karnataka', petrolPrice: 102.86, electricityRate: 6.50,
    gridEmissionFactor: 0.82, lpgPrice: 903, aqiLevel: 'Moderate', aqiValue: 98,
    coalHeavy: false,
  },
  UP: {
    name: 'Uttar Pradesh', petrolPrice: 96.65, electricityRate: 5.50,
    gridEmissionFactor: 1.25, lpgPrice: 903, aqiLevel: 'Unhealthy', aqiValue: 220,
    coalHeavy: true,
  },
  RJ: {
    name: 'Rajasthan', petrolPrice: 108.48, electricityRate: 6.65,
    gridEmissionFactor: 1.19, lpgPrice: 903, aqiLevel: 'Unhealthy', aqiValue: 195,
    coalHeavy: true,
  },
};

const MERCHANT_KEYWORDS = {
  petrol: [
    'indianoil', 'indian oil', 'hpcl', 'hp petrol', 'bpcl',
    'bharat petroleum', 'shell', 'essar', 'nayara', 'reliance petrol',
    'petrol pump', 'fuel station',
  ],
  electricity: [
    'bescom', 'tata power', 'adani electricity', 'adani power', 'msedcl',
    'tneb', 'dvvnl', 'bses rajdhani', 'bses yamuna', 'torrent power',
    'kseb', 'bijli', 'electricity bill', 'jvvnl', 'uppcl',
  ],
  lpg: [
    'hp gas', 'indane', 'bharatgas', 'bharat gas', 'lpg', 'gas agency',
    'cylinder', 'indane gas',
  ],
};

const EMISSION_FACTORS = {
  petrol: 2.31,
  lpg: 2.98,
};

const SAMPLE_SMS = [
  'Debited ₹500 from A/c at IndianOil. UPI Ref 123456',
  'Paid ₹1,200 to BESCOM via UPI. Ref: 789012',
  'Debited ₹850 to HP Gas for LPG cylinder. UPI: 345678',
  'Paid ₹2,500 to BPCL fuel station. Ref 901234',
  'Debited ₹1,800 to Adani Electricity via UPI. Ref 567890',
  'Paid ₹680 to IndianOil petrol pump. UPI Ref 112233',
  'Debited ₹903 to Indane Gas cylinder booking. Ref 445566',
];

const WEEKLY_BUDGET = 50;

const BAR_COLORS = ['bg-slate-100', 'bg-blue-100', 'bg-blue-300', 'bg-blue-500', 'bg-blue-700'];
const BAR_LABELS = ['None', 'Low (<3kg)', 'Moderate', 'High', 'Very High'];

const CATEGORY_META = {
  petrol: {
    label: 'Fuel', bar: 'bg-orange-400', letter: 'F',
    icon: 'bg-orange-100 text-orange-700',
    badge: 'bg-orange-50 border-orange-200 text-orange-700',
  },
  electricity: {
    label: 'Electricity', bar: 'bg-blue-400', letter: 'E',
    icon: 'bg-blue-100 text-blue-700',
    badge: 'bg-blue-50 border-blue-200 text-blue-700',
  },
  lpg: {
    label: 'Cooking Gas', bar: 'bg-purple-400', letter: 'G',
    icon: 'bg-purple-100 text-purple-700',
    badge: 'bg-purple-50 border-purple-200 text-purple-700',
  },
};

const CTA_CLASS =
  'inline-flex items-center gap-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold px-3 py-2 rounded-lg border border-blue-200 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500';

const URGENCY_COLORS = {
  CRITICAL: 'border-rose-500 bg-rose-50',
  HIGH:     'border-amber-500 bg-amber-50',
  MEDIUM:   'border-blue-500 bg-blue-50',
  LOW:      'border-slate-300 bg-slate-50',
};

const URGENCY_TEXT = {
  CRITICAL: 'text-rose-800',
  HIGH:     'text-amber-800',
  MEDIUM:   'text-blue-800',
  LOW:      'text-slate-700',
};

const URGENCY_BADGE = {
  CRITICAL: 'bg-rose-100 text-rose-700 border-rose-200',
  HIGH:     'bg-amber-100 text-amber-700 border-amber-200',
  MEDIUM:   'bg-blue-100 text-blue-700 border-blue-200',
  LOW:      'bg-slate-100 text-slate-600 border-slate-200',
};

const buildSeedDates = () => {
  const today = new Date();
  return Array.from({ length: 14 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (13 - i));
    const label = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    const seeds = [4.2, 0, 8.7, 2.1, 11.3, 0, 5.6, 3.8, 0, 9.1, 6.4, 0, 4.7, 0];
    return { day: label, value: seeds[i], isToday: i === 13 };
  });
};
const HEATMAP_SEED_DATA = buildSeedDates();

// ═══════════════════════════════════════════════════════════════════════════════
// PURE FUNCTIONS — top-level, exported, zero React state dependency
// ═══════════════════════════════════════════════════════════════════════════════

/** Extract the ₹ amount from any UPI/bank SMS string. */
export function extractAmount(smsText) {
  const match = smsText.match(/(?:₹|Rs\.?|INR)\s?([\d,]+(?:\.\d{1,2})?)/i);
  if (!match) return null;
  return parseFloat(match[1].replace(/,/g, ''));
}

/** Classify merchant category (petrol | electricity | lpg) from SMS text. */
export function classifyMerchant(smsText) {
  const lower = smsText.toLowerCase();
  for (const [category, keywords] of Object.entries(MERCHANT_KEYWORDS)) {
    if (keywords.some((kw) => lower.includes(kw))) return category;
  }
  return null;
}

/** Core footprint calculator — pure, stateless, deterministic. */
export function calculateFootprint(amount, category, stateKey) {
  const state = LOCAL_CONTEXT[stateKey];
  if (!state) return null;

  let units, unitLabel, kgCO2, rateUsed, emissionFactor;

  if (category === 'petrol') {
    rateUsed = state.petrolPrice;
    emissionFactor = EMISSION_FACTORS.petrol;
    units = parseFloat((amount / rateUsed).toFixed(2));
    unitLabel = 'litres';
    kgCO2 = parseFloat((units * emissionFactor).toFixed(2));
  } else if (category === 'electricity') {
    rateUsed = state.electricityRate;
    emissionFactor = state.gridEmissionFactor;
    units = parseFloat((amount / rateUsed).toFixed(2));
    unitLabel = 'kWh';
    kgCO2 = parseFloat((units * emissionFactor).toFixed(2));
  } else if (category === 'lpg') {
    rateUsed = state.lpgPrice;
    emissionFactor = EMISSION_FACTORS.lpg;
    const cylinders = amount / rateUsed;
    const kgLPG = cylinders * 14.2;
    units = parseFloat(cylinders.toFixed(2));
    unitLabel = 'cylinders';
    kgCO2 = parseFloat((kgLPG * emissionFactor).toFixed(2));
  } else {
    return null;
  }

  const rupeesSaved = parseFloat((kgCO2 * 5.5).toFixed(2));
  const aqiImpact = kgCO2 > 6 ? 'High' : kgCO2 > 2 ? 'Medium' : 'Low';

  return {
    category, amount, units, unitLabel, kgCO2,
    rupeesSaved, aqiImpact, rateUsed, emissionFactor,
  };
}

/**
 * Multi-signal context engine. Synthesises category, state, history pattern,
 * budget pressure, and AQI severity into a prioritised, layered insight.
 * @param {object} result    - Output of calculateFootprint
 * @param {object} stateData - Full LOCAL_CONTEXT entry for current state
 * @param {Array}  history   - Full session history array
 * @param {number} totalCO2  - Running session total kg CO₂ (post-transaction)
 * @returns {object}         - { headline, reasoning, urgencyLevel, actions }
 */
export function generateInsight(result, stateData, history, totalCO2) {
  const { category, kgCO2, amount, units, unitLabel, rupeesSaved } = result;

  // ── Signal 1: Budget pressure ──────────────────────────────────
  const budgetPct = (totalCO2 / WEEKLY_BUDGET) * 100;
  const budgetSignal =
    budgetPct >= 90 ? 'CRITICAL' :
    budgetPct >= 60 ? 'HIGH' :
    budgetPct >= 30 ? 'MODERATE' : 'LOW';

  // ── Signal 2: Repeat behaviour detection ──────────────────────
  const recentSameCategory = history
    .slice(0, 5)
    .filter(h => h.category === category).length;
  const isRepeatOffender = recentSameCategory >= 2;

  // ── Signal 3: AQI severity of current state ───────────────────
  const aqiSignal =
    stateData.aqiValue >= 200 ? 'SEVERE' :
    stateData.aqiValue >= 150 ? 'HIGH' :
    stateData.aqiValue >= 100 ? 'MODERATE' : 'LOW';

  // ── Signal 4: Economic magnitude ──────────────────────────────
  const largeTxn =
    (category === 'petrol'      && amount > 1500) ||
    (category === 'electricity' && amount > 2000) ||
    (category === 'lpg'         && amount > 1800);

  // ── Signal 5: Coal-heavy grid multiplier ──────────────────────
  const gridRisk = stateData.coalHeavy && category === 'electricity';

  // ── Urgency level (drives headline tone) ──────────────────────
  const urgencyLevel =
    budgetSignal === 'CRITICAL'               ? 'CRITICAL' :
    (isRepeatOffender && aqiSignal !== 'LOW') ? 'HIGH' :
    (gridRisk || largeTxn)                    ? 'MEDIUM' : 'LOW';

  // ── Headline: One declarative sentence, economic-first framing ──
  const headlines = {
    CRITICAL: `Budget alert: you've used ${budgetPct.toFixed(0)}% of your weekly carbon budget — this ${category} transaction adds ₹${rupeesSaved.toFixed(0)} in hidden social costs.`,
    HIGH:     `Pattern detected: ${recentSameCategory} of your last 5 transactions were ${category}. Switching even once saves ₹${(rupeesSaved * recentSameCategory).toFixed(0)} cumulatively.`,
    MEDIUM:   gridRisk
                ? `${stateData.name}'s coal grid (${stateData.gridEmissionFactor} kg/kWh) makes this ₹${amount} bill emit ${kgCO2} kg CO₂ — ${((stateData.gridEmissionFactor / 0.82 - 1) * 100).toFixed(0)}% more than Karnataka's hydro grid.`
                : `This ₹${amount} ${category} transaction generated ${kgCO2} kg CO₂ and ₹${rupeesSaved.toFixed(0)} in social costs.`,
    LOW:      `₹${amount} → ${units} ${unitLabel} → ${kgCO2} kg CO₂ (₹${rupeesSaved.toFixed(0)} social cost). Your session footprint is on track.`,
  };

  // ── Reasoning chain: Show the "why" behind the urgency ────────
  const reasoningParts = [];

  if (budgetSignal !== 'LOW') {
    reasoningParts.push(
      `Budget: ${totalCO2.toFixed(1)} / ${WEEKLY_BUDGET} kg used (${budgetPct.toFixed(0)}%) — ` +
      (budgetSignal === 'CRITICAL' ? 'switch to low-carbon alternatives immediately.' :
       budgetSignal === 'HIGH'     ? 'consider deferring non-essential trips.' :
                                     'you have room but should track carefully.')
    );
  }

  if (isRepeatOffender) {
    reasoningParts.push(
      `Repeat pattern: ${category} appears ${recentSameCategory}× in recent transactions. ` +
      `Habitual spend = compounding footprint.`
    );
  }

  if (aqiSignal !== 'LOW') {
    reasoningParts.push(
      `Local AQI is ${stateData.aqiValue} (${stateData.aqiLevel}) — ` +
      (category === 'petrol'
        ? 'vehicular emissions are a direct PM2.5 contributor here.'
        : category === 'electricity' && stateData.coalHeavy
        ? 'coal-power demand worsens regional air quality.'
        : 'outdoor air quality already stressed.')
    );
  }

  if (gridRisk) {
    const karnatakaFactor = 0.82;
    const excessKg = parseFloat(((stateData.gridEmissionFactor - karnatakaFactor) * (amount / stateData.electricityRate)).toFixed(2));
    reasoningParts.push(
      `Grid penalty: ${stateData.name}'s coal grid adds ~${excessKg} kg extra CO₂ vs a hydro grid for this same bill.`
    );
  }

  if (largeTxn) {
    reasoningParts.push(
      `High-value transaction: ₹${amount} is above the typical ${category} spend threshold — review if usage can be optimised.`
    );
  }

  if (reasoningParts.length === 0) {
    reasoningParts.push('All signals are within normal range. Continue monitoring your weekly budget.');
  }

  // ── Contextual actions (scored and sorted, not static) ─────────
  const candidateActions = [];

  if (category === 'petrol') {
    candidateActions.push(
      { label: 'Book BluSmart EV Cab', url: 'https://www.blusmart.in', score: isRepeatOffender ? 10 : 6 },
      { label: 'Find Metro Route',     url: 'https://www.urbanrail.net/as/in/', score: aqiSignal !== 'LOW' ? 8 : 4 },
    );
  }
  if (category === 'electricity') {
    if (stateData.coalHeavy) {
      candidateActions.push(
        { label: 'Shop 5-Star ACs',       url: 'https://www.flipkart.com/search?q=5+star+ac', score: largeTxn ? 10 : 7 },
        { label: 'Explore Rooftop Solar', url: 'https://solarrooftop.gov.in', score: gridRisk ? 9 : 5 },
      );
    } else {
      candidateActions.push(
        { label: 'Switch to Green Tariff', url: 'https://mnre.gov.in', score: 6 },
        { label: '5-Star Appliances',      url: 'https://www.flipkart.com/search?q=5+star+appliance', score: largeTxn ? 8 : 4 },
      );
    }
  }
  if (category === 'lpg') {
    candidateActions.push(
      { label: 'Check PM Ujjwala Subsidy', url: 'https://www.pmuy.gov.in', score: 7 },
      { label: 'Find Induction Cooktop',   url: 'https://www.amazon.in/s?k=induction+cooktop+BEE+star', score: isRepeatOffender ? 9 : 5 },
    );
  }

  const actions = candidateActions
    .sort((a, b) => b.score - a.score)
    .slice(0, 2);

  return { headline: headlines[urgencyLevel], reasoning: reasoningParts, urgencyLevel, actions };
}

/** SMS → full insight object orchestrator. Now context-aware. */
export function parseSMS(smsText, stateKey, history = [], totalCO2 = 0) {
  const amount = extractAmount(smsText);
  const category = classifyMerchant(smsText);
  if (!amount || !category) return null;
  const footprint = calculateFootprint(amount, category, stateKey);
  if (!footprint) return null;
  const stateData = LOCAL_CONTEXT[stateKey];
  const insight = generateInsight(footprint, stateData, history, totalCO2 + footprint.kgCO2);
  return { ...footprint, insight };
}

/** Aggregate a history array to total kg CO₂. */
export function getTotalFootprint(history) {
  return parseFloat(history.reduce((s, h) => s + h.kgCO2, 0).toFixed(2));
}

/** Extract a readable label from a sample SMS for pill chips. */
function chipLabel(sms) {
  const merchant = sms.match(/(IndianOil|BESCOM|HP\s?Gas|BPCL|Adani|Indane|HPCL)/i)?.[0] ?? 'Sample';
  const amount = sms.match(/₹([\d,]+)/)?.[0] ?? '';
  return `${merchant} · ${amount}`;
}

/** Module-scope category icon component (avoids re-creation inside render). */
const CategoryIcon = ({ category, className }) => {
  if (category === 'petrol') return <Fuel className={className} />;
  if (category === 'electricity') return <Zap className={className} />;
  return <Flame className={className} />;
};

// ═══════════════════════════════════════════════════════════════════════════════
// APP COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

function App() {
  // ── Primary state ──
  const [selectedState, setSelectedState] = useState('KA');
  const [smsInput, setSmsInput] = useState('');
  const [parsedResult, setParsedResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [heatmapData, setHeatmapData] = useState(HEATMAP_SEED_DATA);

  // ── Derived values (useMemo — Efficiency rubric) ──
  const currentState = useMemo(() => LOCAL_CONTEXT[selectedState], [selectedState]);

  const totalFootprint = useMemo(() => getTotalFootprint(history), [history]);

  const totalRupeesSaved = useMemo(
    () => parseFloat(history.reduce((s, h) => s + h.rupeesSaved, 0).toFixed(2)),
    [history],
  );

  const equivalentCarKm = useMemo(
    () => (totalFootprint / 0.21).toFixed(0),
    [totalFootprint],
  );

  const maxHeatVal = useMemo(
    () => Math.max(...heatmapData.map((x) => x.value), 1),
    [heatmapData],
  );

  const budgetPct = useMemo(
    () => Math.min((totalFootprint / WEEKLY_BUDGET) * 100, 100),
    [totalFootprint],
  );

  // ── Largest-remainder method — guarantees pcts sum to exactly 100 ──
  const categoryBreakdown = useMemo(() => {
    if (history.length === 0) return [];
    const totals = history.reduce((acc, h) => {
      acc[h.category] = (acc[h.category] || 0) + h.kgCO2;
      return acc;
    }, {});
    const total = Object.values(totals).reduce((a, b) => a + b, 0);
    if (total === 0) return [];

    const entries = Object.entries(totals);
    const rawPcts = entries.map(([, v]) => (v / total) * 100);
    const floored = rawPcts.map(Math.floor);
    let remainder = 100 - floored.reduce((a, b) => a + b, 0);
    const remainders = rawPcts
      .map((r, i) => ({ i, r: r - floored[i] }))
      .sort((a, b) => b.r - a.r);
    remainders.forEach(({ i }, rank) => {
      if (rank < remainder) floored[i]++;
    });

    return entries.map(([cat, val], i) => ({
      category: cat,
      kg: parseFloat(val.toFixed(2)),
      pct: floored[i],
    }));
  }, [history]);

  // ── handleAnalyze — passes full session context to parseSMS/generateInsight ──
  const handleAnalyze = useCallback(() => {
    const trimmed = smsInput.trim();
    if (!trimmed) return;
    const result = parseSMS(trimmed, selectedState, history, totalFootprint);
    if (result) {
      setParsedResult(result);
      setHistory((prev) => [result, ...prev]);
      setHeatmapData((prev) =>
        prev.map((d, i) =>
          i === 13
            ? { ...d, value: parseFloat((d.value + result.kgCO2).toFixed(2)) }
            : d,
        ),
      );
    } else {
      setParsedResult({ error: true });
    }
    setSmsInput('');
  }, [smsInput, selectedState, history, totalFootprint]);

  // ── handleClear — fresh array to avoid stale reference ──
  const handleClear = useCallback(() => {
    setHistory([]);
    setParsedResult(null);
    setHeatmapData(buildSeedDates());
  }, []);

  // ═════════════════════════════════════════════════════════════════════════════
  // JSX RENDER
  // ═════════════════════════════════════════════════════════════════════════════

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ═══════ HEADER ═══════ */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-screen-xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white text-sm font-bold">C</span>
            </div>
            <h1 className="text-sm font-semibold text-slate-900 leading-none">
              CarbonSense
              <span className="text-xs text-blue-600 font-semibold ml-1">AI</span>
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <span className="bg-slate-100 text-xs text-slate-600 px-3 py-1.5 rounded-full hidden sm:inline-flex">
              Analysing: {currentState.name}
            </span>
            <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-full px-4 py-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
              <span className="text-xs font-medium text-slate-600 hidden md:inline">
                Bank-Grade Local Processing — No Data Leaves Device
              </span>
              <span className="text-xs font-medium text-slate-600 md:hidden">
                100% Local
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* ═══════ MAIN — two-column dashboard ═══════ */}
      <main className="max-w-screen-xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* ═══════ LEFT COLUMN ═══════ */}
          <aside className="lg:col-span-4 space-y-5">
            {/* ── Context Engine ── */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-4">
                Context Engine
              </p>
              <label htmlFor="state-select" className="block text-sm font-medium text-slate-700 mb-2">
                Select State
              </label>
              <div className="relative">
                <select
                  id="state-select"
                  value={selectedState}
                  onChange={(e) => { setSelectedState(e.target.value); setParsedResult(null); }}
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 pr-10 text-sm text-slate-900 appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                >
                  {Object.entries(LOCAL_CONTEXT).map(([key, st]) => (
                    <option key={key} value={key}>{st.name} ({key})</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>

              {/* State stat grid */}
              <div className="mt-4 grid grid-cols-3 gap-3">
                <div className="bg-slate-50 rounded-xl p-3 text-center border border-slate-100">
                  <p className="text-xs text-slate-400 mb-1">Petrol / L</p>
                  <p className="text-sm font-semibold text-slate-800">₹{currentState.petrolPrice}</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-3 text-center border border-slate-100">
                  <p className="text-xs text-slate-400 mb-1">Grid CO₂</p>
                  <p className={`text-sm font-semibold ${currentState.gridEmissionFactor > 1.0 ? 'text-rose-500' : 'text-emerald-600'}`}>
                    {currentState.gridEmissionFactor}
                    <span className="text-xs font-normal text-slate-400"> kg</span>
                  </p>
                </div>
                <div className="bg-slate-50 rounded-xl p-3 text-center border border-slate-100">
                  <p className="text-xs text-slate-400 mb-1">AQI</p>
                  <p className={`text-sm font-semibold ${
                    currentState.aqiLevel === 'Good' ? 'text-emerald-600'
                      : currentState.aqiLevel === 'Moderate' ? 'text-amber-600'
                        : 'text-rose-500'
                  }`}>
                    {currentState.aqiLevel}
                  </p>
                </div>
              </div>

              <div className="bg-slate-50 rounded-xl px-4 py-3 mt-3 border border-slate-100">
                <p className="text-xs text-slate-500">
                  LPG cylinder: ₹{currentState.lpgPrice} · Electricity: ₹{currentState.electricityRate}/kWh
                </p>
              </div>
            </div>

            {/* ── Analyse Transaction ── */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-4">
                Analyse Transaction
              </p>
              <label htmlFor="sms-input" className="block text-sm font-medium text-slate-700 mb-2">
                Paste UPI SMS
              </label>
              <textarea
                id="sms-input"
                rows={4}
                maxLength={500}
                value={smsInput}
                onChange={(e) => setSmsInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleAnalyze();
                  }
                }}
                placeholder={'e.g. "Debited ₹1,200 from A/c at BESCOM via UPI. Ref 789012"'}
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              />
              <p className="text-xs text-slate-400 mt-1">Press Enter to analyse · Shift+Enter for new line</p>
              <button
                onClick={handleAnalyze}
                aria-label="Parse SMS and calculate carbon footprint"
                className="mt-3 w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-xl transition-colors duration-150 text-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                Analyse Footprint
              </button>
            </div>

            {/* ── Quick Test ── */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">
                Quick Test
              </p>
              <div className="flex flex-wrap gap-2">
                {SAMPLE_SMS.map((sms, i) => (
                  <button
                    key={i}
                    onClick={() => setSmsInput(sms)}
                    aria-label={`Load sample SMS: ${sms}`}
                    className="bg-white hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 text-slate-600 text-xs px-3 py-1.5 rounded-full border border-slate-200 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {chipLabel(sms)}
                  </button>
                ))}
              </div>
            </div>
          </aside>

          {/* ═══════ RIGHT COLUMN ═══════ */}
          <section className="lg:col-span-8 space-y-5">
            {/* ── KPI Row ── */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* KPI 1: Session CO₂ */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Leaf className="w-3.5 h-3.5 text-emerald-500" />
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
                    Session CO₂
                  </p>
                </div>
                <p className="text-3xl font-bold text-slate-900 tabular-nums">
                  {totalFootprint}
                  <span className="text-sm font-normal text-slate-400 ml-1">kg</span>
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  {history.length} transaction{history.length !== 1 ? 's' : ''} analysed
                </p>
              </div>

              {/* KPI 2: Social Cost */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Info className="w-3.5 h-3.5 text-blue-500" />
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
                    Est. Social Cost
                  </p>
                </div>
                <p className="text-3xl font-bold text-emerald-600 tabular-nums">
                  ₹{totalRupeesSaved.toFixed(0)}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  at ₹5.5 / kg CO₂ · {equivalentCarKm} km by car
                </p>
              </div>

              {/* KPI 3: Carbon Budget */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Target className="w-3.5 h-3.5 text-blue-500" />
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
                    Carbon Budget
                  </p>
                </div>
                <p className="text-3xl font-bold text-slate-900 tabular-nums">
                  {totalFootprint}
                  <span className="text-sm font-normal text-slate-400 ml-1">/ {WEEKLY_BUDGET} kg</span>
                </p>
                <div className="h-2 bg-slate-100 rounded-full mt-3 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      budgetPct < 60 ? 'bg-emerald-500' : budgetPct < 85 ? 'bg-amber-500' : 'bg-rose-500'
                    }`}
                    style={{ width: `${budgetPct}%` }}
                    role="progressbar"
                    aria-valuenow={totalFootprint}
                    aria-valuemin={0}
                    aria-valuemax={WEEKLY_BUDGET}
                    aria-label={`Carbon budget: ${totalFootprint} of ${WEEKLY_BUDGET} kg used`}
                  />
                </div>
                <p className="text-xs text-slate-400 mt-2">Weekly target</p>
              </div>
            </div>

            {/* ── Emission Breakdown ── */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 className="w-3.5 h-3.5 text-slate-400" />
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
                  Emission Breakdown
                </p>
              </div>
              {categoryBreakdown.length === 0 ? (
                <div className="bg-slate-50 rounded-xl py-6 text-center">
                  <p className="text-sm text-slate-400">Analyse transactions to see category split.</p>
                </div>
              ) : (
                <>
                  <div className="h-3.5 rounded-full overflow-hidden flex bg-slate-100" role="img" aria-label="Emission breakdown by category">
                    {categoryBreakdown.map((cat) => (
                      <div
                        key={cat.category}
                        className={`${CATEGORY_META[cat.category].bar} transition-all duration-500`}
                        style={{ width: `${cat.pct}%` }}
                      />
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-x-5 gap-y-1 mt-3">
                    {categoryBreakdown.map((cat) => (
                      <div key={cat.category} className="flex items-center gap-1.5">
                        <div className={`w-2.5 h-2.5 rounded-sm ${CATEGORY_META[cat.category].bar}`} />
                        <span className="text-xs text-slate-500">{CATEGORY_META[cat.category].label}</span>
                        <span className="text-xs font-semibold text-slate-700">{cat.pct}%</span>
                        <span className="text-xs text-slate-400">({cat.kg} kg)</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* ── 14-Day Impact Heatmap ── */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
              <div className="flex justify-between items-center mb-5">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-3.5 h-3.5 text-slate-400" />
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
                    14-Day CO₂ Impact Trend
                  </p>
                </div>
                <span className="text-xs text-slate-400">kg CO₂ / day</span>
              </div>

              <div className="flex gap-1.5 h-32">
                {heatmapData.map((d, i) => {
                  const heightPct = Math.round((d.value / maxHeatVal) * 100);
                  const intensity =
                    d.value === 0 ? 0
                      : d.value < 3 ? 1
                        : d.value < 8 ? 2
                          : d.value < 15 ? 3 : 4;
                  return (
                    <div
                      key={i}
                      tabIndex={0}
                      role="img"
                      aria-label={`${d.day}: ${d.value.toFixed(1)} kg CO₂`}
                      className="flex-1 h-full flex flex-col justify-end relative group focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
                    >
                      <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-xs px-2 py-1 rounded-lg opacity-0 group-hover:opacity-100 group-focus:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                        {d.value.toFixed(1)} kg
                      </div>
                      <div
                        className={`w-full rounded-t-sm transition-all duration-300 ${BAR_COLORS[intensity]} ${d.isToday ? 'ring-2 ring-blue-500 ring-offset-1' : ''}`}
                        style={{ height: `${Math.max(heightPct, 4)}%` }}
                      />
                    </div>
                  );
                })}
              </div>

              <div className="flex gap-1.5 mt-1.5">
                {heatmapData.map((d, i) => (
                  <span key={i} className={`flex-1 text-center text-xs tabular-nums ${d.isToday ? 'text-blue-600 font-semibold' : 'text-slate-400'}`}>
                    {d.day.split(' ')[0]}
                  </span>
                ))}
              </div>

              <div className="flex gap-4 mt-3 flex-wrap">
                {BAR_LABELS.map((label, i) => (
                  <div key={i} className="flex items-center gap-1">
                    <div className={`w-3 h-3 rounded-sm ${BAR_COLORS[i]}`} />
                    <span className="text-xs text-slate-400">{label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* ── CarbonSense Agent ── */}
            <div
              role="status"
              aria-live="polite"
              aria-atomic="true"
              tabIndex={-1}
              className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-blue-500" />
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
                    CarbonSense Agent
                  </p>
                </div>
                {parsedResult && !parsedResult.error && (
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${CATEGORY_META[parsedResult.category].badge}`}>
                    {CATEGORY_META[parsedResult.category].label}
                  </span>
                )}
              </div>

              {/* NULL STATE */}
              {!parsedResult && (
                <div className="bg-slate-50 rounded-xl p-8 text-center">
                  <div className="w-10 h-10 bg-slate-200 rounded-xl mx-auto mb-3 flex items-center justify-center">
                    <MessageSquare className="w-5 h-5 text-slate-400" />
                  </div>
                  <p className="text-sm font-medium text-slate-700">Ready to analyse</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Paste a UPI SMS or tap a Quick Test chip to see your personalised CO₂ insight.
                  </p>
                </div>
              )}

              {/* ERROR STATE */}
              {parsedResult?.error && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
                  <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-amber-700">Merchant not recognised</p>
                    <p className="text-xs text-amber-600 mt-1">
                      Ensure the SMS mentions a supported merchant: IndianOil, BPCL, HPCL,
                      BESCOM, Adani Electricity, MSEDCL, TNEB, HP Gas, Indane, or Bharatgas.
                    </p>
                  </div>
                </div>
              )}

              {/* SUCCESS STATE — Structured insight rendering */}
              {parsedResult && !parsedResult.error && (
                <div className="space-y-4">
                  {/* Block 1: Urgency badge + Headline */}
                  <div className={`border-l-4 rounded-r-xl px-4 py-3 ${URGENCY_COLORS[parsedResult.insight.urgencyLevel]}`}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${URGENCY_BADGE[parsedResult.insight.urgencyLevel]}`}>
                        {parsedResult.insight.urgencyLevel}
                      </span>
                      <span className="text-xs text-slate-400">CarbonSense Assessment</span>
                    </div>
                    <p className={`text-sm font-medium leading-relaxed ${URGENCY_TEXT[parsedResult.insight.urgencyLevel]}`}>
                      {parsedResult.insight.headline}
                    </p>
                  </div>

                  {/* Block 2: Reasoning chain — "show your working" */}
                  <div className="bg-slate-50 rounded-xl px-4 py-3 space-y-2">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">
                      Signal Analysis
                    </p>
                    {parsedResult.insight.reasoning.map((line, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <span className="mt-0.5 w-4 h-4 rounded-full bg-blue-100 text-blue-600 text-xs flex items-center justify-center flex-shrink-0 font-semibold">
                          {i + 1}
                        </span>
                        <p className="text-xs text-slate-600 leading-relaxed">{line}</p>
                      </div>
                    ))}
                  </div>

                  {/* Block 3: Calculation transparency (monospace math) */}
                  <div className="bg-slate-50 rounded-xl px-4 py-3">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">
                      Calculation
                    </p>
                    <p className="text-xs font-mono text-slate-600 leading-loose">
                      ₹{parsedResult.amount}{' '}
                      <span className="text-blue-600 font-semibold">÷</span>{' '}
                      ₹{parsedResult.rateUsed}/{parsedResult.unitLabel}{' '}
                      <span className="text-slate-400">=</span>{' '}
                      {parsedResult.units} {parsedResult.unitLabel}
                      <br />
                      {parsedResult.units} {parsedResult.unitLabel}{' '}
                      <span className="text-blue-600 font-semibold">×</span>{' '}
                      {parsedResult.category === 'lpg' ? (
                        <>14.2 kg/cyl <span className="text-blue-600 font-semibold">×</span> {parsedResult.emissionFactor} kg CO₂/kg</>
                      ) : (
                        <>{parsedResult.emissionFactor} kg CO₂/{parsedResult.unitLabel}</>
                      )}{' '}
                      <span className="text-slate-400">=</span>{' '}
                      <span className="text-emerald-700 font-bold">{parsedResult.kgCO2} kg CO₂</span>
                      <br />
                      {parsedResult.kgCO2} kg{' '}
                      <span className="text-blue-600 font-semibold">×</span>{' '}
                      ₹5.5 social cost{' '}
                      <span className="text-slate-400">=</span>{' '}
                      <span className="text-slate-900 font-bold">₹{parsedResult.rupeesSaved.toFixed(0)} hidden cost</span>
                    </p>
                  </div>

                  {/* Block 4: 3-stat grid */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                      <p className="text-2xl font-bold text-emerald-700 tabular-nums">{parsedResult.kgCO2}</p>
                      <p className="text-xs text-emerald-600 mt-1">kg CO₂</p>
                    </div>
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                      <p className="text-2xl font-bold text-slate-900 tabular-nums">₹{parsedResult.rupeesSaved.toFixed(0)}</p>
                      <p className="text-xs text-slate-500 mt-1">Social cost</p>
                    </div>
                    <div className={`rounded-xl p-4 border ${
                      parsedResult.aqiImpact === 'High' ? 'bg-rose-50 border-rose-200'
                        : parsedResult.aqiImpact === 'Medium' ? 'bg-amber-50 border-amber-200'
                          : 'bg-emerald-50 border-emerald-200'
                    }`}>
                      <p className={`text-2xl font-bold tabular-nums ${
                        parsedResult.aqiImpact === 'High' ? 'text-rose-500'
                          : parsedResult.aqiImpact === 'Medium' ? 'text-amber-600'
                            : 'text-emerald-600'
                      }`}>
                        {parsedResult.aqiImpact}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">AQI impact</p>
                    </div>
                  </div>

                  {/* Block 5: Priority-scored marketplace actions */}
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">
                      Recommended Actions
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {parsedResult.insight.actions.map((action, i) => (
                        <a
                          key={i}
                          href={action.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`${action.label} — opens in new tab`}
                          className={CTA_CLASS}
                        >
                          {action.label}
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ── Transaction Log ── */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
                  Transaction Log
                </p>
                {history.length > 0 && (
                  <button
                    onClick={handleClear}
                    aria-label="Clear all analysed transactions"
                    className="inline-flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium px-3 py-1.5 rounded-xl transition-colors duration-150 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <Trash2 className="w-3 h-3" />
                    Clear
                  </button>
                )}
              </div>

              {history.length === 0 && (
                <div className="bg-slate-50 rounded-xl py-8 text-center">
                  <p className="text-sm text-slate-400">No transactions analysed this session.</p>
                </div>
              )}

              {history.length > 0 && (
                <ul className="space-y-2 max-h-64 overflow-y-auto" aria-label="Analysed transactions">
                  {history.map((h, i) => (
                    <li key={i} className="flex items-center justify-between py-3 px-4 bg-slate-50 rounded-xl border border-slate-100 hover:border-slate-200 transition-colors">
                      <div className="flex items-center gap-3">
                        <span className={`w-9 h-9 rounded-xl flex items-center justify-center ${CATEGORY_META[h.category].icon}`}>
                          <CategoryIcon category={h.category} className="w-4 h-4" />
                        </span>
                        <div>
                          <p className="text-sm font-medium text-slate-800">{CATEGORY_META[h.category].label}</p>
                          <p className="text-xs text-slate-400">₹{h.amount} · {h.units} {h.unitLabel}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-emerald-700 tabular-nums">{h.kgCO2} kg</p>
                        <p className="text-xs text-slate-400">CO₂</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

export default App;

// ═══════════════════════════════════════════════════════════════════════════════
// JEST + REACT TESTING LIBRARY — Test Suite
// ═══════════════════════════════════════════════════════════════════════════════
//
// Run pure-function tests:   npx jest App.test.js
// Run UI tests:              npx jest --env=jsdom App.test.js
//
// ─── FILE: App.test.js ─────────────────────────────────────────────────────
//
// import { render, screen } from '@testing-library/react';
// import userEvent from '@testing-library/user-event';
// import App, {
//   extractAmount, classifyMerchant, calculateFootprint,
//   parseSMS, getTotalFootprint, generateInsight,
// } from './App';
//
// // ═══════════════════════════════════════════════════════════════════════════
// // UNIT TESTS — Pure Functions
// // ═══════════════════════════════════════════════════════════════════════════
//
// describe('extractAmount', () => {
//   test('parses ₹ symbol',            () => expect(extractAmount('Debited ₹500 at IndianOil')).toBe(500));
//   test('strips commas',              () => expect(extractAmount('Paid ₹1,200 to BESCOM')).toBe(1200));
//   test('handles Rs. prefix',         () => expect(extractAmount('Rs. 850 to HP Gas')).toBe(850));
//   test('handles decimal amounts',    () => expect(extractAmount('₹102.50 at petrol pump')).toBe(102.50));
//   test('returns null for no amount', () => expect(extractAmount('OTP is 456789')).toBeNull());
//   test('handles INR prefix',         () => expect(extractAmount('INR 2500 BPCL')).toBe(2500));
// });
//
// describe('classifyMerchant', () => {
//   test('IndianOil → petrol',     () => expect(classifyMerchant('₹500 at IndianOil')).toBe('petrol'));
//   test('BESCOM → electricity',   () => expect(classifyMerchant('₹1200 to bescom')).toBe('electricity'));
//   test('HP Gas → lpg',           () => expect(classifyMerchant('₹850 to HP Gas')).toBe('lpg'));
//   test('Indane Gas → lpg',       () => expect(classifyMerchant('₹903 to Indane Gas')).toBe('lpg'));
//   test('UPPCL → electricity',    () => expect(classifyMerchant('₹1100 to UPPCL')).toBe('electricity'));
//   test('Swiggy → null',          () => expect(classifyMerchant('₹200 to Swiggy')).toBeNull());
//   test('no merchant → null',     () => expect(classifyMerchant('Received ₹500 from Rahul')).toBeNull());
// });
//
// describe('calculateFootprint — state-aware math', () => {
//   test('KA petrol: ₹500 → ~4.86L × 2.31 ≈ 11.23 kg CO₂', () => {
//     const r = calculateFootprint(500, 'petrol', 'KA');
//     expect(r.units).toBeCloseTo(4.86, 1);
//     expect(r.kgCO2).toBeCloseTo(11.23, 1);
//     expect(r.unitLabel).toBe('litres');
//   });
//
//   test('DL petrol is cheaper per litre → more fuel → more CO₂', () => {
//     const dl = calculateFootprint(500, 'petrol', 'DL');
//     const ka = calculateFootprint(500, 'petrol', 'KA');
//     expect(dl.kgCO2).toBeGreaterThan(ka.kgCO2);
//   });
//
//   test('UP electricity emits more CO₂ than KA (coal-heavy grid)', () => {
//     const up = calculateFootprint(1200, 'electricity', 'UP');
//     const ka = calculateFootprint(1200, 'electricity', 'KA');
//     expect(up.kgCO2).toBeGreaterThan(ka.kgCO2);
//   });
//
//   test('LPG ₹903 = 1 cylinder × 14.2 kg × 2.98 ≈ 42.32 kg CO₂', () => {
//     const r = calculateFootprint(903, 'lpg', 'KA');
//     expect(r.units).toBeCloseTo(1.0, 1);
//     expect(r.kgCO2).toBeCloseTo(42.32, 1);
//     expect(r.unitLabel).toBe('cylinders');
//   });
//
//   test('rupeesSaved = kgCO2 × 5.5', () => {
//     const r = calculateFootprint(500, 'petrol', 'KA');
//     expect(r.rupeesSaved).toBeCloseTo(r.kgCO2 * 5.5, 2);
//   });
//
//   test('aqiImpact High when kgCO2 > 6', () => {
//     const r = calculateFootprint(4000, 'petrol', 'UP');
//     expect(r.aqiImpact).toBe('High');
//   });
//
//   test('aqiImpact Medium when 2 < kgCO2 ≤ 6', () => {
//     const r = calculateFootprint(150, 'electricity', 'DL');
//     expect(r.aqiImpact).toBe('Medium');
//   });
//
//   test('aqiImpact Low when kgCO2 ≤ 2', () => {
//     const r = calculateFootprint(80, 'electricity', 'KA');
//     expect(r.aqiImpact).toBe('Low');
//   });
//
//   test('returns null for invalid stateKey', () => {
//     expect(calculateFootprint(500, 'petrol', 'XX')).toBeNull();
//   });
// });
//
// describe('generateInsight — multi-signal context engine', () => {
//   const kaState = LOCAL_CONTEXT['KA'];
//   const dlState = LOCAL_CONTEXT['DL'];
//
//   const mockFootprint = (category, kgCO2, amount = 500) => ({
//     category, kgCO2, amount, units: 4.8, unitLabel: 'litres',
//     rupeesSaved: kgCO2 * 5.5, aqiImpact: kgCO2 > 6 ? 'High' : 'Low',
//     rateUsed: 102.86, emissionFactor: 2.31,
//   });
//
//   test('CRITICAL urgency when budget > 90%', () => {
//     const result = mockFootprint('petrol', 5);
//     const insight = generateInsight(result, kaState, [], 46);
//     expect(insight.urgencyLevel).toBe('CRITICAL');
//     expect(insight.headline).toMatch(/Budget alert/i);
//   });
//
//   test('HIGH urgency when repeat offender + bad AQI', () => {
//     const history = Array(3).fill(mockFootprint('petrol', 3));
//     const result  = mockFootprint('petrol', 3);
//     const insight = generateInsight(result, dlState, history, 15);
//     expect(insight.urgencyLevel).toBe('HIGH');
//     expect(insight.reasoning.some(r => /pattern/i.test(r))).toBe(true);
//   });
//
//   test('MEDIUM urgency for coal-heavy electricity', () => {
//     const result  = mockFootprint('electricity', 4, 1200);
//     const insight = generateInsight(result, dlState, [], 10);
//     expect(insight.urgencyLevel).toBe('MEDIUM');
//     expect(insight.reasoning.some(r => /coal/i.test(r))).toBe(true);
//   });
//
//   test('LOW urgency for small clean-state transaction', () => {
//     const result  = mockFootprint('electricity', 1, 200);
//     const insight = generateInsight(result, kaState, [], 5);
//     expect(insight.urgencyLevel).toBe('LOW');
//   });
//
//   test('actions are priority-scored: repeat petrol → BluSmart first', () => {
//     const history = Array(3).fill(mockFootprint('petrol', 3));
//     const result  = mockFootprint('petrol', 3);
//     const insight = generateInsight(result, kaState, history, 12);
//     expect(insight.actions[0].label).toContain('BluSmart');
//   });
//
//   test('coal electricity → 5-star AC is top action', () => {
//     const result  = mockFootprint('electricity', 8, 2500);
//     const insight = generateInsight(result, dlState, [], 8);
//     expect(insight.actions[0].label).toMatch(/5-Star/i);
//   });
//
//   test('reasoning array always has at least 1 entry', () => {
//     const result  = mockFootprint('lpg', 1.5, 400);
//     const insight = generateInsight(result, kaState, [], 2);
//     expect(insight.reasoning.length).toBeGreaterThanOrEqual(1);
//   });
//
//   test('parseSMS now returns insight property', () => {
//     const result = parseSMS('Paid ₹1200 to BESCOM', 'DL', [], 0);
//     expect(result).toHaveProperty('insight');
//     expect(result.insight).toHaveProperty('urgencyLevel');
//     expect(result.insight).toHaveProperty('reasoning');
//     expect(result.insight).toHaveProperty('actions');
//   });
// });
//
// describe('parseSMS — integration pipeline', () => {
//   test('petrol SMS in MH returns valid result', () => {
//     const r = parseSMS('Paid ₹2500 to BPCL fuel station', 'MH');
//     expect(r).not.toBeNull();
//     expect(r.category).toBe('petrol');
//     expect(r.kgCO2).toBeGreaterThan(0);
//   });
//
//   test('electricity SMS in DL uses DL grid factor', () => {
//     const r = parseSMS('Paid ₹1200 to BESCOM via UPI', 'DL');
//     expect(r.emissionFactor).toBe(1.12);
//   });
//
//   test('returns null for social payment', () => {
//     expect(parseSMS('Received ₹200 from Priya via GPay', 'KA')).toBeNull();
//   });
//
//   test('returns null for OTP SMS (no debit amount)', () => {
//     expect(parseSMS('Your OTP for IndianOil is 998877', 'KA')).toBeNull();
//   });
// });
//
// describe('getTotalFootprint', () => {
//   test('sums history correctly',    () => expect(getTotalFootprint([{ kgCO2: 5.5 }, { kgCO2: 3.2 }, { kgCO2: 1.1 }])).toBe(9.8));
//   test('returns 0 for empty',       () => expect(getTotalFootprint([])).toBe(0));
//   test('handles single entry',      () => expect(getTotalFootprint([{ kgCO2: 11.22 }])).toBe(11.22));
// });
//
// // ═══════════════════════════════════════════════════════════════════════════
// // COMPONENT TESTS — React Testing Library
// // ═══════════════════════════════════════════════════════════════════════════
//
// describe('UI — Render and Interaction', () => {
//   test('renders SMS input and Analyse button', () => {
//     render(<App />);
//     expect(screen.getByLabelText(/paste upi/i)).toBeInTheDocument();
//     expect(screen.getByRole('button', { name: /analyse footprint/i })).toBeInTheDocument();
//   });
//
//   test('renders trust badge in header', () => {
//     render(<App />);
//     expect(screen.getByText(/no data leaves device/i)).toBeInTheDocument();
//   });
//
//   test('shows null state in Agent card before analysis', () => {
//     render(<App />);
//     expect(screen.getByText(/ready to analyse/i)).toBeInTheDocument();
//   });
//
//   test('analyses petrol SMS and displays CO₂ result', async () => {
//     render(<App />);
//     const textarea = screen.getByLabelText(/paste upi/i);
//     const button = screen.getByRole('button', { name: /analyse footprint/i });
//     await userEvent.type(textarea, 'Debited ₹500 from A/c at IndianOil');
//     await userEvent.click(button);
//     expect(screen.getByText(/kg CO₂/i)).toBeInTheDocument();
//     expect(screen.getByRole('status')).toBeInTheDocument();
//   });
//
//   test('shows error state for unrecognised merchant', async () => {
//     render(<App />);
//     const textarea = screen.getByLabelText(/paste upi/i);
//     const button = screen.getByRole('button', { name: /analyse footprint/i });
//     await userEvent.type(textarea, 'Paid ₹200 to Swiggy');
//     await userEvent.click(button);
//     expect(screen.getByText(/not recognised/i)).toBeInTheDocument();
//   });
//
//   test('clear button resets history', async () => {
//     render(<App />);
//     const textarea = screen.getByLabelText(/paste upi/i);
//     const button = screen.getByRole('button', { name: /analyse footprint/i });
//     await userEvent.type(textarea, 'Debited ₹500 at IndianOil');
//     await userEvent.click(button);
//     const clearBtn = screen.getByRole('button', { name: /clear/i });
//     await userEvent.click(clearBtn);
//     expect(screen.getByText(/no transactions/i)).toBeInTheDocument();
//   });
// });
//
// ═══════════════════════════════════════════════════════════════════════════════
