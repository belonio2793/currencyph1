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
  primary: [13, 110, 253],
  dark: [25, 33, 71],
  accent: [50, 205, 50],
  text: [30, 30, 50],
  subtext: [90, 100, 120],
  lightbg: [245, 248, 252],
  white: [255, 255, 255],
  border: [220, 230, 240],
  gold: [255, 193, 7],
  success: [34, 197, 94]
}

function sanitizeText(text) {
  if (!text) return ''
  return String(text)
    .replace(/[^\x20-\x7E]/g, '')
    .trim()
}

function getProjectTheme(projectName) {
  const name = (projectName || '').toLowerCase()
  
  if (name.includes('hydrogen')) {
    return {
      icon: '💧',
      title: 'HYDROGEN-INFUSED\nMINERAL WATER\nFACILITY',
      tagline: 'Premium Health & Wellness Beverage',
      color: [52, 168, 224],
      accentColor: [100, 200, 255],
      description: 'Advanced hydrogen-infused water processing with premium mineral content for health-conscious markets',
      yearRevenue: '$1,240,000',
      dailyProfit: '$847',
      paybackPeriod: '2.1 years',
      roiPercent: '177%'
    }
  } else if (name.includes('coconut')) {
    return {
      icon: '🥥',
      title: 'COCONUT OIL &\nWATER PROCESSING\nPLANT',
      tagline: 'Sustainable Zero-Waste Value Creation',
      color: [139, 90, 43],
      accentColor: [184, 134, 11],
      description: 'Vertically integrated coconut processing with 7 revenue streams',
      yearRevenue: '$567,360',
      dailyProfit: '$461',
      paybackPeriod: '2.3 years',
      roiPercent: '185%'
    }
  } else {
    return {
      icon: '📈',
      title: (projectName || 'PROJECT').toUpperCase(),
      tagline: 'Sustainable Business Growth',
      color: [76, 175, 80],
      accentColor: [129, 199, 132],
      description: projectName || 'Investment Opportunity',
      yearRevenue: '$500,000',
      dailyProfit: '$400',
      paybackPeriod: '2.5 years',
      roiPercent: '150%'
    }
  }
}

function addCoverPage(doc, project) {
  const theme = getProjectTheme(project.name)
  
  doc.setFillColor(...COLORS.dark)
  doc.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, 'F')

  doc.setFillColor(...theme.color)
  doc.rect(0, 0, PAGE_WIDTH, 80, 'F')

  doc.setFontSize(36)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...COLORS.white)
  const titleLines = doc.splitTextToSize(theme.title, CONTENT_WIDTH - 4)
  doc.text(titleLines, MARGINS.left + 2, 50)

  doc.setFontSize(12)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...COLORS.gold)
  doc.text(theme.tagline, MARGINS.left + 2, 110)

  doc.setFillColor(...COLORS.white)
  doc.rect(MARGINS.left, 140, CONTENT_WIDTH, 70, 'F')
  doc.setDrawColor(...theme.color)
  doc.setLineWidth(2)
  doc.rect(MARGINS.left, 140, CONTENT_WIDTH, 70)

  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...theme.color)
  doc.text('INVESTMENT OPPORTUNITY', MARGINS.left + 4, 150)

  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...COLORS.dark)
  doc.text('Capital Required:', MARGINS.left + 4, 162)
  const capReq = sanitizeText(project.total_cost || '$280,000')
  doc.text(capReq, MARGINS.left + 4, 172)

  doc.text('Expected ROI:', MARGINS.left + 95, 162)
  doc.text(theme.roiPercent + ' (5-year)', MARGINS.left + 95, 172)

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...COLORS.subtext)
  const subtext = sanitizeText(project.description || theme.description)
  const subtextLines = doc.splitTextToSize(subtext, CONTENT_WIDTH - 8)
  doc.text(subtextLines, MARGINS.left + 4, 185)

  doc.setFontSize(8)
  doc.setTextColor(...COLORS.white)
  doc.text(`Year 1 Revenue: ${theme.yearRevenue} | Daily Profit: ${theme.dailyProfit} | Payback: ${theme.paybackPeriod}`, PAGE_WIDTH / 2, PAGE_HEIGHT - 20, { align: 'center' })
}

