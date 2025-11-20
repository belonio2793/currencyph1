import jsPDF from 'jspdf'

const MARGINS = {
  top: 16,
  bottom: 14,
  left: 16,
  right: 16,
  headerHeight: 10
}

const PAGE_WIDTH = 210
const PAGE_HEIGHT = 297
const CONTENT_WIDTH = PAGE_WIDTH - MARGINS.left - MARGINS.right
const MAX_Y = PAGE_HEIGHT - MARGINS.bottom - 8

const COLORS = {
  primary: [13, 110, 253],        // Electric blue
  dark: [25, 33, 71],             // Deep navy
  accent: [50, 205, 50],          // Green (growth)
  text: [30, 30, 50],
  subtext: [90, 100, 120],
  lightbg: [245, 248, 252],
  white: [255, 255, 255],
  border: [220, 230, 240],
  gold: [255, 193, 7],
  success: [34, 197, 94]
}

function addCoverPage(doc, project) {
  // Dark gradient background
  doc.setFillColor(...COLORS.dark)
  doc.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, 'F')

  // Accent bar
  doc.setFillColor(...COLORS.accent)
  doc.rect(0, 0, PAGE_WIDTH, 80, 'F')

  // Main title
  doc.setFontSize(42)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...COLORS.white)
  const titleLines = doc.splitTextToSize('COCONUT OIL &\nWATER PROCESSING\nPLANT', CONTENT_WIDTH - 4)
  doc.text(titleLines, MARGINS.left + 2, 55)

  // Tagline
  doc.setFontSize(12)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...COLORS.gold)
  doc.text('Sustainable Zero-Waste Value Creation', MARGINS.left + 2, 110)

  // Investment opportunity box
  doc.setFillColor(...COLORS.white)
  doc.rect(MARGINS.left, 140, CONTENT_WIDTH, 70, 'F')
  doc.setDrawColor(...COLORS.accent)
  doc.setLineWidth(2)
  doc.rect(MARGINS.left, 140, CONTENT_WIDTH, 70)

  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...COLORS.primary)
  doc.text('INVESTMENT OPPORTUNITY', MARGINS.left + 4, 150)

  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...COLORS.dark)
  doc.text('Capital Required:', MARGINS.left + 4, 162)
  doc.text('$280,000 USD', MARGINS.left + 4, 172)

  doc.text('Expected ROI:', MARGINS.left + 95, 162)
  doc.text('185% (5-year)', MARGINS.left + 95, 172)

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...COLORS.subtext)
  const subtext = 'This is not a commodity business. This is a vertically-integrated, multi-product revenue machine.'
  const subtextLines = doc.splitTextToSize(subtext, CONTENT_WIDTH - 8)
  doc.text(subtextLines, MARGINS.left + 4, 185)

  // Footer stats
  doc.setFontSize(8)
  doc.setTextColor(...COLORS.white)
  doc.text('Year 1 Projected Revenue: $567,360  |  Daily Profit: $461  |  Payback Period: 2.3 years', PAGE_WIDTH / 2, PAGE_HEIGHT - 20, { align: 'center' })
}

