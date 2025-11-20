import jsPDF from 'jspdf'

const MARGINS = {
  top: 18,
  bottom: 16,
  left: 16,
  right: 16,
  headerFooter: 10
}

const PAGE_WIDTH = 210
const PAGE_HEIGHT = 297
const CONTENT_WIDTH = PAGE_WIDTH - MARGINS.left - MARGINS.right
const MAX_Y_POS = PAGE_HEIGHT - MARGINS.bottom - 3

const COLORS = {
  primary: [31, 78, 121],
  secondary: [52, 120, 170],
  accent: [54, 169, 225],
  darkText: [26, 32, 44],
  lightText: [113, 128, 150],
  lightBg: [247, 249, 251],
  border: [203, 213, 225],
  highlight: [249, 250, 251]
}

function addPageHeader(doc, projectName, pageNum, totalPages) {
  const headerY = MARGINS.headerFooter - 2
  
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...COLORS.primary)
  const title = projectName.length > 45 ? projectName.substring(0, 42) + '...' : projectName
  doc.text(title, MARGINS.left, headerY)

  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...COLORS.lightText)
  doc.text(`Page ${pageNum} of ${totalPages}`, PAGE_WIDTH - MARGINS.right - 15, headerY, { align: 'right' })

  doc.setDrawColor(...COLORS.border)
  doc.setLineWidth(0.3)
  doc.line(MARGINS.left, headerY + 3, PAGE_WIDTH - MARGINS.right, headerY + 3)
}

function addPageFooter(doc, totalPages) {
  const footerY = PAGE_HEIGHT - MARGINS.headerFooter + 2

  doc.setDrawColor(...COLORS.border)
  doc.setLineWidth(0.3)
  doc.line(MARGINS.left, footerY - 5, PAGE_WIDTH - MARGINS.right, footerY - 5)

  doc.setFontSize(7)
  doc.setTextColor(...COLORS.lightText)
  doc.setFont('helvetica', 'normal')
  doc.text(`© ${new Date().getFullYear()} Project Report. Confidential.`, MARGINS.left, footerY)
}

function checkAndAddPage(doc, yPos, minSpace = 30, projectName = '', pageNum = 1, totalPages = 1) {
  if (yPos > MAX_Y_POS - minSpace) {
    doc.addPage()
    const newPageNum = doc.internal.getNumberOfPages()
    addPageHeader(doc, projectName, newPageNum, totalPages)
    return MARGINS.top + MARGINS.headerFooter + 6
  }
  return yPos
}

function addSectionTitle(doc, text, yPos) {
  doc.setFontSize(13)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...COLORS.primary)
  
  const lines = doc.splitTextToSize(text, CONTENT_WIDTH - 4)
  doc.text(lines, MARGINS.left, yPos)
  
  const lineHeight = lines.length * 5
  yPos += lineHeight + 2

  doc.setDrawColor(...COLORS.secondary)
  doc.setLineWidth(0.8)
  doc.line(MARGINS.left, yPos, PAGE_WIDTH - MARGINS.right, yPos)

  return yPos + 6
}

function addSubsectionTitle(doc, text, yPos) {
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...COLORS.secondary)
  
  const lines = doc.splitTextToSize(text, CONTENT_WIDTH - 4)
  doc.text(lines, MARGINS.left + 2, yPos)
  
  return yPos + (lines.length * 4) + 2
}

function addBodyText(doc, text, yPos, indent = 0) {
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...COLORS.darkText)
  
  const xPos = MARGINS.left + indent
  const lineWidth = CONTENT_WIDTH - indent
  const lines = doc.splitTextToSize(text, lineWidth)
  doc.text(lines, xPos, yPos)
  
  return yPos + (lines.length * 4.5) + 2
}

function addKeyValuePair(doc, label, value, yPos, indent = 2) {
  const xPos = MARGINS.left + indent
  const labelWidth = 35
  const valueWidth = CONTENT_WIDTH - labelWidth - indent - 2

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...COLORS.lightText)
  doc.text(label + ':', xPos, yPos)

  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...COLORS.darkText)
  const valueLines = doc.splitTextToSize(String(value || 'N/A'), valueWidth)
  doc.text(valueLines, xPos + labelWidth, yPos)

  return yPos + (valueLines.length * 4) + 3
}

function addInfoBox(doc, yPos, title, items) {
  doc.setFillColor(...COLORS.highlight)
  const boxHeight = items.length * 7 + 14
  doc.rect(MARGINS.left, yPos, CONTENT_WIDTH, boxHeight, 'F')

  doc.setDrawColor(...COLORS.border)
  doc.setLineWidth(0.5)
  doc.rect(MARGINS.left, yPos, CONTENT_WIDTH, boxHeight)

  yPos += 4
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...COLORS.primary)
  doc.text(title, MARGINS.left + 4, yPos)

  yPos += 6
  items.forEach(item => {
    yPos = addKeyValuePair(doc, item.label, item.value, yPos, 4)
  })

  return yPos + 4
}

