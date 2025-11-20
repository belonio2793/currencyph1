import jsPDF from 'jspdf'

const MARGINS = {
  top: 25,
  bottom: 25,
  left: 20,
  right: 20,
  headerFooter: 15
}

const PAGE_WIDTH = 210 // A4 width in mm
const CONTENT_WIDTH = PAGE_WIDTH - MARGINS.left - MARGINS.right

const COLORS = {
  primary: [25, 118, 210],
  secondary: [66, 133, 244],
  accent: [66, 200, 124],
  lightGray: [245, 245, 245],
  darkGray: [51, 51, 51],
  textDark: [33, 33, 33],
  textLight: [119, 119, 119],
  border: [224, 224, 224],
  red: [229, 57, 53],
  orange: [251, 140, 0],
  green: [56, 142, 60]
}

function addTitle(doc, text, yPos) {
  doc.setFontSize(24)
  doc.setTextColor(...COLORS.primary)
  doc.setFont('helvetica', 'bold')
  const lines = doc.splitTextToSize(text, CONTENT_WIDTH)
  doc.text(lines, MARGINS.left, yPos)
  return yPos + (lines.length * 8) + 4
}

function addSectionTitle(doc, text, yPos) {
  doc.setFontSize(14)
  doc.setTextColor(...COLORS.primary)
  doc.setFont('helvetica', 'bold')
  const lines = doc.splitTextToSize(text, CONTENT_WIDTH)
  doc.text(lines, MARGINS.left, yPos)

  doc.setDrawColor(...COLORS.secondary)
  doc.setLineWidth(0.5)
  doc.line(MARGINS.left, yPos + (lines.length * 4) + 2, PAGE_WIDTH - MARGINS.right, yPos + (lines.length * 4) + 2)

  return yPos + (lines.length * 4) + 8
}

function addSubsectionTitle(doc, text, yPos) {
  doc.setFontSize(11)
  doc.setTextColor(...COLORS.secondary)
  doc.setFont('helvetica', 'bold')
  const lines = doc.splitTextToSize(text, CONTENT_WIDTH - 5)
  doc.text(lines, MARGINS.left + 5, yPos)
  return yPos + (lines.length * 4) + 4
}

function addLabel(doc, text, yPos, fontSize = 10, bold = false) {
  doc.setFontSize(fontSize)
  doc.setTextColor(...COLORS.textLight)
  doc.setFont('helvetica', bold ? 'bold' : 'normal')
  return yPos
}

function addValue(doc, label, value, yPos, xOffset = MARGINS.left + 5) {
  doc.setFontSize(10)
  doc.setTextColor(...COLORS.textLight)
  doc.setFont('helvetica', 'normal')
  doc.text(`${label}:`, xOffset, yPos)

  doc.setTextColor(...COLORS.textDark)
  doc.setFont('helvetica', 'bold')
  const valueStr = String(value || 'N/A')
  const valueLines = doc.splitTextToSize(valueStr, CONTENT_WIDTH - 60)
  doc.text(valueLines, xOffset + 50, yPos)

  return yPos + (valueLines.length * 5)
}

function addMultilineValue(doc, label, value, yPos, xOffset = MARGINS.left + 5) {
  doc.setFontSize(10)
  doc.setTextColor(...COLORS.textLight)
  doc.setFont('helvetica', 'normal')
  doc.text(`${label}:`, xOffset, yPos)

  doc.setTextColor(...COLORS.textDark)
  doc.setFont('helvetica', 'normal')
  const lines = doc.splitTextToSize(String(value || 'N/A'), CONTENT_WIDTH - 60)
  doc.text(lines, xOffset + 50, yPos)

  return yPos + (lines.length * 5) + 2
}

function addTwoColumnValues(doc, label1, value1, label2, value2, yPos) {
  doc.setFontSize(10)
  doc.setTextColor(...COLORS.textLight)
  doc.setFont('helvetica', 'normal')

  const leftX = MARGINS.left + 5
  const rightX = MARGINS.left + (CONTENT_WIDTH / 2) + 5

  doc.text(`${label1}:`, leftX, yPos)
  doc.setTextColor(...COLORS.textDark)
  doc.setFont('helvetica', 'bold')
  const val1 = String(value1 || 'N/A')
  const val1Lines = doc.splitTextToSize(val1, (CONTENT_WIDTH / 2) - 60)
  doc.text(val1Lines, leftX + 45, yPos)

  doc.setTextColor(...COLORS.textLight)
  doc.setFont('helvetica', 'normal')
  doc.text(`${label2}:`, rightX, yPos)

  doc.setTextColor(...COLORS.textDark)
  doc.setFont('helvetica', 'bold')
  const val2 = String(value2 || 'N/A')
  const val2Lines = doc.splitTextToSize(val2, (CONTENT_WIDTH / 2) - 60)
  doc.text(val2Lines, rightX + 45, yPos)

  return yPos + (Math.max(val1Lines.length, val2Lines.length) * 5)
}