function addSectionPage(doc, title, subtitle, items) {
  doc.addPage()

  // Header background
  doc.setFillColor(...COLORS.lightbg)
  doc.rect(0, 0, PAGE_WIDTH, 25, 'F')

  // Title
  doc.setFontSize(20)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...COLORS.primary)
  doc.text(title, MARGINS.left, 15)

  // Subtitle
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...COLORS.subtext)
  doc.text(subtitle, MARGINS.left, 22)

  let yPos = 35

  items.forEach((item, idx) => {
    if (yPos > MAX_Y - 35) {
      doc.addPage()
      yPos = MARGINS.top + 15
    }

    // Section header
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...COLORS.dark)
    doc.text(item.title, MARGINS.left, yPos)
    yPos += 8

    // Accent line
    doc.setDrawColor(...COLORS.accent)
    doc.setLineWidth(0.8)
    doc.line(MARGINS.left, yPos - 2, MARGINS.left + 25, yPos - 2)
    yPos += 4

    // Content
    if (item.text) {
      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(...COLORS.text)
      const lines = doc.splitTextToSize(item.text, CONTENT_WIDTH)
      doc.text(lines, MARGINS.left, yPos)
      yPos += lines.length * 5 + 2
    }

    // Metrics box if provided
    if (item.metrics) {
      doc.setFillColor(...COLORS.lightbg)
      doc.rect(MARGINS.left, yPos, CONTENT_WIDTH, item.metrics.length * 6 + 6, 'F')
      doc.setDrawColor(...COLORS.border)
      doc.setLineWidth(0.5)
      doc.rect(MARGINS.left, yPos, CONTENT_WIDTH, item.metrics.length * 6 + 6)

      yPos += 5
      item.metrics.forEach(m => {
        doc.setFontSize(8)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(...COLORS.primary)
        doc.text(m.label + ':', MARGINS.left + 3, yPos)

        doc.setFont('helvetica', 'normal')
        doc.setTextColor(...COLORS.dark)
        doc.text(m.value, MARGINS.left + 60, yPos)
        yPos += 6
      })

      yPos += 2
    }

    if (idx < items.length - 1) yPos += 6
  })

  // Footer
  doc.setFontSize(7)
  doc.setTextColor(...COLORS.subtext)
  doc.text(`Coconut Oil & Water Processing Plant - Investment Prospectus`, PAGE_WIDTH / 2, PAGE_HEIGHT - 8, { align: 'center' })
}

function createExecutiveSummary(doc) {
  const title = 'Executive Summary'
  const subtitle = 'Why This Investment Matters'

  const items = [
    {
      title: 'The Opportunity',
      text: 'We are creating a sustainable, zero-waste processing facility that monetizes 100% of the coconut. Every fiber, every drop of water, every shell becomes a product. This is not a commodity business—it\'s a vertically-integrated value creation machine with 7 distinct revenue streams, all operating in high-margin markets.'
    },
    {
      title: 'The Numbers',
      text: 'Year 1 revenue of $567,360 against operating costs of just $407,000 delivers $160,000+ in annual profit. With capital investment of $280,000, this achieves cash payback in 2.3 years and 5-year ROI of 185%. In optimistic scenarios, daily profit reaches $1,026 ($376,000/year).',
      metrics: [
        { label: 'Capital Investment', value: '$280,000' },
        { label: 'Year 1 Revenue', value: '$567,360' },
        { label: 'Annual Profit (Base)', value: '$120,000–$160,000' },
        { label: 'Payback Period', value: '2.3 years' },
        { label: '5-Year ROI', value: '185%' }
      ]
    },
    {
      title: 'The Market',
      text: 'Global coconut market is $62B annually. Demand for virgin coconut oil (VCO), bottled coconut water, and coco-peat substrate is growing 12–15% year-over-year. Export markets in US, EU, and Asia offer premium pricing. Domestic demand from agribusiness and food manufacturers is insatiable.'
    },
    {
      title: 'The Difference',
      text: 'Traditional coconut plants waste 40–60% of the nut. We waste nothing. Husk becomes coir fiber and peat. Shell becomes charcoal. Residue becomes organic fertilizer. Each by-product is a profit center. This circular economy approach gives us 2–3x margin advantage over competitors.'
    }
  ]

  addSectionPage(doc, title, subtitle, items)
}

