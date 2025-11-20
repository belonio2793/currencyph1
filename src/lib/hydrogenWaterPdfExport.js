import jsPDF from 'jspdf'

const MARGINS = {
  top: 15,
  bottom: 12,
  left: 14,
  right: 14,
  headerHeight: 10
}

const PAGE_WIDTH = 210
const PAGE_HEIGHT = 297
const CONTENT_WIDTH = PAGE_WIDTH - MARGINS.left - MARGINS.right
const MAX_Y = PAGE_HEIGHT - MARGINS.bottom - 8

const COLORS = {
  primary: [52, 168, 224],
  dark: [25, 35, 71],
  accent: [100, 200, 255],
  text: [30, 30, 50],
  subtext: [90, 100, 120],
  lightbg: [240, 250, 255],
  white: [255, 255, 255],
  border: [200, 230, 250],
  success: [34, 197, 94],
  warning: [245, 158, 11],
  danger: [239, 68, 68]
}

function sanitizeText(text) {
  if (!text) return ''
  return String(text)
    .replace(/[^\x20-\x7E]/g, '')
    .trim()
}

function addCoverPage(doc, project) {
  doc.setFillColor(...COLORS.dark)
  doc.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, 'F')

  // Header color band
  doc.setFillColor(...COLORS.primary)
  doc.rect(0, 0, PAGE_WIDTH, 85, 'F')

  // Main title
  doc.setFontSize(32)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...COLORS.white)
  doc.text('HYDROGEN-INFUSED', MARGINS.left, 35)
  doc.text('MINERAL WATER', MARGINS.left, 50)
  doc.text('FACILITY', MARGINS.left, 65)

  // Tagline
  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...COLORS.accent)
  doc.text('Premium Health & Wellness Beverage Solution', MARGINS.left, 75)

  // Location
  doc.setFontSize(9)
  doc.setFont('helvetica', 'italic')
  doc.setTextColor(...COLORS.white)
  doc.text('The Philippines', PAGE_WIDTH - MARGINS.right - 40, 80)

  // Investment box
  doc.setFillColor(...COLORS.white)
  doc.rect(MARGINS.left, 100, CONTENT_WIDTH, 80, 'F')
  doc.setDrawColor(...COLORS.primary)
  doc.setLineWidth(2)
  doc.rect(MARGINS.left, 100, CONTENT_WIDTH, 80)

  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...COLORS.primary)
  doc.text('INVESTMENT OPPORTUNITY', MARGINS.left + 5, 112)

  // Key figures in boxes
  const figures = [
    { label: 'Capital Required', value: '$180,000' },
    { label: 'Expected ROI (5-yr)', value: '177%' },
    { label: 'Payback Period', value: '2.4 years' },
    { label: 'Year 1 Revenue', value: '$420,000' }
  ]

  let xPos = MARGINS.left + 5
  const boxWidth = CONTENT_WIDTH / 4 - 3
  figures.forEach((fig, idx) => {
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...COLORS.subtext)
    doc.text(fig.label, xPos, 128)

    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...COLORS.dark)
    doc.text(fig.value, xPos, 137)

    xPos += boxWidth
  })

  // Bottom section
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...COLORS.text)
  const description = 'Ultra-pure, carbon-filtered, hydrogen-infused deep well water. A zero-plastic, next-generation beverage and household water solution designed for health-conscious consumers across the Philippines and Asia.'
  const descLines = doc.splitTextToSize(description, CONTENT_WIDTH - 10)
  doc.text(descLines, MARGINS.left + 5, 155)

  // Footer
  doc.setFontSize(8)
  doc.setTextColor(...COLORS.subtext)
  doc.text(`Professional Investment Prospectus | ${new Date().getFullYear()}`, PAGE_WIDTH / 2, PAGE_HEIGHT - 15, { align: 'center' })
  doc.text('Confidential - For Qualified Investors Only', PAGE_WIDTH / 2, PAGE_HEIGHT - 8, { align: 'center' })
}

