/**
 * Mock Data Service
 *
 * This service provides mock data for development and testing purposes.
 * It contains realistic data structures that match the backend API responses.
 */

// Helper function to generate random numbers within a range
const randomNumber = (min, max) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

// Helper function to generate dates for the past few months
const generatePastMonths = (count) => {
  const result = [];
  const currentDate = new Date();

  for (let i = count - 1; i >= 0; i--) {
    const pastDate = new Date(currentDate);
    pastDate.setMonth(currentDate.getMonth() - i);

    result.push({
      month: pastDate.toLocaleString("default", { month: "long" }),
      monthNumber: pastDate.getMonth() + 1,
      year: pastDate.getFullYear(),
    });
  }

  return result;
};

// Helper to generate realistic DOT data
const DOTS = [
  "Alger",
  "Oran",
  "Constantine",
  "Annaba",
  "Blida",
  "Batna",
  "Djelfa",
  "Sétif",
  "Sidi Bel Abbès",
  "Biskra",
];

// Helper to generate products
const PRODUCTS = [
  "Mobile",
  "Internet",
  "Fixed Line",
  "Enterprise Solutions",
  "Cloud Services",
  "IoT",
  "Security Services",
  "Content Services",
];

// Helper to generate dates in YYYY-MM-DD format
const formatDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

// Helper to generate a random date in the past year
const randomPastDate = (maxDaysAgo = 365) => {
  const today = new Date();
  const daysAgo = randomNumber(1, maxDaysAgo);
  const pastDate = new Date(today);
  pastDate.setDate(today.getDate() - daysAgo);
  return formatDate(pastDate);
};

// Dashboard Overview Mock Data
export const mockDashboardOverview = {
  total_users: 24,
  active_users: 18,
  disabled_users: 6,
  files_uploaded: 156,
  database_size: "477 MB",
  anomalies_detected: 42,
  anomalies_resolved: 28,
  system_status: "healthy",
  last_update: new Date().toISOString(),
  recent_activity: [
    {
      id: 1,
      type: "file_upload",
      user: "admin@test.com",
      timestamp: new Date(Date.now() - 10000).toISOString(),
      details: "Uploaded facturation_manuelle.xlsx",
    },
    {
      id: 2,
      type: "anomaly_resolved",
      user: "admin@test.com",
      timestamp: new Date(Date.now() - 100000).toISOString(),
      details: "Resolved duplicate invoice anomaly",
    },
  ],
};

// Comprehensive Report Mock Data
export const mockRevenueCollectionReport = {
  year: new Date().getFullYear(),
  month: new Date().getMonth() + 1,
  kpis: {
    total_revenue: 24567890.45,
    total_collection: 19876543.21,
    collection_rate: 80.9,
    total_invoiced: 24567890.45,
  },
  breakdowns: {
    revenue_by_dot: Object.fromEntries(
      DOTS.map((dot) => [dot, randomNumber(1000000, 5000000)])
    ),
    collection_by_dot: Object.fromEntries(
      DOTS.map((dot) => [dot, randomNumber(800000, 4000000)])
    ),
    revenue_by_invoice_type: {
      Periodic: 15678900.45,
      "Non-Periodic": 5432100.67,
      DNT: 1345678.9,
      RFD: 1123432.1,
      CNT: 987678.33,
    },
    collection_by_invoice_type: {
      Periodic: 12654300.22,
      "Non-Periodic": 4123456.78,
      DNT: 1234567.89,
      RFD: 956432.1,
      CNT: 876543.22,
    },
  },
  anomalies: [
    {
      id: 1,
      type: "high_revenue_variation",
      description: "Unusually high revenue increase in Alger region",
      severity: "medium",
      status: "open",
    },
    {
      id: 2,
      type: "low_collection_rate",
      description: "Collection rate below target for Oran region",
      severity: "high",
      status: "in_progress",
    },
  ],
  trends: generatePastMonths(6).map((month) => ({
    month: month.month,
    year: month.year,
    revenue: randomNumber(18000000, 25000000),
    collection: randomNumber(15000000, 20000000),
  })),
};