function addTable(doc, headers, rows, yPos) {
  const tableWidth = CONTENT_WIDTH
  const colWidth = tableWidth / headers.length
  const cellPadding = 2
  const rowHeight = 7
  const startXPos = MARGINS.left

  doc.setFontSize(8)

  // Header
  doc.setFillColor(...COLORS.primary)
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')

  let xPos = startXPos
  for (let i = 0; i < headers.length; i++) {
    doc.rect(xPos, yPos, colWidth, rowHeight, 'F')
    const headerText = doc.splitTextToSize(headers[i], colWidth - 2 * cellPadding)
    doc.text(headerText[0] || '', xPos + cellPadding, yPos + cellPadding + 1.5)
    xPos += colWidth
  }

  yPos += rowHeight
  const headerYPos = yPos

  // Rows
  doc.setTextColor(...COLORS.textDark)
  doc.setFont('helvetica', 'normal')

  let alternateColor = false
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]

    if (alternateColor) {
      doc.setFillColor(...COLORS.lightGray)
      xPos = startXPos
      for (let j = 0; j < headers.length; j++) {
        doc.rect(xPos, yPos, colWidth, rowHeight, 'F')
        xPos += colWidth
      }
    }

    xPos = startXPos
    for (let j = 0; j < row.length; j++) {
      const cellValue = String(row[j] || '')
      const cellText = doc.splitTextToSize(cellValue, colWidth - 2 * cellPadding)
      doc.text(cellText[0] || '', xPos + cellPadding, yPos + cellPadding + 1.5)
      xPos += colWidth
    }

    alternateColor = !alternateColor
    yPos += rowHeight
  }

  // Border
  doc.setDrawColor(...COLORS.border)
  doc.setLineWidth(0.2)
  doc.rect(startXPos, headerYPos - rowHeight, tableWidth, rowHeight + (rowHeight * rows.length))

  return yPos + 4
}

function checkAndAddPage(doc, yPos, minSpace = 30) {
  if (yPos > 270) {
    doc.addPage()
    return 15
  }
  return yPos
}