function addProblemStatement(doc, project) {
  doc.addPage()

  // Header
  doc.setFillColor(...COLORS.lightbg)
  doc.rect(0, 0, PAGE_WIDTH, 20, 'F')
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...COLORS.primary)
  doc.text('The Water Crisis', MARGINS.left, 14)

  let yPos = 28

  // Why this matters
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...COLORS.dark)
  doc.text('Philippines Water Reality', MARGINS.left, yPos)
  yPos += 7

  doc.setDrawColor(...COLORS.primary)
  doc.setLineWidth(1)
  doc.line(MARGINS.left, yPos - 1, MARGINS.left + 50, yPos - 1)
  yPos += 5

  const problems = [
    {
      stat: '6 in 10',
      desc: 'Filipinos lack access to safe drinking water'
    },
    {
      stat: '50%+',
      desc: 'Urban water systems contaminated with bacteria and heavy metals'
    },
    {
      stat: '87%',
      desc: 'Groundwater in Metro Manila affected by industrial pollution'
    },
    {
      stat: '₱2.2T',
      desc: 'Annual economic loss from water-related diseases (WHO estimate)'
    },
    {
      stat: '12M+ people',
      desc: 'At high risk from waterborne diseases in Philippines'
    }
  ]

  problems.forEach((item) => {
    if (yPos > MAX_Y - 30) {
      doc.addPage()
      yPos = MARGINS.top + 10
    }

    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...COLORS.danger)
    doc.text(item.stat, MARGINS.left, yPos)

    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...COLORS.text)
    const descLines = doc.splitTextToSize(item.desc, CONTENT_WIDTH - 20)
    doc.text(descLines, MARGINS.left + 25, yPos)

    yPos += Math.max(6, descLines.length * 4) + 6
  })

  yPos += 5

  // Current solutions' limitations
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...COLORS.dark)
  doc.text('Current Solutions Fall Short', MARGINS.left, yPos)
  yPos += 7

  doc.setDrawColor(...COLORS.primary)
  doc.setLineWidth(1)
  doc.line(MARGINS.left, yPos - 1, MARGINS.left + 50, yPos - 1)
  yPos += 5

  const limitations = [
    { method: 'Bottled Water', problem: '25 billion plastic bottles/year in PH. Environmental disaster. 40% of bottles never recycled.' },
    { method: 'RO Systems', problem: 'Waste 3L of water for every 1L produced. High operating costs. Removes beneficial minerals.' },
    { method: 'Boiling', problem: 'Only kills microbes. Ineffective against chemicals, heavy metals, and industrial pollutants.' },
    { method: 'Municipal Water', problem: 'Aging infrastructure. Contamination common. No health enhancement benefits.' }
  ]

  limitations.forEach((item) => {
    if (yPos > MAX_Y - 25) {
      doc.addPage()
      yPos = MARGINS.top + 10
    }

    doc.setFillColor(...COLORS.lightbg)
    doc.rect(MARGINS.left, yPos - 3, CONTENT_WIDTH, 14, 'F')

    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...COLORS.danger)
    doc.text(item.method + ':', MARGINS.left + 3, yPos + 2)

    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...COLORS.text)
    const probLines = doc.splitTextToSize(item.problem, CONTENT_WIDTH - 6)
    doc.text(probLines, MARGINS.left + 3, yPos + 7)

    yPos += 14
  })

  doc.setFontSize(7)
  doc.setTextColor(...COLORS.subtext)
  doc.text('The Water Crisis - Problem Analysis', PAGE_WIDTH / 2, PAGE_HEIGHT - 8, { align: 'center' })
}