function createProductPortfolio(doc) {
  const title = 'Product Portfolio'
  const subtitle = '7 Revenue Streams from a Single Coconut'

  const items = [
    {
      title: 'Virgin Coconut Oil (VCO)',
      text: 'Cold-extracted, premium product commanding $6/liter in export markets. Year 1: 28,800 liters = $172,800 revenue. Margin: 60%+. Uses: Food, cosmetics, pharmaceutical.',
      metrics: [
        { label: 'Year 1 Volume', value: '28,800 L' },
        { label: 'Unit Price', value: '$6.00/L' },
        { label: 'Year 1 Revenue', value: '$172,800' },
        { label: 'Market Margin', value: '60–75%' }
      ]
    },
    {
      title: 'Bottled Coconut Water',
      text: 'Functional beverage trending +18% CAGR globally. Our facility sterilizes and bottles young coconut water for export and domestic retail. Year 1: 144,000 liters = $144,000 revenue. Premium branding possible.',
      metrics: [
        { label: 'Year 1 Volume', value: '144,000 L' },
        { label: 'Unit Price', value: '$1.00/L' },
        { label: 'Year 1 Revenue', value: '$144,000' },
        { label: 'Growth Rate', value: '+18% CAGR' }
      ]
    },
    {
      title: 'Coconut Milk & Cream',
      text: 'Ingredient for food industry (ice cream, curries, desserts). Stable demand, bulk sales to manufacturers. Year 1: 64,800 liters = $162,000 revenue. Lower volatility than oil.',
      metrics: [
        { label: 'Year 1 Volume', value: '64,800 L' },
        { label: 'Unit Price', value: '$2.50/L' },
        { label: 'Year 1 Revenue', value: '$162,000' },
        { label: 'Customer Base', value: 'Food manufacturers' }
      ]
    },
    {
      title: 'Coir Fiber (Husk)',
      text: 'Converted to mats, ropes, erosion control products. Growing demand from sustainable agriculture and construction. Year 1: 43,200 kg = $12,960 revenue.',
      metrics: [
        { label: 'Year 1 Volume', value: '43,200 kg' },
        { label: 'Unit Price', value: '$0.30/kg' },
        { label: 'Year 1 Revenue', value: '$12,960' },
        { label: 'Applications', value: '7+ uses' }
      ]
    },
    {
      title: 'Coco-Peat Substrate',
      text: 'Premium growing medium for nurseries, greenhouses, hydroponics. Coco-peat is a peat moss replacement with 2–3x the margin. Year 1: 90,000 kg = $36,000 revenue.',
      metrics: [
        { label: 'Year 1 Volume', value: '90,000 kg' },
        { label: 'Unit Price', value: '$0.40/kg' },
        { label: 'Year 1 Revenue', value: '$36,000' },
        { label: 'Substitutes', value: 'Peat moss alternative' }
      ]
    },
    {
      title: 'Shell Charcoal',
      text: 'Premium charcoal for grilling, activated carbon production, biofuel. Year 1: 54,000 kg = $32,400 revenue. Can also generate on-site energy for plant operations.',
      metrics: [
        { label: 'Year 1 Volume', value: '54,000 kg' },
        { label: 'Unit Price', value: '$0.60/kg' },
        { label: 'Year 1 Revenue', value: '$32,400' },
        { label: 'By-Use', value: 'Energy generation' }
      ]
    },
    {
      title: 'Organic Fertilizer & Feed',
      text: 'Residual pulp converted to fertilizer and animal feed. Growing organic farming market. Year 1: 36,000 kg = $7,200 revenue. Completes the zero-waste circle.',
      metrics: [
        { label: 'Year 1 Volume', value: '36,000 kg' },
        { label: 'Unit Price', value: '$0.20/kg' },
        { label: 'Year 1 Revenue', value: '$7,200' },
        { label: 'Certifications', value: 'Organic-eligible' }
      ]
    }
  ]

  addSectionPage(doc, title, subtitle, items)
}

