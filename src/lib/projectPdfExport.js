import jsPDF from 'jspdf'

// ============ CONFIGURATION ============
const MARGINS = {
  top: 24,
  bottom: 20,
  left: 18,
  right: 18,
  headerHeight: 14,
  footerHeight: 14
}

const PAGE_WIDTH = 210
const PAGE_HEIGHT = 297
const CONTENT_WIDTH = PAGE_WIDTH - MARGINS.left - MARGINS.right
const CONTENT_START_Y = MARGINS.top + MARGINS.headerHeight
const MAX_Y_POS = PAGE_HEIGHT - MARGINS.bottom - MARGINS.footerHeight

// Professional color palette
const COLORS = {
  // Primary brand colors
  primary: [25, 55, 109],        // Deep navy blue
  primaryLight: [41, 98, 165],    // Lighter blue
  accent: [59, 130, 246],         // Bright blue
  
  // Text colors
  darkText: [17, 24, 39],         // Almost black
  mediumText: [55, 65, 81],       // Medium gray
  lightText: [107, 114, 128],     // Light gray
  
  // Background colors
  white: [255, 255, 255],
  lightBg: [249, 250, 251],       // Very light gray
  lightBg2: [243, 244, 246],      // Slightly darker light gray
  
  // Borders and accents
  border: [209, 213, 219],        // Light border gray
  success: [16, 185, 129],        // Green for positive
  warning: [245, 158, 11],        // Orange for warnings
  danger: [239, 68, 68],          // Red for risks
  
  // Card shadows (RGB for fill)
  cardBg: [255, 255, 255],
}

// ============ TYPOGRAPHY HELPERS ============
function setHeading1(doc) {
  doc.setFontSize(26)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...COLORS.primary)
}

function setHeading2(doc) {
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...COLORS.primary)
}

function setHeading3(doc) {
  doc.setFontSize(13)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...COLORS.primaryLight)
}

function setHeading4(doc) {
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...COLORS.mediumText)
}

function setBodyText(doc) {
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...COLORS.darkText)
}

function setSmallText(doc) {
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...COLORS.lightText)
}

function setLabelText(doc) {
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...COLORS.mediumText)
}

// ============ PAGE HEADER & FOOTER ============
function addPageHeader(doc, projectName, tabName, pageNum) {
  // Header background with subtle gradient effect (light blue)
  doc.setFillColor(...COLORS.lightBg)
  doc.rect(0, 0, PAGE_WIDTH, MARGINS.headerHeight, 'F')

  // Left accent bar
  doc.setFillColor(...COLORS.primaryLight)
  doc.rect(0, 0, 3, MARGINS.headerHeight, 'F')

  // Project name (left)
  setBodyText(doc)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...COLORS.primary)
  const titleText = projectName.length > 35 ? projectName.substring(0, 32) + '...' : projectName
  doc.text(titleText, MARGINS.left + 2, 8)

  // Tab name (center)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...COLORS.primaryLight)
  doc.text(tabName, PAGE_WIDTH / 2, 8, { align: 'center' })

  // Page number (right)
  setSmallText(doc)
  doc.text(`Page ${pageNum}`, PAGE_WIDTH - MARGINS.right, 8, { align: 'right' })

  // Bottom border line
  doc.setDrawColor(...COLORS.border)
  doc.setLineWidth(0.4)
  doc.line(MARGINS.left, MARGINS.headerHeight + 0.5, PAGE_WIDTH - MARGINS.right, MARGINS.headerHeight + 0.5)
}

function addPageFooter(doc, projectName) {
  const footerY = PAGE_HEIGHT - MARGINS.bottom + 3

  // Top border
  doc.setDrawColor(...COLORS.border)
  doc.setLineWidth(0.4)
  doc.line(MARGINS.left, footerY - 9, PAGE_WIDTH - MARGINS.right, footerY - 9)

  // Left - Company
  setSmallText(doc)
  doc.setFont('helvetica', 'normal')
  const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit' })
  doc.text(`Generated: ${dateStr}`, MARGINS.left, footerY - 4)

  // Center - Status
  doc.text('Confidential - Internal Use Only', PAGE_WIDTH / 2, footerY - 4, { align: 'center' })

  // Right - Copyright
  doc.text('© Project Report 2024', PAGE_WIDTH - MARGINS.right, footerY - 4, { align: 'right' })
}

