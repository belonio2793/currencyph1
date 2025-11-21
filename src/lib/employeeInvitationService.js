import { supabase } from './supabaseClient'

export const employeeInvitationService = {
  // =====================================================
  // JOB INVITATIONS
  // =====================================================

  async sendJobInvitation(businessId, invitedUserId, jobDetails) {
    try {
      const { data, error } = await supabase
        .from('job_invitations')
        .insert([{
          business_id: businessId,
          invited_user_id: invitedUserId,
          invited_by_user_id: (await supabase.auth.getUser()).data.user.id,
          job_title: jobDetails.job_title,
          job_description: jobDetails.job_description,
          job_category: jobDetails.job_category,
          pay_rate: jobDetails.pay_rate,
          pay_currency: jobDetails.pay_currency || 'PHP',
          pay_type: jobDetails.pay_type,
          job_type: jobDetails.job_type,
          message: jobDetails.message,
          expires_at: jobDetails.expires_at || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        }])
        .select()
        .single()

      if (error) throw error
      return { data, error: null }
    } catch (err) {
      const errorMsg = err?.message || JSON.stringify(err)
      console.error('[employeeInvitationService] sendJobInvitation failed:', errorMsg)
      return { data: null, error: err }
    }
  },

  async getPendingInvitations(userId) {
    try {
      const { data, error } = await supabase
        .from('job_invitations')
        .select(`
          *,
          business:businesses(id, business_name, owner_id),
          invited_by:auth.users!invited_by_user_id(full_name, username)
        `)
        .eq('invited_user_id', userId)
        .eq('status', 'pending')
        .eq('is_hidden', false)
        .order('sent_at', { ascending: false })

      if (error) throw error
      return { data, error: null }
    } catch (err) {
      const errorMsg = err?.message || JSON.stringify(err)
      console.error('[employeeInvitationService] getPendingInvitations failed:', errorMsg)
      return { data: [], error: err }
    }
  },

  async acceptInvitation(invitationId, employeeId) {
    try {
      const { data: invitation, error: fetchError } = await supabase
        .from('job_invitations')
        .select('*')
        .eq('id', invitationId)
        .single()

      if (fetchError) throw fetchError

      // Update invitation status
      const { error: updateError } = await supabase
        .from('job_invitations')
        .update({
          status: 'accepted',
          accepted_at: new Date().toISOString()
        })
        .eq('id', invitationId)

      if (updateError) throw updateError

      // Create employee assignment
      const { data: assignment, error: assignError } = await supabase
        .from('employee_assignments')
        .insert([{
          business_id: invitation.business_id,
          employee_id: employeeId,
          user_id: invitation.invited_user_id,
          assigned_job_title: invitation.job_title,
          assigned_job_category: invitation.job_category,
          pay_rate: invitation.pay_rate,
          pay_currency: invitation.pay_currency,
          employment_type: this.mapJobTypeToEmploymentType(invitation.job_type),
          status: 'active',
          assignment_status: 'accepted',
          start_date: new Date().toISOString().split('T')[0],
          job_invitation_id: invitationId
        }])
        .select()
        .single()

      if (assignError) throw assignError

      return { data: assignment, error: null }
    } catch (err) {
      const errorMsg = err?.message || JSON.stringify(err)
      console.error('[employeeInvitationService] acceptInvitation failed:', errorMsg)
      return { data: null, error: err }
    }
  },

  async rejectInvitation(invitationId) {
    try {
      const { data, error } = await supabase
        .from('job_invitations')
        .update({
          status: 'rejected',
          rejected_at: new Date().toISOString()
        })
        .eq('id', invitationId)
        .select()
        .single()

      if (error) throw error
      return { data, error: null }
    } catch (err) {
      const errorMsg = err?.message || JSON.stringify(err)
      console.error('[employeeInvitationService] rejectInvitation failed:', errorMsg)
      return { data: null, error: err }
    }
  },

  async hideInvitation(invitationId) {
    try {
      const { data, error } = await supabase
        .from('job_invitations')
        .update({ is_hidden: true })
        .eq('id', invitationId)
        .select()
        .single()

      if (error) throw error
      return { data, error: null }
    } catch (err) {
      const errorMsg = err?.message || JSON.stringify(err)
      console.error('[employeeInvitationService] hideInvitation failed:', errorMsg)
      return { data: null, error: err }
    }
  },

  // =====================================================
  // EMPLOYEE ASSIGNMENTS
  // =====================================================

  async getEmployeeBusinesses(userId) {
    try {
      const { data, error } = await supabase
        .from('employee_assignments')
        .select(`
          id,
          business_id,
          business:businesses(id, business_name, owner_id, city, province),
          assigned_job_title,
          pay_rate,
          employment_type,
          start_date,
          end_date,
          status
        `)
        .eq('user_id', userId)
        .eq('status', 'active')
        .order('start_date', { ascending: false })

      if (error) throw error
      return { data, error: null }
    } catch (err) {
      const errorMsg = err?.message || JSON.stringify(err)
      console.error('[employeeInvitationService] getEmployeeBusinesses failed:', errorMsg)
      return { data: [], error: err }
    }
  },

  async getEmployeeAssignment(businessId, userId) {
    try {
      const { data, error } = await supabase
        .from('employee_assignments')
        .select('*')
        .eq('business_id', businessId)
        .eq('user_id', userId)
        .eq('status', 'active')
        .single()

      if (error && error.code !== 'PGRST116') throw error
      return { data, error: null }
    } catch (err) {
      const errorMsg = err?.message || JSON.stringify(err)
      console.error('[employeeInvitationService] getEmployeeAssignment failed:', errorMsg)
      return { data: null, error: err }
    }
  },

  async terminateAssignment(assignmentId) {
    try {
      const { data, error } = await supabase
        .from('employee_assignments')
        .update({
          status: 'terminated',
          end_date: new Date().toISOString().split('T')[0]
        })
        .eq('id', assignmentId)
        .select()
        .single()

      if (error) throw error
      return { data, error: null }
    } catch (err) {
      const errorMsg = err?.message || JSON.stringify(err)
      console.error('[employeeInvitationService] terminateAssignment failed:', errorMsg)
      return { data: null, error: err }
    }
  },

  // =====================================================
  // EMPLOYEE JOB OFFERS
  // =====================================================

  async getEmployeeJobOffers(userId, status = 'pending') {
    try {
      const { data, error } = await supabase
        .from('employee_job_offers')
        .select(`
          *,
          business:businesses(id, business_name),
          job:jobs(id, job_title, job_description)
        `)
        .eq('user_id', userId)
        .eq('status', status)
        .order('created_at', { ascending: false })

      if (error) throw error
      return { data, error: null }
    } catch (err) {
      const errorMsg = err?.message || JSON.stringify(err)
      console.error('[employeeInvitationService] getEmployeeJobOffers failed:', errorMsg)
      return { data: [], error: err }
    }
  },

  async acceptJobOffer(offerId, employeeId) {
    try {
      const { data, error } = await supabase
        .from('employee_job_offers')
        .update({
          status: 'accepted',
          accepted_at: new Date().toISOString()
        })
        .eq('id', offerId)
        .select()
        .single()

      if (error) throw error
      return { data, error: null }
    } catch (err) {
      const errorMsg = err?.message || JSON.stringify(err)
      console.error('[employeeInvitationService] acceptJobOffer failed:', errorMsg)
      return { data: null, error: err }
    }
  },

  async rejectJobOffer(offerId) {
    try {
      const { data, error } = await supabase
        .from('employee_job_offers')
        .update({
          status: 'rejected'
        })
        .eq('id', offerId)
        .select()
        .single()

      if (error) throw error
      return { data, error: null }
    } catch (err) {
      const errorMsg = err?.message || JSON.stringify(err)
      console.error('[employeeInvitationService] rejectJobOffer failed:', errorMsg)
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
        .channel(`invitations:${userId}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'job_invitations',
          filter: `invited_user_id=eq.${userId}`
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
      const errorMsg = err?.message || JSON.stringify(err)
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
          table: 'employee_assignments',
          filter: `user_id=eq.${userId}`
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
      const errorMsg = err?.message || JSON.stringify(err)
      console.error('[employeeInvitationService] subscribeToAssignments failed:', errorMsg)
      return { unsubscribe: () => {} }
    }
  }
}
