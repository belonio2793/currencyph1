import { supabase } from './supabaseClient'

export const jobsService = {
  // ============================================================================
  // JOBS OPERATIONS
  // ============================================================================

  // Create a new job
  async createJob(jobData) {
    const { data, error } = await supabase
      .from('jobs')
      .insert([jobData])
      .select()
    
    if (error) throw error
    return data?.[0]
  },

  // Get all active jobs
  async getActiveJobs(filters = {}) {
    let query = supabase
      .from('jobs')
      .select(`
        *,
        job_offers (
          id,
          status,
          service_provider_id,
          provider_name,
          offered_rate
        ),
        job_ratings (
          id,
          rating_score,
          review_text
        )
      `)
      .eq('status', 'active')
      .eq('is_public', true)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })

    // Apply category filter
    if (filters.category) {
      query = query.eq('job_category', filters.category)
    }

    // Apply location filter
    if (filters.city) {
      query = query.eq('city', filters.city)
    }

    // Apply job type filter
    if (filters.jobType) {
      query = query.eq('job_type', filters.jobType)
    }

    // Apply search filter
    if (filters.search) {
      query = query.or(`job_title.ilike.%${filters.search}%,job_description.ilike.%${filters.search}%`)
    }

    // Apply rate filters
    if (filters.minRate) {
      query = query.gte('pay_rate', filters.minRate)
    }

    if (filters.maxRate) {
      query = query.lte('pay_rate', filters.maxRate)
    }

    const { data, error } = await query
    
    if (error) throw error
    return data || []
  },

  // Get jobs posted by a specific business
  async getBusinessJobs(businessId) {
    const { data, error } = await supabase
      .from('jobs')
      .select(`
        *,
        job_offers (
          id,
          status,
          service_provider_id,
          provider_name,
          offered_rate,
          created_at
        ),
        job_ratings (
          id,
          rating_score
        )
      `)
      .eq('business_id', businessId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  },

  // Get a single job by ID
  async getJobById(jobId) {
    const { data, error } = await supabase
      .from('jobs')
      .select(`
        id,
        business_id,
        posted_by_user_id,
        job_title,
        job_category,
        job_description,
        job_type,
        pay_rate,
        pay_currency,
        pay_type,
        location,
        city,
        province,
        latitude,
        longitude,
        skills_required,
        experience_level,
        start_date,
        end_date,
        deadline_for_applications,
        status,
        positions_available,
        positions_filled,
        is_public,
        created_at,
        updated_at,
        job_offers (
          id,
          status,
          service_provider_id,
          provider_name,
          provider_email,
          provider_phone,
          offered_rate,
          offer_message,
          created_at
        ),
        job_ratings (
          id,
          rating_score,
          review_title,
          review_text,
          rated_by_user_id,
          rated_user_id
        ),
        job_remarks (
          id,
          remark_text,
          is_public,
          remark_type,
          created_by_user_id,
          created_at
        ),
        job_history (
          id,
          completion_status,
          completion_date,
          final_amount_paid
        )
      `)
      .eq('id', jobId)
      .single()

    if (error) throw error
    return data
  },

  // Update a job
  async updateJob(jobId, updates) {
    const { data, error } = await supabase
      .from('jobs')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', jobId)
      .select()

    if (error) throw error
    return data?.[0]
  },

  // Soft delete a job (marks as deleted but keeps record for history/reputation)
  async softDeleteJob(jobId) {
    const { data, error } = await supabase
      .from('jobs')
      .update({
        deleted_at: new Date().toISOString(),
        status: 'deleted'
      })
      .eq('id', jobId)
      .select()

    if (error) throw error
    return data?.[0]
  },

  // Get jobs by posting type (service_offer or service_request)
  async getJobsByType(postingType, filters = {}) {
    let query = supabase
      .from('jobs')
      .select(`
        *,
        job_offers (
          id,
          status,
          service_provider_id,
          provider_name,
          offered_rate
        ),
        job_ratings (
          id,
          rating_score,
          review_text
        )
      `)
      .eq('posting_type', postingType)
      .eq('status', 'active')
      .eq('is_public', true)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })

    // Apply filters
    if (filters.category) query = query.eq('job_category', filters.category)
    if (filters.city) query = query.eq('city', filters.city)
    if (filters.search) {
      query = query.or(`job_title.ilike.%${filters.search}%,job_description.ilike.%${filters.search}%`)
    }

    const { data, error } = await query
    if (error) throw error
    return data || []
  },

  // Get user's job history (including deleted jobs for reputation)
  async getUserJobHistory(userId) {
    const { data, error } = await supabase
      .from('jobs')
      .select(`
        *,
        job_offers (count),
        job_ratings (
          id,
          rating_score,
          review_text,
          review_title
        )
      `)
      .eq('posted_by_user_id', userId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  },

  // Search jobs with full text search
  async searchJobs(searchTerm, filters = {}) {
    let query = supabase
      .from('jobs')
      .select(`
        *,
        job_offers (count)
      `)
      .eq('status', 'active')
      .eq('is_public', true)

    // Search in title and description
    if (searchTerm) {
      query = query.or(
        `job_title.ilike.%${searchTerm}%,job_description.ilike.%${searchTerm}%,job_category.ilike.%${searchTerm}%`
      )
    }

    // Apply filters
    if (filters.category) query = query.eq('job_category', filters.category)
    if (filters.jobType) query = query.eq('job_type', filters.jobType)
    if (filters.city) query = query.eq('city', filters.city)
    if (filters.minRate) query = query.gte('pay_rate', filters.minRate)
    if (filters.maxRate) query = query.lte('pay_rate', filters.maxRate)

    const { data, error } = await query.order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  },

  // ============================================================================
  // JOB OFFERS OPERATIONS
  // ============================================================================

  // Create a job offer (service provider applying for a job)
  async createJobOffer(offerData) {
    const { data, error } = await supabase
      .from('job_offers')
      .insert([offerData])
      .select()

    if (error) throw error
    return data?.[0]
  },

  // Get offers for a specific job
  async getJobOffers(jobId) {
    const { data, error } = await supabase
      .from('job_offers')
      .select('*')
      .eq('job_id', jobId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  },

  // Get offers submitted by a service provider
  async getProviderOffers(providerId) {
    const { data, error } = await supabase
      .from('job_offers')
      .select(`
        *,
        jobs (
          id,
          job_title,
          job_category,
          pay_rate,
          job_type,
          location,
          created_at
        )
      `)
      .eq('service_provider_id', providerId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  },

  // Update job offer status
  async updateJobOffer(offerId, updates) {
    const { data, error } = await supabase
      .from('job_offers')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', offerId)
      .select()

    if (error) throw error
    return data?.[0]
  },

  // Accept a job offer
  async acceptJobOffer(offerId) {
    return this.updateJobOffer(offerId, {
      status: 'accepted',
      accepted_date: new Date().toISOString()
    })
  },

  // Reject a job offer
  async rejectJobOffer(offerId) {
    return this.updateJobOffer(offerId, {
      status: 'rejected'
    })
  },

  // ============================================================================
  // JOB RATINGS OPERATIONS
  // ============================================================================

  // Create a rating for a job/provider
  async createJobRating(ratingData) {
    const { data, error } = await supabase
      .from('job_ratings')
      .insert([ratingData])
      .select()

    if (error) throw error
    return data?.[0]
  },

  // Get ratings for a user
  async getUserRatings(userId) {
    const { data, error } = await supabase
      .from('job_ratings')
      .select('*')
      .eq('rated_user_id', userId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  },

  // Get ratings for a specific job
  async getJobRatings(jobId) {
    const { data, error } = await supabase
      .from('job_ratings')
      .select('*')
      .eq('job_id', jobId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  },

  // Calculate average rating for a user
  async getUserAverageRating(userId) {
    const { data, error } = await supabase
      .from('job_ratings')
      .select('rating_score')
      .eq('rated_user_id', userId)

    if (error) throw error
    
    if (!data || data.length === 0) return 0
    
    const sum = data.reduce((acc, rating) => acc + rating.rating_score, 0)
    return (sum / data.length).toFixed(1)
  },

  // ============================================================================
  // JOB REMARKS OPERATIONS
  // ============================================================================

  // Create a remark/comment on a job
  async createJobRemark(remarkData) {
    const { data, error } = await supabase
      .from('job_remarks')
      .insert([remarkData])
      .select()

    if (error) throw error
    return data?.[0]
  },

  // Get remarks for a job with user information
  async getJobRemarks(jobId, onlyPublic = false) {
    let query = supabase
      .from('job_remarks')
      .select(`
        id,
        job_id,
        job_offer_id,
        created_by_user_id,
        remark_text,
        is_public,
        remark_type,
        created_at,
        updated_at
      `)
      .eq('job_id', jobId)

    if (onlyPublic) {
      query = query.eq('is_public', true)
    }

    const { data, error } = await query.order('created_at', { ascending: false })

    if (error) throw error

    // Fetch user information for each remark (email, names, etc.)
    if (data && data.length > 0) {
      const userIds = [...new Set(data.map(r => r.created_by_user_id))]

      try {
        const { data: users } = await supabase
          .from('users')
          .select('id, email, full_name, username, profile_picture_url')
          .in('id', userIds)

        const userMap = {}
        users?.forEach(user => {
          userMap[user.id] = user
        })

        return data.map(remark => ({
          ...remark,
          user: userMap[remark.created_by_user_id] || { id: remark.created_by_user_id, email: 'Unknown User' }
        }))
      } catch (err) {
        console.warn('Could not fetch user info for remarks:', err)
        return data
      }
    }

    return data || []
  },

  // ============================================================================
  // JOB HISTORY OPERATIONS
  // ============================================================================

  // Create job history record
  async createJobHistory(historyData) {
    const { data, error } = await supabase
      .from('job_history')
      .insert([historyData])
      .select()

    if (error) throw error
    return data?.[0]
  },

  // Get job history
  async getJobHistory(jobId) {
    const { data, error } = await supabase
      .from('job_history')
      .select('*')
      .eq('job_id', jobId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  },

  // Get provider job history
  async getProviderJobHistory(providerId) {
    const { data, error } = await supabase
      .from('job_history')
      .select(`
        *,
        jobs (
          id,
          job_title,
          pay_rate
        )
      `)
      .eq('service_provider_id', providerId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  },

  // ============================================================================
  // JOB ANALYTICS
  // ============================================================================

  // Get statistics about a business's jobs
  async getBusinessJobStats(businessId) {
    const [
      totalJobs,
      activeJobs,
      filledJobs,
      totalOffers,
      acceptedOffers
    ] = await Promise.all([
      supabase
        .from('jobs')
        .select('id', { count: 'exact' })
        .eq('business_id', businessId),
      supabase
        .from('jobs')
        .select('id', { count: 'exact' })
        .eq('business_id', businessId)
        .eq('status', 'active'),
      supabase
        .from('jobs')
        .select('id', { count: 'exact' })
        .eq('business_id', businessId)
        .eq('status', 'filled'),
      supabase
        .from('job_offers')
        .select('id', { count: 'exact' })
        .eq('business_id', businessId),
      supabase
        .from('job_offers')
        .select('id', { count: 'exact' })
        .eq('business_id', businessId)
        .eq('status', 'accepted')
    ])

    return {
      totalJobs: totalJobs.count || 0,
      activeJobs: activeJobs.count || 0,
      filledJobs: filledJobs.count || 0,
      totalOffers: totalOffers.count || 0,
      acceptedOffers: acceptedOffers.count || 0
    }
  },

  // Get job categories for autocomplete
  async getJobCategories() {
    try {
      const { data, error } = await supabase
        .from('jobs')
        .select('job_category')

      if (error) throw error

      // Remove duplicates and sort
      const categories = [...new Set(
        data
          ?.map(item => item.job_category)
          .filter(Boolean) || []
      )].sort()

      return categories
    } catch (err) {
      console.error('Error fetching job categories:', err)
      return []
    }
  },

  // Get job locations/cities
  async getJobCities() {
    try {
      const { data, error } = await supabase
        .from('jobs')
        .select('city')

      if (error) throw error

      // Remove duplicates and sort
      const cities = [...new Set(
        data
          ?.map(item => item.city)
          .filter(Boolean) || []
      )].sort()

      return cities
    } catch (err) {
      console.error('Error fetching job cities:', err)
      return []
    }
  },

  // Get autocomplete suggestions for job search
  async getSearchSuggestions(searchTerm) {
    const { data, error } = await supabase
      .from('jobs')
      .select('job_title, job_category, city')
      .ilike('job_title', `%${searchTerm}%`)
      .limit(10)
      .order('created_at', { ascending: false })

    if (error) throw error
    
    return data || []
  }
}