// Corporate Park Report Mock Data
export const mockCorporateParkReport = {
  year: new Date().getFullYear(),
  month: new Date().getMonth() + 1,
  kpis: {
    total_vehicles: 3456,
  },
  breakdowns: {
    vehicles_by_dot: Object.fromEntries(
      DOTS.map((dot) => [dot, randomNumber(200, 600)])
    ),
    vehicles_by_state: {
      Active: 2890,
      Maintenance: 234,
      Inactive: 332,
    },
    vehicles_by_type: {
      Small: 1234,
      Medium: 1543,
      Heavy: 456,
      Special: 223,
    },
  },
  anomalies: [
    {
      id: 3,
      type: "unusual_vehicle_count",
      description: "Unexpected decrease in vehicle count for Blida",
      severity: "low",
      status: "open",
    },
  ],
  trends: generatePastMonths(6).map((month) => ({
    month: month.month,
    year: month.year,
    total_vehicles: randomNumber(3300, 3600),
    active_vehicles: randomNumber(2800, 3000),
  })),
};

// Receivables Report Mock Data
export const mockReceivablesReport = {
  year: new Date().getFullYear(),
  month: new Date().getMonth() + 1,
  kpis: {
    total_receivables: 9876543.21,
  },
  breakdowns: {
    receivables_by_dot: Object.fromEntries(
      DOTS.map((dot) => [dot, randomNumber(500000, 1500000)])
    ),
    receivables_by_age: {
      "0-30": 3456789.1,
      "31-60": 2345678.9,
      "61-90": 1567890.45,
      "91+": 2506184.76,
    },
  },
  anomalies: [
    {
      id: 4,
      type: "high_aged_receivables",
      description: "Significant increase in receivables over 90 days",
      severity: "high",
      status: "open",
    },
  ],
  trends: generatePastMonths(6).map((month) => ({
    month: month.month,
    year: month.year,
    total_receivables: randomNumber(8000000, 10000000),
    current_receivables: randomNumber(3000000, 4000000),
    aged_receivables: randomNumber(5000000, 6000000),
  })),
};

