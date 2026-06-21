import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App, {
  extractAmount, classifyMerchant, calculateFootprint,
  parseSMS, getTotalFootprint, generateInsight, computeBreakdown,
} from './App';

// ═══════════════════════════════════════════════════════════════════════════
// UNIT TESTS — Pure Functions
// ═══════════════════════════════════════════════════════════════════════════

describe('extractAmount', () => {
  test('parses ₹ symbol',            () => expect(extractAmount('Debited ₹500 at IndianOil')).toBe(500));
  test('strips commas',              () => expect(extractAmount('Paid ₹1,200 to BESCOM')).toBe(1200));
  test('handles Rs. prefix',         () => expect(extractAmount('Rs. 850 to HP Gas')).toBe(850));
  test('handles decimal amounts',    () => expect(extractAmount('₹102.50 at petrol pump')).toBe(102.50));
  test('returns null for no amount', () => expect(extractAmount('OTP is 456789')).toBeNull());
  test('handles INR prefix',         () => expect(extractAmount('INR 2500 BPCL')).toBe(2500));
  test('returns null for null input',  () => expect(extractAmount(null)).toBeNull());
  test('returns null for number input', () => expect(extractAmount(12345)).toBeNull());
});

describe('classifyMerchant', () => {
  test('IndianOil → petrol',     () => expect(classifyMerchant('₹500 at IndianOil')).toBe('petrol'));
  test('BESCOM → electricity',   () => expect(classifyMerchant('₹1200 to bescom')).toBe('electricity'));
  test('HP Gas → lpg',           () => expect(classifyMerchant('₹850 to HP Gas')).toBe('lpg'));
  test('Indane Gas → lpg',       () => expect(classifyMerchant('₹903 to Indane Gas')).toBe('lpg'));
  test('UPPCL → electricity',    () => expect(classifyMerchant('₹1100 to UPPCL')).toBe('electricity'));
  test('Swiggy → null',          () => expect(classifyMerchant('₹200 to Swiggy')).toBeNull());
  test('no merchant → null',     () => expect(classifyMerchant('Received ₹500 from Rahul')).toBeNull());
  test('HPCL Diesel → diesel',   () => expect(classifyMerchant('₹1500 at HPCL Diesel pump')).toBe('diesel'));
  test('diesel pump → diesel',   () => expect(classifyMerchant('₹800 at diesel pump')).toBe('diesel'));
  test('returns null for null',   () => expect(classifyMerchant(null)).toBeNull());
});

describe('calculateFootprint — state-aware math', () => {
  test('KA petrol: ₹500 → ~4.86L × 2.31 ≈ 11.23 kg CO₂', () => {
    const r = calculateFootprint(500, 'petrol', 'KA');
    expect(r.units).toBeCloseTo(4.86, 1);
    expect(r.kgCO2).toBeCloseTo(11.23, 1);
    expect(r.unitLabel).toBe('litres');
  });

  test('DL petrol is cheaper per litre → more fuel → more CO₂', () => {
    const dl = calculateFootprint(500, 'petrol', 'DL');
    const ka = calculateFootprint(500, 'petrol', 'KA');
    expect(dl.kgCO2).toBeGreaterThan(ka.kgCO2);
  });

  test('UP electricity emits more CO₂ than KA (coal-heavy grid)', () => {
    const up = calculateFootprint(1200, 'electricity', 'UP');
    const ka = calculateFootprint(1200, 'electricity', 'KA');
    expect(up.kgCO2).toBeGreaterThan(ka.kgCO2);
  });

  test('LPG ₹903 = 1 cylinder × 14.2 kg × 2.98 ≈ 42.32 kg CO₂', () => {
    const r = calculateFootprint(903, 'lpg', 'KA');
    expect(r.units).toBeCloseTo(1.0, 1);
    expect(r.kgCO2).toBeCloseTo(42.32, 1);
    expect(r.unitLabel).toBe('cylinders');
  });

  test('rupeesSaved = kgCO2 × SOCIAL_COST_PER_KG', () => {
    const r = calculateFootprint(500, 'petrol', 'KA');
    expect(r.rupeesSaved).toBeCloseTo(r.kgCO2 * 5.5, 2);
  });

  test('aqiImpact High when kgCO2 > 6', () => {
    const r = calculateFootprint(4000, 'petrol', 'UP');
    expect(r.aqiImpact).toBe('High');
  });

  test('aqiImpact Medium when 2 < kgCO2 ≤ 6', () => {
    const r = calculateFootprint(150, 'electricity', 'DL');
    expect(r.aqiImpact).toBe('Medium');
  });

  test('aqiImpact Low when kgCO2 ≤ 2', () => {
    const r = calculateFootprint(80, 'electricity', 'KA');
    expect(r.aqiImpact).toBe('Low');
  });

  test('returns null for invalid stateKey', () => {
    expect(calculateFootprint(500, 'petrol', 'XX')).toBeNull();
  });

  test('diesel ₹1500 in DL → uses diesel price and factor', () => {
    const r = calculateFootprint(1500, 'diesel', 'DL');
    expect(r.category).toBe('diesel');
    expect(r.unitLabel).toBe('litres');
    expect(r.emissionFactor).toBe(2.68);
    expect(r.kgCO2).toBeGreaterThan(0);
  });

  test('TN petrol uses TN-specific price', () => {
    const r = calculateFootprint(500, 'petrol', 'TN');
    expect(r.rateUsed).toBe(100.76);
    expect(r.kgCO2).toBeGreaterThan(0);
  });

  test('returns null for negative amount', () => {
    expect(calculateFootprint(-100, 'petrol', 'KA')).toBeNull();
  });
});