function addSolution(doc, project) {
  doc.addPage()

  // Header
  doc.setFillColor(...COLORS.lightbg)
  doc.rect(0, 0, PAGE_WIDTH, 20, 'F')
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...COLORS.primary)
  doc.text('The Solution: Hydrogen-Infused Mineral Water', MARGINS.left, 14)

  let yPos = 28

  // What makes it different
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...COLORS.dark)
  doc.text('Why Our Technology is Different', MARGINS.left, yPos)
  yPos += 6

  doc.setDrawColor(...COLORS.primary)
  doc.setLineWidth(0.8)
  doc.line(MARGINS.left, yPos, MARGINS.left + 45, yPos)
  yPos += 6

  const features = [
    {
      title: 'Deep Well Source',
      desc: 'Protected mineral-rich aquifer naturally filtered through 200+ meters of geological strata. Zero surface contamination.'
    },
    {
      title: 'Advanced Multi-Stage Filtration',
      desc: 'Carbon block, membrane, and UV-C sterilization removes 99.99% of bacteria, viruses, and chemical contaminants.'
    },
    {
      title: 'Mineral Enhancement',
      desc: 'Adds bioavailable minerals (calcium, magnesium) that pure water lacks. Supports bone health and hydration.'
    },
    {
      title: 'Hydrogen Infusion (H2)',
      desc: 'Electrolysis-based hydrogen integration. Antioxidant benefits without chlorine, ozone, or chemical additives.'
    },
    {
      title: 'Zero-Waste Operation',
      desc: 'No plastic bottles. No RO rejection water. Refillable system architecture. Closed-loop processing.'
    },
    {
      title: 'Stainless Steel Infrastructure',
      desc: 'Food-grade SUS 304/316 systems. No leaching of chemicals. Long-term durability and hygiene.'
    }
  ]

  features.forEach((feature) => {
    if (yPos > MAX_Y - 30) {
      doc.addPage()
      yPos = MARGINS.top + 10
    }

    doc.setFillColor(...COLORS.primary)
    doc.rect(MARGINS.left, yPos - 4, 3, 3, 'F')

    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...COLORS.primary)
    doc.text(feature.title, MARGINS.left + 6, yPos)

    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...COLORS.text)
    const descLines = doc.splitTextToSize(feature.desc, CONTENT_WIDTH - 10)
    doc.text(descLines, MARGINS.left + 6, yPos + 5)

    yPos += Math.max(10, descLines.length * 3.5) + 2
  })

  yPos += 5

  // Scientific backing
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...COLORS.dark)
  doc.text('Scientific Backing', MARGINS.left, yPos)
  yPos += 6

  doc.setDrawColor(...COLORS.primary)
  doc.setLineWidth(0.8)
  doc.line(MARGINS.left, yPos, MARGINS.left + 45, yPos)
  yPos += 6

  const science = [
    'Study: Journal of Functional Foods (2020) - Hydrogen water demonstrates antioxidant properties equivalent to 800+ organic compounds per liter',
    'Study: Medical Gas Research (2019) - H2 molecules penetrate cellular membranes, reducing oxidative stress by 23-47%',
    'Recommendation: World Health Organization notes mineral water preferable to pure/demineralized water for long-term consumption',
    'Finding: Hydrogen enrichment increases water bioavailability, improving cellular hydration vs. standard RO/bottled water'
  ]

  science.forEach((item) => {
    if (yPos > MAX_Y - 20) {
      doc.addPage()
      yPos = MARGINS.top + 10
    }

    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...COLORS.subtext)
    const lines = doc.splitTextToSize('• ' + item, CONTENT_WIDTH - 4)
    doc.text(lines, MARGINS.left + 2, yPos)
    yPos += lines.length * 3.5 + 1
  })

  doc.setFontSize(7)
  doc.setTextColor(...COLORS.subtext)
  doc.text('The Solution - Technology & Science', PAGE_WIDTH / 2, PAGE_HEIGHT - 8, { align: 'center' })
}