// KPI Data
export const mockKpiData = {
  dashboard_summary: {
    total_revenue: 24567890.45,
    total_collection: 19876543.21,
    collection_rate: 80.9,
    total_receivables: 9876543.21,
    total_vehicles: 3456,
    anomalies_count: 42,
    recent_uploads: 12,
    revenue_growth: 8.5,
    collection_growth: 6.2,
    trends: {
      revenue: generatePastMonths(12).map((month) => ({
        month: month.month,
        value: randomNumber(18000000, 25000000),
      })),
      collection: generatePastMonths(12).map((month) => ({
        month: month.month,
        value: randomNumber(15000000, 20000000),
      })),
      receivables: generatePastMonths(12).map((month) => ({
        month: month.month,
        value: randomNumber(8000000, 10000000),
      })),
    },
  },

  revenue: {
    total_revenue: 24567890.45,
    total: 24567890.45,
    previous_year_revenue: 22642518.32,
    growth_percentage: 8.5,
    ytd_revenue: 18956734.21,
    objective: 25000000.0,
    achievement_rate: 98.27,

    periodic: 15678900.45,
    non_periodic: 5432100.67,
    special: {
      dnt: 1345678.9,
      rfd: 1123432.1,
      cnt: 987678.33,
    },

    current_year: {
      total_revenue: 24567890.45,
      regular_revenue: 18543921.12,
      previous_exercise_revenue: 2345678.54,
      advance_billing_revenue: 3678290.79,
    },

    previous_year: {
      total_revenue: 22642518.32,
      regular_revenue: 17123456.43,
      previous_exercise_revenue: 2109876.32,
      advance_billing_revenue: 3409185.57,
    },

    revenue_by_dot: DOTS.map((dot) => {
      const total = randomNumber(1000000, 5000000);
      const objective = randomNumber(total * 0.9, total * 1.2);
      return {
        organization: dot,
        total,
        objective,
        achievement_rate: parseFloat(((total / objective) * 100).toFixed(2)),
        growth: parseFloat((Math.random() * 20 - 5).toFixed(2)),
        previous_year: total / (1 + Math.random() * 0.2),
      };
    }).sort((a, b) => b.total - a.total),

    by_dot: Object.fromEntries(
      DOTS.map((dot) => [dot, randomNumber(1000000, 5000000)])
    ),

    by_product: Object.fromEntries(
      PRODUCTS.map((product) => [product, randomNumber(1000000, 4000000)])
    ),

    growth: 8.5,

    revenue_by_product_type: PRODUCTS.map((product) => {
      const total = randomNumber(1000000, 4000000);
      return {
        product,
        total,
        percentage: 0,
        growth: parseFloat((Math.random() * 20 - 5).toFixed(2)),
        previous_year: total / (1 + Math.random() * 0.2),
      };
    }),

    monthly_trends: (() => {
      const months = [
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December",
      ];
      return months.map((month, index) => {
        const current_year_value = randomNumber(18000000, 25000000);
        const previous_year_value =
          current_year_value * (0.8 + Math.random() * 0.3); // 80-110% of current
        return {
          month,
          month_number: index + 1,
          current_year_value,
          previous_year_value,
          difference: current_year_value - previous_year_value,
          difference_percentage: parseFloat(
            ((current_year_value / previous_year_value - 1) * 100).toFixed(2)
          ),
        };
      });
    })(),

    by_invoice_type: {
      "Regular Invoices": 14532789.45,
      "Adjusted Invoices": 4325678.32,
      "Credit Notes": 2876543.12,
      "Special Operations": 2832879.56,
    },

    target_achievement: (() => {
      let cumulative = 0;
      const target = 25000000.0;
      const monthlyTargets = Array(12)
        .fill(0)
        .map(() => target / 12);

      return Array(12)
        .fill(0)
        .map((_, index) => {
          const monthly = randomNumber(target / 15, target / 10);
          cumulative += monthly;
          return {
            month: [
              "Jan",
              "Feb",
              "Mar",
              "Apr",
              "May",
              "Jun",
              "Jul",
              "Aug",
              "Sep",
              "Oct",
              "Nov",
              "Dec",
            ][index],
            month_number: index + 1,
            monthly,
            cumulative,
            target_cumulative: monthlyTargets
              .slice(0, index + 1)
              .reduce((sum, val) => sum + val, 0),
            achievement_percentage: parseFloat(
              (
                (cumulative /
                  monthlyTargets
                    .slice(0, index + 1)
                    .reduce((sum, val) => sum + val, 0)) *
                100
              ).toFixed(2)
            ),
          };
        });
    })(),

    top_customers: [
      { name: "Enterprise Client A", revenue: 3456789.21, percentage: 14.1 },
      { name: "Government Entity B", revenue: 2945678.12, percentage: 12.0 },
      { name: "Corporate Group C", revenue: 2345678.34, percentage: 9.5 },
      { name: "Telecom Partner D", revenue: 1987654.56, percentage: 8.1 },
      { name: "Enterprise Client E", revenue: 1876543.23, percentage: 7.6 },
    ],

    // Simple monthly trend data for backward compatibility
    trends: generatePastMonths(12).map((month) => ({
      month: month.month,
      year: month.year,
      value: randomNumber(18000000, 25000000),
    })),
  },

  collection: {
    total: 19876543.21,
    total_collection: 19876543.21,
    total_collected: 19876543.21,
    total_invoiced: 24567890.45,
    collection_rate: 80.9,
    growth: 6.2,

    total_current_year: 19876543.21,
    total_previous_year: 18345678.9,
    total_objective: 20500000.0,
    achievement_percentage: 96.96,
    change_percentage: 8.34,

    collection_by_dot: DOTS.map((dot) => {
      const total = randomNumber(800000, 4000000);
      const invoiced = total * (1 + Math.random() * 0.4);
      const objective = total * (1 + Math.random() * 0.2);
      const previousYear = total * (0.8 + Math.random() * 0.3);

      return {
        dot,
        total,
        invoiced,
        objective,
        collection_rate: parseFloat(((total / invoiced) * 100).toFixed(2)),
        achievement_rate: parseFloat(((total / objective) * 100).toFixed(2)),
        previous_year: previousYear,
        growth_percentage: parseFloat(
          ((total / previousYear - 1) * 100).toFixed(2)
        ),
      };
    }).sort((a, b) => b.total - a.total),

    by_dot: Object.fromEntries(
      DOTS.map((dot) => [dot, randomNumber(800000, 4000000)])
    ),

    by_product: Object.fromEntries(
      PRODUCTS.map((product) => [product, randomNumber(800000, 3000000)])
    ),

    collection_by_product: PRODUCTS.map((product) => {
      const total = randomNumber(800000, 3000000);
      const invoiced = total * (1 + Math.random() * 0.4);
      const previousYear = total * (0.8 + Math.random() * 0.3);

      return {
        product,
        total,
        invoiced,
        collection_rate: parseFloat(((total / invoiced) * 100).toFixed(2)),
        previous_year: previousYear,
        growth_percentage: parseFloat(
          ((total / previousYear - 1) * 100).toFixed(2)
        ),
      };
    }).sort((a, b) => b.total - a.total),

    monthly_trends: (() => {
      const months = [
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December",
      ];
      return months.map((month, index) => {
        const current_year = randomNumber(1200000, 2000000);
        const previous_year = current_year * (0.7 + Math.random() * 0.4);
        const objective = current_year * (1 + Math.random() * 0.3);

        return {
          month,
          month_number: index + 1,
          current_year,
          previous_year,
          objective,
          collection_rate: String(
            parseFloat(Math.random() * 30 + 70).toFixed(2)
          ),
          achievement_rate: String(
            parseFloat(((current_year / objective) * 100).toFixed(2))
          ),
          growth_rate: String(
            parseFloat(((current_year / previous_year - 1) * 100).toFixed(2))
          ),
        };
      });
    })(),

    trends: generatePastMonths(12).map((month) => ({
      month: month.month,
      year: month.year,
      value: randomNumber(15000000, 20000000),
    })),

    aging_data: {
      "0-30 days": 3456789.1,
      "31-60 days": 2345678.9,
      "61-90 days": 1567890.45,
      "91+ days": 2506184.76,
    },

    payment_behavior: {
      on_time: 70,
      late: 25,
      very_late: 5,
    },

    collection_by_segment: {
      Corporate: 9876543.21,
      Government: 5678901.23,
      SME: 2345678.9,
      Retail: 1975320.87,
    },

    collection_by_method: {
      "Bank Transfer": 8976543.21,
      "Credit Card": 5432109.87,
      "Direct Debit": 3456789.1,
      Check: 1234567.89,
      Cash: 776532.14,
    },

    top_performers: DOTS.slice(0, 5)
      .map((dot) => ({
        dot,
        collection_rate: String(parseFloat(Math.random() * 15 + 85).toFixed(2)),
        total: randomNumber(2000000, 4000000),
      }))
      .sort(
        (a, b) => parseFloat(b.collection_rate) - parseFloat(a.collection_rate)
      ),

    underperformers: DOTS.slice(5, 10)
      .map((dot) => ({
        dot,
        collection_rate: String(parseFloat(Math.random() * 20 + 65).toFixed(2)),
        total: randomNumber(800000, 2000000),
      }))
      .sort(
        (a, b) => parseFloat(a.collection_rate) - parseFloat(b.collection_rate)
      ),

    efficiency_metrics: {
      average_days_to_collect: randomNumber(30, 60),
      first_time_collection_rate: String(
        parseFloat(Math.random() * 20 + 70).toFixed(2)
      ),
      recurring_payment_success: String(
        parseFloat(Math.random() * 10 + 85).toFixed(2)
      ),
      digital_payment_adoption: String(
        parseFloat(Math.random() * 30 + 50).toFixed(2)
      ),
    },
  },

  receivables: {
    total: 9876543.21,
    total_receivables: 9876543.21,

    // Current year vs previous year
    total_current_year: 9876543.21,
    total_previous_year: 8765432.1,
    total_objective: 8500000.0,
    achievement_percentage: 116.2,
    change_percentage: 12.7,

    // Basic breakdowns
    by_dot: Object.fromEntries(
      DOTS.map((dot) => [dot, randomNumber(500000, 1500000)])
    ),
    by_age: {
      "0-30": 3456789.1,
      "31-60": 2345678.9,
      "61-90": 1567890.45,
      "91+": 2506184.76,
    },
    by_product: Object.fromEntries(
      PRODUCTS.map((product) => [product, randomNumber(500000, 1500000)])
    ),
    growth: 3.4,

    // Detailed receivables by DOT
    receivables_by_dot: DOTS.map((dot) => {
      const total = randomNumber(500000, 1500000);
      const previousYear = total * (0.7 + Math.random() * 0.4);
      const collectibleAmount = total * (0.4 + Math.random() * 0.5);

      return {
        dot,
        total,
        previous_year: previousYear,
        growth_percentage: parseFloat(
          ((total / previousYear - 1) * 100).toFixed(2)
        ),
        collectible_amount: collectibleAmount,
        collection_probability: parseFloat(
          ((collectibleAmount / total) * 100).toFixed(2)
        ),
        average_days_outstanding: Math.round(30 + Math.random() * 60),
        risk_score: parseFloat((Math.random() * 10).toFixed(1)),
      };
    }).sort((a, b) => b.total - a.total),

    // Detailed receivables by Product
    receivables_by_product: PRODUCTS.map((product) => {
      const total = randomNumber(500000, 1500000);
      const previousYear = total * (0.7 + Math.random() * 0.4);

      return {
        product,
        total,
        previous_year: previousYear,
        growth_percentage: parseFloat(
          ((total / previousYear - 1) * 100).toFixed(2)
        ),
        percentage_of_total: parseFloat(
          ((total / 9876543.21) * 100).toFixed(2)
        ),
      };
    }).sort((a, b) => b.total - a.total),

    // Detailed age analysis
    aging_analysis: {
      "0-30 days": {
        amount: 3456789.1,
        percentage: 35.0,
        risk_level: "Low",
        expected_collection: 3283949.65, // 95% of amount
        provision_percentage: 5,
        provision_amount: 172839.46,
      },
      "31-60 days": {
        amount: 2345678.9,
        percentage: 23.7,
        risk_level: "Medium",
        expected_collection: 1993827.07, // 85% of amount
        provision_percentage: 15,
        provision_amount: 351851.84,
      },
      "61-90 days": {
        amount: 1567890.45,
        percentage: 15.9,
        risk_level: "High",
        expected_collection: 1098523.32, // 70% of amount
        provision_percentage: 30,
        provision_amount: 470367.14,
      },
      "91+ days": {
        amount: 2506184.76,
        percentage: 25.4,
        risk_level: "Critical",
        expected_collection: 751855.43, // 30% of amount
        provision_percentage: 70,
        provision_amount: 1754329.33,
      },
    },

    // Customer segmentation
    customer_segmentation: {
      Corporate: {
        amount: 4938271.61,
        percentage: 50.0,
        average_days: 45,
        risk_score: 4.2,
      },
      Government: {
        amount: 2469135.8,
        percentage: 25.0,
        average_days: 75,
        risk_score: 6.8,
      },
      SME: {
        amount: 1481481.48,
        percentage: 15.0,
        average_days: 35,
        risk_score: 5.3,
      },
      Retail: {
        amount: 987654.32,
        percentage: 10.0,
        average_days: 25,
        risk_score: 3.7,
      },
    },

    // Risk categorization
    risk_categorization: {
      "Low Risk": {
        amount: 3950617.28,
        percentage: 40.0,
        customers_count: 234,
        expected_loss: 197530.86,
      },
      "Medium Risk": {
        amount: 2962962.96,
        percentage: 30.0,
        customers_count: 156,
        expected_loss: 444444.44,
      },
      "High Risk": {
        amount: 1975308.64,
        percentage: 20.0,
        customers_count: 87,
        expected_loss: 592592.59,
      },
      Critical: {
        amount: 987654.32,
        percentage: 10.0,
        customers_count: 42,
        expected_loss: 691358.02,
      },
    },

    // Monthly trends with comparison
    monthly_trends: (() => {
      const months = [
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December",
      ];
      return months.map((month, index) => {
        const current_year = randomNumber(8000000, 10000000);
        const previous_year = current_year * (0.7 + Math.random() * 0.4);
        const collections = current_year * (0.1 + Math.random() * 0.1);

        return {
          month,
          month_number: index + 1,
          current_year,
          previous_year,
          change_amount: current_year - previous_year,
          change_percentage: ((current_year / previous_year - 1) * 100).toFixed(
            2
          ),
          collections,
          collection_rate: ((collections / current_year) * 100).toFixed(2),
        };
      });
    })(),

    // Trends for backward compatibility
    trends: generatePastMonths(12).map((month) => ({
      month: month.month,
      year: month.year,
      value: randomNumber(8000000, 10000000),
    })),

    // Top debtors
    top_debtors: [
      {
        name: "Enterprise Client X",
        amount: 1234567.89,
        days_outstanding: 75,
        risk_score: 7.2,
      },
      {
        name: "Government Entity Y",
        amount: 987654.32,
        days_outstanding: 95,
        risk_score: 8.4,
      },
      {
        name: "Corporate Group Z",
        amount: 876543.21,
        days_outstanding: 45,
        risk_score: 5.1,
      },
      {
        name: "Telecom Provider W",
        amount: 765432.1,
        days_outstanding: 60,
        risk_score: 6.3,
      },
      {
        name: "Enterprise Client V",
        amount: 654321.09,
        days_outstanding: 30,
        risk_score: 3.5,
      },
    ],

    // Collection forecasts
    collection_forecast: {
      next_30_days: 3456789.1,
      next_60_days: 5123456.78,
      next_90_days: 6345678.9,
      expected_uncollectible: 2345678.9,
    },

    // Performance metrics
    performance_metrics: {
      days_sales_outstanding: 52,
      average_collection_period: 48,
      receivables_turnover_ratio: 7.6,
      bad_debt_percentage: 6.8,
      provision_coverage_ratio: 28.5,
    },

    // Anomalies detected
    anomalies: [
      {
        id: 1,
        description:
          "Unexpected increase in 90+ days receivables for Telecom Provider W",
        severity: "High",
        impact_amount: 234567.89,
      },
      {
        id: 2,
        description:
          "Government Entity Y payment delay exceeding standard terms by 45 days",
        severity: "Medium",
        impact_amount: 345678.9,
      },
      {
        id: 3,
        description:
          "Unusual pattern in SME sector collections - 15% below forecast",
        severity: "Medium",
        impact_amount: 123456.78,
      },
      {
        id: 4,
        description: "Enterprise Client X disputed invoice #RV-2023-1234",
        severity: "High",
        impact_amount: 456789.01,
      },
      {
        id: 5,
        description:
          "Collection rate in Batna DOT dropped by 12% month-over-month",
        severity: "Low",
        impact_amount: 98765.43,
      },
    ],
  },

  corporate_park: {
    total_vehicles: 3456,
    by_dot: Object.fromEntries(
      DOTS.map((dot) => [dot, randomNumber(200, 600)])
    ),
    by_state: {
      Active: 2890,
      Maintenance: 234,
      Inactive: 332,
    },
    by_type: {
      Small: 1234,
      Medium: 1543,
      Heavy: 456,
      Special: 223,
    },
    growth: 2.1,
    trends: generatePastMonths(12).map((month) => ({
      month: month.month,
      year: month.year,
      value: randomNumber(3300, 3600),
    })),
  },
};