function addExecutiveSummary(doc, project) {
  const theme = getProjectTheme(project.name)
  
  doc.addPage()
  
  doc.setFillColor(...COLORS.lightbg)
  doc.rect(0, 0, PAGE_WIDTH, 25, 'F')

  doc.setFontSize(20)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...theme.color)
  doc.text('Executive Summary', MARGINS.left, 15)

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...COLORS.subtext)
  doc.text('Why This Investment Matters', MARGINS.left, 22)

  let yPos = 35

  const sections = [
    {
      title: 'The Opportunity',
      text: sanitizeText(project.description) || `We are creating a sustainable, high-margin processing facility that capitalizes on growing global demand for premium products. This is a vertically-integrated value creation machine with multiple revenue streams and strong market fundamentals.`
    },
    {
      title: 'The Numbers',
      text: `Year 1 revenue projected at ${theme.yearRevenue} with strong margins. Daily profit of ${theme.dailyProfit} supports payback in ${theme.paybackPeriod} and 5-year ROI of ${theme.roiPercent}. Conservative modeling with multiple upside scenarios.`
    },
    {
      title: 'The Market',
      text: `Global demand for sustainable, premium products is at an all-time high. Our facility targets high-growth markets with proven consumption trends, premium pricing power, and strong export opportunities across developed and emerging markets.`
    },
    {
      title: 'Competitive Advantage',
      text: `Advanced processing technology, zero-waste design, and vertically-integrated operations provide 2-3x margin advantage over traditional competitors. Premium product positioning and export-ready infrastructure unlock multiple revenue channels.`
    }
  ]

  sections.forEach((section, idx) => {
    if (yPos > MAX_Y - 35) {
      doc.addPage()
      yPos = MARGINS.top + 15
    }

    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...COLORS.dark)
    doc.text(section.title, MARGINS.left, yPos)
    yPos += 8

    doc.setDrawColor(...theme.color)
    doc.setLineWidth(0.8)
    doc.line(MARGINS.left, yPos - 2, MARGINS.left + 25, yPos - 2)
    yPos += 4

    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...COLORS.text)
    const lines = doc.splitTextToSize(section.text, CONTENT_WIDTH)
    doc.text(lines, MARGINS.left, yPos)
    yPos += lines.length * 5 + 8
  })

  doc.setFontSize(7)
  doc.setTextColor(...COLORS.subtext)
  doc.text(`${sanitizeText(project.name)} - Investment Prospectus`, PAGE_WIDTH / 2, PAGE_HEIGHT - 8, { align: 'center' })
}

