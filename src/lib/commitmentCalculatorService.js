/**
 * Commitment Calculator Service
 * Handles all calculations for commitments, costs, and commissions
 */

export const ITEM_TYPES = [
  'Coconut',
  'Equipment',
  'Machinery',
  'Warehouse Space',
  'Labour',
  'Water',
  'Processing',
  'Transportation',
  'Retail Space',
  'Other'
];

export const QUANTITY_UNITS = [
  'Pieces',
  'Tons',
  'Liters',
  'Kilograms',
  'Hours',
  'Square Meters',
  'Units',
  'Bags',
  'Barrels',
  'Crates',
  'Other'
];

export const SCHEDULE_INTERVALS = [
  { value: 'daily', label: 'Daily', multiplier: 365 },
  { value: 'weekly', label: 'Weekly', multiplier: 52 },
  { value: 'bi-weekly', label: 'Bi-weekly', multiplier: 26 },
  { value: 'monthly', label: 'Monthly', multiplier: 12 },
  { value: 'quarterly', label: 'Quarterly', multiplier: 4 },
  { value: 'annual', label: 'Annual', multiplier: 1 },
  { value: 'as-needed', label: 'As Needed', multiplier: 0 },
  { value: 'one-time', label: 'One Time', multiplier: 1 }
];

export const BUSINESS_TYPES = [
  'Farmer',
  'Vendor',
  'Wholesaler',
  'Retailer',
  'Processor',
  'Exporter',
  'Service Provider',
  'Equipment Supplier',
  'Logistics',
  'Other'
];

// Cost estimation rules based on item type and requirements
const COST_ESTIMATION_RULES = {
  'Coconut': {
    baseDeliveryPerTon: 500,
    baseHandlingPerTon: 300,
    baseShippingPerTon: 1000
  },
  'Equipment': {
    baseDeliveryPerUnit: 2000,
    baseHandlingPerUnit: 500,
    baseShippingPerUnit: 3000
  },
  'Machinery': {
    baseDeliveryPerUnit: 5000,
    baseHandlingPerUnit: 1500,
    baseShippingPerUnit: 8000
  },
  'Warehouse Space': {
    baseDeliveryPerSqm: 100,
    baseHandlingPerSqm: 50,
    baseShippingPerSqm: 150
  },
  'Labour': {
    baseDeliveryPerHour: 0,
    baseHandlingPerHour: 0,
    baseShippingPerHour: 0
  },
  'Water': {
    baseDeliveryPerLiter: 5,
    baseHandlingPerLiter: 2,
    baseShippingPerLiter: 8
  },
  'Processing': {
    baseDeliveryPerUnit: 500,
    baseHandlingPerUnit: 300,
    baseShippingPerUnit: 1000
  },
  'Transportation': {
    baseDeliveryPerUnit: 0,
    baseHandlingPerUnit: 0,
    baseShippingPerUnit: 0
  },
  'Retail Space': {
    baseDeliveryPerSqm: 200,
    baseHandlingPerSqm: 100,
    baseShippingPerSqm: 300
  }
};

/**
 * Calculate total committed value
 * @param {number} quantity - Quantity committed
 * @param {number} unitPrice - Price per unit
 * @param {number} intervalCount - Number of intervals
 * @returns {number} Total committed value
 */
export function calculateTotalCommittedValue(quantity, unitPrice, intervalCount = 1) {
  if (!quantity || !unitPrice) return 0;
  return quantity * unitPrice * intervalCount;
}

/**
 * Estimate delivery cost based on item type and quantity
 * @param {string} itemType - Type of item
 * @param {number} quantity - Quantity
 * @param {string} unit - Unit of measurement
 * @returns {number} Estimated delivery cost
 */
export function estimateDeliveryCost(itemType, quantity, unit) {
  if (!itemType || !quantity) return 0;
  
  const rules = COST_ESTIMATION_RULES[itemType] || {};
  let cost = 0;

  // Calculate based on unit type
  if (unit === 'Tons' && rules.baseDeliveryPerTon) {
    cost = quantity * rules.baseDeliveryPerTon;
  } else if (unit === 'Units' && rules.baseDeliveryPerUnit) {
    cost = quantity * rules.baseDeliveryPerUnit;
  } else if (unit === 'Square Meters' && rules.baseDeliveryPerSqm) {
    cost = quantity * rules.baseDeliveryPerSqm;
  } else if (unit === 'Liters' && rules.baseDeliveryPerLiter) {
    cost = quantity * rules.baseDeliveryPerLiter;
  } else if (unit === 'Hours' && rules.baseDeliveryPerHour) {
    cost = quantity * rules.baseDeliveryPerHour;
  } else {
    // Default: 10% of unit price if no specific rule
    cost = quantity * 10;
  }

  return Math.round(cost * 100) / 100;
}

/**
 * Estimate handling cost based on item type and quantity
 * @param {string} itemType - Type of item
 * @param {number} quantity - Quantity
 * @param {string} unit - Unit of measurement
 * @returns {number} Estimated handling cost
 */
export function estimateHandlingCost(itemType, quantity, unit) {
  if (!itemType || !quantity) return 0;
  
  const rules = COST_ESTIMATION_RULES[itemType] || {};
  let cost = 0;

  if (unit === 'Tons' && rules.baseHandlingPerTon) {
    cost = quantity * rules.baseHandlingPerTon;
  } else if (unit === 'Units' && rules.baseHandlingPerUnit) {
    cost = quantity * rules.baseHandlingPerUnit;
  } else if (unit === 'Square Meters' && rules.baseHandlingPerSqm) {
    cost = quantity * rules.baseHandlingPerSqm;
  } else if (unit === 'Liters' && rules.baseHandlingPerLiter) {
    cost = quantity * rules.baseHandlingPerLiter;
  } else if (unit === 'Hours' && rules.baseHandlingPerHour) {
    cost = quantity * rules.baseHandlingPerHour;
  } else {
    cost = quantity * 5;
  }

  return Math.round(cost * 100) / 100;
}

