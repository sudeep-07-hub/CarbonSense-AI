import { useState, useMemo, useCallback, memo } from 'react';
import PropTypes from 'prop-types';
import {
  ShieldCheck, ChevronDown, MessageSquare, AlertTriangle,
  Sparkles, Leaf, Target, BarChart3,
  Trash2, Fuel, Zap, Flame, Info, ExternalLink,
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════════
// LAYER 1 — NAMED CONSTANTS (no magic numbers in business logic)
// ═══════════════════════════════════════════════════════════════════════════════

/** Weight of a standard Indian domestic LPG cylinder in kilograms. */
const LPG_CYLINDER_WEIGHT_KG = 14.2;

/** India's shadow carbon price in ₹ per kg CO₂ (USD 8–12/tonne × ₹83/USD). */
const SOCIAL_COST_PER_KG = 5.5;

/** Average tailpipe emission for a 1,200 cc Indian petrol hatchback (kg CO₂/km). */
const CAR_EMISSION_PER_KM = 0.21;

/** Maximum character length for the SMS textarea input (defence-in-depth). */
const SMS_MAX_LENGTH = 500;

/** Number of days displayed in the CO₂ impact heatmap. */
const HEATMAP_DAYS = 14;

/** Number of recent transactions examined for repeat-behaviour detection. */
const HISTORY_LOOKBACK = 5;

/** Maximum number of transactions rendered in the log to prevent DOM bloat. */
const LOG_RENDER_LIMIT = 20;

/** Per-capita weekly CO₂ budget under India's 1.5°C fair-share pathway (kg). */
const WEEKLY_BUDGET = 50;

/** India's weighted-average grid emission factor (CEA 2023, kg CO₂/kWh). */
const NATIONAL_AVG_GRID_FACTOR = 0.91;

/** Category-specific thresholds (₹) above which a transaction is classified as "large". */
const LARGE_TXN_THRESHOLDS = Object.freeze({
  petrol: 1500, diesel: 1500, electricity: 2000, lpg: 1800,
});

/** Budget-pressure breakpoints (% of WEEKLY_BUDGET) driving urgency tiers. */
const BUDGET_THRESHOLDS = Object.freeze({ critical: 90, high: 60, moderate: 30 });

/** AQI breakpoints mapping state air-quality readings to severity signals. */
const AQI_THRESHOLDS = Object.freeze({ severe: 200, high: 150, moderate: 100 });

// ═══════════════════════════════════════════════════════════════════════════════
// LAYER 2 — DATA DICTIONARIES
// ═══════════════════════════════════════════════════════════════════════════════

/** Per-state context data sourced from CEA 2023, PPAC Q1 2025, CPCB AQI Bulletin. */
const LOCAL_CONTEXT = {
  DL: {
    name: 'Delhi', petrolPrice: 94.72, dieselPrice: 87.62,
    electricityRate: 7.00, gridEmissionFactor: 1.12, lpgPrice: 903,
    aqiLevel: 'Unhealthy', aqiValue: 187, coalHeavy: true,
  },
  MH: {
    name: 'Maharashtra', petrolPrice: 106.28, dieselPrice: 94.27,
    electricityRate: 8.20, gridEmissionFactor: 1.05, lpgPrice: 903,
    aqiLevel: 'Moderate', aqiValue: 120, coalHeavy: false,
  },
  GJ: {
    name: 'Gujarat', petrolPrice: 96.63, dieselPrice: 89.72,
    electricityRate: 5.55, gridEmissionFactor: 0.98, lpgPrice: 903,
    aqiLevel: 'Moderate', aqiValue: 115, coalHeavy: false,
  },
  BR: {
    name: 'Bihar', petrolPrice: 107.24, dieselPrice: 94.27,
    electricityRate: 6.10, gridEmissionFactor: 1.15, lpgPrice: 903,
    aqiLevel: 'Unhealthy', aqiValue: 210, coalHeavy: true,
  },
  KA: {
    name: 'Karnataka', petrolPrice: 102.86, dieselPrice: 88.94,
    electricityRate: 6.50, gridEmissionFactor: 0.82, lpgPrice: 903,
    aqiLevel: 'Moderate', aqiValue: 98, coalHeavy: false,
  },
  UP: {
    name: 'Uttar Pradesh', petrolPrice: 96.65, dieselPrice: 89.62,
    electricityRate: 5.50, gridEmissionFactor: 1.25, lpgPrice: 903,
    aqiLevel: 'Unhealthy', aqiValue: 220, coalHeavy: true,
  },
  RJ: {
    name: 'Rajasthan', petrolPrice: 108.48, dieselPrice: 95.86,
    electricityRate: 6.65, gridEmissionFactor: 1.19, lpgPrice: 903,
    aqiLevel: 'Unhealthy', aqiValue: 195, coalHeavy: true,
  },
  TN: {
    name: 'Tamil Nadu', petrolPrice: 100.76, dieselPrice: 93.52,
    electricityRate: 5.50, gridEmissionFactor: 0.95, lpgPrice: 903,
    aqiLevel: 'Good', aqiValue: 62, coalHeavy: false,
  },
};

/**
 * Keyword dictionary mapping SMS merchant substrings to emission categories.
 * Order matters: diesel is checked before petrol so that "HPCL Diesel" → diesel, not petrol.
 */
const MERCHANT_KEYWORDS = {
  diesel: [
    'diesel pump', 'diesel fuel', 'diesel', 'hsd',
  ],
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

/** Tank-to-wheel emission factors (kg CO₂ per unit). Source: IPCC AR6 / MoEFCC. */
const EMISSION_FACTORS = {
  petrol: 2.31,
  diesel: 2.68,
  lpg: 2.98,
};

/** Pre-built sample SMS messages for Quick Test chips. */
const SAMPLE_SMS = [
  'Debited ₹500 from A/c at IndianOil. UPI Ref 123456',
  'Paid ₹1,200 to BESCOM via UPI. Ref: 789012',
  'Debited ₹850 to HP Gas for LPG cylinder. UPI: 345678',
  'Paid ₹2,500 to BPCL fuel station. Ref 901234',
  'Debited ₹1,800 to Adani Electricity via UPI. Ref 567890',
  'Paid ₹680 to IndianOil petrol pump. UPI Ref 112233',
  'Debited ₹903 to Indane Gas cylinder booking. Ref 445566',
  'Paid ₹1,500 to HPCL Diesel pump via UPI. Ref 778899',
  'Debited ₹2,200 to Tata Power via UPI. Ref 334455',
  'Paid ₹903 to Bharatgas for LPG refill. UPI Ref 990011',
];

// ═══════════════════════════════════════════════════════════════════════════════
// LAYER 2b — UI TOKENS (presentation constants, no business logic)
// ═══════════════════════════════════════════════════════════════════════════════

const BAR_COLORS = ['bg-slate-100', 'bg-blue-100', 'bg-blue-300', 'bg-blue-500', 'bg-blue-700'];
const BAR_LABELS = ['None', 'Low (<3kg)', 'Moderate', 'High', 'Very High'];

const CATEGORY_META = {
  petrol: {
    label: 'Fuel (Petrol)', bar: 'bg-orange-400', letter: 'P',
    icon: 'bg-orange-100 text-orange-700',
    badge: 'bg-orange-50 border-orange-200 text-orange-700',
  },
  diesel: {
    label: 'Fuel (Diesel)', bar: 'bg-amber-400', letter: 'D',
    icon: 'bg-amber-100 text-amber-700',
    badge: 'bg-amber-50 border-amber-200 text-amber-700',
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

/**
 * Pre-computed quick test chips array. Computed once outside React render
 * to avoid expensive Regex matching on every component render.
 */
const QUICK_TEST_CHIPS = SAMPLE_SMS.map((sms) => {
  const merchantMatch = sms.match(/(IndianOil|BESCOM|HP\s?Gas|BPCL|Adani|Indane|HPCL|Diesel|Tata\sPower|Bharatgas|TNEB)/i);
  const merchant = merchantMatch ? merchantMatch[0] : 'Sample';
  const amountMatch = sms.match(/₹([\d,]+)/);
  const amount = amountMatch ? amountMatch[0] : '';
  return { sms, label: `${merchant} · ${amount}` };
});

/**
 * Generate 14-day heatmap seed data with today as the last entry.
 * @returns {Array<{day: string, value: number, isToday: boolean}>}
 */
const buildSeedDates = () => {
  const today = new Date();
  return Array.from({ length: HEATMAP_DAYS }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (HEATMAP_DAYS - 1 - i));
    const label = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    const seeds = [4.2, 0, 8.7, 2.1, 11.3, 0, 5.6, 3.8, 0, 9.1, 6.4, 0, 4.7, 0];
    return { day: label, value: seeds[i], isToday: i === HEATMAP_DAYS - 1 };
  });
};

// ═══════════════════════════════════════════════════════════════════════════════
// LAYER 3 — PURE FUNCTIONS (exported, zero React dependency, fully testable)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Extract the ₹ amount from a UPI/bank SMS string.
 * Supports ₹, Rs, Rs., and INR prefixes with optional comma grouping and decimal paise.
 *
 * @param {string} smsText - Raw SMS message text
 * @returns {number|null} Extracted amount in ₹, or null if input is invalid or no amount found
 * @example extractAmount('Debited ₹1,200 at BESCOM') // → 1200
 */
export function extractAmount(smsText) {
  if (typeof smsText !== 'string') return null;
  const match = smsText.match(/(?:₹|Rs\.?|INR)\s?([\d,]+(?:\.\d{1,2})?)/i);
  if (!match) return null;
  const val = parseFloat(match[1].replace(/,/g, ''));
  return isNaN(val) ? null : val;
}

/**
 * Classify merchant category from SMS text using substring matching.
 *
 * @param {string} smsText - Raw SMS message text
 * @returns {'petrol'|'diesel'|'electricity'|'lpg'|null} Detected category, or null if unrecognised
 * @example classifyMerchant('₹1500 at HPCL Diesel')  // → 'diesel'
 */
export function classifyMerchant(smsText) {
  if (typeof smsText !== 'string') return null;
  const lower = smsText.toLowerCase();
  for (const [category, keywords] of Object.entries(MERCHANT_KEYWORDS)) {
    if (keywords.some((kw) => lower.includes(kw))) return category;
  }
  return null;
}

/**
 * Core footprint calculator. Converts ₹ amount + category + state into a CO₂ result object.
 *
 * @param {number} amount   - Transaction amount in ₹
 * @param {string} category - One of 'petrol', 'diesel', 'electricity', 'lpg'
 * @param {string} stateKey - State code key into LOCAL_CONTEXT (e.g. 'KA', 'DL')
 * @returns {object|null} Result object, or null on invalid input
 */
export function calculateFootprint(amount, category, stateKey) {
  const state = LOCAL_CONTEXT[stateKey];
  if (!state || typeof amount !== 'number' || amount <= 0) return null;

  let units, unitLabel, kgCO2, rateUsed, emissionFactor;

  if (category === 'petrol') {
    rateUsed = state.petrolPrice;
    emissionFactor = EMISSION_FACTORS.petrol;
    units = parseFloat((amount / rateUsed).toFixed(2)) || 0;
    unitLabel = 'litres';
    kgCO2 = parseFloat((units * emissionFactor).toFixed(2)) || 0;
  } else if (category === 'diesel') {
    rateUsed = state.dieselPrice;
    emissionFactor = EMISSION_FACTORS.diesel;
    units = parseFloat((amount / rateUsed).toFixed(2)) || 0;
    unitLabel = 'litres';
    kgCO2 = parseFloat((units * emissionFactor).toFixed(2)) || 0;
  } else if (category === 'electricity') {
    rateUsed = state.electricityRate;
    emissionFactor = state.gridEmissionFactor;
    units = parseFloat((amount / rateUsed).toFixed(2)) || 0;
    unitLabel = 'kWh';
    kgCO2 = parseFloat((units * emissionFactor).toFixed(2)) || 0;
  } else if (category === 'lpg') {
    rateUsed = state.lpgPrice;
    emissionFactor = EMISSION_FACTORS.lpg;
    const cylinders = amount / rateUsed;
    const kgLPG = cylinders * LPG_CYLINDER_WEIGHT_KG;
    units = parseFloat(cylinders.toFixed(2)) || 0;
    unitLabel = 'cylinders';
    kgCO2 = parseFloat((kgLPG * emissionFactor).toFixed(2)) || 0;
  } else {
    return null;
  }

  const rupeesSaved = parseFloat((kgCO2 * SOCIAL_COST_PER_KG).toFixed(2)) || 0;
  const aqiImpact = kgCO2 > 6 ? 'High' : kgCO2 > 2 ? 'Medium' : 'Low';

  return {
    category, amount, units, unitLabel, kgCO2,
    rupeesSaved, aqiImpact, rateUsed, emissionFactor,
  };
}

// ── Helpers for generateInsight to reduce cyclomatic complexity ──

function getUrgencyLevel(budgetSignal, isRepeatOffender, aqiSignal, gridRisk, largeTxn) {
  if (budgetSignal === 'CRITICAL') return 'CRITICAL';
  if (isRepeatOffender && aqiSignal !== 'LOW') return 'HIGH';
  if (gridRisk || largeTxn) return 'MEDIUM';
  return 'LOW';
}

function getHeadline(urgencyLevel, budgetPct, category, rupeesSaved, recentSameCategory, gridRisk, stateData, amount, kgCO2, units, unitLabel) {
  if (urgencyLevel === 'CRITICAL') {
    return `Budget alert: you've used ${budgetPct.toFixed(0)}% of your weekly carbon budget — this ${category} transaction adds ₹${rupeesSaved.toFixed(0)} in hidden social costs.`;
  }
  if (urgencyLevel === 'HIGH') {
    return `Pattern detected: ${recentSameCategory} of your last ${HISTORY_LOOKBACK} transactions were ${category}. Switching even once saves ₹${(rupeesSaved * recentSameCategory).toFixed(0)} cumulatively.`;
  }
  if (urgencyLevel === 'MEDIUM') {
    if (gridRisk) {
      return `${stateData.name}'s coal grid (${stateData.gridEmissionFactor} kg/kWh) makes this ₹${amount} bill emit ${kgCO2} kg CO₂ — ${((stateData.gridEmissionFactor / NATIONAL_AVG_GRID_FACTOR - 1) * 100).toFixed(0)}% more than the national average.`;
    }
    return `This ₹${amount} ${category} transaction generated ${kgCO2} kg CO₂ and ₹${rupeesSaved.toFixed(0)} in social costs.`;
  }
  return `₹${amount} → ${units} ${unitLabel} → ${kgCO2} kg CO₂ (₹${rupeesSaved.toFixed(0)} social cost). Your session footprint is on track.`;
}

function buildReasoningChain({ budgetSignal, isRepeatOffender, aqiSignal, gridRisk, largeTxn, category, recentSameCategory, stateData, amount, totalCO2, budgetPct, isFuel, threshold }) {
  const reasoning = [];

  if (budgetSignal !== 'LOW') {
    const advice = budgetSignal === 'CRITICAL' ? 'switch to low-carbon alternatives immediately.' :
                   budgetSignal === 'HIGH'     ? 'consider deferring non-essential trips.' :
                                                 'you have room but should track carefully.';
    reasoning.push(`Budget: ${totalCO2.toFixed(1)} / ${WEEKLY_BUDGET} kg used (${budgetPct.toFixed(0)}%) — ${advice}`);
  }

  if (isRepeatOffender) {
    reasoning.push(`Repeat pattern: ${category} appears ${recentSameCategory}× in recent transactions. Habitual spend = compounding footprint.`);
  }

  if (aqiSignal !== 'LOW') {
    const aqiAdvice = isFuel ? 'vehicular emissions are a direct PM2.5 contributor here.' :
                      category === 'electricity' && stateData.coalHeavy ? 'coal-power demand worsens regional air quality.' :
                      'outdoor air quality already stressed.';
    reasoning.push(`Local AQI is ${stateData.aqiValue} (${stateData.aqiLevel}) — ${aqiAdvice}`);
  }

  if (gridRisk) {
    const excessKg = parseFloat(((stateData.gridEmissionFactor - NATIONAL_AVG_GRID_FACTOR) * (amount / stateData.electricityRate)).toFixed(2)) || 0;
    reasoning.push(`Grid penalty: ${stateData.name}'s coal grid adds ~${excessKg} kg extra CO₂ vs the national average for this same bill.`);
  }

  if (largeTxn) {
    reasoning.push(`High-value transaction: ₹${amount} is above the typical ${category} spend threshold (₹${threshold}) — review if usage can be optimised.`);
  }

  if (reasoning.length === 0) {
    reasoning.push('All signals are within normal range. Continue monitoring your weekly budget.');
  }

  return reasoning;
}

function buildActions({ category, isFuel, isRepeatOffender, aqiSignal, stateData, largeTxn, gridRisk }) {
  const candidateActions = [];

  if (isFuel) {
    candidateActions.push({ label: 'Book BluSmart EV Cab', url: 'https://www.blusmart.in', score: isRepeatOffender ? 10 : 6 });
    candidateActions.push({ label: 'Find Metro Route', url: 'https://www.urbanrail.net/as/in/', score: aqiSignal !== 'LOW' ? 8 : 4 });
  } else if (category === 'electricity') {
    if (stateData.coalHeavy) {
      candidateActions.push({ label: 'Shop 5-Star ACs', url: 'https://www.flipkart.com/search?q=5+star+ac', score: largeTxn ? 10 : 7 });
      candidateActions.push({ label: 'Explore Rooftop Solar', url: 'https://solarrooftop.gov.in', score: gridRisk ? 9 : 5 });
    } else {
      candidateActions.push({ label: 'Switch to Green Tariff', url: 'https://mnre.gov.in', score: 6 });
      candidateActions.push({ label: '5-Star Appliances', url: 'https://www.flipkart.com/search?q=5+star+appliance', score: largeTxn ? 8 : 4 });
    }
  } else if (category === 'lpg') {
    candidateActions.push({ label: 'Check PM Ujjwala Subsidy', url: 'https://www.pmuy.gov.in', score: 7 });
    candidateActions.push({ label: 'Find Induction Cooktop', url: 'https://www.amazon.in/s?k=induction+cooktop+BEE+star', score: isRepeatOffender ? 9 : 5 });
  }

  return candidateActions.sort((a, b) => b.score - a.score).slice(0, 2);
}

function getHealthAdvisory(stateData) {
  if (stateData.aqiValue >= AQI_THRESHOLDS.severe) {
    return `AQI ${stateData.aqiValue} (${stateData.aqiLevel}): Limit outdoor exercise. Use N95 masks. Consider indoor air purifiers for your family.`;
  }
  if (stateData.aqiValue >= AQI_THRESHOLDS.high) {
    return `AQI ${stateData.aqiValue} (${stateData.aqiLevel}): Reduce outdoor activity during peak hours (11am–4pm). Sensitive groups should stay indoors.`;
  }
  return null;
}

/**
 * Multi-signal context intelligence engine.
 * Synthesises five independent signals into a prioritised, layered insight.
 *
 * @param {object} result    - Output of calculateFootprint()
 * @param {object} stateData - Full LOCAL_CONTEXT entry for the user's current state
 * @param {Array}  history   - Full session history array
 * @param {number} totalCO2  - Running session total kg CO₂
 * @returns {object} Structured insight object
 */
export function generateInsight(result, stateData, history, totalCO2) {
  const { category, kgCO2, amount, units, unitLabel, rupeesSaved } = result;

  const budgetPct = (totalCO2 / WEEKLY_BUDGET) * 100;
  const budgetSignal = budgetPct >= BUDGET_THRESHOLDS.critical ? 'CRITICAL' :
                       budgetPct >= BUDGET_THRESHOLDS.high     ? 'HIGH' :
                       budgetPct >= BUDGET_THRESHOLDS.moderate  ? 'MODERATE' : 'LOW';

  const recentSameCategory = history.slice(0, HISTORY_LOOKBACK).filter(h => h.category === category).length;
  const isRepeatOffender = recentSameCategory >= 2;

  const aqiSignal = stateData.aqiValue >= AQI_THRESHOLDS.severe ? 'SEVERE' :
                    stateData.aqiValue >= AQI_THRESHOLDS.high    ? 'HIGH' :
                    stateData.aqiValue >= AQI_THRESHOLDS.moderate ? 'MODERATE' : 'LOW';

  const threshold = LARGE_TXN_THRESHOLDS[category] || 1500;
  const largeTxn = amount > threshold;
  const gridRisk = stateData.coalHeavy && category === 'electricity';
  const isFuel = category === 'petrol' || category === 'diesel';

  const urgencyLevel = getUrgencyLevel(budgetSignal, isRepeatOffender, aqiSignal, gridRisk, largeTxn);
  const headline = getHeadline(urgencyLevel, budgetPct, category, rupeesSaved, recentSameCategory, gridRisk, stateData, amount, kgCO2, units, unitLabel);

  const reasoningParams = { budgetSignal, isRepeatOffender, aqiSignal, gridRisk, largeTxn, category, recentSameCategory, stateData, amount, totalCO2, budgetPct, isFuel, threshold };
  const reasoning = buildReasoningChain(reasoningParams);

  const actionParams = { category, isFuel, isRepeatOffender, aqiSignal, stateData, largeTxn, gridRisk };
  const actions = buildActions(actionParams);

  const healthAdvisory = getHealthAdvisory(stateData);

  return { headline, reasoning, urgencyLevel, actions, healthAdvisory };
}

/**
 * End-to-end SMS → insight orchestrator. Chains extraction, classification, and insight generation.
 *
 * @param {string} smsText  - Raw SMS message text
 * @param {string} stateKey - State code key into LOCAL_CONTEXT
 * @param {Array}  history  - Session history for context signals (default [])
 * @param {number} totalCO2 - Session running total kg CO₂ (default 0)
 * @returns {object|null} Combined footprint + insight result, or null if parsing fails
 */
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

/**
 * Aggregate a history array to total kg CO₂ (session lifetime).
 *
 * @param {Array<{kgCO2: number}>} history - Session history array
 * @returns {number} Total kg CO₂ rounded to 2 decimal places
 */
export function getTotalFootprint(history) {
  if (!Array.isArray(history) || history.length === 0) return 0;
  return parseFloat(history.reduce((s, h) => s + h.kgCO2, 0).toFixed(2)) || 0;
}

/**
 * Compute category breakdown with largest-remainder normalisation.
 * Guarantees percentage values sum to exactly 100.
 *
 * @param {Array<{category: string, kgCO2: number}>} history - Session history array
 * @returns {Array<{category: string, kg: number, pct: number}>} Breakdown
 */
export function computeBreakdown(history) {
  if (!Array.isArray(history) || history.length === 0) return [];
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
    kg: parseFloat(val.toFixed(2)) || 0,
    pct: floored[i],
  }));
}