function addTable(doc, headers, rows, yPos) {
  if (rows.length === 0) return yPos

  const colCount = headers.length
  const tableWidth = CONTENT_WIDTH
  const colWidth = tableWidth / colCount
  const rowHeight = 6.5
  const headerHeight = 7
  const cellPadding = 1.5
  const startX = MARGINS.left

  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(255, 255, 255)
  doc.setFillColor(...COLORS.primary)

  let xPos = startX
  for (let i = 0; i < colCount; i++) {
    doc.rect(xPos, yPos, colWidth, headerHeight, 'F')
    const headerText = String(headers[i] || '').substring(0, 16)
    doc.text(headerText, xPos + cellPadding + 0.5, yPos + cellPadding + 1.8, { maxWidth: colWidth - 2 * cellPadding })
    xPos += colWidth
  }

  yPos += headerHeight
  const headerYPos = yPos

  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...COLORS.darkText)

  let rowIndex = 0
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]

    if (rowIndex % 2 === 1) {
      doc.setFillColor(...COLORS.lightBg)
      xPos = startX
      for (let j = 0; j < colCount; j++) {
        doc.rect(xPos, yPos, colWidth, rowHeight, 'F')
        xPos += colWidth
      }
    }

    xPos = startX
    for (let j = 0; j < row.length; j++) {
      const cellValue = String(row[j] || '').substring(0, 18)
      doc.text(cellValue, xPos + cellPadding + 0.5, yPos + cellPadding + 1.5, { maxWidth: colWidth - 2 * cellPadding })
      xPos += colWidth
    }

    yPos += rowHeight
    rowIndex++
  }

  doc.setDrawColor(...COLORS.border)
  doc.setLineWidth(0.3)
  doc.rect(startX, headerYPos - headerHeight, tableWidth, headerHeight + (rowHeight * rows.length))

  return yPos + 4
}

function addDivider(doc, yPos) {
  doc.setDrawColor(...COLORS.border)
  doc.setLineWidth(0.2)
  doc.line(MARGINS.left, yPos, PAGE_WIDTH - MARGINS.right, yPos)
  return yPos + 5
}