// Mock anomaly data
export const mockAnomalies = {
  results: Array(20)
    .fill(null)
    .map((_, index) => ({
      id: index + 1,
      type: [
        "missing_data",
        "duplicate_data",
        "invalid_data",
        "outlier",
        "inconsistent_data",
      ][randomNumber(0, 4)],
      severity: ["low", "medium", "high"][randomNumber(0, 2)],
      description: `Anomaly detected in ${
        ["Revenue", "Collection", "Receivables", "Corporate Park"][
          randomNumber(0, 3)
        ]
      } data`,
      status: ["open", "in_progress", "resolved", "ignored"][
        randomNumber(0, 3)
      ],
      created_at: randomPastDate(90),
      data_source: [
        "journal_ventes",
        "etat_facture",
        "facturation_manuelle",
        "parc_corporate",
        "creances_ngbss",
      ][randomNumber(0, 4)],
      record_id: randomNumber(100, 999),
      details: {
        affected_fields: ["amount", "date", "client", "invoice_number"][
          randomNumber(0, 3)
        ],
        expected_value: `Expected value information`,
      },
    })),
  count: 20,
};

// Mock anomaly statistics
export const mockAnomalyStats = {
  total_anomalies: 42,
  by_status: {
    open: 15,
    in_progress: 8,
    resolved: 16,
    ignored: 3,
  },
  by_type: [
    { type: "missing_data", count: 12, type_display: "Missing Data" },
    { type: "duplicate_data", count: 8, type_display: "Duplicate Data" },
    { type: "invalid_data", count: 10, type_display: "Invalid Data" },
    { type: "outlier", count: 5, type_display: "Outlier" },
    { type: "inconsistent_data", count: 7, type_display: "Inconsistent Data" },
  ],
  top_invoices: [
    { invoice_id: 1, invoice_number: "INV-2023-001", anomaly_count: 5 },
    { invoice_id: 2, invoice_number: "INV-2023-002", anomaly_count: 4 },
    { invoice_id: 3, invoice_number: "INV-2023-003", anomaly_count: 3 },
  ],
  recent_anomalies: [
    {
      id: 1,
      type: "missing_data",
      type_display: "Missing Data",
      description:
        "Empty important fields in JournalVentes: invoice_date, client",
      status: "open",
      status_display: "Open",
      invoice_number: "INV-2023-001",
    },
    {
      id: 2,
      type: "duplicate_data",
      type_display: "Duplicate Data",
      description: "Duplicate invoice number INV-2023-002 in Journal Ventes",
      status: "in_progress",
      status_display: "In Progress",
      invoice_number: "INV-2023-002",
    },
    {
      id: 3,
      type: "outlier",
      type_display: "Outlier",
      description: "Unusually high revenue amount for invoice INV-2023-003",
      status: "resolved",
      status_display: "Resolved",
      invoice_number: "INV-2023-003",
    },
  ],
};

