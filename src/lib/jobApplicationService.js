import { supabase } from './supabaseClient'

export const jobApplicationService = {
  // ============================================================================
  // JOB APPLICATION OPERATIONS
  // ============================================================================

  async createApplication(applicationData) {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) throw new Error('User not authenticated')

      const { data, error } = await supabase
        .from('job_applications')
        .insert([{
          business_id: applicationData.business_id,
          job_id: applicationData.job_id,
          applicant_user_id: user.id,
          applicant_name: applicationData.applicant_name || '',
          applicant_email: applicationData.applicant_email || user.email,
          applicant_phone: applicationData.applicant_phone || '',
          position_applied_for: applicationData.position_applied_for || '',
          salary_expectation: applicationData.salary_expectation,
          salary_currency: applicationData.salary_currency || 'PHP',
          cover_letter: applicationData.cover_letter || '',
          additional_message: applicationData.additional_message || '',
          status: 'submitted'
        }])
        .select()
        .single()

      if (error) throw error
      return { data, error: null }
    } catch (err) {
      console.error('[jobApplicationService] createApplication failed:', err)
      return { data: null, error: err }
    }
  },

  async getApplicationById(applicationId) {
    try {
      const { data, error } = await supabase
        .from('job_applications')
        .select(`
          *,
          applicant_employment_history (*),
          applicant_education (*),
          applicant_certifications (*),
          applicant_skills (*),
          interview_details (*),
          job_offers (*),
          applicant_references (*)
        `)
        .eq('id', applicationId)
        .single()

      if (error) throw error
      return { data, error: null }
    } catch (err) {
      console.error('[jobApplicationService] getApplicationById failed:', err)
      return { data: null, error: err }
    }
  },

  async getApplicationsByApplicant(userId) {
    try {
      const { data, error } = await supabase
        .from('job_applications')
        .select(`
          *,
          businesses:business_id (id, business_name, city_of_registration),
          applicant_employment_history (count),
          applicant_education (count),
          applicant_skills (count)
        `)
        .eq('applicant_user_id', userId)
        .order('submitted_at', { ascending: false })

      if (error) throw error
      return { data: data || [], error: null }
    } catch (err) {
      console.error('[jobApplicationService] getApplicationsByApplicant failed:', err)
      return { data: [], error: err }
    }
  },

  async getApplicationsByBusiness(businessId, status = null) {
    try {
      let query = supabase
        .from('job_applications')
        .select(`
          *,
          applicant_employment_history (count),
          applicant_education (count),
          applicant_skills (count),
          interview_details (count)
        `)
        .eq('business_id', businessId)

      if (status) {
        query = query.eq('status', status)
      }

      const { data, error } = await query.order('submitted_at', { ascending: false })

      if (error) throw error
      return { data: data || [], error: null }
    } catch (err) {
      console.error('[jobApplicationService] getApplicationsByBusiness failed:', err)
      return { data: [], error: err }
    }
  },

  async updateApplication(applicationId, updates) {
    try {
      const { data, error } = await supabase
        .from('job_applications')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', applicationId)
        .select()
        .single()

      if (error) throw error
      return { data, error: null }
    } catch (err) {
      console.error('[jobApplicationService] updateApplication failed:', err)
      return { data: null, error: err }
    }
  },

  async updateApplicationStatus(applicationId, status) {
    return this.updateApplication(applicationId, { 
      status,
      reviewed_at: status !== 'submitted' ? new Date().toISOString() : null
    })
  },

  // ============================================================================
  // EMPLOYMENT HISTORY OPERATIONS
  // ============================================================================

  async addEmploymentHistory(applicationId, historyData) {
    try {
      const { data, error } = await supabase
        .from('applicant_employment_history')
        .insert([{
          job_application_id: applicationId,
          ...historyData
        }])
        .select()
        .single()

      if (error) throw error
      return { data, error: null }
    } catch (err) {
      console.error('[jobApplicationService] addEmploymentHistory failed:', err)
      return { data: null, error: err }
    }
  },

  async updateEmploymentHistory(historyId, updates) {
    try {
      const { data, error } = await supabase
        .from('applicant_employment_history')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', historyId)
        .select()
        .single()

      if (error) throw error
      return { data, error: null }
    } catch (err) {
      console.error('[jobApplicationService] updateEmploymentHistory failed:', err)
      return { data: null, error: err }
    }
  },

  async deleteEmploymentHistory(historyId) {
    try {
      const { error } = await supabase
        .from('applicant_employment_history')
        .delete()
        .eq('id', historyId)

      if (error) throw error
      return { error: null }
    } catch (err) {
      console.error('[jobApplicationService] deleteEmploymentHistory failed:', err)
      return { error: err }
    }
  },

  async getEmploymentHistory(applicationId) {
    try {
      const { data, error } = await supabase
        .from('applicant_employment_history')
        .select('*')
        .eq('job_application_id', applicationId)
        .order('end_date', { ascending: false, nullsFirst: false })

      if (error) throw error
      return { data: data || [], error: null }
    } catch (err) {
      console.error('[jobApplicationService] getEmploymentHistory failed:', err)
      return { data: [], error: err }
    }
  },

  // ============================================================================
  // EDUCATION OPERATIONS
  // ============================================================================

  async addEducation(applicationId, educationData) {
    try {
      const { data, error } = await supabase
        .from('applicant_education')
        .insert([{
          job_application_id: applicationId,
          ...educationData
        }])
        .select()
        .single()

      if (error) throw error
      return { data, error: null }
    } catch (err) {
      console.error('[jobApplicationService] addEducation failed:', err)
      return { data: null, error: err }
    }
  },

  async updateEducation(educationId, updates) {
    try {
      const { data, error } = await supabase
        .from('applicant_education')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', educationId)
        .select()
        .single()

      if (error) throw error
      return { data, error: null }
    } catch (err) {
      console.error('[jobApplicationService] updateEducation failed:', err)
      return { data: null, error: err }
    }
  },

  async deleteEducation(educationId) {
    try {
      const { error } = await supabase
        .from('applicant_education')
        .delete()
        .eq('id', educationId)

      if (error) throw error
      return { error: null }
    } catch (err) {
      console.error('[jobApplicationService] deleteEducation failed:', err)
      return { error: err }
    }
  },

  async getEducation(applicationId) {
    try {
      const { data, error } = await supabase
        .from('applicant_education')
        .select('*')
        .eq('job_application_id', applicationId)
        .order('end_date', { ascending: false, nullsFirst: false })

      if (error) throw error
      return { data: data || [], error: null }
    } catch (err) {
      console.error('[jobApplicationService] getEducation failed:', err)
      return { data: [], error: err }
    }
  },

  // ============================================================================
  // CERTIFICATIONS OPERATIONS
  // ============================================================================

  async addCertification(applicationId, certificationData) {
    try {
      const { data, error } = await supabase
        .from('applicant_certifications')
        .insert([{
          job_application_id: applicationId,
          ...certificationData
        }])
        .select()
        .single()

      if (error) throw error
      return { data, error: null }
    } catch (err) {
      console.error('[jobApplicationService] addCertification failed:', err)
      return { data: null, error: err }
    }
  },

  async updateCertification(certificationId, updates) {
    try {
      const { data, error } = await supabase
        .from('applicant_certifications')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', certificationId)
        .select()
        .single()

      if (error) throw error
      return { data, error: null }
    } catch (err) {
      console.error('[jobApplicationService] updateCertification failed:', err)
      return { data: null, error: err }
    }
  },

  async deleteCertification(certificationId) {
    try {
      const { error } = await supabase
        .from('applicant_certifications')
        .delete()
        .eq('id', certificationId)

      if (error) throw error
      return { error: null }
    } catch (err) {
      console.error('[jobApplicationService] deleteCertification failed:', err)
      return { error: err }
    }
  },

  async getCertifications(applicationId) {
    try {
      const { data, error } = await supabase
        .from('applicant_certifications')
        .select('*')
        .eq('job_application_id', applicationId)
        .order('issue_date', { ascending: false })

      if (error) throw error
      return { data: data || [], error: null }
    } catch (err) {
      console.error('[jobApplicationService] getCertifications failed:', err)
      return { data: [], error: err }
    }
  },

  // ============================================================================
  // SKILLS OPERATIONS
  // ============================================================================

  async addSkill(applicationId, skillData) {
    try {
      const { data, error } = await supabase
        .from('applicant_skills')
        .insert([{
          job_application_id: applicationId,
          ...skillData
        }])
        .select()
        .single()

      if (error) throw error
      return { data, error: null }
    } catch (err) {
      console.error('[jobApplicationService] addSkill failed:', err)
      return { data: null, error: err }
    }
  },

  async updateSkill(skillId, updates) {
    try {
      const { data, error } = await supabase
        .from('applicant_skills')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', skillId)
        .select()
        .single()

      if (error) throw error
      return { data, error: null }
    } catch (err) {
      console.error('[jobApplicationService] updateSkill failed:', err)
      return { data: null, error: err }
    }
  },

  async deleteSkill(skillId) {
    try {
      const { error } = await supabase
        .from('applicant_skills')
        .delete()
        .eq('id', skillId)

      if (error) throw error
      return { error: null }
    } catch (err) {
      console.error('[jobApplicationService] deleteSkill failed:', err)
      return { error: err }
    }
  },

  async getSkills(applicationId) {
    try {
      const { data, error } = await supabase
        .from('applicant_skills')
        .select('*')
        .eq('job_application_id', applicationId)
        .order('proficiency_level', { ascending: false })

      if (error) throw error
      return { data: data || [], error: null }
    } catch (err) {
      console.error('[jobApplicationService] getSkills failed:', err)
      return { data: [], error: err }
    }
  },

  // ============================================================================
  // INTERVIEW OPERATIONS
  // ============================================================================

  async scheduleInterview(applicationId, interviewData) {
    try {
      const { data, error } = await supabase
        .from('interview_details')
        .insert([{
          job_application_id: applicationId,
          ...interviewData,
          interview_status: 'scheduled'
        }])
        .select()
        .single()

      if (error) throw error
      return { data, error: null }
    } catch (err) {
      console.error('[jobApplicationService] scheduleInterview failed:', err)
      return { data: null, error: err }
    }
  },

  async updateInterview(interviewId, updates) {
    try {
      const { data, error } = await supabase
        .from('interview_details')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', interviewId)
        .select()
        .single()

      if (error) throw error
      return { data, error: null }
    } catch (err) {
      console.error('[jobApplicationService] updateInterview failed:', err)
      return { data: null, error: err }
    }
  },

  async getInterviews(applicationId) {
    try {
      const { data, error } = await supabase
        .from('interview_details')
        .select('*')
        .eq('job_application_id', applicationId)
        .order('scheduled_date', { ascending: true })

      if (error) throw error
      return { data: data || [], error: null }
    } catch (err) {
      console.error('[jobApplicationService] getInterviews failed:', err)
      return { data: [], error: err }
    }
  },

  async confirmInterview(interviewId) {
    try {
      const { data, error } = await supabase
        .from('interview_details')
        .update({
          applicant_confirmed: true,
          confirmed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', interviewId)
        .select()
        .single()

      if (error) throw error
      return { data, error: null }
    } catch (err) {
      console.error('[jobApplicationService] confirmInterview failed:', err)
      return { data: null, error: err }
    }
  },

  // ============================================================================
  // JOB OFFER OPERATIONS
  // ============================================================================

  async extendOffer(applicationId, offerData) {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) throw new Error('User not authenticated')

      const { data, error } = await supabase
        .from('job_offers')
        .insert([{
          job_application_id: applicationId,
          ...offerData,
          extended_by_user_id: user.id,
          offer_status: 'pending'
        }])
        .select()
        .single()

      if (error) throw error
      return { data, error: null }
    } catch (err) {
      console.error('[jobApplicationService] extendOffer failed:', err)
      return { data: null, error: err }
    }
  },

  async updateOffer(offerId, updates) {
    try {
      const { data, error } = await supabase
        .from('job_offers')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', offerId)
        .select()
        .single()

      if (error) throw error
      return { data, error: null }
    } catch (err) {
      console.error('[jobApplicationService] updateOffer failed:', err)
      return { data: null, error: err }
    }
  },

  async respondToOffer(offerId, response) {
    try {
      const { data, error } = await supabase
        .from('job_offers')
        .update({
          offer_status: response.status,
          applicant_response_date: new Date().toISOString(),
          applicant_notes: response.notes,
          updated_at: new Date().toISOString()
        })
        .eq('id', offerId)
        .select()
        .single()

      if (error) throw error
      return { data, error: null }
    } catch (err) {
      console.error('[jobApplicationService] respondToOffer failed:', err)
      return { data: null, error: err }
    }
  },

  async getOffers(applicationId) {
    try {
      const { data, error } = await supabase
        .from('job_offers')
        .select('*')
        .eq('job_application_id', applicationId)
        .order('created_at', { ascending: false })

      if (error) throw error
      return { data: data || [], error: null }
    } catch (err) {
      console.error('[jobApplicationService] getOffers failed:', err)
      return { data: [], error: err }
    }
  },

  // ============================================================================
  // REFERENCES OPERATIONS
  // ============================================================================

  async addReference(applicationId, referenceData) {
    try {
      const { data, error } = await supabase
        .from('applicant_references')
        .insert([{
          job_application_id: applicationId,
          ...referenceData
        }])
        .select()
        .single()

      if (error) throw error
      return { data, error: null }
    } catch (err) {
      console.error('[jobApplicationService] addReference failed:', err)
      return { data: null, error: err }
    }
  },

  async updateReference(referenceId, updates) {
    try {
      const { data, error } = await supabase
        .from('applicant_references')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', referenceId)
        .select()
        .single()

      if (error) throw error
      return { data, error: null }
    } catch (err) {
      console.error('[jobApplicationService] updateReference failed:', err)
      return { data: null, error: err }
    }
  },

  async deleteReference(referenceId) {
    try {
      const { error } = await supabase
        .from('applicant_references')
        .delete()
        .eq('id', referenceId)

      if (error) throw error
      return { error: null }
    } catch (err) {
      console.error('[jobApplicationService] deleteReference failed:', err)
      return { error: err }
    }
  },

  async getReferences(applicationId) {
    try {
      const { data, error } = await supabase
        .from('applicant_references')
        .select('*')
        .eq('job_application_id', applicationId)

      if (error) throw error
      return { data: data || [], error: null }
    } catch (err) {
      console.error('[jobApplicationService] getReferences failed:', err)
      return { data: [], error: err }
    }
  }
}
