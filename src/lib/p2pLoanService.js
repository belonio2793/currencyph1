import { supabase } from './supabaseClient'

export const p2pLoanService = {
  // ============================================================================
  // USER VERIFICATION
  // ============================================================================
  
  async submitVerification(userId, idType, idNumber, idImageUrl) {
    try {
      const { data, error } = await supabase
        .from('user_verifications')
        .insert({
          user_id: userId,
          id_type: idType,
          id_number: idNumber,
          id_image_url: idImageUrl,
          status: 'pending'
        })
        .select()
        .single()
      
      if (error) throw error
      return { success: true, data }
    } catch (err) {
      console.error('Error submitting verification:', err)
      throw err
    }
  },

  async getVerificationStatus(userId) {
    try {
      const { data, error } = await supabase
        .from('user_verifications')
        .select('*')
        .eq('user_id', userId)
        .single()

      if (error && error.code !== 'PGRST116' && error.code !== '42P01') throw error
      return data || null
    } catch (err) {
      // Silently handle errors - verification is optional
      return null
    }
  },

  // ============================================================================
  // LENDER PROFILES
  // ============================================================================

  async createOrUpdateLenderProfile(userId, profileData) {
    try {
      const { data, error } = await supabase
        .from('lender_profiles')
        .upsert({
          user_id: userId,
          ...profileData,
          updated_at: new Date()
        }, { onConflict: 'user_id' })
        .select()
        .single()
      
      if (error) throw error
      return { success: true, data }
    } catch (err) {
      console.error('Error updating lender profile:', err)
      throw err
    }
  },

  async getLenderProfile(userId) {
    try {
      const { data, error } = await supabase
        .from('lender_profile_summary')
        .select('*')
        .eq('user_id', userId)
        .single()

      if (error && error.code !== 'PGRST116' && error.code !== '42P01') throw error
      return data || null
    } catch (err) {
      // Silently handle errors - lender profile is optional
      return null
    }
  },

  async getLenderRatings(userId) {
    try {
      const { data, error } = await supabase
        .from('loan_ratings')
        .select('*')
        .eq('rated_user_id', userId)
        .eq('rating_type', 'lender_review')
        .order('created_at', { ascending: false })
        .limit(10)
      
      if (error) throw error
      return data || []
    } catch (err) {
      console.error('Error fetching lender ratings:', err)
      throw err
    }
  },

  async getTopLenders(limit = 10) {
    try {
      const { data, error } = await supabase
        .from('lender_profile_summary')
        .select('*')
        .eq('is_verified', true)
        .order('rating', { ascending: false })
        .limit(limit)
      
      if (error) throw error
      return data || []
    } catch (err) {
      console.error('Error fetching top lenders:', err)
      throw err
    }
  },

  // ============================================================================
  // LOAN OFFERS
  // ============================================================================

  async submitLoanOffer(loanRequestId, lenderId, offerData) {
    try {
      // Calculate platform fee if using platform facilitation
      let platformFeeAmount = 0
      if (offerData.use_platform_facilitation) {
        platformFeeAmount = (offerData.offered_amount * 0.10)
      }

      const { data, error } = await supabase
        .from('loan_offers')
        .insert({
          loan_request_id: loanRequestId,
          lender_id: lenderId,
          offered_amount: offerData.offered_amount,
          interest_rate: offerData.interest_rate,
          duration_days: offerData.duration_days,
          due_date: offerData.due_date,
          repayment_schedule: offerData.repayment_schedule,
          payment_method: offerData.payment_method,
          use_platform_facilitation: offerData.use_platform_facilitation || false,
          platform_fee_amount: platformFeeAmount,
          status: 'pending'
        })
        .select()
        .single()
      
      if (error) throw error
      return { success: true, data }
    } catch (err) {
      console.error('Error submitting loan offer:', err)
      throw err
    }
  },

  async getOffersForRequest(loanRequestId) {
    try {
      const { data, error } = await supabase
        .from('loan_offers')
        .select(`
          *,
          lender:lender_id (
            id, email, 
            lender_profiles (
              rating, total_rating_count, completed_loans_count, is_verified, profile_image_url
            )
          )
        `)
        .eq('loan_request_id', loanRequestId)
        .order('created_at', { ascending: false })
      
      if (error) throw error
      return data || []
    } catch (err) {
      console.error('Error fetching loan offers:', err)
      throw err
    }
  },

  async acceptLoanOffer(offerId, borrowerId) {
    try {
      // Get the offer details
      const { data: offer, error: offerError } = await supabase
        .from('loan_offers')
        .select('*')
        .eq('id', offerId)
        .single()
      
      if (offerError) throw offerError

      // Update offer status to accepted
      const { data: updatedOffer, error: acceptError } = await supabase
        .from('loan_offers')
        .update({
          status: 'accepted',
          accepted_at: new Date()
        })
        .eq('id', offerId)
        .select()
        .single()
      
      if (acceptError) throw acceptError

      // Update the loan with lender and terms
      const { data: updatedLoan, error: loanError } = await supabase
        .from('loans')
        .update({
          lender_id: offer.lender_id,
          status: 'active',
          interest_rate: offer.interest_rate,
          due_date: offer.due_date,
          original_due_date: offer.due_date,
          duration_days: offer.duration_days,
          repayment_schedule: offer.repayment_schedule,
          payment_method: offer.payment_method,
          platform_fee_applied: offer.use_platform_facilitation,
          platform_fee_amount: offer.platform_fee_amount,
          total_owed: offer.offered_amount * (1 + (offer.interest_rate / 100))
        })
        .eq('id', offer.loan_request_id)
        .select()
        .single()
      
      if (loanError) throw loanError

      // Reject all other offers for this loan request
      await supabase
        .from('loan_offers')
        .update({ status: 'rejected' })
        .eq('loan_request_id', offer.loan_request_id)
        .neq('id', offerId)

      return { success: true, offer: updatedOffer, loan: updatedLoan }
    } catch (err) {
      console.error('Error accepting loan offer:', err)
      throw err
    }
  },

  async rejectLoanOffer(offerId) {
    try {
      const { data, error } = await supabase
        .from('loan_offers')
        .update({ status: 'rejected' })
        .eq('id', offerId)
        .select()
        .single()
      
      if (error) throw error
      return { success: true, data }
    } catch (err) {
      console.error('Error rejecting loan offer:', err)
      throw err
    }
  },

  // ============================================================================
  // MATCHING ALGORITHM - Find best lenders for a loan request
  // ============================================================================

  async findMatchingLenders(loanRequestData) {
    try {
      let query = supabase
        .from('lender_profile_summary')
        .select('*')
        .eq('is_verified', true)
        .gt('rating', 2.0) // Minimum 2.0 rating

      // Filter by preferred currency if specified
      if (loanRequestData.preferred_payment_methods) {
        const methods = loanRequestData.preferred_payment_methods.split(',')
        query = query.filter('preferred_payment_methods', 'cs', methods.join(','))
      }

      const { data, error } = await query
        .order('rating', { ascending: false })
        .order('completed_loans_count', { ascending: false })
        .limit(20)

      if (error) throw error

      // Score and rank lenders
      const scored = (data || []).map(lender => ({
        ...lender,
        match_score: (lender.rating * 0.5) + (Math.min(lender.completed_loans_count, 50) / 100 * 0.5)
      }))

      return scored.sort((a, b) => b.match_score - a.match_score)
    } catch (err) {
      console.error('Error finding matching lenders:', err)
      throw err
    }
  },

  // ============================================================================
  // LOAN RATINGS
  // ============================================================================

  async submitLoanRating(loanId, raterId, ratedUserId, ratingData) {
    try {
      const { data, error } = await supabase
        .from('loan_ratings')
        .insert({
          loan_id: loanId,
          rater_id: raterId,
          rated_user_id: ratedUserId,
          rating_score: ratingData.rating_score,
          review: ratingData.review,
          rating_type: ratingData.rating_type, // 'lender_review' or 'borrower_review'
          on_time_payment: ratingData.on_time_payment || true,
          communication_quality: ratingData.communication_quality || 3,
          trustworthiness: ratingData.trustworthiness || 3
        })
        .select()
        .single()
      
      if (error) throw error
      return { success: true, data }
    } catch (err) {
      console.error('Error submitting loan rating:', err)
      throw err
    }
  },

  // ============================================================================
  // PAYMENT SCHEDULES & PENALTIES
  // ============================================================================

  async createPaymentSchedule(loanId, scheduleData) {
    try {
      const { data, error } = await supabase
        .from('loan_payment_schedules')
        .insert(scheduleData)
        .select()
      
      if (error) throw error
      return { success: true, data }
    } catch (err) {
      console.error('Error creating payment schedule:', err)
      throw err
    }
  },

  async getPaymentSchedule(loanId) {
    try {
      const { data, error } = await supabase
        .from('loan_payment_schedules')
        .select('*')
        .eq('loan_id', loanId)
        .order('payment_number', { ascending: true })
      
      if (error) throw error
      return data || []
    } catch (err) {
      console.error('Error fetching payment schedule:', err)
      throw err
    }
  },

  async updatePaymentStatus(scheduleId, paymentData) {
    try {
      const { data, error } = await supabase
        .from('loan_payment_schedules')
        .update({
          status: paymentData.status,
          amount_paid: paymentData.amount_paid,
          paid_date: paymentData.paid_date,
          days_late: paymentData.days_late || 0,
          penalty_amount: paymentData.penalty_amount || 0
        })
        .eq('id', scheduleId)
        .select()
        .single()
      
      if (error) throw error
      return { success: true, data }
    } catch (err) {
      console.error('Error updating payment status:', err)
      throw err
    }
  },

  // ============================================================================
  // PLATFORM TRANSACTIONS
  // ============================================================================

  async recordPlatformTransaction(loanId, transactionType, amount, feeAmount) {
    try {
      const { data, error } = await supabase
        .from('platform_transactions')
        .insert({
          loan_id: loanId,
          transaction_type: transactionType,
          amount,
          fee_amount: feeAmount,
          status: 'completed'
        })
        .select()
        .single()
      
      if (error) throw error
      return { success: true, data }
    } catch (err) {
      console.error('Error recording platform transaction:', err)
      throw err
    }
  },

  // ============================================================================
  // LOAN REQUEST STATUS MANAGEMENT
  // ============================================================================

  async markLoanAsAgreed(loanId) {
    try {
      const { data, error } = await supabase
        .from('loans')
        .update({
          status: 'active',
          updated_at: new Date()
        })
        .eq('id', loanId)
        .select()
        .single()
      
      if (error) throw error
      return { success: true, data }
    } catch (err) {
      console.error('Error marking loan as agreed:', err)
      throw err
    }
  },

  async markLoanAsCompleted(loanId) {
    try {
      const { data, error } = await supabase
        .from('loans')
        .update({
          status: 'completed',
          completed_at: new Date(),
          updated_at: new Date()
        })
        .eq('id', loanId)
        .select()
        .single()
      
      if (error) throw error
      return { success: true, data }
    } catch (err) {
      console.error('Error marking loan as completed:', err)
      throw err
    }
  }
}