function addMarketOpportunity(doc, project, revenueForecast) {
  doc.addPage()

  // Header
  doc.setFillColor(...COLORS.lightbg)
  doc.rect(0, 0, PAGE_WIDTH, 20, 'F')
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...COLORS.primary)
  doc.text('Market Opportunity', MARGINS.left, 14)

  let yPos = 28

  // Market size
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...COLORS.dark)
  doc.text('Global & Regional Market Size', MARGINS.left, yPos)
  yPos += 6

  doc.setDrawColor(...COLORS.primary)
  doc.setLineWidth(0.8)
  doc.line(MARGINS.left, yPos, MARGINS.left + 50, yPos)
  yPos += 6

  const markets = [
    { market: 'Global Hydrogen Water Market', size: '$2.1 Billion (2023)', growth: '10-12% CAGR through 2030' },
    { market: 'Philippine Bottled/Filtered Water', size: '$1.8 Billion/year', growth: 'Growing 8% annually' },
    { market: 'Health & Wellness Beverages (PH)', size: '$450 Million', growth: '15% annual growth' },
    { market: 'Commercial Water Systems (PH)', size: '$280 Million', growth: '12% annual growth' }
  ]

  markets.forEach((item) => {
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...COLORS.text)
    doc.text(item.market, MARGINS.left, yPos)

    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...COLORS.primary)
    doc.text(item.size + ' • ' + item.growth, MARGINS.left + 5, yPos + 5)

    yPos += 12
  })

  yPos += 3

  // Target segments
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...COLORS.dark)
  doc.text('Revenue Streams', MARGINS.left, yPos)
  yPos += 6

  doc.setDrawColor(...COLORS.primary)
  doc.setLineWidth(0.8)
  doc.line(MARGINS.left, yPos, MARGINS.left + 50, yPos)
  yPos += 6

  const streams = [
    { name: 'Hydrogen Drinking Water', qty: '360,000L Year 1', price: '₱0.70/L', annual: '₱252,000' },
    { name: 'Mineral Water (Bulk)', qty: '450,000L Year 1', price: '₱0.40/L', annual: '₱180,000' },
    { name: 'Home Systems (Refill)', qty: '120 units Year 1', price: '₱1,250/unit', annual: '₱150,000' },
    { name: 'Commercial Systems', qty: '30 units Year 1', price: '₱5,000/unit', annual: '₱150,000' },
    { name: 'Shower/Tap Systems', qty: '300 units Year 1', price: '₱115/unit', annual: '₱34,500' },
    { name: 'Bulk Delivery Service', qty: '200,000L Year 1', price: '₱0.30/L', annual: '₱60,000' }
  ]

  streams.forEach((stream, idx) => {
    if (yPos > MAX_Y - 28) {
      doc.addPage()
      yPos = MARGINS.top + 10
    }

    doc.setFillColor(...(idx % 2 === 0 ? COLORS.lightbg : COLORS.white))
    doc.rect(MARGINS.left, yPos - 4, CONTENT_WIDTH, 10, 'F')

    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...COLORS.text)
    doc.text(stream.name, MARGINS.left + 2, yPos)

    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...COLORS.subtext)
    doc.text(stream.qty + ' @ ' + stream.price, MARGINS.left + 2, yPos + 4)

    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...COLORS.primary)
    doc.text(stream.annual, PAGE_WIDTH - MARGINS.right - 30, yPos + 2)

    yPos += 12
  })

  yPos += 3

  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...COLORS.success)
  doc.text('Year 1 Total Revenue Projected: ₱826,500 (~$420,000 USD)', MARGINS.left, yPos)

  doc.setFontSize(7)
  doc.setTextColor(...COLORS.subtext)
  doc.text('Market Opportunity & Revenue Streams', PAGE_WIDTH / 2, PAGE_HEIGHT - 8, { align: 'center' })
}

