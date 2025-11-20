import jsPDF from 'jspdf'

const MARGINS = {
  top: 20,
  bottom: 18,
  left: 16,
  right: 16,
  headerHeight: 12,
  footerHeight: 12
}

const PAGE_WIDTH = 210
const PAGE_HEIGHT = 297
const CONTENT_WIDTH = PAGE_WIDTH - MARGINS.left - MARGINS.right
const CONTENT_START_Y = MARGINS.top + MARGINS.headerHeight
const MAX_Y_POS = PAGE_HEIGHT - MARGINS.bottom - MARGINS.footerHeight

const COLORS = {
  primary: [31, 78, 121],
  secondary: [52, 120, 170],
  accent: [54, 169, 225],
  darkText: [26, 32, 44],
  lightText: [113, 128, 150],
  lightBg: [247, 249, 251],
  border: [203, 213, 225],
  highlight: [249, 250, 251],
  white: [255, 255, 255]
}

function addPageHeader(doc, projectName, tabName, pageNum) {
  // Header background
  doc.setFillColor(...COLORS.lightBg)
  doc.rect(0, 0, PAGE_WIDTH, MARGINS.headerHeight + 2, 'F')

  // Left side - Project name
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...COLORS.primary)
  const titleText = projectName.length > 40 ? projectName.substring(0, 37) + '...' : projectName
  doc.text(titleText, MARGINS.left, 7)

  // Middle - Tab name
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...COLORS.secondary)
  doc.text(tabName, PAGE_WIDTH / 2, 7, { align: 'center' })

  // Right side - Page number
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...COLORS.lightText)
  doc.text(`Page ${pageNum}`, PAGE_WIDTH - MARGINS.right, 7, { align: 'right' })

  // Bottom border line
  doc.setDrawColor(...COLORS.border)
  doc.setLineWidth(0.5)
  doc.line(MARGINS.left, MARGINS.headerHeight + 1, PAGE_WIDTH - MARGINS.right, MARGINS.headerHeight + 1)
}

function addPageFooter(doc, projectName) {
  const footerY = PAGE_HEIGHT - MARGINS.bottom + 4

  // Top border line
  doc.setDrawColor(...COLORS.border)
  doc.setLineWidth(0.5)
  doc.line(MARGINS.left, footerY - 8, PAGE_WIDTH - MARGINS.right, footerY - 8)

  // Left - Date
  doc.setFontSize(7)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...COLORS.lightText)
  const dateStr = new Date().toLocaleDateString()
  doc.text(`Generated: ${dateStr}`, MARGINS.left, footerY - 3)

  // Center - Company info
  doc.text('Confidential - For Internal Review Only', PAGE_WIDTH / 2, footerY - 3, { align: 'center' })

  // Right - Filename
  doc.text('© Project Report', PAGE_WIDTH - MARGINS.right, footerY - 3, { align: 'right' })
}

function initPage(doc, projectName, tabName, pageNum) {
  doc.addPage()
  addPageHeader(doc, projectName, tabName, pageNum)
  addPageFooter(doc, projectName)
  return CONTENT_START_Y
}

function checkPageBreak(doc, yPos, minSpace = 25) {
  if (yPos > MAX_Y_POS - minSpace) {
    doc.addPage()
    return CONTENT_START_Y
  }
  return yPos
}

function addSectionTitle(doc, text, yPos) {
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...COLORS.primary)
  
  const lines = doc.splitTextToSize(text, CONTENT_WIDTH)
  doc.text(lines, MARGINS.left, yPos)
  
  const lineHeight = lines.length * 6.5
  yPos += lineHeight + 4

  doc.setDrawColor(...COLORS.secondary)
  doc.setLineWidth(1)
  doc.line(MARGINS.left, yPos, PAGE_WIDTH - MARGINS.right, yPos)

  return yPos + 8
}

function addSubsectionTitle(doc, text, yPos) {
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...COLORS.secondary)
  
  const lines = doc.splitTextToSize(text, CONTENT_WIDTH)
  doc.text(lines, MARGINS.left, yPos)
  
  return yPos + (lines.length * 5.5) + 3
}

function addBodyText(doc, text, yPos, indent = 0, fontSize = 9) {
  doc.setFontSize(fontSize)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...COLORS.darkText)
  
  const xPos = MARGINS.left + indent
  const lineWidth = CONTENT_WIDTH - indent
  const lines = doc.splitTextToSize(text, lineWidth)
  doc.text(lines, xPos, yPos)
  
  return yPos + (lines.length * 4.8) + 2
}