describe('generateInsight — multi-signal context engine', () => {
  const kaState = { name: 'Karnataka', petrolPrice: 102.86, dieselPrice: 88.94, electricityRate: 6.50, gridEmissionFactor: 0.82, lpgPrice: 903, aqiLevel: 'Moderate', aqiValue: 98, coalHeavy: false };
  const dlState = { name: 'Delhi', petrolPrice: 94.72, dieselPrice: 87.62, electricityRate: 7.00, gridEmissionFactor: 1.12, lpgPrice: 903, aqiLevel: 'Unhealthy', aqiValue: 187, coalHeavy: true };

  const mockFootprint = (category, kgCO2, amount = 500) => ({
    category, kgCO2, amount, units: 4.8, unitLabel: 'litres',
    rupeesSaved: kgCO2 * 5.5, aqiImpact: kgCO2 > 6 ? 'High' : 'Low',
    rateUsed: 102.86, emissionFactor: 2.31,
  });

  test('CRITICAL urgency when budget > 90%', () => {
    const result = mockFootprint('petrol', 5);
    const insight = generateInsight(result, kaState, [], 46);
    expect(insight.urgencyLevel).toBe('CRITICAL');
    expect(insight.headline).toMatch(/Budget alert/i);
  });

  test('HIGH urgency when repeat offender + bad AQI', () => {
    const history = Array(3).fill(mockFootprint('petrol', 3));
    const result  = mockFootprint('petrol', 3);
    const insight = generateInsight(result, dlState, history, 15);
    expect(insight.urgencyLevel).toBe('HIGH');
    expect(insight.reasoning.some(r => /pattern/i.test(r))).toBe(true);
  });

  test('MEDIUM urgency for coal-heavy electricity', () => {
    const result  = mockFootprint('electricity', 4, 1200);
    const insight = generateInsight(result, dlState, [], 10);
    expect(insight.urgencyLevel).toBe('MEDIUM');
    expect(insight.reasoning.some(r => /coal/i.test(r))).toBe(true);
  });

  test('LOW urgency for small clean-state transaction', () => {
    const result  = mockFootprint('electricity', 1, 200);
    const insight = generateInsight(result, kaState, [], 5);
    expect(insight.urgencyLevel).toBe('LOW');
  });

  test('actions are priority-scored: repeat petrol → BluSmart first', () => {
    const history = Array(3).fill(mockFootprint('petrol', 3));
    const result  = mockFootprint('petrol', 3);
    const insight = generateInsight(result, kaState, history, 12);
    expect(insight.actions[0].label).toContain('BluSmart');
  });

  test('coal electricity → 5-star AC is top action', () => {
    const result  = mockFootprint('electricity', 8, 2500);
    const insight = generateInsight(result, dlState, [], 8);
    expect(insight.actions[0].label).toMatch(/5-Star/i);
  });

  test('reasoning array always has at least 1 entry', () => {
    const result  = mockFootprint('lpg', 1.5, 400);
    const insight = generateInsight(result, kaState, [], 2);
    expect(insight.reasoning.length).toBeGreaterThanOrEqual(1);
  });

  test('parseSMS now returns insight property with healthAdvisory', () => {
    const result = parseSMS('Paid ₹1200 to BESCOM', 'DL', [], 0);
    expect(result).toHaveProperty('insight');
    expect(result.insight).toHaveProperty('urgencyLevel');
    expect(result.insight).toHaveProperty('reasoning');
    expect(result.insight).toHaveProperty('actions');
    expect(result.insight).toHaveProperty('healthAdvisory');
  });

  test('healthAdvisory is non-null for high-AQI state (DL)', () => {
    const result = mockFootprint('petrol', 5);
    const insight = generateInsight(result, dlState, [], 10);
    expect(insight.healthAdvisory).not.toBeNull();
    expect(insight.healthAdvisory).toMatch(/AQI/);
  });

  test('healthAdvisory is null for good-AQI state (KA)', () => {
    const result = mockFootprint('petrol', 5);
    const insight = generateInsight(result, kaState, [], 10);
    expect(insight.healthAdvisory).toBeNull();
  });

  test('diesel transactions get fuel-type actions (BluSmart/Metro)', () => {
    const result = mockFootprint('diesel', 8, 1500);
    result.category = 'diesel';
    const insight = generateInsight(result, kaState, [], 8);
    expect(insight.actions.length).toBeGreaterThanOrEqual(1);
    expect(insight.actions[0].label).toMatch(/BluSmart|Metro/);
  });
});