// ═══════════════════════════════════════════════════════════════════════════════
// LAYER 4 — MEMOIZED SUB-COMPONENTS (React.memo prevents unnecessary re-renders)
// ═══════════════════════════════════════════════════════════════════════════════

/** Category icon selector — defined at module scope, not recreated per render. */
const CategoryIcon = memo(function CategoryIcon({ category, className }) {
  if (category === 'petrol' || category === 'diesel') return <Fuel className={className} />;
  if (category === 'electricity') return <Zap className={className} />;
  return <Flame className={className} />;
});
CategoryIcon.propTypes = {
  category: PropTypes.string.isRequired,
  className: PropTypes.string,
};

// ── Header ──────────────────────────────────────────────────────────────────
const Header = memo(function Header({ stateName }) {
  return (
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
            Analysing: {stateName}
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
  );
});
Header.propTypes = { stateName: PropTypes.string.isRequired };

// ── State Config Card ────────────────────────────────────────────────────────
const StateConfigCard = memo(function StateConfigCard({ selectedState, currentState, onStateChange }) {
  return (
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
          onChange={onStateChange}
          className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 pr-10 text-sm text-slate-900 appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
        >
          {Object.entries(LOCAL_CONTEXT).map(([key, st]) => (
            <option key={key} value={key}>{st.name} ({key})</option>
          ))}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
      </div>

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
          Diesel: ₹{currentState.dieselPrice}/L · LPG: ₹{currentState.lpgPrice} · Electricity: ₹{currentState.electricityRate}/kWh
        </p>
      </div>
    </div>
  );
});
StateConfigCard.propTypes = {
  selectedState: PropTypes.string.isRequired,
  currentState: PropTypes.object.isRequired,
  onStateChange: PropTypes.func.isRequired,
};