function initPage(doc, projectName, tabName, pageNum) {
  doc.addPage()
  addPageHeader(doc, projectName, tabName, pageNum)
  addPageFooter(doc, projectName)
  return CONTENT_START_Y
}

// ============ PAGE LAYOUT UTILITIES ============
function checkPageBreak(doc, yPos, minSpace = 30) {
  if (yPos > MAX_Y_POS - minSpace) {
    doc.addPage()
    return CONTENT_START_Y
  }
  return yPos
}

function addVerticalSpace(doc, yPos, space = 4) {
  return yPos + space
}

// ============ SECTION HEADERS ============
function addSectionTitle(doc, text, yPos) {
  setHeading2(doc)
  const lines = doc.splitTextToSize(text, CONTENT_WIDTH)
  doc.text(lines, MARGINS.left, yPos)
  
  const lineHeight = lines.length * 7
  yPos += lineHeight + 3

  // Decorative underline
  doc.setDrawColor(...COLORS.primaryLight)
  doc.setLineWidth(1.2)
  doc.line(MARGINS.left, yPos, PAGE_WIDTH - MARGINS.right, yPos)

  return yPos + 8
}

function addSubsectionTitle(doc, text, yPos) {
  setHeading3(doc)
  const lines = doc.splitTextToSize(text, CONTENT_WIDTH - 4)
  doc.text(lines, MARGINS.left, yPos)
  return yPos + (lines.length * 5.5) + 4
}

// ============ CONTENT BLOCKS ============
function addBodyText(doc, text, yPos, indent = 0) {
  setBodyText(doc)
  const xPos = MARGINS.left + indent
  const lineWidth = CONTENT_WIDTH - indent
  const lines = doc.splitTextToSize(text, lineWidth)
  doc.text(lines, xPos, yPos)
  return yPos + (lines.length * 4.8) + 3
}

// Dual currency display
function formatDualCurrency(phpAmount, usdAmount) {
  const phpStr = `₱${Number(phpAmount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  const usdStr = `$${Number(usdAmount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  return `${phpStr} / ${usdStr}`
}

function addMetricRow(doc, label, phpValue, usdValue, yPos, indent = 2) {
  const xLabel = MARGINS.left + indent
  const xValue = MARGINS.left + 65

  // Label
  setLabelText(doc)
  doc.text(label, xLabel, yPos)

  // PHP Value
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...COLORS.primary)
  doc.text(`₱${Number(phpValue).toLocaleString('en-US', { maximumFractionDigits: 0 })}`, xValue, yPos)

  // USD Value (below in gray)
  setSmallText(doc)
  doc.text(`$${Number(usdValue).toLocaleString('en-US', { maximumFractionDigits: 2 })}`, xValue, yPos + 4)

  return yPos + 8
}

// ============ CARD STYLES ============
function addMetricCard(doc, yPos, title, items) {
  // Card background with shadow effect
  doc.setFillColor(...COLORS.lightBg2)
  const cardHeight = Math.max(items.length * 10 + 14, 45)
  doc.rect(MARGINS.left, yPos, CONTENT_WIDTH, cardHeight, 'F')

  // Card border
  doc.setDrawColor(...COLORS.primaryLight)
  doc.setLineWidth(0.8)
  doc.rect(MARGINS.left, yPos, CONTENT_WIDTH, cardHeight)

  // Title background
  doc.setFillColor(...COLORS.primary)
  doc.rect(MARGINS.left, yPos, CONTENT_WIDTH, 7.5, 'F')

  // Title text
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...COLORS.white)
  doc.text(title, MARGINS.left + 4, yPos + 5)

  yPos += 10
  items.forEach(item => {
    yPos = addMetricRow(doc, item.label, item.phpValue, item.usdValue, yPos, 4)
  })

  return yPos + 4
}

