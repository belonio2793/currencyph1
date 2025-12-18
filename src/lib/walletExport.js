import jsPDF from 'jspdf'

export const walletExport = {
  // Export wallet data to PDF
  exportToPDF(wallet, transactions, stats) {
    const doc = new jsPDF()
    let yPosition = 20

    // Title
    doc.setFontSize(20)
    doc.text(`Wallet Report - ${wallet.currency_code}`, 20, yPosition)
    yPosition += 15

    // Generated date
    doc.setFontSize(10)
    doc.setTextColor(100, 100, 100)
    doc.text(`Generated: ${new Date().toLocaleString()}`, 20, yPosition)
    yPosition += 10

    // Wallet Information Section
    doc.setFontSize(14)
    doc.setTextColor(0, 0, 0)
    doc.text('Wallet Information', 20, yPosition)
    yPosition += 10

    const walletInfo = [
      { label: 'Currency Code', value: wallet.currency_code },
      { label: 'Currency Name', value: wallet.currency_name },
      { label: 'Type', value: wallet.currency_type },
      { label: 'Account Number', value: wallet.account_number || 'N/A' },
      { label: 'Status', value: wallet.is_active ? 'Active' : 'Inactive' },
      { label: 'Created', value: wallet.created_at ? new Date(wallet.created_at).toLocaleDateString() : 'N/A' }
    ]

    doc.setFontSize(10)
    walletInfo.forEach(info => {
      doc.text(`${info.label}:`, 25, yPosition)
      doc.text(info.value.toString(), 100, yPosition)
      yPosition += 7
    })
    yPosition += 5

    // Balance Information Section
    doc.setFontSize(14)
    doc.setTextColor(0, 0, 0)
    doc.text('Balance Information', 20, yPosition)
    yPosition += 10

    const balanceInfo = [
      { label: 'Current Balance', value: wallet.balance.toFixed(8) },
      { label: 'Total Deposited', value: wallet.total_deposited.toFixed(8) },
      { label: 'Total Withdrawn', value: wallet.total_withdrawn.toFixed(8) }
    ]

    doc.setFontSize(10)
    balanceInfo.forEach(info => {
      doc.text(`${info.label}:`, 25, yPosition)
      doc.text(info.value, 100, yPosition)
      yPosition += 7
    })

    // Statistics Section
    if (stats) {
      yPosition += 5
      doc.setFontSize(14)
      doc.setTextColor(0, 0, 0)
      doc.text('Statistics', 20, yPosition)
      yPosition += 10

      const statsInfo = [
        { label: 'Total Transactions', value: stats.transactionCount || 0 },
        { label: 'Deposits', value: stats.depositCount || 0 },
        { label: 'Withdrawals', value: stats.withdrawalCount || 0 },
        { label: 'Largest Deposit', value: (stats.largestDeposit || 0).toFixed(8) },
        { label: 'Largest Withdrawal', value: (stats.largestWithdrawal || 0).toFixed(8) }
      ]

      doc.setFontSize(10)
      statsInfo.forEach(info => {
        doc.text(`${info.label}:`, 25, yPosition)
        doc.text(info.value.toString(), 100, yPosition)
        yPosition += 7
      })
    }

    // Transactions Table
    if (transactions && transactions.length > 0) {
      // Check if we need a new page
      if (yPosition > 250) {
        doc.addPage()
        yPosition = 20
      }

      yPosition += 10
      doc.setFontSize(14)
      doc.setTextColor(0, 0, 0)
      doc.text('Transaction History', 20, yPosition)
      yPosition += 10

      // Table header
      doc.setFontSize(9)
      doc.setTextColor(50, 50, 50)
      const tableTop = yPosition

      // Column widths
      const colWidths = {
        date: 35,
        type: 25,
        amount: 30,
        description: 60
      }

      // Headers
      let xPos = 20
      doc.text('Date', xPos, tableTop)
      xPos += colWidths.date
      doc.text('Type', xPos, tableTop)
      xPos += colWidths.type
      doc.text('Amount', xPos, tableTop)
      xPos += colWidths.amount
      doc.text('Description', xPos, tableTop)

      yPosition = tableTop + 7

      // Table rows
      transactions.slice(0, 20).forEach(tx => {
        if (yPosition > 280) {
          doc.addPage()
          yPosition = 20
        }

        const date = new Date(tx.created_at).toLocaleDateString()
        const type = tx.type
        const amount = (tx.amount || 0).toFixed(8)
        const description = (tx.description || '').substring(0, 30)

        doc.setTextColor(0, 0, 0)
        xPos = 20
        doc.text(date, xPos, yPosition, { maxWidth: colWidths.date })
        xPos += colWidths.date
        doc.text(type, xPos, yPosition, { maxWidth: colWidths.type })
        xPos += colWidths.type
        doc.text(amount, xPos, yPosition, { maxWidth: colWidths.amount })
        xPos += colWidths.amount
        doc.text(description, xPos, yPosition, { maxWidth: colWidths.description })

        yPosition += 7
      })

      if (transactions.length > 20) {
        yPosition += 5
        doc.setFontSize(8)
        doc.setTextColor(150, 150, 150)
        doc.text(`... and ${transactions.length - 20} more transactions`, 20, yPosition)
      }
    }

    // Save PDF
    doc.save(`wallet_${wallet.currency_code}_${new Date().toISOString().split('T')[0]}.pdf`)
  },

  // Generate wallet summary report
  generateSummaryReport(wallets) {
    const lines = []

    lines.push('Wallet Summary Report')
    lines.push(`Generated: ${new Date().toLocaleString()}`)
    lines.push('')
    lines.push('SUMMARY')
    lines.push(`Total Wallets,${wallets.length}`)
    lines.push(`Active Wallets,${wallets.filter(w => w.is_active).length}`)
    lines.push(`Fiat Wallets,${wallets.filter(w => w.currency_type === 'fiat').length}`)
    lines.push(`Crypto Wallets,${wallets.filter(w => w.currency_type === 'crypto').length}`)
    lines.push('')

    lines.push('WALLET LIST')
    lines.push('Currency Code,Currency Name,Type,Balance,Total Deposited,Total Withdrawn,Status,Account Number')

    wallets.forEach(w => {
      lines.push(`${w.currency_code},${w.currency_name},${w.currency_type},${w.balance},${w.total_deposited},${w.total_withdrawn},${w.is_active ? 'Active' : 'Inactive'},${w.account_number || 'N/A'}`)
    })

    const csv = lines.join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `wallet_summary_${new Date().toISOString().split('T')[0]}.csv`
    link.click()
    URL.revokeObjectURL(link.href)
  }
}
