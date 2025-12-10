import { supabase } from './supabaseClient'

/**
 * Calculate shipping rates and fees for a port
 * Supports calculations by weight (kg), container (TEU), or cubic meters (CBM)
 */
export const portRateCalculator = {
  /**
   * Calculate total shipping cost for a given port and cargo details
   * @param {Object} port - Port object with rate fields
   * @param {Object} cargo - Cargo details { type: 'kg'|'teu'|'cbm', quantity: number, direction: 'import'|'export' }
   * @returns {Object} Detailed cost breakdown
   */
  calculateTotalCost(port, cargo) {
    if (!port || !cargo) return null

    const breakdown = {
      port_name: port.name,
      country: port.country_code,
      cargo_type: cargo.type,
      cargo_quantity: cargo.quantity,
      direction: cargo.direction || 'import'
    }

    // Base handling fee
    let handlingFee = 0
    switch (cargo.type) {
      case 'kg':
        handlingFee = (port.handling_fee_php_per_kg || 25) * cargo.quantity
        break
      case 'teu':
        handlingFee = (port.handling_fee_php_per_teu || 5000) * cargo.quantity
        break
      case 'cbm':
        handlingFee = (port.handling_fee_php_per_cbm || 500) * cargo.quantity
        break
      default:
        handlingFee = 0
    }

    breakdown.handling_fee = parseFloat(handlingFee.toFixed(2))

    // Documentation fee (usually per shipment, not per unit)
    breakdown.documentation_fee = parseFloat((port.documentation_fee_php || 2000).toFixed(2))

    // Port authority fee
    breakdown.port_authority_fee = parseFloat((port.port_authority_fee_php || 5000).toFixed(2))

    // Security fee
    breakdown.security_fee = parseFloat((port.security_fee_php || 1500).toFixed(2))

    // Customs clearance fee
    breakdown.customs_clearance_fee = parseFloat((port.customs_clearance_fee_php || 3000).toFixed(2))

    // Subtotal before surcharges
    const subtotal = breakdown.handling_fee + breakdown.documentation_fee + 
                     breakdown.port_authority_fee + breakdown.security_fee + 
                     breakdown.customs_clearance_fee

    breakdown.subtotal = parseFloat(subtotal.toFixed(2))

    // Apply surcharge based on direction
    const surchargePercentage = cargo.direction === 'export' 
      ? (port.export_surcharge_percentage || 5) 
      : (port.import_surcharge_percentage || 10)

    const surchargeAmount = subtotal * (surchargePercentage / 100)
    breakdown.surcharge_percentage = surchargePercentage
    breakdown.surcharge_amount = parseFloat(surchargeAmount.toFixed(2))

    // Final total
    breakdown.total = parseFloat((subtotal + surchargeAmount).toFixed(2))

    return breakdown
  },

  /**
   * Format cost breakdown for display
   */
  formatBreakdown(breakdown) {
    if (!breakdown) return ''

    const lines = [
      `📦 ${breakdown.cargo_quantity} ${breakdown.cargo_type.toUpperCase()}`,
      `🚢 ${breakdown.port_name} (${breakdown.country})`,
      `📊 Direction: ${breakdown.direction.toUpperCase()}`,
      '',
      'Fee Breakdown (PHP):',
      `  Handling: ₱${breakdown.handling_fee.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`,
      `  Documentation: ₱${breakdown.documentation_fee.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`,
      `  Port Authority: ₱${breakdown.port_authority_fee.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`,
      `  Security: ₱${breakdown.security_fee.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`,
      `  Customs: ₱${breakdown.customs_clearance_fee.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`,
      `─────────────────────`,
      `  Subtotal: ₱${breakdown.subtotal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`,
      `  Surcharge (${breakdown.surcharge_percentage}%): ₱${breakdown.surcharge_amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`,
      `═════════════════════`,
      `  TOTAL: ₱${breakdown.total.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`
    ]

    return lines.join('\n')
  },

  /**
   * Get default cargo for quick estimate
   */
  getDefaultCargo(type = 'teu') {
    const defaults = {
      kg: { type: 'kg', quantity: 1000, direction: 'import' },
      teu: { type: 'teu', quantity: 1, direction: 'import' },
      cbm: { type: 'cbm', quantity: 20, direction: 'import' }
    }
    return defaults[type] || defaults.teu
  },

  /**
   * Compare rates between two ports
   */
  comparePorts(port1, port2, cargo) {
    const cost1 = this.calculateTotalCost(port1, cargo)
    const cost2 = this.calculateTotalCost(port2, cargo)

    return {
      port1: { ...cost1, port_name: port1.name },
      port2: { ...cost2, port_name: port2.name },
      difference: parseFloat((cost2.total - cost1.total).toFixed(2)),
      cheaper_port: cost1.total < cost2.total ? port1.name : port2.name,
      savings_percentage: parseFloat(
        (Math.abs(cost2.total - cost1.total) / Math.max(cost1.total, cost2.total) * 100).toFixed(2)
      )
    }
  }
}