// ============ DATA TABLES ============
function addDataTable(doc, headers, rows, yPos, columnWidths = null) {
  if (rows.length === 0) {
    setBodyText(doc)
    doc.setTextColor(...COLORS.lightText)
    doc.text('No data available', MARGINS.left, yPos)
    return yPos + 8
  }

  const colCount = headers.length
  const tableWidth = CONTENT_WIDTH
  const colWidths = columnWidths || headers.map(() => tableWidth / colCount)
  const rowHeight = 7.5
  const headerHeight = 8.5
  const cellPadding = 1.8
  const startX = MARGINS.left

  // Header row
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...COLORS.white)
  doc.setFillColor(...COLORS.primary)

  let xPos = startX
  for (let i = 0; i < colCount; i++) {
    doc.rect(xPos, yPos, colWidths[i], headerHeight, 'F')
    const headerText = String(headers[i] || '').substring(0, 25)
    doc.text(headerText, xPos + cellPadding, yPos + cellPadding + 2.2, { 
      maxWidth: colWidths[i] - cellPadding * 2, 
      align: 'left' 
    })
    xPos += colWidths[i]
  }

  yPos += headerHeight

  // Data rows
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...COLORS.darkText)

  rows.forEach((row, rowIdx) => {
    // Alternating row background
    if (rowIdx % 2 === 0) {
      doc.setFillColor(...COLORS.lightBg)
      xPos = startX
      for (let j = 0; j < colCount; j++) {
        doc.rect(xPos, yPos, colWidths[j], rowHeight, 'F')
        xPos += colWidths[j]
      }
    }

    // Row borders
    doc.setDrawColor(...COLORS.border)
    doc.setLineWidth(0.3)
    xPos = startX
    for (let j = 0; j < colCount; j++) {
      doc.rect(xPos, yPos, colWidths[j], rowHeight)
      xPos += colWidths[j]
    }

    // Row content
    xPos = startX
    for (let j = 0; j < row.length; j++) {
      const cellValue = String(row[j] || '').substring(0, 30)
      doc.text(cellValue, xPos + cellPadding, yPos + cellPadding + 1.8, { 
        maxWidth: colWidths[j] - cellPadding * 2, 
        align: 'left' 
      })
      xPos += colWidths[j]
    }

    yPos += rowHeight
  })

  return yPos + 6
}

// ============ DIVIDERS ============
function addDivider(doc, yPos) {
  doc.setDrawColor(...COLORS.border)
  doc.setLineWidth(0.3)
  doc.line(MARGINS.left, yPos, PAGE_WIDTH - MARGINS.right, yPos)
  return yPos + 6
}

// ============ PAGE GENERATORS ============

function createOverviewPage(doc, project, equipment, costs, pageNum, exchangeRate) {
  let yPos = initPage(doc, project.name, 'Overview', pageNum)

  yPos = addSectionTitle(doc, 'Project Overview', yPos)

  // Description
  if (project.long_description) {
    yPos = addBodyText(doc, project.long_description, yPos, 0)
    yPos += 4
  }

  // Key Financial Metrics
  const totalCostUsd = costs.reduce((sum, c) => sum + (c.budgeted_amount_usd || 0), 0)
  const totalCostPhp = totalCostUsd / exchangeRate
  const totalRaisedUsd = (project.funded_amount_usd || 0)
  const totalRaisedPhp = totalRaisedUsd / exchangeRate
  const remainingUsd = totalCostUsd - totalRaisedUsd
  const remainingPhp = totalCostPhp - totalRaisedPhp
  const fundingPercent = totalCostUsd > 0 ? ((totalRaisedUsd / totalCostUsd) * 100).toFixed(1) : 0

  yPos = addMetricCard(doc, yPos, 'Capital Requirements', [
    { label: 'Total Project Cost', phpValue: totalCostPhp, usdValue: totalCostUsd },
    { label: 'Current Funding', phpValue: totalRaisedPhp, usdValue: totalRaisedUsd },
    { label: 'Remaining to Raise', phpValue: remainingPhp, usdValue: remainingUsd },
    { label: 'Funding Progress', phpValue: fundingPercent + '%', usdValue: fundingPercent + '%' }
  ])

  return doc
}