// Mock file data
export const mockFileData = {
  uploaded_files: Array(10)
    .fill(null)
    .map((_, index) => ({
      id: index + 1,
      invoice_number: `INV-${2023}-${String(index + 1).padStart(3, "0")}`,
      file_name: [
        "facturation_manuelle.xlsx",
        "journal_ventes.csv",
        "etat_facture.xlsx",
        "parc_corporate.csv",
        "creances_ngbss.xlsx",
      ][randomNumber(0, 4)],
      file_type: [
        "facturation_manuelle",
        "journal_ventes",
        "etat_facture",
        "parc_corporate",
        "creances_ngbss",
      ][randomNumber(0, 4)],
      upload_date: randomPastDate(60),
      uploaded_by: "admin@test.com",
      status: ["pending", "processing", "saved", "failed"][randomNumber(0, 3)],
      file_size: randomNumber(1024, 10240),
      processed_data_count: randomNumber(0, 500),
    })),
};

// Mock enhanced KPI data
export const mockEnhancedKpiData = {
  revenue_performance: {
    total_revenue: 24567890.45,
    target_revenue: 26000000,
    achievement_percentage: 94.5,
    growth_vs_previous: 8.5,
    top_performers: DOTS.slice(0, 3).map((dot) => ({
      dot,
      revenue: randomNumber(3000000, 5000000),
      growth: randomNumber(5, 15),
    })),
    bottom_performers: DOTS.slice(7, 10).map((dot) => ({
      dot,
      revenue: randomNumber(1000000, 2000000),
      growth: randomNumber(-10, 5),
    })),
    by_product: PRODUCTS.map((product) => ({
      product,
      current: randomNumber(1000000, 4000000),
      previous: randomNumber(900000, 3800000),
      growth: randomNumber(-5, 15),
    })),
    monthly_trend: generatePastMonths(12).map((month) => ({
      month: month.month,
      year: month.year,
      value: randomNumber(18000000, 25000000),
    })),
  },

  collection_performance: {
    total_collection: 19876543.21,
    target_collection: 22000000,
    achievement_percentage: 90.3,
    growth_vs_previous: 6.2,
    top_performers: DOTS.slice(0, 3).map((dot) => ({
      dot,
      collection: randomNumber(2500000, 4000000),
      growth: randomNumber(5, 15),
    })),
    bottom_performers: DOTS.slice(7, 10).map((dot) => ({
      dot,
      collection: randomNumber(800000, 1800000),
      growth: randomNumber(-10, 5),
    })),
    collection_rate: {
      overall: 80.9,
      by_dot: Object.fromEntries(
        DOTS.map((dot) => [dot, randomNumber(70, 95)])
      ),
    },
    monthly_trend: generatePastMonths(12).map((month) => ({
      month: month.month,
      year: month.year,
      value: randomNumber(15000000, 20000000),
    })),
  },

  corporate_park_metrics: {
    total_vehicles: 3456,
    active_vehicles: 2890,
    utilization_rate: 83.6,
    by_telecom_type: {
      Voice: 1245,
      Data: 1567,
      IoT: 644,
    },
    by_offer: {
      Basic: 987,
      Standard: 1456,
      Premium: 1013,
    },
    monthly_trend: generatePastMonths(12).map((month) => ({
      month: month.month,
      year: month.year,
      total: randomNumber(3300, 3600),
      active: randomNumber(2800, 3000),
    })),
  },

  receivables_metrics: {
    total_receivables: 9876543.21,
    aging_profile: {
      "0-30": 3456789.1,
      "31-60": 2345678.9,
      "61-90": 1567890.45,
      "91+": 2506184.76,
    },
    risk_assessment: {
      "Low Risk": 3456789.1,
      "Medium Risk": 3913569.35,
      "High Risk": 2506184.76,
    },
    by_customer_level: {
      "Level 1": 4567890.12,
      "Level 2": 3456789.1,
      "Level 3": 1851863.99,
    },
    monthly_trend: generatePastMonths(12).map((month) => ({
      month: month.month,
      year: month.year,
      value: randomNumber(8000000, 10000000),
    })),
  },

  dashboard_data: {
    summary: {
      revenue: {
        value: 24567890.45,
        trend: "+8.5%",
        status: "positive",
      },
      collection: {
        value: 19876543.21,
        trend: "+6.2%",
        status: "positive",
      },
      receivables: {
        value: 9876543.21,
        trend: "+3.4%",
        status: "negative",
      },
      corporate_park: {
        value: 3456,
        trend: "+2.1%",
        status: "positive",
      },
    },
    zero_revenue_structures: DOTS.slice(0, 3).map((dot) => ({
      dot,
      structure_count: randomNumber(1, 5),
    })),
    zero_collection_structures: DOTS.slice(3, 6).map((dot) => ({
      dot,
      structure_count: randomNumber(1, 5),
    })),
    top_revenue_structures: Array(5)
      .fill(null)
      .map((_, i) => ({
        dot: DOTS[randomNumber(0, 9)],
        structure: `Structure ${i + 1}`,
        revenue: randomNumber(500000, 2000000),
      })),
    top_collection_structures: Array(5)
      .fill(null)
      .map((_, i) => ({
        dot: DOTS[randomNumber(0, 9)],
        structure: `Structure ${i + 1}`,
        collection: randomNumber(400000, 1800000),
      })),
    visualization_data: {
      offer_quantities: PRODUCTS.map((product) => ({
        product,
        quantity: randomNumber(300, 1200),
      })),
      park_evolution: generatePastMonths(12).map((month) => ({
        month: month.month,
        park_size: randomNumber(3300, 3600),
      })),
    },
    trend_analysis: {
      revenue: generatePastMonths(6).map((month) => ({
        month: month.month,
        value: randomNumber(18000000, 25000000),
      })),
      collection: generatePastMonths(6).map((month) => ({
        month: month.month,
        value: randomNumber(15000000, 20000000),
      })),
      receivables: generatePastMonths(6).map((month) => ({
        month: month.month,
        value: randomNumber(8000000, 10000000),
      })),
    },
  },
};