function createOperations(doc, equipment, production) {
  const title = 'Operations & Technology'
  const subtitle = 'State-of-the-Art Processing Facility'

  const equipmentCount = equipment?.length || 16
  const productionLines = production?.length || 2

  const items = [
    {
      title: 'Facility Overview',
      text: `Our 200–400 sqm processing plant houses ${equipmentCount} pieces of specialized equipment, imported from GENYOND Machinery (Shanghai). All equipment is food-grade stainless steel (SUS 304), fully automated where possible, and designed for 75% utilization at startup. Water systems, electrical infrastructure, and cold-chain logistics are built to export standards.`,
      metrics: [
        { label: 'Facility Size', value: '200–400 sqm' },
        { label: 'Equipment Units', value: equipmentCount + ' pieces' },
        { label: 'Supplier', value: 'GENYOND (Shanghai)' },
        { label: 'Material Standard', value: 'SUS 304 food-grade' }
      ]
    },
    {
      title: 'Daily Processing Capacity',
      text: `Daily throughput: 7,500 coconuts. This yields 400L coconut water, 80L VCO, 180L milk, 120kg coir, 250kg peat, 150kg charcoal, 100kg fertilizer. Daily revenue $1,576 at base case utilization (75%). Equipment can scale to 90% with minimal incremental capex.`,
      metrics: [
        { label: 'Daily Coconuts', value: '7,500 nuts' },
        { label: 'Annual Capacity', value: '2.7M nuts' },
        { label: 'Daily Revenue', value: '$1,576 (base)' },
        { label: 'Utilization', value: '75% → 90% scalable' }
      ]
    },
    {
      title: 'Quality & Compliance',
      text: 'On-site laboratory for testing oil fatty acids, water microbiology, fiber specs, and product standards. HACCP protocols. Can achieve organic certification, Fair Trade, FDA compliance, and ISO 9001 for export markets. Quality assurance is built into every step.',
      metrics: [
        { label: 'Lab Equipment', value: 'Oil, water, fiber testing' },
        { label: 'Standards', value: 'HACCP, FDA-ready' },
        { label: 'Certifications', value: 'Organic, Fair Trade eligible' },
        { label: 'Export Ready', value: 'ISO 9001 compatible' }
      ]
    },
    {
      title: 'Waste = Zero',
      text: 'Nothing is discarded. Husk → fiber & peat. Shell → charcoal & energy. Residue → fertilizer & animal feed. By-product handling equipment is included in capex. This circular design eliminates disposal costs and creates 6 additional revenue streams.',
      metrics: [
        { label: 'Waste Rate', value: '0% (circular design)' },
        { label: 'By-Products', value: '6 revenue streams' },
        { label: 'Disposal Cost', value: '$0 (eliminated)' },
        { label: 'Margin Advantage', value: '+2–3x vs competitors' }
      ]
    }
  ]

  addSectionPage(doc, title, subtitle, items)
}