function createEquipmentPage(doc, project, equipment, pageNum, exchangeRate) {
  let yPos = initPage(doc, project.name, 'Equipment & Infrastructure', pageNum)

  yPos = addSectionTitle(doc, 'Equipment Assets', yPos)

  // Equipment table
  const headers = ['Equipment', 'Type', 'Capacity', 'Power (kW)', 'Unit Cost (PHP)', 'Total Cost (PHP)']
  const colWidths = [35, 25, 20, 18, 35, 35]
  
  const rows = equipment.map(e => [
    (e.equipment_name || '').substring(0, 20),
    (e.equipment_type || '').substring(0, 15),
    (e.capacity || '').substring(0, 12),
    (e.power_kw || '').substring(0, 8),
    `₱${Number(e.unit_cost_usd / exchangeRate).toLocaleString('en-US', { maximumFractionDigits: 0 })}`,
    `₱${Number((e.total_cost_usd || 0) / exchangeRate).toLocaleString('en-US', { maximumFractionDigits: 0 })}`
  ])

  yPos = addDataTable(doc, headers, rows, yPos, colWidths)

  // Equipment summary
  if (equipment.length > 0) {
    const totalEquipmentUsd = equipment.reduce((sum, e) => sum + (e.total_cost_usd || 0), 0)
    const totalEquipmentPhp = totalEquipmentUsd / exchangeRate

    yPos += 4
    yPos = addMetricCard(doc, yPos, 'Equipment Summary', [
      { label: 'Total Equipment Items', phpValue: equipment.length, usdValue: equipment.length },
      { label: 'Total Investment', phpValue: totalEquipmentPhp, usdValue: totalEquipmentUsd }
    ])
  }

  return doc
}

function createCostsPage(doc, project, costs, pageNum, exchangeRate) {
  let yPos = initPage(doc, project.name, 'Costs & Budget', pageNum)

  yPos = addSectionTitle(doc, 'Project Cost Breakdown', yPos)

  const headers = ['Category', 'Budgeted (PHP)', 'Actual (PHP)', '% of Total']
  const colWidths = [50, 40, 40, 35]

  const rows = costs.map(c => {
    const budgetPhp = Number((c.budgeted_amount_usd || 0) / exchangeRate).toLocaleString('en-US', { maximumFractionDigits: 0 })
    const actualPhp = c.actual_amount_usd ? Number((c.actual_amount_usd / exchangeRate)).toLocaleString('en-US', { maximumFractionDigits: 0 }) : '-'
    
    return [
      (c.cost_category || '').substring(0, 25),
      `₱${budgetPhp}`,
      actualPhp === '-' ? '-' : `₱${actualPhp}`,
      `${c.percentage_of_total || 0}%`
    ]
  })

  yPos = addDataTable(doc, headers, rows, yPos, colWidths)

  // Cost summary
  if (costs.length > 0) {
    const totalBudgetedUsd = costs.reduce((sum, c) => sum + (c.budgeted_amount_usd || 0), 0)
    const totalBudgetedPhp = totalBudgetedUsd / exchangeRate
    const totalActualUsd = costs.reduce((sum, c) => sum + (c.actual_amount_usd || 0), 0)
    const totalActualPhp = totalActualUsd / exchangeRate

    yPos += 4
    yPos = addMetricCard(doc, yPos, 'Cost Summary', [
      { label: 'Total Budgeted', phpValue: totalBudgetedPhp, usdValue: totalBudgetedUsd },
      { label: 'Total Actual', phpValue: totalActualPhp || 'N/A', usdValue: totalActualUsd || 'N/A' },
      { label: 'Budget Variance', phpValue: (totalBudgetedPhp - totalActualPhp), usdValue: (totalBudgetedUsd - totalActualUsd) }
    ])
  }

  return doc
}

