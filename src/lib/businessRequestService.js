import { supabase } from './supabaseClient'

export const businessRequestService = {
  // ===== GET BUSINESSES =====
  async getAllBusinesses(limit = 50, offset = 0) {
    try {
      const { data, error, count } = await supabase
        .from('businesses')
        .select(`
          id,
          business_name,
          registration_type,
          currency_registration_number,
          city_of_registration,
          status,
          metadata,
          user_id,
          created_at
        `, { count: 'exact' })
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)

      if (error) throw error
      return { data: data || [], count: count || 0, error: null }
    } catch (err) {
      const errorMsg = err?.message || JSON.stringify(err)
      console.error('[businessRequestService] getAllBusinesses failed:', errorMsg)
      return { data: [], count: 0, error: err }
    }
  },

  async getBusinessDetails(businessId) {
    try {
      const { data, error } = await supabase
        .from('businesses')
        .select(`
          id,
          business_name,
          registration_type,
          currency_registration_number,
          city_of_registration,
          status,
          tin,
          metadata,
          user_id,
          created_at
        `)
        .eq('id', businessId)
        .single()

      if (error) throw error
      return { data, error: null }
    } catch (err) {
      const errorMsg = err?.message || JSON.stringify(err)
      console.error('[businessRequestService] getBusinessDetails failed:', errorMsg)
      return { data: null, error: err }
    }
  },

  // ===== SUBMIT BUSINESS REQUEST =====
  async submitBusinessRequest(businessId, requestData) {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) throw new Error('User not authenticated')

      const { data, error } = await supabase
        .from('business_requests')
        .insert([{
          business_id: businessId,
          requesting_user_id: user.id,
          occupation: requestData.occupation,
          requested_salary: parseFloat(requestData.requestedSalary) || null,
          salary_currency: requestData.salaryCurrency || 'PHP',
          skills: requestData.skills || [],
          resume_text: requestData.resumeText || null,
          resume_file_url: requestData.resumeFileUrl || null,
          message: requestData.message || null,
          availability_date: requestData.availabilityDate || null,
          status: 'pending',
          created_at: new Date().toISOString()
        }])
        .select()
        .single()

      if (error) throw error
      return { data, error: null }
    } catch (err) {
      const errorMsg = err?.message || JSON.stringify(err)
      console.error('[businessRequestService] submitBusinessRequest failed:', errorMsg)
      return { data: null, error: err }
    }
  },

  // ===== GET USER'S REQUESTS =====
  async getUserRequests(userId, status = null) {
    try {
      let query = supabase
        .from('business_requests')
        .select(`
          id,
          business_id,
          occupation,
          requested_salary,
          salary_currency,
          status,
          created_at,
          updated_at,
          businesses:business_id (
            id,
            business_name,
            currency_registration_number,
            city_of_registration
          )
        `)
        .eq('requesting_user_id', userId)

      if (status) {
        query = query.eq('status', status)
      }

      const { data, error } = await query.order('created_at', { ascending: false })

      if (error) throw error
      return { data: data || [], error: null }
    } catch (err) {
      const errorMsg = err?.message || JSON.stringify(err)
      console.error('[businessRequestService] getUserRequests failed:', errorMsg)
      return { data: [], error: err }
    }
  },

  // ===== GET BUSINESS REQUESTS =====
  async getBusinessRequests(businessId, status = null) {
    try {
      let query = supabase
        .from('business_requests')
        .select(`
          id,
          requesting_user_id,
          occupation,
          requested_salary,
          salary_currency,
          skills,
          resume_text,
          message,
          availability_date,
          status,
          created_at,
          updated_at
        `)
        .eq('business_id', businessId)

      if (status) {
        query = query.eq('status', status)
      }

      const { data, error } = await query.order('created_at', { ascending: false })

      if (error) throw error
      return { data: data || [], error: null }
    } catch (err) {
      const errorMsg = err?.message || JSON.stringify(err)
      console.error('[businessRequestService] getBusinessRequests failed:', errorMsg)
      return { data: [], error: err }
    }
  },

  // ===== UPDATE REQUEST STATUS =====
  async updateRequestStatus(requestId, newStatus) {
    try {
      const { data, error } = await supabase
        .from('business_requests')
        .update({
          status: newStatus,
          updated_at: new Date().toISOString(),
          reviewed_at: newStatus !== 'pending' ? new Date().toISOString() : null
        })
        .eq('id', requestId)
        .select()
        .single()

      if (error) throw error
      return { data, error: null }
    } catch (err) {
      const errorMsg = err?.message || JSON.stringify(err)
      console.error('[businessRequestService] updateRequestStatus failed:', errorMsg)
      return { data: null, error: err }
    }
  },

  // ===== WITHDRAW REQUEST =====
  async withdrawRequest(requestId) {
    try {
      const { data, error } = await supabase
        .from('business_requests')
        .update({
          status: 'withdrawn',
          updated_at: new Date().toISOString()
        })
        .eq('id', requestId)
        .select()
        .single()

      if (error) throw error
      return { data, error: null }
    } catch (err) {
      const errorMsg = err?.message || JSON.stringify(err)
      console.error('[businessRequestService] withdrawRequest failed:', errorMsg)
      return { data: null, error: err }
    }
  },

  // ===== SUBMIT RESPONSE =====
  async submitResponse(requestId, businessId, responseData) {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) throw new Error('User not authenticated')

      const { data, error } = await supabase
        .from('business_request_responses')
        .insert([{
          request_id: requestId,
          business_id: businessId,
          responding_user_id: user.id,
          response_status: responseData.responseStatus,
          response_message: responseData.responseMessage || null,
          offered_salary: responseData.offeredSalary ? parseFloat(responseData.offeredSalary) : null,
          offered_position: responseData.offeredPosition || null,
          created_at: new Date().toISOString()
        }])
        .select()
        .single()

      if (error) throw error

      // Update request status to 'reviewed'
      await this.updateRequestStatus(requestId, 'reviewed')

      return { data, error: null }
    } catch (err) {
      const errorMsg = err?.message || JSON.stringify(err)
      console.error('[businessRequestService] submitResponse failed:', errorMsg)
      return { data: null, error: err }
    }
  },

  // ===== GET RESPONSES FOR REQUEST =====
  async getResponsesForRequest(requestId) {
    try {
      const { data, error } = await supabase
        .from('business_request_responses')
        .select('*')
        .eq('request_id', requestId)
        .order('created_at', { ascending: false })

      if (error) throw error
      return { data: data || [], error: null }
    } catch (err) {
      const errorMsg = err?.message || JSON.stringify(err)
      console.error('[businessRequestService] getResponsesForRequest failed:', errorMsg)
      return { data: [], error: err }
    }
  }
}