// ── SMS Input Card ──────────────────────────────────────────────────────────
const SmsInputCard = memo(function SmsInputCard({ smsInput, onInputChange, onAnalyze }) {
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onAnalyze();
    }
  }, [onAnalyze]);

  return (
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
        maxLength={SMS_MAX_LENGTH}
        value={smsInput}
        onChange={onInputChange}
        onKeyDown={handleKeyDown}
        placeholder={'e.g. "Debited ₹1,200 from A/c at BESCOM via UPI. Ref 789012"'}
        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
      />
      <p className="text-xs text-slate-400 mt-1">Press Enter to analyse · Shift+Enter for new line</p>
      <button
        onClick={onAnalyze}
        aria-label="Parse SMS and calculate carbon footprint"
        className="mt-3 w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-xl transition-colors duration-150 text-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
      >
        Analyse Footprint
      </button>
    </div>
  );
});
SmsInputCard.propTypes = {
  smsInput: PropTypes.string.isRequired,
  onInputChange: PropTypes.func.isRequired,
  onAnalyze: PropTypes.func.isRequired,
};

// ── Quick Test Panel ────────────────────────────────────────────────────────
const QuickTestPanel = memo(function QuickTestPanel({ onSelectSms }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">
        Quick Test
      </p>
      <div className="flex flex-wrap gap-2">
        {QUICK_TEST_CHIPS.map((chip, i) => (
          <button
            key={i}
            onClick={() => onSelectSms(chip.sms)}
            aria-label={`Load sample SMS: ${chip.sms}`}
            className="bg-white hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 text-slate-600 text-xs px-3 py-1.5 rounded-full border border-slate-200 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {chip.label}
          </button>
        ))}
      </div>
    </div>
  );
});
QuickTestPanel.propTypes = { onSelectSms: PropTypes.func.isRequired };