function addKeyValueRow(doc, label, value, yPos, indent = 2) {
  doc.setFontSize(9)
  
  // Label
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...COLORS.darkText)
  doc.text(label + ':', MARGINS.left + indent, yPos)

  // Value
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...COLORS.darkText)
  const valueLines = doc.splitTextToSize(String(value || 'N/A'), CONTENT_WIDTH - indent - 50)
  doc.text(valueLines, MARGINS.left + indent + 50, yPos)

  return yPos + (valueLines.length * 4.5) + 1
}

function addInfoBox(doc, yPos, title, items) {
  // Background
  doc.setFillColor(...COLORS.highlight)
  const boxHeight = Math.max(items.length * 6.5 + 12, 40)
  doc.rect(MARGINS.left, yPos, CONTENT_WIDTH, boxHeight, 'F')

  // Border
  doc.setDrawColor(...COLORS.border)
  doc.setLineWidth(0.8)
  doc.rect(MARGINS.left, yPos, CONTENT_WIDTH, boxHeight)

  yPos += 5
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...COLORS.primary)
  doc.text(title, MARGINS.left + 4, yPos)

  yPos += 7
  items.forEach(item => {
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...COLORS.lightText)
    doc.text(item.label + ':', MARGINS.left + 4, yPos)

    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...COLORS.darkText)
    const valueLines = doc.splitTextToSize(String(item.value || 'N/A'), CONTENT_WIDTH - 12)
    doc.text(valueLines, MARGINS.left + 35, yPos)

    yPos += (valueLines.length * 4.5) + 1
  })

  return yPos + 4
}

function addTable(doc, headers, rows, yPos) {
  if (rows.length === 0) {
    doc.setFontSize(9)
    doc.setTextColor(...COLORS.lightText)
    doc.text('No data available', MARGINS.left, yPos)
    return yPos + 8
  }

  const colCount = headers.length
  const tableWidth = CONTENT_WIDTH
  const colWidth = tableWidth / colCount
  const rowHeight = 7
  const headerHeight = 8
  const cellPadding = 2
  const startX = MARGINS.left

  // Header row
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...COLORS.white)
  doc.setFillColor(...COLORS.primary)

  let xPos = startX
  for (let i = 0; i < colCount; i++) {
    doc.rect(xPos, yPos, colWidth, headerHeight, 'F')
    const headerText = String(headers[i] || '').substring(0, 20)
    doc.text(headerText, xPos + cellPadding, yPos + cellPadding + 2, { maxWidth: colWidth - cellPadding * 2, align: 'left' })
    xPos += colWidth
  }

  yPos += headerHeight

  // Data rows
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...COLORS.darkText)

  rows.forEach((row, rowIdx) => {
    // Alternating background
    if (rowIdx % 2 === 0) {
      doc.setFillColor(...COLORS.lightBg)
      xPos = startX
      for (let j = 0; j < colCount; j++) {
        doc.rect(xPos, yPos, colWidth, rowHeight, 'F')
        xPos += colWidth
      }
    }

    // Cell borders
    doc.setDrawColor(...COLORS.border)
    doc.setLineWidth(0.3)
    xPos = startX
    for (let j = 0; j < colCount; j++) {
      doc.rect(xPos, yPos, colWidth, rowHeight)
      xPos += colWidth
    }

    // Cell content
    xPos = startX
    for (let j = 0; j < row.length; j++) {
      const cellValue = String(row[j] || '').substring(0, 25)
      doc.text(cellValue, xPos + cellPadding, yPos + cellPadding + 1.5, { maxWidth: colWidth - cellPadding * 2, align: 'left' })
      xPos += colWidth
    }

    yPos += rowHeight
  })

  return yPos + 6
}

function addDivider(doc, yPos) {
  doc.setDrawColor(...COLORS.border)
  doc.setLineWidth(0.3)
  doc.line(MARGINS.left, yPos, PAGE_WIDTH - MARGINS.right, yPos)
  return yPos + 6
}