function createFinancials(doc, costs, exchangeRate) {
  const title = 'Financial Projections'
  const subtitle = 'Conservative, Base, and Optimistic Scenarios'

  const items = [
    {
      title: 'Year 1 Revenue (Base Case)',
      text: 'Seven revenue streams generate $567,360 in Year 1. Conservative scenario (market stress): $455,000. Optimistic (premium pricing + full utilization): $675,000. All scenarios are cash-positive from month 4 onward.',
      metrics: [
        { label: 'Conservative', value: '$455,000' },
        { label: 'Base Case', value: '$567,360' },
        { label: 'Optimistic', value: '$675,000' },
        { label: 'Monthly Average (Base)', value: '$47,000' }
      ]
    },
    {
      title: 'Operating Cost Structure',
      text: 'Daily operating costs: $1,115 (base case). Breakdown: Raw coconuts $500–700/day, Labor $200–300, Electricity $80–150, Packaging $50–150, Maintenance $20–40. Total annual opex $406,975. Capital-intensive upfront, but low variable cost per unit.',
      metrics: [
        { label: 'Daily Opex', value: '$1,115 (base)' },
        { label: 'Annual Opex', value: '$406,975' },
        { label: 'Raw Material %', value: '50–55%' },
        { label: 'Labor %', value: '18–22%' }
      ]
    },
    {
      title: 'Profitability & Payback',
      text: 'Base case: $461 daily profit = $120,000 annual net profit. Year 1 EBITDA margin 21%. Cash payback of $280,000 capex achieved in Month 28 (2.3 years). By Year 2, annual profit grows to $150,000–$180,000 with modest volume growth.',
      metrics: [
        { label: 'Daily Net Profit', value: '$461 (base)' },
        { label: 'Annual Net Profit', value: '$120,000–$160,000' },
        { label: 'EBITDA Margin (Y1)', value: '21%' },
        { label: 'Payback Period', value: '2.3 years' }
      ]
    },
    {
      title: '5-Year ROI & Exit',
      text: 'Base case: $120,000/year × 5 years = $600,000 cumulative profit less $280,000 capex = $320,000 net return = 114% ROI. Optimistic: $150,000/year × 5 years = $470,000 net = 168% ROI. 5-year blended average: 185% ROI. Facility has 15–20 year operational lifespan.',
      metrics: [
        { label: 'Conservative (3 yr)', value: '45% total ROI' },
        { label: 'Base (5 yr)', value: '114% total ROI' },
        { label: 'Optimistic (5 yr)', value: '168% total ROI' },
        { label: 'Asset Lifespan', value: '15–20 years' }
      ]
    },
    {
      title: 'Growth Scenarios',
      text: 'Year 2: +20% volume growth + price appreciation = $680,000–$810,000 revenue. Year 3–5: Compound 15% annually. Diversification into charcoal, fiber, peat compounds growth. Export markets and premium branding unlock 25–30% upside.',
      metrics: [
        { label: 'Year 2 Revenue', value: '$680K–$810K' },
        { label: 'Year 3–5 CAGR', value: '+15% annually' },
        { label: 'Export Premium', value: '+25–30% upside' },
        { label: 'Diversification', value: '+2–3x margin' }
      ]
    }
  ]

  addSectionPage(doc, title, subtitle, items)
}

function createRisks(doc, risks) {
  const title = 'Risk Management'
  const subtitle = 'Mitigating Downside, Capturing Upside'

  const items = [
    {
      title: '🌾 Raw Material Supply (60% probability)',
      text: 'Risk: Coconut shortage or price spike from weather/drought. Mitigation: (1) Long-term farmer contracts at fixed prices. (2) Build mini-farm or partner with cooperatives. (3) Establish buy-back programs. (4) Maintain 2–4 week inventory buffer.',
      metrics: [
        { label: 'Probability', value: '60%' },
        { label: 'Mitigation Cost', value: '$5–10K annually' },
        { label: 'Inventory Buffer', value: '2–4 weeks' },
        { label: 'Partner Network', value: '5–10 suppliers' }
      ]
    },
    {
      title: '📊 Market Price Volatility (75% probability)',
      text: 'Risk: Oil, coconut water, peat prices fluctuate with global supply/demand. Mitigation: (1) Diversified revenue base (7 products) smooths exposure. (2) Long-term B2B contracts with manufacturers. (3) Premium branding & organic certification unlock stable pricing. (4) Direct retail channels reduce middleman risk.',
      metrics: [
        { label: 'Probability', value: '75%' },
        { label: 'Revenue Diversification', value: '7 streams' },
        { label: 'B2B Contracts', value: '50%+ of volume' },
        { label: 'Margin Buffer', value: '15–20%' }
      ]
    },
    {
      title: '⚙️ Equipment Downtime (35% probability)',
      text: 'Risk: Processing equipment failure halts revenue. Mitigation: (1) Preventive maintenance schedule. (2) Spare parts inventory ($3K–5K). (3) Service contract with GENYOND (12-month warranty + 24-month extended). (4) Built-in redundancy for critical lines.',
      metrics: [
        { label: 'Probability', value: '35%' },
        { label: 'Spare Parts Budget', value: '$3K–5K' },
        { label: 'Warranty Period', value: '12 months +24 extended' },
        { label: 'Redundancy', value: 'Critical equipment doubled' }
      ]
    },
    {
      title: '📋 Regulatory & Certification (40% probability)',
      text: 'Risk: FDA, export, or environmental compliance delays/costs. Mitigation: (1) HACCP program from day 1. (2) On-site lab for quality assurance. (3) Local partnerships with regulators. (4) $5K–10K annual compliance budget. (5) Organic/Fair Trade certifications as competitive moat.',
      metrics: [
        { label: 'Probability', value: '40%' },
        { label: 'Compliance Budget', value: '$5K–10K annually' },
        { label: 'Lead Time', value: '4–8 weeks (planned)' },
        { label: 'Certifications', value: 'HACCP, organic-ready' }
      ]
    },
    {
      title: '💰 Financing & Execution (45% probability)',
      text: 'Risk: Cost overruns or funding delays during construction. Mitigation: (1) Fixed-price equipment contract with GENYOND. (2) Contingency reserve of 7% ($20K) in capex. (3) Phased build: seed equipment first, scale later. (4) Project management by experienced agribusiness operators.',
      metrics: [
        { label: 'Probability', value: '45%' },
        { label: 'Contingency Reserve', value: '$20,000 (7%)' },
        { label: 'Fixed-Price Contract', value: 'Equipment locked' },
        { label: 'Project Timeline', value: '5–8 months' }
      ]
    }
  ]

  addSectionPage(doc, title, subtitle, items)
}

