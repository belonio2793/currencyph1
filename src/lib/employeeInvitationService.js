import { supabase } from './supabaseClient'

export const employeeInvitationService = {
  // =====================================================
  // JOB APPLICATIONS (replacing job invitations)
  // =====================================================

  async sendJobInvitation(businessId, invitedUserId, jobDetails) {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) throw new Error('User not authenticated')

      const { data, error } = await supabase
        .from('job_applications')
        .insert([{
          business_id: businessId,
          applicant_user_id: invitedUserId,
          job_title: jobDetails.job_title,
          job_description: jobDetails.job_description,
          job_category: jobDetails.job_category,
          pay_rate: jobDetails.pay_rate,
          pay_currency: jobDetails.pay_currency || 'PHP',
          pay_type: jobDetails.pay_type,
          job_type: jobDetails.job_type,
          cover_letter: jobDetails.message,
          status: 'submitted',
          submitted_at: new Date().toISOString()
        }])
        .select()
        .single()

      if (error) throw error
      return { data, error: null }
    } catch (err) {
      const errorMsg = err?.message || err?.code || 'Unknown error'
      console.error('[employeeInvitationService] sendJobInvitation failed:', errorMsg)
      return { data: null, error: err }
    }
  },

  async getPendingInvitations(userId) {
    try {
      const { data, error } = await supabase
        .from('job_applications')
        .select('*')
        .eq('applicant_user_id', userId)
        .eq('status', 'submitted')
        .order('submitted_at', { ascending: false })

      if (error) {
        const errorMsg = error?.message || error?.code || String(error)
        console.error('[employeeInvitationService] getPendingInvitations error:', errorMsg)
        return { data: [], error: error }
      }

      // Fetch business details separately for each application
      if (data && data.length > 0) {
        const businessIds = [...new Set(data.map(app => app.business_id))]
        const { data: businesses, error: businessError } = await supabase
          .from('businesses')
          .select('id,business_name,owner_id')
          .in('id', businessIds)

        if (businessError) {
          const errorMsg = businessError?.message || businessError?.code || String(businessError)
          console.error('[employeeInvitationService] Error fetching application businesses:', errorMsg)
        }

        const businessMap = {}
        businesses?.forEach(b => {
          businessMap[b.id] = b
        })

        data.forEach(app => {
          app.business = businessMap[app.business_id] || null
        })
      }

      return { data: data || [], error: null }
    } catch (err) {
      const errorMsg = err?.message || err?.code || String(err)
      console.error('[employeeInvitationService] getPendingInvitations failed:', errorMsg)
      return { data: [], error: err }
    }
  },

  async acceptInvitation(applicationId, employeeId) {
    try {
      const { data: application, error: fetchError } = await supabase
        .from('job_applications')
        .select('*')
        .eq('id', applicationId)
        .single()

      if (fetchError) throw fetchError

      // Update application status
      const { error: updateError } = await supabase
        .from('job_applications')
        .update({
          status: 'accepted',
          reviewed_at: new Date().toISOString()
        })
        .eq('id', applicationId)

      if (updateError) throw updateError

      return { data: application, error: null }
    } catch (err) {
      const errorMsg = err?.message || err?.code || 'Unknown error'
      console.error('[employeeInvitationService] acceptInvitation failed:', errorMsg)
      return { data: null, error: err }
    }
  },

  async rejectInvitation(invitationId) {
    try {
      const { data, error } = await supabase
        .from('job_applications')
        .update({
          status: 'rejected',
          reviewed_at: new Date().toISOString()
        })
        .eq('id', invitationId)
        .select()
        .single()

      if (error) throw error
      return { data, error: null }
    } catch (err) {
      const errorMsg = err?.message || err?.code || 'Unknown error'
      console.error('[employeeInvitationService] rejectInvitation failed:', errorMsg)
      return { data: null, error: err }
    }
  },

  async hideInvitation(invitationId) {
    try {
      const { data, error } = await supabase
        .from('job_applications')
        .update({ status: 'withdrawn' })
        .eq('id', invitationId)
        .select()
        .single()

      if (error) throw error
      return { data, error: null }
    } catch (err) {
      const errorMsg = err?.message || err?.code || 'Unknown error'
      console.error('[employeeInvitationService] hideInvitation failed:', errorMsg)
      return { data: null, error: err }
    }
  },

  // =====================================================
  // EMPLOYEE ASSIGNMENTS (Legacy - use job_applications instead)
  // =====================================================

  async getEmployeeBusinesses(userId) {
    try {
      // Get accepted applications for the user
      const { data, error } = await supabase
        .from('job_applications')
        .select('id,business_id,job_title,job_category,pay_rate,pay_currency,job_type,submitted_at')
        .eq('applicant_user_id', userId)
        .eq('status', 'accepted')
        .order('submitted_at', { ascending: false })

      if (error) {
        const errorMsg = error?.message || error?.code || String(error)
        console.error('[employeeInvitationService] getEmployeeBusinesses error:', errorMsg)
        return { data: [], error: error }
      }

      // Fetch business details separately
      if (data && data.length > 0) {
        const businessIds = [...new Set(data.map(a => a.business_id))]
        const { data: businesses, error: businessError } = await supabase
          .from('businesses')
          .select('id,business_name,owner_id,city,province')
          .in('id', businessIds)

        if (businessError) {
          const errorMsg = businessError?.message || businessError?.code || String(businessError)
          console.error('[employeeInvitationService] Error fetching businesses:', errorMsg)
        }

        const businessMap = {}
        businesses?.forEach(b => {
          businessMap[b.id] = b
        })

        data.forEach(assignment => {
          assignment.business = businessMap[assignment.business_id] || null
        })
      }

      return { data: data || [], error: null }
    } catch (err) {
      const errorMsg = err?.message || err?.code || String(err)
      console.error('[employeeInvitationService] getEmployeeBusinesses failed:', errorMsg)
      return { data: [], error: err }
    }
  },

  async getEmployeeAssignment(businessId, userId) {
    try {
      const { data, error } = await supabase
        .from('job_applications')
        .select('*')
        .eq('business_id', businessId)
        .eq('applicant_user_id', userId)
        .eq('status', 'accepted')
        .single()

      if (error && error.code !== 'PGRST116') throw error
      return { data, error: null }
    } catch (err) {
      const errorMsg = err?.message || err?.code || 'Unknown error'
      console.error('[employeeInvitationService] getEmployeeAssignment failed:', errorMsg)
      return { data: null, error: err }
    }
  },

  async terminateAssignment(applicationId) {
    try {
      const { data, error } = await supabase
        .from('job_applications')
        .update({
          status: 'rejected'
        })
        .eq('id', applicationId)
        .select()
        .single()

      if (error) throw error
      return { data, error: null }
    } catch (err) {
      const errorMsg = err?.message || err?.code || 'Unknown error'
      console.error('[employeeInvitationService] terminateAssignment failed:', errorMsg)
      return { data: null, error: err }
    }
  },

  // =====================================================
  // HELPER FUNCTIONS
  // =====================================================

  mapJobTypeToEmploymentType(jobType) {
    const mapping = {
      'one_time': 'temporary',
      'hourly': 'part_time',
      'full_time': 'full_time',
      'part_time': 'part_time',
      'contract': 'contract'
    }
    return mapping[jobType] || 'temporary'
  },

  subscribeToInvitations(userId, callback) {
    try {
      const channel = supabase
        .channel(`applications:${userId}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'job_applications',
          filter: `applicant_user_id=eq.${userId}`
        }, (payload) => {
          callback(payload)
        })
        .subscribe()

      return {
        unsubscribe: () => {
          channel.unsubscribe()
        }
      }
    } catch (err) {
      const errorMsg = err?.message || err?.code || 'Unknown error'
      console.error('[employeeInvitationService] subscribeToInvitations failed:', errorMsg)
      return { unsubscribe: () => {} }
    }
  },

  subscribeToAssignments(userId, callback) {
    try {
      const channel = supabase
        .channel(`assignments:${userId}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'job_applications',
          filter: `applicant_user_id=eq.${userId}`
        }, (payload) => {
          callback(payload)
        })
        .subscribe()

      return {
        unsubscribe: () => {
          channel.unsubscribe()
        }
      }
    } catch (err) {
      const errorMsg = err?.message || err?.code || 'Unknown error'
      console.error('[employeeInvitationService] subscribeToAssignments failed:', errorMsg)
      return { unsubscribe: () => {} }
    }
  }
}
