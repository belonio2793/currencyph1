import React, { useState } from 'react'
import { currencyAPI } from './currencyAPI'

/**
 * Get exchange rate for PHP to USD based on user's geolocation
 * Falls back to standard rate if geolocation unavailable
 */
export async function getPhpToUsdRate() {
  try {
    const rates = await currencyAPI.getGlobalRates()
    if (rates && rates.PHP && rates.PHP.rate) {
      return 1 / rates.PHP.rate
    }
  } catch (err) {
    console.warn('Failed to fetch exchange rates:', err)
  }
  return 0.018
}

/**
 * Convert PHP to USD
 */
export function phpToUsd(phpAmount, exchangeRate) {
  if (!phpAmount || !exchangeRate) return 0
  return Number((phpAmount * exchangeRate).toFixed(2))
}

/**
 * Convert USD to PHP
 */
export function usdToPhp(usdAmount, exchangeRate) {
  if (!usdAmount || !exchangeRate) return 0
  return Number((usdAmount / exchangeRate).toFixed(2))
}

/**
 * Format currency value for display
 */
export function formatPhp(amount) {
  if (!amount && amount !== 0) return '₱0'
  return '₱' + Number(amount).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function formatUsd(amount) {
  if (!amount && amount !== 0) return '$0.00'
  return '$' + Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