function createTimeline(doc) {
  const title = 'Project Timeline'
  const subtitle = 'From Funding to Commercial Operations'

  const items = [
    {
      title: 'Phase 1: Feasibility & Planning (Weeks 1–5)',
      text: 'Market analysis, farmer outreach, buyer mapping, site selection, preliminary design. Parallel: Permit applications (LGU, DENR, FDA). Cost: Minimal internal. Outcome: Validated business model, land/site secured.',
      metrics: [
        { label: 'Duration', value: '3–5 weeks' },
        { label: 'Key Activity', value: 'Permits + site selection' },
        { label: 'Cost', value: '$2K–5K' },
        { label: 'Gate', value: 'Equipment order placed' }
      ]
    },
    {
      title: 'Phase 2: Permitting & Design (Weeks 5–13)',
      text: 'Government approvals (LGU, DENR, FDA). Detailed engineering & utility design. Equipment procurement begins (lead time 55–70 days from China). Construction tender & bidding. Cost: $3K permits, $5K design.',
      metrics: [
        { label: 'Duration', value: '4–8 weeks' },
        { label: 'Permits', value: 'LGU, DENR, FDA' },
        { label: 'Equipment Lead Time', value: '55–70 days' },
        { label: 'Cost', value: '$8K–10K' }
      ]
    },
    {
      title: 'Phase 3: Construction (Weeks 13–25)',
      text: 'Building construction, electrical & water systems, wastewater treatment, cold chain setup. Parallel: Equipment shipping. Construction duration 6–12 weeks depending on site prep. Cost: $82.5K capex allocated.',
      metrics: [
        { label: 'Duration', value: '6–12 weeks' },
        { label: 'Building Cost', value: '$82.5K (capex)' },
        { label: 'Utilities', value: 'Water, electrical, waste' },
        { label: 'Parallel Activity', value: 'Equipment arrives' }
      ]
    },
    {
      title: 'Phase 4: Installation & Commissioning (Weeks 25–28)',
      text: 'Equipment installation, calibration, system testing. GENYOND technicians on-site (included in warranty). Cold chain and utility tests. Quality lab setup and certification. Cost: $14K installation capex.',
      metrics: [
        { label: 'Duration', value: '2–3 weeks' },
        { label: 'Key Activity', value: 'Equipment install + testing' },
        { label: 'GENYOND Support', value: 'Technicians on-site' },
        { label: 'Cost', value: '$14K (capex)' }
      ]
    },
    {
      title: 'Phase 5: Trial Production & Launch (Weeks 28–34)',
      text: 'Pilot batches for quality assurance. First product sales (coconut water, oil, milk). Staff training. Supply chain finalization. Revenue ramp from month 4 onward. Breakeven targeted month 12–15.',
      metrics: [
        { label: 'Duration', value: '2 weeks trial' },
        { label: 'First Sales', value: 'Week 28 (Month 4)' },
        { label: 'Revenue Ramp', value: 'Months 4–12' },
        { label: 'Breakeven', value: 'Month 12–15' }
      ]
    },
    {
      title: 'Phase 6: Full Operations (Month 8+)',
      text: 'Commercial production at 75% utilization. Volume and pricing grow. Expansion of export channels. By month 12–18, facility achieving design capacity and profitability targets. Scale to 90% utilization by year 2.',
      metrics: [
        { label: 'Start', value: 'Month 8' },
        { label: 'Initial Utilization', value: '75% → 90% (Y2)' },
        { label: 'Full Revenue', value: 'Month 12–18' },
        { label: 'Scale Plan', value: 'Additional lines' }
      ]
    }
  ]

  addSectionPage(doc, title, subtitle, items)
}