// Mock performance rankings
export const mockPerformanceRankings = {
  top_revenue: DOTS.slice(0, 5).map((dot, index) => ({
    rank: index + 1,
    dot,
    value: randomNumber(3000000 - index * 300000, 5000000 - index * 300000),
    growth: randomNumber(5, 15),
  })),
  bottom_revenue: DOTS.slice(5, 10).map((dot, index) => ({
    rank: index + 6,
    dot,
    value: randomNumber(1000000 - index * 100000, 2500000 - index * 200000),
    growth: randomNumber(-10, 5),
  })),
  top_collection: DOTS.slice(0, 5).map((dot, index) => ({
    rank: index + 1,
    dot,
    value: randomNumber(2500000 - index * 200000, 4000000 - index * 200000),
    growth: randomNumber(5, 15),
  })),
  bottom_collection: DOTS.slice(5, 10).map((dot, index) => ({
    rank: index + 6,
    dot,
    value: randomNumber(800000 - index * 50000, 1800000 - index * 100000),
    growth: randomNumber(-10, 5),
  })),
};

// Export all mock data
export default {
  dashboardOverview: mockDashboardOverview,
  revenueCollectionReport: mockRevenueCollectionReport,
  corporateParkReport: mockCorporateParkReport,
  receivablesReport: mockReceivablesReport,
  kpiData: mockKpiData,
  anomalies: mockAnomalies,
  anomalyStats: mockAnomalyStats,
  fileData: mockFileData,
  enhancedKpiData: mockEnhancedKpiData,
  performanceRankings: mockPerformanceRankings,
};