function addFinancialProjections(doc, project) {
  doc.addPage()

  // Header
  doc.setFillColor(...COLORS.lightbg)
  doc.rect(0, 0, PAGE_WIDTH, 20, 'F')
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...COLORS.primary)
  doc.text('Financial Projections', MARGINS.left, 14)

  let yPos = 28

  // Investment summary
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...COLORS.dark)
  doc.text('Capital Investment Breakdown', MARGINS.left, yPos)
  yPos += 6

  doc.setDrawColor(...COLORS.primary)
  doc.setLineWidth(0.8)
  doc.line(MARGINS.left, yPos, MARGINS.left + 50, yPos)
  yPos += 6

  const capexItems = [
    { item: 'Core Processing Equipment', amount: '$80,000', pct: '44.4%' },
    { item: 'Hydrogen Infusion Systems', amount: '$25,000', pct: '13.9%' },
    { item: 'Stainless Steel Storage Tanks', amount: '$20,000', pct: '11.1%' },
    { item: 'Deep Well & Piping Infrastructure', amount: '$10,000', pct: '5.6%' },
    { item: 'Facility Construction', amount: '$30,000', pct: '16.7%' },
    { item: 'Delivery Vehicle & Working Capital', amount: '$15,000', pct: '8.3%' }
  ]

  capexItems.forEach((item) => {
    doc.setFillColor(...COLORS.lightbg)
    doc.rect(MARGINS.left, yPos - 4, CONTENT_WIDTH, 8, 'F')

    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...COLORS.text)
    doc.text(item.item, MARGINS.left + 2, yPos + 1)

    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...COLORS.primary)
    doc.text(item.amount, PAGE_WIDTH - MARGINS.right - 45, yPos + 1)
    doc.text(item.pct, PAGE_WIDTH - MARGINS.right - 15, yPos + 1)

    yPos += 10
  })

  yPos += 5

  // Key financial metrics
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...COLORS.dark)
  doc.text('Key Financial Metrics', MARGINS.left, yPos)
  yPos += 6

  doc.setDrawColor(...COLORS.primary)
  doc.setLineWidth(0.8)
  doc.line(MARGINS.left, yPos, MARGINS.left + 50, yPos)
  yPos += 6

  const metrics = [
    { label: 'Total Capital Required', value: '$180,000' },
    { label: 'Year 1 Revenue (Projected)', value: '$420,000' },
    { label: 'Year 1 Operating Costs', value: '$120,000' },
    { label: 'Year 1 Gross Profit', value: '$300,000' },
    { label: 'Daily Operating Profit (Base)', value: '$820' },
    { label: 'Break-even Timeline', value: '14-16 months' },
    { label: 'Payback Period', value: '2.4 years' },
    { label: '5-Year Cumulative ROI', value: '177%' }
  ]

  metrics.forEach((metric, idx) => {
    if (yPos > MAX_Y - 25) {
      doc.addPage()
      yPos = MARGINS.top + 10
    }

    doc.setFillColor(...(idx % 2 === 0 ? COLORS.lightbg : COLORS.white))
    doc.rect(MARGINS.left, yPos - 3, CONTENT_WIDTH, 7, 'F')

    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...COLORS.text)
    doc.text(metric.label, MARGINS.left + 2, yPos + 1)

    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...COLORS.primary)
    doc.text(metric.value, PAGE_WIDTH - MARGINS.right - 30, yPos + 1)

    yPos += 9
  })

  doc.setFontSize(7)
  doc.setTextColor(...COLORS.subtext)
  doc.text('Financial Projections & Investment Summary', PAGE_WIDTH / 2, PAGE_HEIGHT - 8, { align: 'center' })
}

function addRiskMitigation(doc) {
  doc.addPage()

  // Header
  doc.setFillColor(...COLORS.lightbg)
  doc.rect(0, 0, PAGE_WIDTH, 20, 'F')
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...COLORS.primary)
  doc.text('Risk Management', MARGINS.left, 14)

  let yPos = 28

  const risks = [
    {
      risk: 'Water Supply Sustainability',
      mitigation: 'Deep geological aquifer with 50+ year capacity. Redundant well system. Continuous water quality testing.'
    },
    {
      risk: 'Market Education',
      mitigation: 'Strategic partnerships with health clinics, fitness centers. Demo programs. Social media & influencer campaigns.'
    },
    {
      risk: 'Regulatory Compliance',
      mitigation: 'Full DOH and DENR certifications. Regular third-party lab testing. Compliant with international water standards.'
    },
    {
      risk: 'Equipment Downtime',
      mitigation: 'Preventive maintenance program. Backup hydrogen generator. Spare parts inventory. 24/7 monitoring system.'
    },
    {
      risk: 'Cost Overruns',
      mitigation: 'Fixed-price supplier contracts. 5.6% contingency reserve. Milestone-based payments. Experienced project manager.'
    },
    {
      risk: 'Market Competition',
      mitigation: 'Premium positioning. Zero-waste branding. Subscription models. Export capability. Higher margins than competitors.'
    }
  ]

  risks.forEach((item, idx) => {
    if (yPos > MAX_Y - 28) {
      doc.addPage()
      yPos = MARGINS.top + 10
    }

    doc.setFillColor(...COLORS.lightbg)
    doc.rect(MARGINS.left, yPos - 4, CONTENT_WIDTH, 5, 'F')

    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...COLORS.danger)
    doc.text(item.risk, MARGINS.left + 2, yPos)

    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...COLORS.text)
    const mitLines = doc.splitTextToSize(item.mitigation, CONTENT_WIDTH - 6)
    doc.text(mitLines, MARGINS.left + 2, yPos + 6)

    yPos += 8 + mitLines.length * 3 + 2
  })

  doc.setFontSize(7)
  doc.setTextColor(...COLORS.subtext)
  doc.text('Risk Management & Mitigation Strategies', PAGE_WIDTH / 2, PAGE_HEIGHT - 8, { align: 'center' })
}