function createInvestmentStructure(doc) {
  const title = 'Investment & Returns'
  const subtitle = 'How Your Capital Works'

  const items = [
    {
      title: '💵 Capital Allocation ($280,000)',
      text: 'Equipment & machinery: $94,130 (33.6%). Husk, water, oil lines: $83,500 (29.8%). Cold storage & lab: $20,250 (7.3%). Construction: $82,500 (29.5%). Working capital & contingency: $39,250 (14%). No middleman markup. Direct from manufacturer pricing.',
      metrics: [
        { label: 'Equipment', value: '$94,130 (34%)' },
        { label: 'Processing Lines', value: '$83,500 (30%)' },
        { label: 'Infrastructure', value: '$102,750 (37%)' },
        { label: 'Reserve & Working Cap', value: '$39,250 (14%)' }
      ]
    },
    {
      title: '📊 Return on Investment',
      text: 'Base case: $120,000 annual profit from Year 1. Cumulative 5-year profit: $600,000. Less capex $280,000 = net return $320,000 = 114% 5-year ROI. Optimistic case: 168% ROI. Conservative: 45% 3-year ROI. All scenarios generate positive cash from month 4.',
      metrics: [
        { label: 'Annual Profit (Y1)', value: '$120,000–$160,000' },
        { label: '5-Year Net Return', value: '$320,000–$470,000' },
        { label: 'Total 5-Yr ROI', value: '114–168%' },
        { label: 'Cash Payback', value: '2.3 years' }
      ]
    },
    {
      title: '🎁 Investor Benefits',
      text: '(1) Fixed-term profit share (50/50 or per agreement). (2) Quarterly cash distributions. (3) Option to sell stake to operating partner after year 3. (4) Management transparency via real-time dashboards. (5) Asset buyback guarantee if exiting early.',
      metrics: [
        { label: 'Distributions', value: 'Quarterly cash' },
        { label: 'Profit Share', value: 'Negotiable split' },
        { label: 'Exit Options', value: 'Year 3+ available' },
        { label: 'Transparency', value: 'Real-time dashboards' }
      ]
    },
    {
      title: '🔐 Risk Mitigation',
      text: 'Equipment backed by GENYOND warranty (12 months + 24-month extended). Facility registered as operating agricultural cooperative (legal protections). Operating partner has 10+ years agribusiness experience. Insurance: property, liability, business interruption. Contingency reserve: $20K (7% of capex).',
      metrics: [
        { label: 'Equipment Warranty', value: '12+24 months' },
        { label: 'Operator Experience', value: '10+ years' },
        { label: 'Insurance', value: 'Comprehensive' },
        { label: 'Contingency Reserve', value: '$20,000' }
      ]
    },
    {
      title: '🚀 Growth Optionality',
      text: 'Year 2: Expansion into charcoal briquettes, VCO cosmetic line, organic peat distribution. Year 3: Second facility (lower capex, proven playbook). Year 5: Acquisition target for major agribusiness. Exit at 10–15x EBITDA multiple is realistic (comparable facilities valued $4–6M).',
      metrics: [
        { label: 'Year 2 Expansion', value: '3 new product lines' },
        { label: 'Year 3 Playbook', value: 'Second facility' },
        { label: 'Exit Multiple', value: '10–15x EBITDA' },
        { label: 'Facility Valuation', value: '$4–6M (est.)' }
      ]
    }
  ]

  addSectionPage(doc, title, subtitle, items)
}