function createSuppliersPage(doc, project, suppliers, pageNum) {
  let yPos = initPage(doc, project.name, 'Suppliers & Vendors', pageNum)

  yPos = addSectionTitle(doc, 'Supply Chain Partners', yPos)

  if (!suppliers || suppliers.length === 0) {
    setBodyText(doc)
    doc.setTextColor(...COLORS.lightText)
    doc.text('No supplier information available', MARGINS.left, yPos)
    return doc
  }

  suppliers.forEach((sup, idx) => {
    yPos = checkPageBreak(doc, yPos, 40)
    yPos = addSubsectionTitle(doc, sup.supplier_name || `Supplier ${idx + 1}`, yPos)

    const details = []
    if (sup.supplier_type) details.push({ label: 'Type', value: sup.supplier_type })
    if (sup.contact_person) details.push({ label: 'Contact Person', value: sup.contact_person })
    if (sup.email) details.push({ label: 'Email', value: sup.email })
    if (sup.phone) details.push({ label: 'Phone', value: sup.phone })
    if (sup.delivery_timeline_days) details.push({ label: 'Delivery Timeline', value: `${sup.delivery_timeline_days} days` })
    if (sup.warranty_months) details.push({ label: 'Warranty Period', value: `${sup.warranty_months} months` })

    details.forEach(detail => {
      setLabelText(doc)
      doc.text(detail.label + ':', MARGINS.left + 2, yPos)
      setBodyText(doc)
      doc.text(detail.value, MARGINS.left + 40, yPos)
      yPos += 5
    })

    if (idx < suppliers.length - 1) {
      yPos = addDivider(doc, yPos + 2)
    }
    yPos += 2
  })

  return doc
}

function createPartnershipsPage(doc, project, partnerships, pageNum, exchangeRate) {
  let yPos = initPage(doc, project.name, 'Strategic Partnerships', pageNum)

  yPos = addSectionTitle(doc, 'Partnership Overview', yPos)

  if (!partnerships || partnerships.length === 0) {
    setBodyText(doc)
    doc.setTextColor(...COLORS.lightText)
    doc.text('No partnership information available', MARGINS.left, yPos)
    return doc
  }

  partnerships.forEach((partner, idx) => {
    yPos = checkPageBreak(doc, yPos, 45)
    yPos = addSubsectionTitle(doc, partner.partner_name || `Partner ${idx + 1}`, yPos)

    const investmentPhp = (partner.investment_amount_usd || 0) / exchangeRate
    const investmentUsd = partner.investment_amount_usd || 0

    const details = []
    if (partner.partnership_type) details.push({ label: 'Partnership Type', value: partner.partnership_type })
    if (partner.partnership_status) details.push({ label: 'Status', value: partner.partnership_status })
    if (partner.contact_person) details.push({ label: 'Contact Person', value: partner.contact_person })
    if (partner.revenue_share_percentage) details.push({ label: 'Revenue Share', value: `${partner.revenue_share_percentage}%` })
    details.push({ label: 'Investment Amount', value: `₱${Number(investmentPhp).toLocaleString('en-US', { maximumFractionDigits: 0 })} / $${Number(investmentUsd).toLocaleString('en-US', { maximumFractionDigits: 2 })}` })

    details.forEach(detail => {
      setLabelText(doc)
      doc.text(detail.label + ':', MARGINS.left + 2, yPos)
      setBodyText(doc)
      doc.text(detail.value, MARGINS.left + 40, yPos)
      yPos += 5
    })

    if (idx < partnerships.length - 1) {
      yPos = addDivider(doc, yPos + 2)
    }
    yPos += 2
  })

  return doc
}

function createProductionPage(doc, project, production, pageNum) {
  let yPos = initPage(doc, project.name, 'Production & Capacity', pageNum)

  yPos = addSectionTitle(doc, 'Production Capacity Planning', yPos)

  const headers = ['Phase', 'Product Type', 'Annual Capacity', 'Utilization %']
  const colWidths = [50, 50, 35, 35]

  const rows = production.map(p => [
    (p.phase_name || '').substring(0, 25),
    (p.product_type || '').substring(0, 25),
    String(p.capacity_per_year || 0),
    `${p.utilization_percentage || 80}%`
  ])

  yPos = addDataTable(doc, headers, rows, yPos, colWidths)

  if (production.length > 0) {
    const totalCapacity = production.reduce((sum, p) => sum + (p.capacity_per_year || 0), 0)
    const avgUtilization = (production.reduce((sum, p) => sum + (p.utilization_percentage || 0), 0) / production.length).toFixed(1)

    yPos += 4
    yPos = addMetricCard(doc, yPos, 'Production Summary', [
      { label: 'Total Annual Capacity', phpValue: totalCapacity, usdValue: totalCapacity },
      { label: 'Average Utilization', phpValue: avgUtilization + '%', usdValue: avgUtilization + '%' }
    ])
  }

  return doc
}