describe('parseSMS — integration pipeline', () => {
  test('petrol SMS in MH returns valid result', () => {
    const r = parseSMS('Paid ₹2500 to BPCL fuel station', 'MH');
    expect(r).not.toBeNull();
    expect(r.category).toBe('petrol');
    expect(r.kgCO2).toBeGreaterThan(0);
  });

  test('electricity SMS in DL uses DL grid factor', () => {
    const r = parseSMS('Paid ₹1200 to BESCOM via UPI', 'DL');
    expect(r.emissionFactor).toBe(1.12);
  });

  test('returns null for social payment', () => {
    expect(parseSMS('Received ₹200 from Priya via GPay', 'KA')).toBeNull();
  });

  test('returns null for OTP SMS (no debit amount)', () => {
    expect(parseSMS('Your OTP for IndianOil is 998877', 'KA')).toBeNull();
  });

  test('diesel SMS in TN returns diesel category', () => {
    const r = parseSMS('Paid ₹1500 to HPCL Diesel pump', 'TN');
    expect(r).not.toBeNull();
    expect(r.category).toBe('diesel');
    expect(r.emissionFactor).toBe(2.68);
  });
});

describe('getTotalFootprint', () => {
  test('sums history correctly',    () => expect(getTotalFootprint([{ kgCO2: 5.5 }, { kgCO2: 3.2 }, { kgCO2: 1.1 }])).toBe(9.8));
  test('returns 0 for empty',       () => expect(getTotalFootprint([])).toBe(0));
  test('handles single entry',      () => expect(getTotalFootprint([{ kgCO2: 11.22 }])).toBe(11.22));
  test('returns 0 for null input',  () => expect(getTotalFootprint(null)).toBe(0));
});

describe('computeBreakdown', () => {
  test('normalises to 100%', () => {
    const bd = computeBreakdown([
      { category: 'petrol', kgCO2: 10 },
      { category: 'lpg', kgCO2: 20 },
      { category: 'electricity', kgCO2: 3 },
    ]);
    const totalPct = bd.reduce((s, b) => s + b.pct, 0);
    expect(totalPct).toBe(100);
  });

  test('returns empty for empty history', () => {
    expect(computeBreakdown([])).toEqual([]);
  });

  test('single category = 100%', () => {
    const bd = computeBreakdown([{ category: 'petrol', kgCO2: 5 }]);
    expect(bd[0].pct).toBe(100);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT TESTS — React Testing Library
// ═══════════════════════════════════════════════════════════════════════════

describe('UI — Render and Interaction', () => {
  test('renders SMS input and Analyse button', () => {
    render(<App />);
    expect(screen.getByLabelText(/paste upi/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /analyse footprint/i })).toBeInTheDocument();
  });

  test('renders trust badge in header', () => {
    render(<App />);
    expect(screen.getByText(/no data leaves device/i)).toBeInTheDocument();
  });

  test('shows null state in Agent card before analysis', () => {
    render(<App />);
    expect(screen.getByText(/ready to analyse/i)).toBeInTheDocument();
  });

  test('analyses petrol SMS and displays CO₂ result', async () => {
    render(<App />);
    const textarea = screen.getByLabelText(/paste upi/i);
    const button = screen.getByRole('button', { name: /analyse footprint/i });
    await userEvent.type(textarea, 'Debited ₹500 from A/c at IndianOil');
    await userEvent.click(button);
    expect(screen.getByText(/kg CO₂/i)).toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  test('shows error state for unrecognised merchant', async () => {
    render(<App />);
    const textarea = screen.getByLabelText(/paste upi/i);
    const button = screen.getByRole('button', { name: /analyse footprint/i });
    await userEvent.type(textarea, 'Paid ₹200 to Swiggy');
    await userEvent.click(button);
    expect(screen.getByText(/not recognised/i)).toBeInTheDocument();
  });

  test('clear button resets history', async () => {
    render(<App />);
    const textarea = screen.getByLabelText(/paste upi/i);
    const button = screen.getByRole('button', { name: /analyse footprint/i });
    await userEvent.type(textarea, 'Debited ₹500 at IndianOil');
    await userEvent.click(button);
    const clearBtn = screen.getByRole('button', { name: /clear/i });
    await userEvent.click(clearBtn);
    expect(screen.getByText(/no transactions/i)).toBeInTheDocument();
  });
});