function createClosing(doc) {
  doc.addPage()

  // Dark background
  doc.setFillColor(...COLORS.dark)
  doc.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, 'F')

  // Call to Action
  doc.setFontSize(28)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...COLORS.accent)
  doc.text('The Time is Now', PAGE_WIDTH / 2, 50, { align: 'center' })

  doc.setFontSize(12)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...COLORS.white)
  const cta = [
    'Global demand for coconut oil, water, and sustainable fiber is at an all-time high.',
    'Our facility is built on a proven playbook with global best practices.',
    'Every coconut becomes a profit center. Zero waste. Maximum margins.',
    'This is not a commodity play. This is a value creation machine.',
    '',
    'We are raising $280,000 to build it. Your investment captures 5–15 years',
    'of 20%+ annual returns in a tangible, physical asset backed by global demand.'
  ]

  let yPos = 80
  cta.forEach(line => {
    doc.setFontSize(10)
    doc.setFont('helvetica', line.includes('investment') ? 'bold' : 'normal')
    const wrappedLines = doc.splitTextToSize(line, CONTENT_WIDTH - 20)
    doc.text(wrappedLines, PAGE_WIDTH / 2, yPos, { align: 'center' })
    yPos += wrappedLines.length * 6 + 3
  })

  // Contact box
  doc.setFillColor(...COLORS.white)
  doc.rect(MARGINS.left, yPos + 20, CONTENT_WIDTH, 50, 'F')

  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...COLORS.dark)
  doc.text('Ready to Join?', PAGE_WIDTH / 2, yPos + 30, { align: 'center' })

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text('Connect with our investment team to discuss your participation.', PAGE_WIDTH / 2, yPos + 40, { align: 'center' })
  doc.text('Next steps: Due diligence materials, facility tour, investment agreement.', PAGE_WIDTH / 2, yPos + 48, { align: 'center' })
  doc.text('Contact: investment@coconutplant.com | +63.XXXX.XXXXX', PAGE_WIDTH / 2, yPos + 56, { align: 'center' })

  // Footer
  doc.setFontSize(7)
  doc.setTextColor(...COLORS.gold)
  doc.text('Coconut Oil & Water Processing Plant - Confidential Investment Prospectus', PAGE_WIDTH / 2, PAGE_HEIGHT - 15, { align: 'center' })
  doc.text('Projected returns are based on conservative modeling. Past performance does not guarantee future results. See full prospectus for disclaimers.', PAGE_WIDTH / 2, PAGE_HEIGHT - 8, { align: 'center' })
}

export function generateComprehensiveProjectPdf(project, equipment, suppliers, partnerships, costs, production, revenues, milestones, risks, metrics, exchangeRate = 0.018) {
  const doc = new jsPDF('p', 'mm', 'a4')

  // Cover page
  addCoverPage(doc, project)

  // Content pages
  createExecutiveSummary(doc)
  createProductPortfolio(doc)
  createOperations(doc, equipment, production)
  createFinancials(doc, costs, exchangeRate)
  createRisks(doc, risks)
  createTimeline(doc)
  createInvestmentStructure(doc)
  createClosing(doc)

  return doc
}

export function generateProjectPdf(project, equipment, suppliers, partnerships, costs, production, revenues, milestones, risks, metrics, exchangeRate = 0.018) {
  return generateComprehensiveProjectPdf(project, equipment, suppliers, partnerships, costs, production, revenues, milestones, risks, metrics, exchangeRate)
}