// ── KPI Row ─────────────────────────────────────────────────────────────────
const KpiRow = memo(function KpiRow({ totalFootprint, totalRupeesSaved, equivalentCarKm, budgetPct, historyCount }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-3">
          <Leaf className="w-3.5 h-3.5 text-emerald-500" />
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Session CO₂</p>
        </div>
        <p className="text-3xl font-bold text-slate-900 tabular-nums">
          {totalFootprint}
          <span className="text-sm font-normal text-slate-400 ml-1">kg</span>
        </p>
        <p className="text-xs text-slate-400 mt-1">
          {historyCount} transaction{historyCount !== 1 ? 's' : ''} analysed
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-3">
          <Info className="w-3.5 h-3.5 text-blue-500" />
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Est. Social Cost</p>
        </div>
        <p className="text-3xl font-bold text-emerald-600 tabular-nums">
          ₹{totalRupeesSaved.toFixed(0)}
        </p>
        <p className="text-xs text-slate-400 mt-1">
          at ₹{SOCIAL_COST_PER_KG} / kg CO₂ · {equivalentCarKm} km by car
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-3">
          <Target className="w-3.5 h-3.5 text-blue-500" />
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Carbon Budget</p>
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
  );
});
KpiRow.propTypes = {
  totalFootprint: PropTypes.number.isRequired,
  totalRupeesSaved: PropTypes.number.isRequired,
  equivalentCarKm: PropTypes.string.isRequired,
  budgetPct: PropTypes.number.isRequired,
  historyCount: PropTypes.number.isRequired,
};