function createFinancialsPage(doc, project, revenues, costs, equipment, pageNum, exchangeRate) {
  let yPos = initPage(doc, project.name, 'Financial Projections', pageNum)

  yPos = addSectionTitle(doc, 'Revenue & Financial Forecasts', yPos)

  if (revenues && revenues.length > 0) {
    const headers = ['Product', 'Annual Volume', 'Unit Price (PHP)', 'Annual Revenue (PHP)']
    const colWidths = [50, 35, 40, 50]

    const rows = revenues.map(r => {
      const unitPricePhp = Number((r.unit_price_usd || 0) / exchangeRate).toLocaleString('en-US', { maximumFractionDigits: 0 })
      const revenuePhp = Number((r.projected_annual_revenue_usd || 0) / exchangeRate).toLocaleString('en-US', { maximumFractionDigits: 0 })

      return [
        (r.product_type || '').substring(0, 25),
        String(r.projected_annual_volume || 0),
        `₱${unitPricePhp}`,
        `₱${revenuePhp}`
      ]
    })

    yPos = addDataTable(doc, headers, rows, yPos, colWidths)

    const revenueTotalUsd = revenues.reduce((sum, r) => sum + (r.projected_annual_revenue_usd || 0), 0)
    const revenueTotalPhp = revenueTotalUsd / exchangeRate

    yPos += 4
    yPos = addMetricCard(doc, yPos, 'Revenue Summary', [
      { label: 'Total Annual Revenue', phpValue: revenueTotalPhp, usdValue: revenueTotalUsd }
    ])
  }

  yPos = checkPageBreak(doc, yPos, 45)
  yPos += 6
  yPos = addSectionTitle(doc, 'Financial Overview', yPos)

  const totalCostUsd = costs.reduce((sum, c) => sum + (c.budgeted_amount_usd || 0), 0)
  const totalCostPhp = totalCostUsd / exchangeRate
  const equipmentTotalUsd = equipment.reduce((sum, e) => sum + (e.total_cost_usd || 0), 0)
  const equipmentTotalPhp = equipmentTotalUsd / exchangeRate
  const totalRaisedUsd = (project.funded_amount_usd || 0)
  const totalRaisedPhp = totalRaisedUsd / exchangeRate
  const remainingUsd = totalCostUsd - totalRaisedUsd
  const remainingPhp = totalCostPhp - totalRaisedPhp
  const fundingPercent = totalCostUsd > 0 ? ((totalRaisedUsd / totalCostUsd) * 100).toFixed(1) : 0

  yPos = addMetricCard(doc, yPos, 'Investment Summary', [
    { label: 'Total Capital Required', phpValue: totalCostPhp, usdValue: totalCostUsd },
    { label: 'Current Commitments', phpValue: totalRaisedPhp, usdValue: totalRaisedUsd },
    { label: 'Remaining to Raise', phpValue: remainingPhp, usdValue: remainingUsd },
    { label: 'Funding Status', phpValue: fundingPercent + '%', usdValue: fundingPercent + '%' }
  ])

  return doc
}

function createTimelinePage(doc, project, milestones, pageNum) {
  let yPos = initPage(doc, project.name, 'Project Timeline', pageNum)

  yPos = addSectionTitle(doc, 'Project Milestones', yPos)

  const headers = ['Milestone', 'Type', 'Target Date', 'Status']
  const colWidths = [50, 35, 40, 40]

  const rows = milestones.map(m => [
    (m.milestone_name || '').substring(0, 25),
    (m.milestone_type || '').substring(0, 20),
    (m.planned_date || '').substring(0, 10),
    (m.status || '').substring(0, 15)
  ])

  yPos = addDataTable(doc, headers, rows, yPos, colWidths)

  if (milestones.length > 0) {
    const completedCount = milestones.filter(m => m.status === 'Completed' || m.status === 'Complete').length
    const inProgressCount = milestones.filter(m => m.status === 'In Progress').length
    const pendingCount = milestones.length - completedCount - inProgressCount

    yPos += 4
    yPos = addMetricCard(doc, yPos, 'Timeline Status', [
      { label: 'Total Milestones', phpValue: milestones.length, usdValue: milestones.length },
      { label: 'Completed', phpValue: completedCount, usdValue: completedCount },
      { label: 'In Progress', phpValue: inProgressCount, usdValue: inProgressCount },
      { label: 'Pending', phpValue: pendingCount, usdValue: pendingCount }
    ])
  }

  return doc
}