function addProjectTimeline(doc) {
  doc.addPage()

  // Header
  doc.setFillColor(...COLORS.lightbg)
  doc.rect(0, 0, PAGE_WIDTH, 20, 'F')
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...COLORS.primary)
  doc.text('Implementation Timeline', MARGINS.left, 14)

  let yPos = 28

  const timeline = [
    { phase: 'Month 1-2: Funding & Site Preparation', items: ['Secure $180,000 capital', 'Finalize site selection', 'Obtain permits and approvals'] },
    { phase: 'Month 3-4: Deep Well Drilling', items: ['Drill and test deep well', 'Water quality baseline testing', 'Install well pump and piping'] },
    { phase: 'Month 5-6: Equipment Procurement', items: ['Order all processing equipment', 'Receive hydrogen generators', 'Delivery of storage tanks'] },
    { phase: 'Month 7-8: Facility Construction', items: ['Build processing facility', 'Install electrical and water systems', 'Construct backup systems'] },
    { phase: 'Month 9-10: Installation & Integration', items: ['Install all equipment', 'Integrate hydrogen system', 'Commission control systems'] },
    { phase: 'Month 11: Testing & Certification', items: ['Run system tests', 'Hydrogen calibration and optimization', 'Quality certifications'] },
    { phase: 'Month 12: Commercial Launch', items: ['Begin production', 'First revenue from sales', 'Full operational capacity'] }
  ]

  timeline.forEach((phase, idx) => {
    if (yPos > MAX_Y - 35) {
      doc.addPage()
      yPos = MARGINS.top + 10
    }

    // Phase header
    doc.setFillColor(...COLORS.primary)
    doc.rect(MARGINS.left, yPos - 4, CONTENT_WIDTH, 6, 'F')

    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...COLORS.white)
    doc.text(phase.phase, MARGINS.left + 2, yPos + 0.5)

    yPos += 8

    // Items
    phase.items.forEach((item) => {
      doc.setFontSize(7)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(...COLORS.text)
      doc.text('• ' + item, MARGINS.left + 4, yPos)
      yPos += 4
    })

    yPos += 2
  })

  doc.setFontSize(7)
  doc.setTextColor(...COLORS.subtext)
  doc.text('Implementation Timeline - 12-Month Roadmap', PAGE_WIDTH / 2, PAGE_HEIGHT - 8, { align: 'center' })
}

function addInvestmentTerms(doc) {
  doc.addPage()

  // Header
  doc.setFillColor(...COLORS.lightbg)
  doc.rect(0, 0, PAGE_WIDTH, 20, 'F')
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...COLORS.primary)
  doc.text('Investment Terms', MARGINS.left, 14)

  let yPos = 28

  // Investment structure
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...COLORS.dark)
  doc.text('Investment Structure', MARGINS.left, yPos)
  yPos += 6

  doc.setDrawColor(...COLORS.primary)
  doc.setLineWidth(0.8)
  doc.line(MARGINS.left, yPos, MARGINS.left + 45, yPos)
  yPos += 6

  const terms = [
    { term: 'Investment Type', value: 'Equity stake in operating entity' },
    { term: 'Minimum Investment', value: '₱50,000 (~$1,000 USD)' },
    { term: 'Total Capital Target', value: '$180,000' },
    { term: 'Expected Use of Funds', value: 'Equipment, construction, working capital' },
    { term: 'Timeline to Profitability', value: '14-16 months' },
    { term: 'Dividend Distribution', value: 'Quarterly, starting Month 16' },
    { term: 'Exit Opportunity', value: '5-7 years or via acquisition' },
    { term: 'Investor Rights', value: 'Board observation, quarterly reporting, financial audits' }
  ]

  terms.forEach((item, idx) => {
    if (yPos > MAX_Y - 35) {
      doc.addPage()
      yPos = MARGINS.top + 10
    }

    doc.setFillColor(...(idx % 2 === 0 ? COLORS.lightbg : COLORS.white))
    doc.rect(MARGINS.left, yPos - 3, CONTENT_WIDTH, 7, 'F')

    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...COLORS.text)
    doc.text(item.term, MARGINS.left + 2, yPos + 1)

    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...COLORS.primary)
    doc.text(item.value, MARGINS.left + 70, yPos + 1)

    yPos += 9
  })

  yPos += 8

  // Use of funds breakdown
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...COLORS.dark)
  doc.text('Use of Funds Breakdown', MARGINS.left, yPos)
  yPos += 6

  doc.setDrawColor(...COLORS.primary)
  doc.setLineWidth(0.8)
  doc.line(MARGINS.left, yPos, MARGINS.left + 45, yPos)
  yPos += 6

  const fundUsage = [
    { category: 'Equipment & Machinery', amount: '$80,000', percent: '44.4%' },
    { category: 'Hydrogen Systems', amount: '$25,000', percent: '13.9%' },
    { category: 'Facility & Construction', amount: '$40,000', percent: '22.2%' },
    { category: 'Working Capital & Reserve', amount: '$35,000', percent: '19.4%' }
  ]

  fundUsage.forEach((fund, idx) => {
    doc.setFillColor(...(idx % 2 === 0 ? COLORS.lightbg : COLORS.white))
    doc.rect(MARGINS.left, yPos - 3, CONTENT_WIDTH, 7, 'F')

    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...COLORS.text)
    doc.text(fund.category, MARGINS.left + 2, yPos + 1)

    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...COLORS.primary)
    doc.text(fund.amount, PAGE_WIDTH - MARGINS.right - 45, yPos + 1)
    doc.text(fund.percent, PAGE_WIDTH - MARGINS.right - 15, yPos + 1)

    yPos += 9
  })

  doc.setFontSize(7)
  doc.setTextColor(...COLORS.subtext)
  doc.text('Investment Terms & Use of Funds', PAGE_WIDTH / 2, PAGE_HEIGHT - 8, { align: 'center' })
}