// ── Emission Breakdown Card ─────────────────────────────────────────────────
const EmissionBreakdownCard = memo(function EmissionBreakdownCard({ breakdown }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 className="w-3.5 h-3.5 text-slate-400" />
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Emission Breakdown</p>
      </div>
      {breakdown.length === 0 ? (
        <div className="bg-slate-50 rounded-xl py-6 text-center">
          <p className="text-sm text-slate-400">Analyse transactions to see category split.</p>
        </div>
      ) : (
        <>
          <div className="h-3.5 rounded-full overflow-hidden flex bg-slate-100" role="img" aria-label="Emission breakdown by category">
            {breakdown.map((cat) => (
              <div
                key={cat.category}
                className={`${CATEGORY_META[cat.category].bar} transition-all duration-500`}
                style={{ width: `${cat.pct}%` }}
              />
            ))}
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-1 mt-3">
            {breakdown.map((cat) => (
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
  );
});
EmissionBreakdownCard.propTypes = { breakdown: PropTypes.array.isRequired };

// ── Heatmap Card ────────────────────────────────────────────────────────────
const HeatmapCard = memo(function HeatmapCard({ data, maxVal }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
      <div className="flex justify-between items-center mb-5">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-3.5 h-3.5 text-slate-400" />
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
            {HEATMAP_DAYS}-Day CO₂ Impact Trend
          </p>
        </div>
        <span className="text-xs text-slate-400">kg CO₂ / day</span>
      </div>

      <div className="flex gap-1.5 h-32">
        {data.map((d, i) => {
          const heightPct = Math.round((d.value / maxVal) * 100);
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
        {data.map((d, i) => (
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
  );
});
HeatmapCard.propTypes = {
  data: PropTypes.array.isRequired,
  maxVal: PropTypes.number.isRequired,
};

// ── Agent Bubble Card ───────────────────────────────────────────────────────
const AgentBubbleCard = memo(function AgentBubbleCard({ parsedResult }) {
  return (
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
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">CarbonSense Agent</p>
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
              Ensure the SMS mentions a supported merchant: IndianOil, BPCL, HPCL (petrol/diesel),
              BESCOM, Adani, Tata Power, MSEDCL, TNEB (electricity), HP Gas, Indane, Bharatgas (LPG).
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

          {/* Block 1b: Health Advisory (when AQI is concerning) */}
          {parsedResult.insight.healthAdvisory && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 flex gap-2.5">
              <AlertTriangle className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-rose-700 mb-0.5">Health Advisory</p>
                <p className="text-xs text-rose-600 leading-relaxed">{parsedResult.insight.healthAdvisory}</p>
              </div>
            </div>
          )}

          {/* Block 2: Reasoning chain */}
          <div className="bg-slate-50 rounded-xl px-4 py-3 space-y-2">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">Signal Analysis</p>
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
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">Calculation</p>
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
                <>{LPG_CYLINDER_WEIGHT_KG} kg/cyl <span className="text-blue-600 font-semibold">×</span> {parsedResult.emissionFactor} kg CO₂/kg</>
              ) : (
                <>{parsedResult.emissionFactor} kg CO₂/{parsedResult.unitLabel}</>
              )}{' '}
              <span className="text-slate-400">=</span>{' '}
              <span className="text-emerald-700 font-bold">{parsedResult.kgCO2} kg CO₂</span>
              <br />
              {parsedResult.kgCO2} kg{' '}
              <span className="text-blue-600 font-semibold">×</span>{' '}
              ₹{SOCIAL_COST_PER_KG} social cost{' '}
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
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">Recommended Actions</p>
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
  );
});
AgentBubbleCard.propTypes = { parsedResult: PropTypes.object };

// ── Transaction Log ─────────────────────────────────────────────────────────
const TransactionLog = memo(function TransactionLog({ history, onClear }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Transaction Log</p>
        {history.length > 0 && (
          <button
            onClick={onClear}
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
          {history.slice(0, LOG_RENDER_LIMIT).map((h, i) => (
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
          {history.length > LOG_RENDER_LIMIT && (
            <li className="text-center text-xs text-slate-400 pt-2">
              + {history.length - LOG_RENDER_LIMIT} older transactions hidden
            </li>
          )}
        </ul>
      )}
    </div>
  );
});
TransactionLog.propTypes = {
  history: PropTypes.array.isRequired,
  onClear: PropTypes.func.isRequired,
};

// ═══════════════════════════════════════════════════════════════════════════════
// LAYER 5 — APP COMPONENT (composition only — all logic in pure functions)
// ═══════════════════════════════════════════════════════════════════════════════

function App() {
  // ── Primary state ──
  const [selectedState, setSelectedState] = useState('KA');
  const [smsInput, setSmsInput] = useState('');
  const [parsedResult, setParsedResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [heatmapData, setHeatmapData] = useState(buildSeedDates);

  // ── Derived values (useMemo — avoids redundant computation per render) ──
  const currentState = useMemo(() => LOCAL_CONTEXT[selectedState], [selectedState]);
  const totalFootprint = useMemo(() => getTotalFootprint(history), [history]);
  const totalRupeesSaved = useMemo(
    () => parseFloat(history.reduce((s, h) => s + h.rupeesSaved, 0).toFixed(2)) || 0,
    [history],
  );
  const equivalentCarKm = useMemo(
    () => (totalFootprint / CAR_EMISSION_PER_KM).toFixed(0),
    [totalFootprint],
  );
  const budgetPct = useMemo(
    () => Math.min((totalFootprint / WEEKLY_BUDGET) * 100, 100),
    [totalFootprint],
  );
  const maxHeatVal = useMemo(
    () => Math.max(...heatmapData.map((x) => x.value), 1),
    [heatmapData],
  );
  const categoryBreakdown = useMemo(() => computeBreakdown(history), [history]);

  // ── Stable event handlers (useCallback — prevents child re-renders) ──
  const handleStateChange = useCallback((e) => {
    setSelectedState(e.target.value);
    setParsedResult(null);
  }, []);

  const handleInputChange = useCallback((e) => setSmsInput(e.target.value), []);

  const handleSelectSms = useCallback((sms) => setSmsInput(sms), []);

  const handleAnalyze = useCallback(() => {
    const trimmed = smsInput.trim();
    if (!trimmed) return;
    const result = parseSMS(trimmed, selectedState, history, totalFootprint);
    if (result) {
      setParsedResult(result);
      setHistory((prev) => [result, ...prev]);
      setHeatmapData((prev) =>
        prev.map((d, i) =>
          i === HEATMAP_DAYS - 1
            ? { ...d, value: parseFloat((d.value + result.kgCO2).toFixed(2)) || 0 }
            : d,
        ),
      );
    } else {
      setParsedResult({ error: true });
    }
    setSmsInput('');
  }, [smsInput, selectedState, history, totalFootprint]);

  const handleClear = useCallback(() => {
    setHistory([]);
    setParsedResult(null);
    setHeatmapData(buildSeedDates());
  }, []);

  // ═════════════════════════════════════════════════════════════════════════════
  // RENDER — composed from memoized sub-components
  // ═════════════════════════════════════════════════════════════════════════════

  return (
    <div className="min-h-screen bg-slate-50">
      <Header stateName={currentState.name} />

      <main className="max-w-screen-xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* LEFT COLUMN */}
          <aside className="lg:col-span-4 space-y-5">
            <StateConfigCard
              selectedState={selectedState}
              currentState={currentState}
              onStateChange={handleStateChange}
            />
            <SmsInputCard
              smsInput={smsInput}
              onInputChange={handleInputChange}
              onAnalyze={handleAnalyze}
            />
            <QuickTestPanel onSelectSms={handleSelectSms} />
          </aside>

          {/* RIGHT COLUMN */}
          <section className="lg:col-span-8 space-y-5">
            <KpiRow
              totalFootprint={totalFootprint}
              totalRupeesSaved={totalRupeesSaved}
              equivalentCarKm={equivalentCarKm}
              budgetPct={budgetPct}
              historyCount={history.length}
            />
            <EmissionBreakdownCard breakdown={categoryBreakdown} />
            <HeatmapCard data={heatmapData} maxVal={maxHeatVal} />
            <AgentBubbleCard parsedResult={parsedResult} />
            <TransactionLog history={history} onClear={handleClear} />
          </section>
        </div>
      </main>
    </div>
  );
}

export default App;