// PAGE 1: OVERVIEW
function createOverviewPage(doc, project, equipment, costs, pageNum) {
  let yPos = initPage(doc, project.name, 'Overview', pageNum)

  yPos = addSectionTitle(doc, 'Project Overview', yPos)

  if (project.long_description) {
    yPos = addBodyText(doc, project.long_description, yPos, 0, 9)
    yPos += 4
  }

  // Key Metrics
  const totalCost = costs.reduce((sum, c) => sum + (c.budgeted_amount_usd || 0), 0)
  const totalRaised = project.funded_amount_usd || 0
  const remaining = totalCost - totalRaised
  const fundingPercent = totalCost > 0 ? ((totalRaised / totalCost) * 100).toFixed(1) : 0

  yPos = addInfoBox(doc, yPos, 'Project Financials', [
    { label: 'Total Project Cost', value: `$${totalCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
    { label: 'Current Funding', value: `$${totalRaised.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
    { label: 'Funding Progress', value: `${fundingPercent}%` },
    { label: 'Amount Remaining', value: `$${Math.max(0, remaining).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` }
  ])

  return doc
}

// PAGE 2: EQUIPMENT
function createEquipmentPage(doc, project, equipment, pageNum) {
  let yPos = initPage(doc, project.name, 'Equipment', pageNum)

  yPos = addSectionTitle(doc, 'Manage Equipment', yPos)

  const headers = ['Equipment', 'Type', 'Capacity', 'Power (kW)', 'Unit Cost', 'Total Cost']
  const rows = equipment.map(e => [
    e.equipment_name || '',
    e.equipment_type || '',
    e.capacity || '',
    e.power_kw || '',
    `₱${(e.unit_cost_usd || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })}`,
    `₱${(e.total_cost_usd || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })}`
  ])

  yPos = addTable(doc, headers, rows, yPos)

  if (equipment.length > 0) {
    const totalEquipmentCost = equipment.reduce((sum, e) => sum + (e.total_cost_usd || 0), 0)
    yPos += 4
    yPos = addInfoBox(doc, yPos, 'Equipment Summary', [
      { label: 'Total Equipment Count', value: equipment.length },
      { label: 'Total Equipment Cost', value: `₱${totalEquipmentCost.toLocaleString('en-US', { maximumFractionDigits: 2 })}` }
    ])
  }

  return doc
}

// PAGE 3: COSTS
function createCostsPage(doc, project, costs, pageNum) {
  let yPos = initPage(doc, project.name, 'Costs', pageNum)

  yPos = addSectionTitle(doc, 'Project Costs Breakdown', yPos)

  const headers = ['Category', 'Budgeted', 'Actual', '% of Total']
  const rows = costs.map(c => [
    c.cost_category || '',
    `₱${(c.budgeted_amount_usd || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })}`,
    c.actual_amount_usd ? `₱${(c.actual_amount_usd).toLocaleString('en-US', { maximumFractionDigits: 2 })}` : '-',
    `${c.percentage_of_total || 0}%`
  ])

  yPos = addTable(doc, headers, rows, yPos)

  if (costs.length > 0) {
    const totalBudgeted = costs.reduce((sum, c) => sum + (c.budgeted_amount_usd || 0), 0)
    const totalActual = costs.reduce((sum, c) => sum + (c.actual_amount_usd || 0), 0)
    
    yPos += 4
    yPos = addInfoBox(doc, yPos, 'Cost Summary', [
      { label: 'Total Budgeted', value: `₱${totalBudgeted.toLocaleString('en-US', { maximumFractionDigits: 2 })}` },
      { label: 'Total Actual', value: totalActual > 0 ? `₱${totalActual.toLocaleString('en-US', { maximumFractionDigits: 2 })}` : 'N/A' }
    ])
  }

  return doc
}

// PAGE 4: SUPPLIERS & PARTNERSHIPS
function createSuppliersPartnershipsPage(doc, project, suppliers, partnerships, pageNum) {
  let yPos = initPage(doc, project.name, 'Suppliers & Partnerships', pageNum)

  // Suppliers section
  if (suppliers && suppliers.length > 0) {
    yPos = addSectionTitle(doc, 'Suppliers', yPos)

    suppliers.forEach((sup, idx) => {
      yPos = checkPageBreak(doc, yPos, 35)
      yPos = addSubsectionTitle(doc, sup.supplier_name || `Supplier ${idx + 1}`, yPos)
      yPos += 2

      yPos = addKeyValueRow(doc, 'Type', sup.supplier_type || 'N/A', yPos)
      yPos = addKeyValueRow(doc, 'Contact', sup.contact_person || 'N/A', yPos)
      if (sup.email) yPos = addKeyValueRow(doc, 'Email', sup.email, yPos)
      if (sup.phone) yPos = addKeyValueRow(doc, 'Phone', sup.phone, yPos)
      yPos = addKeyValueRow(doc, 'Delivery Timeline', `${sup.delivery_timeline_days || 'N/A'} days`, yPos)
      yPos = addKeyValueRow(doc, 'Warranty Period', `${sup.warranty_months || 'N/A'} months`, yPos)

      if (idx < suppliers.length - 1) {
        yPos = addDivider(doc, yPos + 2)
      }
    })

    yPos += 4
  }

  // Partnerships section
  if (partnerships && partnerships.length > 0) {
    yPos = checkPageBreak(doc, yPos, 30)
    yPos = addSectionTitle(doc, 'Strategic Partnerships', yPos)

    partnerships.forEach((partner, idx) => {
      yPos = checkPageBreak(doc, yPos, 35)
      yPos = addSubsectionTitle(doc, partner.partner_name || `Partner ${idx + 1}`, yPos)
      yPos += 2

      yPos = addKeyValueRow(doc, 'Type', partner.partnership_type || 'N/A', yPos)
      yPos = addKeyValueRow(doc, 'Status', partner.partnership_status || 'N/A', yPos)
      yPos = addKeyValueRow(doc, 'Contact', partner.contact_person || 'N/A', yPos)
      yPos = addKeyValueRow(doc, 'Revenue Share', `${partner.revenue_share_percentage || 0}%`, yPos)
      yPos = addKeyValueRow(doc, 'Investment Amount', `₱${(partner.investment_amount_usd || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })}`, yPos)

      if (idx < partnerships.length - 1) {
        yPos = addDivider(doc, yPos + 2)
      }
    })
  }

  return doc
}

// PAGE 5: PRODUCTION
function createProductionPage(doc, project, production, pageNum) {
  let yPos = initPage(doc, project.name, 'Production', pageNum)

  yPos = addSectionTitle(doc, 'Production Capacity', yPos)

  const headers = ['Phase', 'Product Type', 'Annual Capacity', 'Utilization %']
  const rows = production.map(p => [
    p.phase_name || '',
    p.product_type || '',
    String(p.capacity_per_year || '0'),
    `${p.utilization_percentage || 80}%`
  ])

  yPos = addTable(doc, headers, rows, yPos)

  if (production.length > 0) {
    const totalCapacity = production.reduce((sum, p) => sum + (p.capacity_per_year || 0), 0)
    const avgUtilization = (production.reduce((sum, p) => sum + (p.utilization_percentage || 0), 0) / production.length).toFixed(1)
    
    yPos += 4
    yPos = addInfoBox(doc, yPos, 'Production Summary', [
      { label: 'Total Annual Capacity', value: String(totalCapacity) },
      { label: 'Average Utilization', value: `${avgUtilization}%` }
    ])
  }

  return doc
}

// PAGE 6: FINANCIALS
function createFinancialsPage(doc, project, revenues, costs, equipment, pageNum) {
  let yPos = initPage(doc, project.name, 'Financials', pageNum)

  yPos = addSectionTitle(doc, 'Financial Projections', yPos)

  if (revenues && revenues.length > 0) {
    yPos = addSubsectionTitle(doc, 'Revenue Projections', yPos)
    yPos += 2

    const headers = ['Product', 'Annual Volume', 'Unit Price', 'Annual Revenue']
    const rows = revenues.map(r => [
      r.product_type || '',
      String(r.projected_annual_volume || 0),
      `₱${(r.unit_price_usd || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })}`,
      `₱${(r.projected_annual_revenue_usd || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })}`
    ])

    yPos = addTable(doc, headers, rows, yPos)

    const revenueTotal = revenues.reduce((sum, r) => sum + (r.projected_annual_revenue_usd || 0), 0)
    yPos += 2
    yPos = addInfoBox(doc, yPos, 'Revenue Summary', [
      { label: 'Total Projected Annual Revenue', value: `₱${revenueTotal.toLocaleString('en-US', { maximumFractionDigits: 2 })}` }
    ])
  }

  // Financial Summary
  yPos = checkPageBreak(doc, yPos, 30)
  yPos += 6
  yPos = addSectionTitle(doc, 'Financial Summary', yPos)

  const totalCost = costs.reduce((sum, c) => sum + (c.budgeted_amount_usd || 0), 0)
  const equipmentTotal = equipment.reduce((sum, e) => sum + (e.total_cost_usd || 0), 0)
  const totalRaised = project.funded_amount_usd || 0
  const remaining = totalCost - totalRaised
  const fundingPercent = totalCost > 0 ? ((totalRaised / totalCost) * 100).toFixed(1) : 0

  yPos = addInfoBox(doc, yPos, 'Investment Overview', [
    { label: 'Total Capital Required', value: `₱${totalCost.toLocaleString('en-US', { maximumFractionDigits: 2 })}` },
    { label: 'Current Commitments', value: `₱${totalRaised.toLocaleString('en-US', { maximumFractionDigits: 2 })}` },
    { label: 'Remaining to Raise', value: `₱${Math.max(0, remaining).toLocaleString('en-US', { maximumFractionDigits: 2 })}` },
    { label: 'Funding Status', value: `${fundingPercent}% Complete` }
  ])

  return doc
}

// PAGE 7: TIMELINE
function createTimelinePage(doc, project, milestones, pageNum) {
  let yPos = initPage(doc, project.name, 'Timeline', pageNum)

  yPos = addSectionTitle(doc, 'Project Timeline', yPos)

  const headers = ['Milestone', 'Type', 'Target Date', 'Status']
  const rows = milestones.map(m => [
    m.milestone_name || '',
    m.milestone_type || '',
    (m.planned_date || '').substring(0, 10),
    m.status || ''
  ])

  yPos = addTable(doc, headers, rows, yPos)

  if (milestones.length > 0) {
    const completedCount = milestones.filter(m => m.status === 'Completed' || m.status === 'Completed').length
    
    yPos += 4
    yPos = addInfoBox(doc, yPos, 'Timeline Summary', [
      { label: 'Total Milestones', value: milestones.length },
      { label: 'Completed', value: completedCount },
      { label: 'Pending', value: milestones.length - completedCount }
    ])
  }

  return doc
}

// PAGE 8: RISKS
function createRisksPage(doc, project, risks, pageNum) {
  let yPos = initPage(doc, project.name, 'Risks', pageNum)

  yPos = addSectionTitle(doc, 'Risk Assessment', yPos)

  const headers = ['Risk Category', 'Probability', 'Impact', 'Status']
  const rows = risks.map(r => [
    r.risk_category || '',
    `${r.probability_percentage || 0}%`,
    r.impact_severity || '',
    r.status || ''
  ])

  yPos = addTable(doc, headers, rows, yPos)

  if (risks.length > 0) {
    const highRisks = risks.filter(r => (r.probability_percentage || 0) > 50).length
    const lowRisks = risks.filter(r => (r.probability_percentage || 0) <= 50).length
    
    yPos += 4
    yPos = addInfoBox(doc, yPos, 'Risk Summary', [
      { label: 'Total Identified Risks', value: risks.length },
      { label: 'High Priority Risks', value: highRisks },
      { label: 'Low Priority Risks', value: lowRisks }
    ])
  }

  return doc
}

export function generateComprehensiveProjectPdf(project, equipment, suppliers, partnerships, costs, production, revenues, milestones, risks, metrics) {
  const doc = new jsPDF('p', 'mm', 'a4')

  let pageNum = 1

  // Page 1: Overview
  createOverviewPage(doc, project, equipment, costs, pageNum++)

  // Page 2: Equipment
  if (equipment && equipment.length > 0) {
    createEquipmentPage(doc, project, equipment, pageNum++)
  }

  // Page 3: Costs
  if (costs && costs.length > 0) {
    createCostsPage(doc, project, costs, pageNum++)
  }

  // Page 4: Suppliers & Partnerships
  if ((suppliers && suppliers.length > 0) || (partnerships && partnerships.length > 0)) {
    createSuppliersPartnershipsPage(doc, project, suppliers || [], partnerships || [], pageNum++)
  }

  // Page 5: Production
  if (production && production.length > 0) {
    createProductionPage(doc, project, production, pageNum++)
  }

  // Page 6: Financials
  if (revenues && revenues.length > 0) {
    createFinancialsPage(doc, project, revenues, costs || [], equipment || [], pageNum++)
  }

  // Page 7: Timeline
  if (milestones && milestones.length > 0) {
    createTimelinePage(doc, project, milestones, pageNum++)
  }

  // Page 8: Risks
  if (risks && risks.length > 0) {
    createRisksPage(doc, project, risks, pageNum++)
  }

  return doc
}

export function generateProjectPdf(project, equipment, suppliers, partnerships, costs, production, revenues, milestones, risks, metrics) {
  return generateComprehensiveProjectPdf(project, equipment, suppliers, partnerships, costs, production, revenues, milestones, risks, metrics)
}