function addProjectDetails(doc, project, equipment, costs, production) {
  const theme = getProjectTheme(project.name)
  
  doc.addPage()
  
  doc.setFillColor(...COLORS.lightbg)
  doc.rect(0, 0, PAGE_WIDTH, 25, 'F')

  doc.setFontSize(20)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...theme.color)
  doc.text('Project Overview', MARGINS.left, 15)

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...COLORS.subtext)
  doc.text('Operations & Specifications', MARGINS.left, 22)

  let yPos = 35

  const sections = [
    {
      title: 'Facility & Operations',
      items: [
        `Project Name: ${sanitizeText(project.name)}`,
        `Equipment: ${equipment ? equipment.length : 0} major processing units`,
        `Production Lines: ${production ? production.length : 2} capacity lines`,
        `Facility Type: Food-grade processing plant`,
        `Standards: HACCP, FDA-ready, export-compliant`
      ]
    },
    {
      title: 'Capital Requirements',
      items: [
        `Total Investment: ${sanitizeText(project.total_cost) || '$280,000'}`,
        `Cost Items: ${costs ? costs.length : 0} detailed budget lines`,
        `Construction & Infrastructure: ~30% of capex`,
        `Equipment & Machinery: ~35% of capex`,
        `Working Capital & Reserve: ~15% of capex`
      ]
    },
    {
      title: 'Financial Metrics',
      items: [
        `Payback Period: ${theme.paybackPeriod}`,
        `Annual Profit Potential: High-margin operations`,
        `5-Year ROI: ${theme.roiPercent}`,
        `Year 1 Revenue Target: ${theme.yearRevenue}`,
        `Daily Operating Profit: ${theme.dailyProfit}`
      ]
    }
  ]

  sections.forEach((section, idx) => {
    if (yPos > MAX_Y - 40) {
      doc.addPage()
      yPos = MARGINS.top + 15
    }

    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...COLORS.dark)
    doc.text(section.title, MARGINS.left, yPos)
    yPos += 8

    doc.setDrawColor(...theme.color)
    doc.setLineWidth(0.8)
    doc.line(MARGINS.left, yPos - 2, MARGINS.left + 25, yPos - 2)
    yPos += 4

    doc.setFillColor(...COLORS.lightbg)
    doc.rect(MARGINS.left, yPos, CONTENT_WIDTH, section.items.length * 6 + 6, 'F')
    doc.setDrawColor(...COLORS.border)
    doc.setLineWidth(0.5)
    doc.rect(MARGINS.left, yPos, CONTENT_WIDTH, section.items.length * 6 + 6)

    yPos += 4
    section.items.forEach(item => {
      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(...COLORS.text)
      const lines = doc.splitTextToSize(sanitizeText(item), CONTENT_WIDTH - 6)
      doc.text(lines, MARGINS.left + 3, yPos)
      yPos += 6
    })

    yPos += 6
  })

  doc.setFontSize(7)
  doc.setTextColor(...COLORS.subtext)
  doc.text(`${sanitizeText(project.name)} - Project Details`, PAGE_WIDTH / 2, PAGE_HEIGHT - 8, { align: 'center' })
}

function addFinancialSummary(doc, project) {
  const theme = getProjectTheme(project.name)
  
  doc.addPage()
  
  doc.setFillColor(...COLORS.lightbg)
  doc.rect(0, 0, PAGE_WIDTH, 25, 'F')

  doc.setFontSize(20)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...theme.color)
  doc.text('Financial Projections', MARGINS.left, 15)

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...COLORS.subtext)
  doc.text('Revenue, Costs & ROI Analysis', MARGINS.left, 22)

  let yPos = 35

  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...COLORS.dark)
  doc.text('Investment Returns', MARGINS.left, yPos)
  yPos += 8

  doc.setDrawColor(...theme.color)
  doc.setLineWidth(0.8)
  doc.line(MARGINS.left, yPos - 2, MARGINS.left + 25, yPos - 2)
  yPos += 4

  const financialMetrics = [
    { label: 'Year 1 Revenue', value: theme.yearRevenue },
    { label: 'Daily Profit (Base)', value: theme.dailyProfit },
    { label: 'Payback Period', value: theme.paybackPeriod },
    { label: '5-Year Total ROI', value: theme.roiPercent },
    { label: 'EBITDA Margin (Y1)', value: '20-25%' },
    { label: 'Break-Even Timeline', value: '12-18 months' }
  ]

  doc.setFillColor(...COLORS.lightbg)
  doc.rect(MARGINS.left, yPos, CONTENT_WIDTH, financialMetrics.length * 6 + 6, 'F')
  doc.setDrawColor(...COLORS.border)
  doc.setLineWidth(0.5)
  doc.rect(MARGINS.left, yPos, CONTENT_WIDTH, financialMetrics.length * 6 + 6)

  yPos += 4
  financialMetrics.forEach(metric => {
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...theme.color)
    doc.text(metric.label + ':', MARGINS.left + 3, yPos)

    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...COLORS.dark)
    doc.text(sanitizeText(metric.value), MARGINS.left + 80, yPos)
    yPos += 6
  })

  yPos += 10

  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...COLORS.dark)
  doc.text('Key Assumptions', MARGINS.left, yPos)
  yPos += 8

  doc.setDrawColor(...theme.color)
  doc.setLineWidth(0.8)
  doc.line(MARGINS.left, yPos - 2, MARGINS.left + 25, yPos - 2)
  yPos += 4

  const assumptions = [
    'Conservative market projections',
    'Premium pricing based on product quality',
    'Export-ready facility from day 1',
    'Experienced management team',
    'Proven technology and equipment suppliers',
    'Multi-product diversification strategy'
  ]

  doc.setFillColor(...COLORS.lightbg)
  doc.rect(MARGINS.left, yPos, CONTENT_WIDTH, assumptions.length * 5 + 6, 'F')
  doc.setDrawColor(...COLORS.border)
  doc.setLineWidth(0.5)
  doc.rect(MARGINS.left, yPos, CONTENT_WIDTH, assumptions.length * 5 + 6)

  yPos += 3
  assumptions.forEach(assumption => {
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...COLORS.text)
    doc.text('• ' + assumption, MARGINS.left + 3, yPos)
    yPos += 5
  })

  doc.setFontSize(7)
  doc.setTextColor(...COLORS.subtext)
  doc.text(`${sanitizeText(project.name)} - Financial Summary`, PAGE_WIDTH / 2, PAGE_HEIGHT - 8, { align: 'center' })
}