function createRisksPage(doc, project, risks, pageNum) {
  let yPos = initPage(doc, project.name, 'Risk Assessment', pageNum)

  yPos = addSectionTitle(doc, 'Risk Register', yPos)

  const headers = ['Risk Category', 'Probability %', 'Impact Level', 'Status']
  const colWidths = [50, 35, 35, 45]

  const rows = risks.map(r => [
    (r.risk_category || '').substring(0, 25),
    `${r.probability_percentage || 0}%`,
    (r.impact_severity || '').substring(0, 20),
    (r.status || '').substring(0, 15)
  ])

  yPos = addDataTable(doc, headers, rows, yPos, colWidths)

  if (risks.length > 0) {
    const highRisks = risks.filter(r => (r.probability_percentage || 0) > 70).length
    const mediumRisks = risks.filter(r => (r.probability_percentage || 0) > 30 && (r.probability_percentage || 0) <= 70).length
    const lowRisks = risks.filter(r => (r.probability_percentage || 0) <= 30).length

    yPos += 4
    yPos = addMetricCard(doc, yPos, 'Risk Summary', [
      { label: 'Total Identified Risks', phpValue: risks.length, usdValue: risks.length },
      { label: 'High Priority (>70%)', phpValue: highRisks, usdValue: highRisks },
      { label: 'Medium Priority (31-70%)', phpValue: mediumRisks, usdValue: mediumRisks },
      { label: 'Low Priority (<30%)', phpValue: lowRisks, usdValue: lowRisks }
    ])
  }

  return doc
}

// ============ MAIN EXPORT FUNCTION ============
export function generateComprehensiveProjectPdf(project, equipment, suppliers, partnerships, costs, production, revenues, milestones, risks, metrics, exchangeRate = 0.018) {
  const doc = new jsPDF('p', 'mm', 'a4')
  let pageNum = 1

  // Page 1: Overview
  createOverviewPage(doc, project, equipment, costs, pageNum++, exchangeRate)

  // Page 2: Equipment
  if (equipment && equipment.length > 0) {
    createEquipmentPage(doc, project, equipment, pageNum++, exchangeRate)
  }

  // Page 3: Costs
  if (costs && costs.length > 0) {
    createCostsPage(doc, project, costs, pageNum++, exchangeRate)
  }

  // Page 4: Suppliers
  if (suppliers && suppliers.length > 0) {
    createSuppliersPage(doc, project, suppliers, pageNum++, exchangeRate)
  }

  // Page 5: Partnerships
  if (partnerships && partnerships.length > 0) {
    createPartnershipsPage(doc, project, partnerships, pageNum++, exchangeRate)
  }

  // Page 6: Production
  if (production && production.length > 0) {
    createProductionPage(doc, project, production, pageNum++, exchangeRate)
  }

  // Page 7: Financials
  if (revenues && revenues.length > 0) {
    createFinancialsPage(doc, project, revenues, costs || [], equipment || [], pageNum++, exchangeRate)
  }

  // Page 8: Timeline
  if (milestones && milestones.length > 0) {
    createTimelinePage(doc, project, milestones, pageNum++, exchangeRate)
  }

  // Page 9: Risks
  if (risks && risks.length > 0) {
    createRisksPage(doc, project, risks, pageNum++, exchangeRate)
  }

  return doc
}

export function generateProjectPdf(project, equipment, suppliers, partnerships, costs, production, revenues, milestones, risks, metrics, exchangeRate = 0.018) {
  return generateComprehensiveProjectPdf(project, equipment, suppliers, partnerships, costs, production, revenues, milestones, risks, metrics, exchangeRate)
}