/**
 * Estimate shipping cost based on item type and quantity
 * @param {string} itemType - Type of item
 * @param {number} quantity - Quantity
 * @param {string} unit - Unit of measurement
 * @returns {number} Estimated shipping cost
 */
export function estimateShippingCost(itemType, quantity, unit) {
  if (!itemType || !quantity) return 0;
  
  const rules = COST_ESTIMATION_RULES[itemType] || {};
  let cost = 0;

  if (unit === 'Tons' && rules.baseShippingPerTon) {
    cost = quantity * rules.baseShippingPerTon;
  } else if (unit === 'Units' && rules.baseShippingPerUnit) {
    cost = quantity * rules.baseShippingPerUnit;
  } else if (unit === 'Square Meters' && rules.baseShippingPerSqm) {
    cost = quantity * rules.baseShippingPerSqm;
  } else if (unit === 'Liters' && rules.baseShippingPerLiter) {
    cost = quantity * rules.baseShippingPerLiter;
  } else if (unit === 'Hours' && rules.baseShippingPerHour) {
    cost = quantity * rules.baseShippingPerHour;
  } else {
    cost = quantity * 15;
  }

  return Math.round(cost * 100) / 100;
}

/**
 * Calculate total additional costs
 * @param {number} delivery - Delivery cost
 * @param {number} handling - Handling cost
 * @param {number} shipping - Shipping cost
 * @returns {number} Total additional costs
 */
export function calculateTotalAdditionalCosts(delivery, handling, shipping) {
  return (delivery || 0) + (handling || 0) + (shipping || 0);
}

/**
 * Calculate grand total
 * @param {number} committedValue - Total committed value
 * @param {number} additionalCosts - Total additional costs
 * @returns {number} Grand total
 */
export function calculateGrandTotal(committedValue, additionalCosts) {
  return committedValue + additionalCosts;
}

/**
 * Calculate affiliate commission
 * @param {number} grandTotal - Grand total amount
 * @param {number} commissionPercentage - Commission percentage (e.g., 50 for 50%)
 * @returns {number} Commission amount
 */
export function calculateAffiliateCommission(grandTotal, commissionPercentage = 50) {
  if (!grandTotal) return 0;
  return (grandTotal * commissionPercentage) / 100;
}

/**
 * Get interval multiplier for annualized calculations
 * @param {string} interval - Schedule interval
 * @returns {number} Multiplier to annualize the value
 */
export function getIntervalMultiplier(interval) {
  const found = SCHEDULE_INTERVALS.find(i => i.value === interval);
  return found ? found.multiplier : 1;
}

/**
 * Format currency value
 * @param {number} value - Value to format
 * @param {string} currency - Currency code (PHP, USD, etc.)
 * @returns {string} Formatted currency string
 */
export function formatCurrencyValue(value, currency = 'PHP') {
  const formatter = new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  return formatter.format(value || 0);
}

/**
 * Generate commitment summary
 * @param {object} commitment - Commitment data
 * @returns {object} Summary of commitment with all calculated values
 */
export function generateCommitmentSummary(commitment) {
  const {
    quantity = 0,
    unitPrice = 0,
    intervalCount = 1,
    itemType,
    quantityUnit,
    requiresDelivery = false,
    estimatedDeliveryCost = 0,
    requiresHandling = false,
    estimatedHandlingCost = 0,
    requiresShipping = false,
    estimatedShippingCost = 0,
    commissionPercentage = 50,
    currency = 'PHP'
  } = commitment;

  const committedValue = calculateTotalCommittedValue(quantity, unitPrice, intervalCount);
  
  let deliveryCost = 0;
  let handlingCost = 0;
  let shippingCost = 0;
  
  if (requiresDelivery) {
    deliveryCost = estimatedDeliveryCost || estimateDeliveryCost(itemType, quantity, quantityUnit);
  }
  
  if (requiresHandling) {
    handlingCost = estimatedHandlingCost || estimateHandlingCost(itemType, quantity, quantityUnit);
  }
  
  if (requiresShipping) {
    shippingCost = estimatedShippingCost || estimateShippingCost(itemType, quantity, quantityUnit);
  }

  const additionalCosts = calculateTotalAdditionalCosts(deliveryCost, handlingCost, shippingCost);
  const grandTotal = calculateGrandTotal(committedValue, additionalCosts);
  const commission = calculateAffiliateCommission(grandTotal, commissionPercentage);

  return {
    committedValue,
    deliveryCost,
    handlingCost,
    shippingCost,
    additionalCosts,
    grandTotal,
    commission,
    commissionPercentage,
    formattedCommittedValue: formatCurrencyValue(committedValue, currency),
    formattedDeliveryCost: formatCurrencyValue(deliveryCost, currency),
    formattedHandlingCost: formatCurrencyValue(handlingCost, currency),
    formattedShippingCost: formatCurrencyValue(shippingCost, currency),
    formattedAdditionalCosts: formatCurrencyValue(additionalCosts, currency),
    formattedGrandTotal: formatCurrencyValue(grandTotal, currency),
    formattedCommission: formatCurrencyValue(commission, currency)
  };
}