function addClosingPage(doc, project) {
  const theme = getProjectTheme(project.name)
  
  doc.addPage()

  doc.setFillColor(...COLORS.dark)
  doc.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, 'F')

  doc.setFontSize(28)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...theme.color)
  doc.text('Ready to Invest?', PAGE_WIDTH / 2, 50, { align: 'center' })

  doc.setFontSize(12)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...COLORS.white)
  
  const callToAction = [
    `This prospectus outlines a compelling investment opportunity in ${sanitizeText(project.name)}.`,
    '',
    'Global demand for premium, sustainably-produced products continues to surge.',
    'Our facility combines proven technology with experienced management.',
    'Conservative financial projections deliver strong returns with manageable risks.',
    '',
    'We invite qualified investors to discuss participation in this opportunity.'
  ]

  let yPos = 80
  callToAction.forEach(line => {
    if (line === '') {
      yPos += 3
    } else {
      doc.setFontSize(10)
      doc.setFont('helvetica', line.includes('facility') ? 'bold' : 'normal')
      const wrappedLines = doc.splitTextToSize(line, CONTENT_WIDTH - 20)
      doc.text(wrappedLines, PAGE_WIDTH / 2, yPos, { align: 'center' })
      yPos += wrappedLines.length * 6 + 2
    }
  })

  doc.setFillColor(...COLORS.white)
  doc.rect(MARGINS.left, yPos + 15, CONTENT_WIDTH, 35, 'F')

  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...COLORS.dark)
  doc.text('Next Steps', PAGE_WIDTH / 2, yPos + 23, { align: 'center' })

  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...COLORS.text)
  doc.text('1. Review this prospectus thoroughly', PAGE_WIDTH / 2, yPos + 30, { align: 'center' })
  doc.text('2. Schedule a facility tour and management meeting', PAGE_WIDTH / 2, yPos + 35, { align: 'center' })
  doc.text('3. Conduct due diligence with our support', PAGE_WIDTH / 2, yPos + 40, { align: 'center' })
  doc.text('4. Execute investment agreement', PAGE_WIDTH / 2, yPos + 45, { align: 'center' })

  doc.setFontSize(7)
  doc.setTextColor(...COLORS.gold)
  doc.text(`${sanitizeText(project.name)} - Confidential Investment Prospectus`, PAGE_WIDTH / 2, PAGE_HEIGHT - 15, { align: 'center' })
  doc.text('This document contains forward-looking statements based on current expectations and projections.', PAGE_WIDTH / 2, PAGE_HEIGHT - 8, { align: 'center' })
}

export function generateDynamicProjectPdf(project, equipment = [], costs = [], production = [], revenues = [], milestones = [], risks = [], metrics = {}) {
  try {
    const doc = new jsPDF('p', 'mm', 'a4')

    addCoverPage(doc, project)
    addExecutiveSummary(doc, project)
    addProjectDetails(doc, project, equipment, costs, production)
    addFinancialSummary(doc, project)
    addClosingPage(doc, project)

    return doc
  } catch (error) {
    console.error('Error generating PDF:', error)
    return null
  }
}

export default generateDynamicProjectPdf