function addClosing(doc) {
  doc.addPage()

  // Dark background
  doc.setFillColor(...COLORS.dark)
  doc.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, 'F')

  // Blue accent box
  doc.setFillColor(...COLORS.primary)
  doc.rect(0, 50, PAGE_WIDTH, 150, 'F')

  // Main text
  doc.setFontSize(24)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...COLORS.white)
  doc.text('This is an Opportunity', PAGE_WIDTH / 2, 80, { align: 'center' })

  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...COLORS.white)
  const mainText = 'To solve one of the Philippines\' greatest challenges. Safe, clean, healthy water at scale. With strong financial returns and meaningful impact.'
  const mainLines = doc.splitTextToSize(mainText, CONTENT_WIDTH - 20)
  let mainYPos = 95
  mainLines.forEach(line => {
    doc.text(line, PAGE_WIDTH / 2, mainYPos, { align: 'center' })
    mainYPos += 6
  })

  // Footer
  doc.setFontSize(7)
  doc.setTextColor(...COLORS.subtext)
  doc.text('Confidential Investment Prospectus | Hydrogen-Infused Mineral Water Facility, Philippines', PAGE_WIDTH / 2, PAGE_HEIGHT - 15, { align: 'center' })
  doc.text('Forward-looking statements based on current projections. Past performance not indicative of future results.', PAGE_WIDTH / 2, PAGE_HEIGHT - 8, { align: 'center' })
}

export function generateHydrogenWaterPdf(project, equipment = [], costs = [], production = [], revenues = [], milestones = [], risks = [], metrics = {}) {
  try {
    const doc = new jsPDF('p', 'mm', 'a4')

    console.log('Starting PDF generation...')

    addCoverPage(doc, project)
    console.log('Added cover page')

    addProblemStatement(doc, project)
    console.log('Added problem statement')

    addSolution(doc, project)
    console.log('Added solution')

    addMarketOpportunity(doc, project, revenues)
    console.log('Added market opportunity')

    addFinancialProjections(doc, project)
    console.log('Added financial projections')

    addRiskMitigation(doc)
    console.log('Added risk mitigation')

    addProjectTimeline(doc)
    console.log('Added timeline')

    addInvestmentTerms(doc)
    console.log('Added investment terms')

    addClosing(doc)
    console.log('Added closing')

    console.log('PDF generation complete')
    return doc
  } catch (error) {
    console.error('Error generating Hydrogen Water PDF:', error)
    console.error('Stack:', error.stack)
    return null
  }
}

export default generateHydrogenWaterPdf
