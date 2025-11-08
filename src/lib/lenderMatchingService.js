import { supabase } from './supabaseClient'
import { p2pLoanService } from './p2pLoanService'

export const lenderMatchingService = {
  /**
   * Find and rank the best matching lenders for a loan request
   * Scoring algorithm considers:
   * - Lender rating (0-5 stars)
   * - Completion rate (success rate)
   * - Loan amount capacity
   * - Payment method compatibility
   * - Verification status
   * - Geographic proximity (if applicable)
   */
  async findBestMatches(loanRequest, limit = 20) {
    try {
      // Get all verified lenders with profiles
      const { data: lenders, error } = await supabase
        .from('lender_profile_summary')
        .select('*')
        .eq('is_verified', true)
        .gt('rating', 0)
        .order('rating', { ascending: false })
        .limit(100)

      if (error) throw error

      // Score each lender
      const scoredLenders = (lenders || []).map(lender => {
        return {
          ...lender,
          matchScore: this.calculateMatchScore(lender, loanRequest),
          breakdown: this.getScoreBreakdown(lender, loanRequest)
        }
      })

      // Sort by match score descending
      const ranked = scoredLenders
        .sort((a, b) => b.matchScore - a.matchScore)
        .slice(0, limit)

      return ranked
    } catch (err) {
      console.error('Error finding matching lenders:', err)
      throw err
    }
  },

  /**
   * Calculate match score (0-100) based on multiple factors
   */
  calculateMatchScore(lender, loanRequest) {
    let score = 0
    const weights = {
      rating: 0.35,           // 35% - Lender rating
      completion: 0.25,       // 25% - Success rate
      verification: 0.15,     // 15% - Verification status
      experience: 0.15,       // 15% - Loan count
      paymentMethod: 0.10     // 10% - Payment method match
    }

    // Rating score (0-100)
    const ratingScore = (lender.rating || 0) * 20 // 5 stars = 100 points
    score += ratingScore * weights.rating

    // Completion rate score
    const totalLoans = (lender.completed_loans_count || 0) + (lender.defaulted_loans_count || 0)
    const completionRate = totalLoans > 0
      ? (lender.completed_loans_count || 0) / totalLoans * 100
      : 50 // Default 50% for new lenders
    score += completionRate * weights.completion

    // Verification bonus
    if (lender.is_verified) {
      score += 100 * weights.verification
    }

    // Experience bonus (logarithmic - more weight to early loans)
    const experienceScore = Math.min(
      Math.log(Math.max(lender.completed_loans_count || 1, 1)) * 20,
      100
    )
    score += experienceScore * weights.experience

    // Payment method match (if specified)
    if (loanRequest.preferred_payment_methods) {
      const requestMethods = loanRequest.preferred_payment_methods
        .split(',')
        .map(m => m.trim().toLowerCase())
      
      if (lender.preferred_payment_methods) {
        const lenderMethods = lender.preferred_payment_methods
          .split(',')
          .map(m => m.trim().toLowerCase())
        
        const methodMatch = requestMethods.some(m => lenderMethods.includes(m))
        if (methodMatch) {
          score += 100 * weights.paymentMethod
        }
      }
    }

    return Math.min(score, 100)
  },

  /**
   * Get detailed score breakdown for transparency
   */
  getScoreBreakdown(lender, loanRequest) {
    const totalLoans = (lender.completed_loans_count || 0) + (lender.defaulted_loans_count || 0)
    const completionRate = totalLoans > 0
      ? ((lender.completed_loans_count || 0) / totalLoans * 100).toFixed(1)
      : 'N/A'

    return {
      rating: {
        score: (lender.rating || 0) * 20,
        label: `${lender.rating || 0}/5 stars`,
        weight: 0.35
      },
      completionRate: {
        score: completionRate,
        label: `${completionRate}% success rate`,
        weight: 0.25
      },
      verification: {
        score: lender.is_verified ? 100 : 0,
        label: lender.is_verified ? 'Verified' : 'Unverified',
        weight: 0.15
      },
      experience: {
        score: lender.completed_loans_count || 0,
        label: `${lender.completed_loans_count || 0} completed loans`,
        weight: 0.15
      }
    }
  },

  /**
   * Get recommended lenders for a specific borrower
   * Takes into account previous interactions and borrower profile
   */
  async getRecommendedLendersForBorrower(borrowerId, limit = 10) {
    try {
      // Get borrower's loan history
      const { data: borrowerLoans } = await supabase
        .from('loans')
        .select('lender_id, status, created_at')
        .eq('user_id', borrowerId)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(5)

      // Get lenders this borrower has successfully worked with
      const previousLenderIds = (borrowerLoans || [])
        .map(l => l.lender_id)
        .filter(Boolean)

      // Get top-rated lenders
      const { data: topLenders } = await supabase
        .from('lender_profile_summary')
        .select('*')
        .eq('is_verified', true)
        .order('rating', { ascending: false })
        .limit(limit)

      // Score lenders, prioritizing those with previous successful transactions
      const scored = (topLenders || []).map(lender => ({
        ...lender,
        isPreviousLender: previousLenderIds.includes(lender.user_id),
        score: previousLenderIds.includes(lender.user_id) 
          ? (lender.rating || 0) + 0.5  // Bonus for previous lenders
          : (lender.rating || 0)
      }))

      return scored
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
    } catch (err) {
      console.error('Error getting recommended lenders:', err)
      throw err
    }
  },

  /**
   * Get lenders with similar preferences to a borrower
   */
  async findLendersWithMatchingPreferences(borrowerId, limit = 10) {
    try {
      // Get borrower's loan requests to infer preferences
      const { data: borrowerLoans } = await supabase
        .from('loans')
        .select('currency_code, city, payment_method, created_at')
        .eq('user_id', borrowerId)
        .limit(5)

      if (!borrowerLoans || borrowerLoans.length === 0) {
        return await this.findBestMatches({}, limit)
      }

      // Extract preferences
      const currencies = [...new Set((borrowerLoans || []).map(l => l.currency_code))]
      const cities = [...new Set((borrowerLoans || []).map(l => l.city).filter(Boolean))]
      const paymentMethods = [...new Set((borrowerLoans || []).map(l => l.payment_method).filter(Boolean))]

      // Find lenders matching these preferences
      let query = supabase
        .from('lender_profile_summary')
        .select('*')
        .eq('is_verified', true)

      if (currencies.length > 0) {
        query = query.in('preferred_loan_currency', currencies)
      }

      const { data: matchedLenders } = await query
        .order('rating', { ascending: false })
        .limit(limit)

      return matchedLenders || []
    } catch (err) {
      console.error('Error finding preference-matched lenders:', err)
      throw err
    }
  },

  /**
   * Calculate compatibility score between a specific lender and borrower
   */
  async calculateLenderBorrowerCompatibility(lenderId, borrowerId) {
    try {
      const [lender, borrower] = await Promise.all([
        supabase.from('lender_profile_summary').select('*').eq('user_id', lenderId).single(),
        supabase.from('loans').select('*').eq('user_id', borrowerId).limit(10)
      ])

      if (lender.error || borrower.error) throw lender.error || borrower.error

      const borrowerLoans = borrower.data || []
      
      // Check previous transactions
      const hasPreviousTransaction = borrowerLoans.some(l => l.lender_id === lenderId)
      const successRate = borrowerLoans.filter(l => l.status === 'completed').length / Math.max(borrowerLoans.length, 1)

      return {
        compatibility: {
          hasPreviousTransaction,
          borrowerSuccessRate: (successRate * 100).toFixed(1),
          lenderRating: lender.data.rating,
          recommendation: this.getCompatibilityRecommendation(
            hasPreviousTransaction,
            successRate,
            lender.data.rating
          )
        }
      }
    } catch (err) {
      console.error('Error calculating compatibility:', err)
      throw err
    }
  },

  /**
   * Get text recommendation based on compatibility metrics
   */
  getCompatibilityRecommendation(hasPrevious, borrowerSuccess, lenderRating) {
    if (hasPrevious) return 'Tried before'
    if (borrowerSuccess >= 0.8 && lenderRating >= 4) return 'Excellent match'
    if (borrowerSuccess >= 0.6 && lenderRating >= 3.5) return 'Good match'
    if (lenderRating >= 4) return 'Highly rated lender'
    return 'Potential match'
  }
}