export function generateComprehensiveProjectPdf(project, equipment, suppliers, partnerships, costs, production, revenues, milestones, risks, metrics) {
  const doc = new jsPDF('p', 'mm', 'a4')
  let pageNum = 1
  let totalPages = 12

  const projectName = project.name || 'Project Report'

  let yPos = MARGINS.top + MARGINS.headerFooter + 4

  doc.setFillColor(...COLORS.primary)
  doc.rect(0, 0, PAGE_WIDTH, 70, 'F')

  doc.setFontSize(32)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(255, 255, 255)
  const titleLines = doc.splitTextToSize(projectName, CONTENT_WIDTH - 8)
  doc.text(titleLines, MARGINS.left + 4, 25)

  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(210, 220, 230)
  const subLines = doc.splitTextToSize(project.description || 'Project Documentation', CONTENT_WIDTH - 8)
  doc.text(subLines, MARGINS.left + 4, 28 + titleLines.length * 8)

  doc.setFontSize(8)
  doc.setTextColor(210, 220, 230)
  doc.setFont('helvetica', 'normal')
  doc.text(`Prepared: ${new Date().toLocaleDateString()}`, MARGINS.left + 4, PAGE_HEIGHT - 12)
  doc.text('Confidential - For Internal Review Only', PAGE_WIDTH - MARGINS.right - 45, PAGE_HEIGHT - 12)

  const totalCost = costs.reduce((sum, c) => sum + (c.budgeted_amount_usd || 0), 0)
  const totalRaised = project.funded_amount_usd || 0
  const remaining = totalCost - totalRaised
  const fundingPercent = totalCost > 0 ? ((totalRaised / totalCost) * 100).toFixed(1) : 0

  doc.addPage()
  addPageHeader(doc, projectName, 2, totalPages)
  yPos = MARGINS.top + MARGINS.headerFooter + 6

  yPos = addSectionTitle(doc, 'Executive Summary', yPos)

  yPos = addInfoBox(doc, yPos, 'Project Financials', [
    { label: 'Total Project Cost', value: `$${totalCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
    { label: 'Current Funding', value: `$${totalRaised.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
    { label: 'Funding Progress', value: `${fundingPercent}% Complete` },
    { label: 'Amount Required', value: `$${Math.max(0, remaining).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` }
  ])

  yPos += 6

  if (project.long_description) {
    yPos = addSubsectionTitle(doc, 'Project Overview', yPos)
    yPos += 2
    yPos = addBodyText(doc, project.long_description, yPos, 2)
    yPos = addDivider(doc, yPos) + 2
  }

  if (equipment.length > 0) {
    doc.addPage()
    addPageHeader(doc, projectName, 3, totalPages)
    yPos = MARGINS.top + MARGINS.headerFooter + 6

    yPos = addSectionTitle(doc, 'Equipment & Infrastructure', yPos)

    const equipmentHeaders = ['Equipment', 'Qty', 'Unit Cost', 'Total Cost']
    const equipmentRows = equipment.map(e => [
      (e.equipment_name || '').substring(0, 20),
      String(e.quantity || 1),
      `$${(e.unit_cost_usd || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`,
      `$${(e.total_cost_usd || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`
    ])

    yPos = addTable(doc, equipmentHeaders, equipmentRows, yPos)
  }

  if (suppliers.length > 0) {
    doc.addPage()
    addPageHeader(doc, projectName, 4, totalPages)
    yPos = MARGINS.top + MARGINS.headerFooter + 6

    yPos = addSectionTitle(doc, 'Suppliers & Vendors', yPos)

    for (let i = 0; i < Math.min(suppliers.length, 2); i++) {
      const sup = suppliers[i]
      yPos = addSubsectionTitle(doc, sup.supplier_name || 'Supplier', yPos)
      yPos += 2

      yPos = addKeyValuePair(doc, 'Type', sup.supplier_type || 'N/A', yPos)
      yPos = addKeyValuePair(doc, 'Contact', sup.contact_person || 'N/A', yPos)
      if (sup.email) yPos = addKeyValuePair(doc, 'Email', sup.email, yPos)
      if (sup.phone) yPos = addKeyValuePair(doc, 'Phone', sup.phone, yPos)
      yPos = addKeyValuePair(doc, 'Delivery Timeline', `${sup.delivery_timeline_days || 'N/A'} days`, yPos)
      yPos = addKeyValuePair(doc, 'Warranty Period', `${sup.warranty_months || 'N/A'} months`, yPos)

      if (i < suppliers.length - 1) {
        yPos = addDivider(doc, yPos) + 2
      }
    }
  }

  if (partnerships.length > 0) {
    doc.addPage()
    addPageHeader(doc, projectName, 5, totalPages)
    yPos = MARGINS.top + MARGINS.headerFooter + 6

    yPos = addSectionTitle(doc, 'Strategic Partnerships', yPos)

    for (let i = 0; i < Math.min(partnerships.length, 2); i++) {
      const partner = partnerships[i]
      yPos = addSubsectionTitle(doc, partner.partner_name || 'Partner', yPos)
      yPos += 2

      yPos = addKeyValuePair(doc, 'Type', partner.partnership_type || 'N/A', yPos)
      yPos = addKeyValuePair(doc, 'Status', partner.partnership_status || 'N/A', yPos)
      yPos = addKeyValuePair(doc, 'Contact', partner.contact_person || 'N/A', yPos)
      yPos = addKeyValuePair(doc, 'Revenue Share', `${partner.revenue_share_percentage || 0}%`, yPos)
      yPos = addKeyValuePair(doc, 'Investment Amount', `$${(partner.investment_amount_usd || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`, yPos)

      if (i < partnerships.length - 1) {
        yPos = addDivider(doc, yPos) + 2
      }
    }
  }

  if (costs.length > 0) {
    doc.addPage()
    addPageHeader(doc, projectName, 6, totalPages)
    yPos = MARGINS.top + MARGINS.headerFooter + 6

    yPos = addSectionTitle(doc, 'Financial Breakdown', yPos)

    const costHeaders = ['Cost Category', 'Amount', 'Percentage']
    const costRows = costs.map(c => [
      (c.cost_category || '').substring(0, 25),
      `$${(c.budgeted_amount_usd || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`,
      `${c.percentage_of_total || 0}%`
    ])

    yPos = addTable(doc, costHeaders, costRows, yPos)
  }

  if (revenues.length > 0) {
    doc.addPage()
    addPageHeader(doc, projectName, 7, totalPages)
    yPos = MARGINS.top + MARGINS.headerFooter + 6

    yPos = addSectionTitle(doc, 'Revenue Projections', yPos)

    const revenueHeaders = ['Product', 'Annual Volume', 'Unit Price', 'Annual Revenue']
    const revenueRows = revenues.map(r => [
      (r.product_type || '').substring(0, 20),
      String(r.projected_annual_volume || 0),
      `$${(r.unit_price_usd || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`,
      `$${(r.projected_annual_revenue_usd || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`
    ])

    yPos = addTable(doc, revenueHeaders, revenueRows, yPos)
  }

  if (production.length > 0) {
    doc.addPage()
    addPageHeader(doc, projectName, 8, totalPages)
    yPos = MARGINS.top + MARGINS.headerFooter + 6

    yPos = addSectionTitle(doc, 'Production Capacity', yPos)

    const productionHeaders = ['Phase', 'Product Type', 'Annual Capacity', 'Utilization']
    const productionRows = production.map(p => [
      (p.phase_name || '').substring(0, 20),
      (p.product_type || '').substring(0, 18),
      String(p.capacity_per_year || 0),
      `${p.utilization_percentage || 80}%`
    ])

    yPos = addTable(doc, productionHeaders, productionRows, yPos)
  }

  if (milestones.length > 0) {
    doc.addPage()
    addPageHeader(doc, projectName, 9, totalPages)
    yPos = MARGINS.top + MARGINS.headerFooter + 6

    yPos = addSectionTitle(doc, 'Project Timeline', yPos)

    const milestoneHeaders = ['Milestone', 'Type', 'Target Date', 'Status']
    const milestoneRows = milestones.map(m => [
      (m.milestone_name || '').substring(0, 20),
      (m.milestone_type || '').substring(0, 15),
      (m.planned_date || '').substring(0, 12),
      (m.status || '').substring(0, 15)
    ])

    yPos = addTable(doc, milestoneHeaders, milestoneRows, yPos)
  }

  if (risks.length > 0) {
    doc.addPage()
    addPageHeader(doc, projectName, 10, totalPages)
    yPos = MARGINS.top + MARGINS.headerFooter + 6

    yPos = addSectionTitle(doc, 'Risk Assessment', yPos)

    const riskHeaders = ['Risk Category', 'Probability', 'Impact', 'Status']
    const riskRows = risks.map(r => [
      (r.risk_category || '').substring(0, 20),
      `${r.probability_percentage || 0}%`,
      (r.impact_severity || '').substring(0, 15),
      (r.status || '').substring(0, 12)
    ])

    yPos = addTable(doc, riskHeaders, riskRows, yPos)
  }

  if (metrics.length > 0) {
    doc.addPage()
    addPageHeader(doc, projectName, 11, totalPages)
    yPos = MARGINS.top + MARGINS.headerFooter + 6

    yPos = addSectionTitle(doc, 'Key Performance Metrics', yPos)

    const metricHeaders = ['Metric', 'Value', 'Target']
    const metricRows = metrics.map(m => [
      (m.metric_name || '').substring(0, 25),
      String(m.metric_value || 'N/A').substring(0, 20),
      (m.notes || '').substring(0, 20)
    ])

    yPos = addTable(doc, metricHeaders, metricRows, yPos)
  }

  doc.addPage()
  addPageHeader(doc, projectName, 12, totalPages)
  yPos = MARGINS.top + MARGINS.headerFooter + 6

  yPos = addSectionTitle(doc, 'Financial Summary', yPos)

  yPos = addInfoBox(doc, yPos, 'Investment Overview', [
    { label: 'Total Capital Required', value: `$${totalCost.toLocaleString('en-US', { minimumFractionDigits: 2 })}` },
    { label: 'Current Commitments', value: `$${totalRaised.toLocaleString('en-US', { minimumFractionDigits: 2 })}` },
    { label: 'Remaining to Raise', value: `$${Math.max(0, remaining).toLocaleString('en-US', { minimumFractionDigits: 2 })}` },
    { label: 'Funding Status', value: `${fundingPercent}% Complete` }
  ])

  const equipmentTotal = equipment.reduce((sum, e) => sum + (e.total_cost_usd || 0), 0)
  const revenueTotal = revenues.reduce((sum, r) => sum + (r.projected_annual_revenue_usd || 0), 0)

  yPos += 8
  yPos = addSubsectionTitle(doc, 'Investment Highlights', yPos)
  yPos += 2

  yPos = addKeyValuePair(doc, 'Equipment Investment', `$${equipmentTotal.toLocaleString('en-US', { maximumFractionDigits: 0 })}`, yPos, 2)
  yPos = addKeyValuePair(doc, 'Operating Costs', `$${totalCost.toLocaleString('en-US', { maximumFractionDigits: 0 })}`, yPos, 2)
  yPos = addKeyValuePair(doc, 'Projected Annual Revenue', `$${revenueTotal.toLocaleString('en-US', { maximumFractionDigits: 0 })}`, yPos, 2)

  const totalPages_real = doc.internal.getNumberOfPages()
  for (let i = 2; i <= totalPages_real; i++) {
    doc.setPage(i)
    addPageFooter(doc, totalPages_real)
  }

  return doc
}

export function generateProjectPdf(project, equipment, suppliers, partnerships, costs, production, revenues, milestones, risks, metrics) {
  return generateComprehensiveProjectPdf(project, equipment, suppliers, partnerships, costs, production, revenues, milestones, risks, metrics)
}