export function generateProjectPdf(project, equipment, suppliers, partnerships, costs, production, revenues, milestones, risks, metrics) {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  
  let yPos = 15
  
  // ===== TITLE PAGE =====
  yPos = addTitle(doc, project.name, yPos)
  
  yPos += 8
  doc.setFontSize(11)
  doc.setTextColor(...COLORS.textLight)
  doc.text(project.description || 'Project Details', 20, yPos)
  
  yPos += 15
  
  // Key Metrics Box
  doc.setFillColor(...COLORS.lightGray)
  doc.rect(20, yPos, 170, 50, 'F')
  
  yPos += 5
  const totalCost = costs.reduce((sum, c) => sum + (c.budgeted_amount_usd || 0), 0)
  const totalRaised = project.funded_amount_usd || 0
  const remaining = totalCost - totalRaised
  
  yPos = addValue(doc, 'Total Project Cost', `$${totalCost.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, yPos)
  yPos = addValue(doc, 'Amount Funded', `$${totalRaised.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, yPos)
  yPos = addValue(doc, 'Remaining to Fund', `$${Math.max(0, remaining).toLocaleString('en-US', { minimumFractionDigits: 2 })}`, yPos)
  
  const fundingPercent = totalCost > 0 ? ((totalRaised / totalCost) * 100).toFixed(1) : 0
  doc.setFontSize(10)
  doc.setTextColor(...COLORS.green)
  doc.setFont('helvetica', 'bold')
  doc.text(`Funding Progress: ${fundingPercent}%`, 25, yPos + 8)
  
  yPos += 35
  yPos = checkAndAddPage(doc, yPos, 50)
  
  // ===== PROJECT OVERVIEW =====
  yPos = addSectionTitle(doc, 'Project Overview', yPos)
  yPos += 5
  
  if (project.long_description) {
    doc.setFontSize(10)
    doc.setTextColor(...COLORS.textDark)
    const descLines = doc.splitTextToSize(project.long_description, 170)
    doc.text(descLines, 25, yPos)
    yPos += (descLines.length * 5) + 5
  }
  
  yPos = checkAndAddPage(doc, yPos, 40)
  
  // ===== EQUIPMENT SECTION =====
  if (equipment.length > 0) {
    yPos = addSectionTitle(doc, 'Equipment', yPos)
    yPos += 5
    
    const equipmentHeaders = ['Equipment Name', 'Type', 'Quantity', 'Unit Cost', 'Total Cost']
    const equipmentRows = equipment.map(e => [
      e.equipment_name || '',
      e.equipment_type || '',
      String(e.quantity || 1),
      `$${(e.unit_cost_usd || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
      `$${(e.total_cost_usd || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
    ])
    
    yPos = addTable(doc, equipmentHeaders, equipmentRows, yPos)
    yPos = checkAndAddPage(doc, yPos, 40)
  }
  
  // ===== SUPPLIERS SECTION =====
  if (suppliers.length > 0) {
    yPos = addSectionTitle(doc, 'Suppliers', yPos)
    yPos += 5
    
    for (let i = 0; i < suppliers.length; i++) {
      const sup = suppliers[i]
      
      yPos = addSubsectionTitle(doc, sup.supplier_name, yPos)
      yPos += 2
      
      yPos = addValue(doc, 'Type', sup.supplier_type, yPos)
      yPos = addValue(doc, 'Contact Person', sup.contact_person, yPos)
      yPos = addValue(doc, 'Email', sup.email, yPos)
      yPos = addValue(doc, 'Phone', sup.phone, yPos)
      
      if (sup.city || sup.country) {
        yPos = addValue(doc, 'Location', `${sup.city || ''}, ${sup.country || ''}`, yPos)
      }
      
      yPos = addValue(doc, 'Delivery Timeline', `${sup.delivery_timeline_days || 'N/A'} days`, yPos)
      yPos = addValue(doc, 'Warranty', `${sup.warranty_months || 'N/A'} months`, yPos)
      
      if (sup.payment_terms) {
        yPos = addMultilineValue(doc, 'Payment Terms', sup.payment_terms, yPos)
      }
      
      if (sup.notes) {
        yPos = addMultilineValue(doc, 'Notes', sup.notes, yPos)
      }
      
      yPos += 3
      yPos = checkAndAddPage(doc, yPos, 40)
    }
  }
  
  // ===== PARTNERSHIPS SECTION =====
  if (partnerships.length > 0) {
    yPos = addSectionTitle(doc, 'Partnerships', yPos)
    yPos += 5
    
    for (let i = 0; i < partnerships.length; i++) {
      const partner = partnerships[i]
      
      yPos = addSubsectionTitle(doc, partner.partner_name, yPos)
      yPos += 2
      
      yPos = addValue(doc, 'Type', partner.partnership_type, yPos)
      yPos = addValue(doc, 'Status', partner.partnership_status, yPos)
      yPos = addValue(doc, 'Contact Person', partner.contact_person, yPos)
      yPos = addValue(doc, 'Email', partner.email, yPos)
      yPos = addValue(doc, 'Phone', partner.phone, yPos)
      
      if (partner.city || partner.country) {
        yPos = addValue(doc, 'Location', `${partner.city || ''}, ${partner.country || ''}`, yPos)
      }
      
      if (partner.start_date || partner.end_date) {
        yPos = addTwoColumnValues(doc, 'Start Date', partner.start_date, 'End Date', partner.end_date, yPos)
      }
      
      if (partner.revenue_share_percentage || partner.investment_amount_usd) {
        yPos = addTwoColumnValues(
          doc,
          'Revenue Share',
          `${partner.revenue_share_percentage || 0}%`,
          'Investment',
          `$${(partner.investment_amount_usd || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
          yPos
        )
      }
      
      yPos = addValue(doc, 'Contract Duration', `${partner.contract_duration_months || 'N/A'} months`, yPos)
      
      if (partner.key_terms) {
        yPos = addMultilineValue(doc, 'Key Terms', partner.key_terms, yPos)
      }
      
      if (partner.notes) {
        yPos = addMultilineValue(doc, 'Notes', partner.notes, yPos)
      }
      
      yPos += 3
      yPos = checkAndAddPage(doc, yPos, 40)
    }
  }
  
  // ===== FINANCIAL SUMMARY =====
  yPos = addSectionTitle(doc, 'Financial Summary', yPos)
  yPos += 5
  
  if (costs.length > 0) {
    yPos = addSubsectionTitle(doc, 'Project Costs by Category', yPos)
    yPos += 2
    
    const costHeaders = ['Category', 'Budgeted Amount', '% of Total']
    const costRows = costs.map(c => [
      c.cost_category,
      `$${(c.budgeted_amount_usd || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
      `${c.percentage_of_total || 0}%`
    ])
    
    yPos = addTable(doc, costHeaders, costRows, yPos)
    yPos = checkAndAddPage(doc, yPos, 40)
  }
  
  // ===== REVENUE PROJECTIONS =====
  if (revenues.length > 0) {
    yPos = addSectionTitle(doc, 'Revenue Projections', yPos)
    yPos += 5
    
    const revenueHeaders = ['Product Type', 'Annual Volume', 'Unit Price', 'Annual Revenue', 'Year']
    const revenueRows = revenues.map(r => [
      r.product_type || '',
      `${(r.projected_annual_volume || 0).toLocaleString('en-US', { minimumFractionDigits: 0 })} ${r.volume_unit || 'units'}`,
      `$${(r.unit_price_usd || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
      `$${(r.projected_annual_revenue_usd || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
      `Year ${r.year_number || ''}`
    ])
    
    yPos = addTable(doc, revenueHeaders, revenueRows, yPos)
    yPos = checkAndAddPage(doc, yPos, 40)
  }
  
  // ===== PRODUCTION CAPACITY =====
  if (production.length > 0) {
    yPos = addSectionTitle(doc, 'Production Capacity', yPos)
    yPos += 5
    
    for (let i = 0; i < production.length; i++) {
      const prod = production[i]
      
      yPos = addSubsectionTitle(doc, prod.phase_name, yPos)
      yPos += 2
      
      yPos = addValue(doc, 'Product Type', prod.product_type, yPos)
      yPos = addValue(doc, 'Capacity per Year', `${(prod.capacity_per_year || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} ${prod.capacity_unit || 'units'}`, yPos)
      yPos = addValue(doc, 'Utilization Target', `${prod.utilization_percentage || 80}%`, yPos)
      yPos = addValue(doc, 'Effective Annual Output', `${(prod.effective_annual_output || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} ${prod.capacity_unit || 'units'}`, yPos)
      
      if (prod.phase_start_date || prod.phase_end_date) {
        yPos = addTwoColumnValues(doc, 'Start Date', prod.phase_start_date, 'End Date', prod.phase_end_date, yPos)
      }
      
      if (prod.notes) {
        yPos = addMultilineValue(doc, 'Notes', prod.notes, yPos)
      }
      
      yPos += 3
      yPos = checkAndAddPage(doc, yPos, 40)
    }
  }
  
  // ===== MILESTONES =====
  if (milestones.length > 0) {
    yPos = addSectionTitle(doc, 'Project Milestones', yPos)
    yPos += 5
    
    const milestoneHeaders = ['Milestone', 'Type', 'Planned Date', 'Status', 'Progress']
    const milestoneRows = milestones.map(m => [
      m.milestone_name || '',
      m.milestone_type || '',
      m.planned_date || '',
      m.status || '',
      `${m.progress_percentage || 0}%`
    ])
    
    yPos = addTable(doc, milestoneHeaders, milestoneRows, yPos)
    yPos = checkAndAddPage(doc, yPos, 40)
  }
  
  // ===== RISK ASSESSMENT =====
  if (risks.length > 0) {
    yPos = addSectionTitle(doc, 'Risk Assessment', yPos)
    yPos += 5
    
    const riskHeaders = ['Risk Category', 'Description', 'Probability', 'Impact', 'Status']
    const riskRows = risks.map(r => [
      r.risk_category || '',
      (r.risk_description || '').substring(0, 30) + '...',
      `${r.probability_percentage || 0}%`,
      r.impact_severity || '',
      r.status || ''
    ])
    
    yPos = addTable(doc, riskHeaders, riskRows, yPos)
    yPos = checkAndAddPage(doc, yPos, 40)
  }
  
  // ===== FOOTER =====
  doc.setFontSize(8)
  doc.setTextColor(...COLORS.textLight)
  doc.text(`Generated on ${new Date().toLocaleDateString()}`, 20, pageHeight - 10)
  doc.text(`Project: ${project.name}`, pageWidth - 60, pageHeight - 10)
  
  return doc
}
