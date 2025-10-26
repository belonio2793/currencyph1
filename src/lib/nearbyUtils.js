import { supabase } from './supabaseClient'

export const nearbyUtils = {
  // Get vote for a listing by current user
  async getListingVote(listingId, listingType, userId) {
    if (!userId) return null
    const { data, error } = await supabase
      .from('listing_votes')
      .select('vote_type')
      .eq('listing_id', listingId)
      .eq('listing_type', listingType)
      .eq('user_id', userId)
      .maybeSingle()
    
    if (error) {
      console.warn('getListingVote error:', error)
      return null
    }
    return data?.vote_type || null
  },

  // Get vote counts for a listing
  async getListingVoteCounts(listingId, listingType) {
    const { data, error } = await supabase
      .from('listing_votes')
      .select('vote_type')
      .eq('listing_id', listingId)
      .eq('listing_type', listingType)
    
    if (error) {
      console.warn('getListingVoteCounts error:', error)
      return { thumbsUp: 0, thumbsDown: 0 }
    }

    const counts = {
      thumbsUp: (data || []).filter(d => d.vote_type === 'up').length,
      thumbsDown: (data || []).filter(d => d.vote_type === 'down').length
    }
    return counts
  },

  // Submit or update a vote
  async submitListingVote(listingId, listingType, userId, voteType) {
    if (!userId) throw new Error('User not authenticated')
    
    const { error } = await supabase
      .from('listing_votes')
      .upsert({
        listing_id: listingId,
        listing_type: listingType,
        user_id: userId,
        vote_type: voteType
      }, { onConflict: 'listing_id,listing_type,user_id' })
    
    if (error) throw error
  },

  // Remove a vote
  async removeListingVote(listingId, listingType, userId) {
    if (!userId) throw new Error('User not authenticated')
    
    const { error } = await supabase
      .from('listing_votes')
      .delete()
      .eq('listing_id', listingId)
      .eq('listing_type', listingType)
      .eq('user_id', userId)
    
    if (error) throw error
  },

  // Get all pending listings
  async getPendingListings(status = 'pending', limit = 50) {
    const { data, error } = await supabase
      .from('pending_listings')
      .select('*')
      .eq('status', status)
      .order('created_at', { ascending: false })
      .limit(limit)
    
    if (error) throw error
    return data || []
  },

  // Submit a pending listing (new business)
  async submitPendingListing(userId, listing) {
    if (!userId) throw new Error('User not authenticated')
    
    const { data, error } = await supabase
      .from('pending_listings')
      .insert([{
        submitted_by_user_id: userId,
        name: listing.name,
        address: listing.address,
        latitude: listing.latitude ? Number(listing.latitude) : null,
        longitude: listing.longitude ? Number(listing.longitude) : null,
        rating: listing.rating ? Number(listing.rating) : null,
        category: listing.category,
        description: listing.description || null,
        status: 'pending',
        raw: listing.raw || {}
      }])
      .select()
      .single()
    
    if (error) throw error
    return data
  },

  // Get approval votes for a pending listing
  async getApprovalVotes(pendingListingId) {
    const { data, error } = await supabase
      .from('approval_votes')
      .select('vote')
      .eq('pending_listing_id', pendingListingId)
    
    if (error) throw error
    
    const votes = data || []
    return {
      approvals: votes.filter(v => v.vote === 'approve').length,
      rejections: votes.filter(v => v.vote === 'reject').length,
      total: votes.length
    }
  },

  // Get user's approval vote for a pending listing
  async getUserApprovalVote(pendingListingId, userId) {
    if (!userId) return null
    
    const { data, error } = await supabase
      .from('approval_votes')
      .select('vote')
      .eq('pending_listing_id', pendingListingId)
      .eq('user_id', userId)
      .maybeSingle()
    
    if (error) {
      console.warn('getUserApprovalVote error:', error)
      return null
    }
    return data?.vote || null
  },

  // Submit or update an approval vote
  async submitApprovalVote(pendingListingId, userId, voteType) {
    if (!userId) throw new Error('User not authenticated')
    
    const { error } = await supabase
      .from('approval_votes')
      .upsert({
        pending_listing_id: pendingListingId,
        user_id: userId,
        vote: voteType
      }, { onConflict: 'pending_listing_id,user_id' })
    
    if (error) throw error
  },

  // Approve a pending listing and move to nearby_listings
  async approvePendingListing(pendingListingId) {
    const { data: pending, error: fetchError } = await supabase
      .from('pending_listings')
      .select('*')
      .eq('id', pendingListingId)
      .single()
    
    if (fetchError) throw fetchError
    if (!pending) throw new Error('Pending listing not found')

    // Create nearby listing
    const { error: insertError } = await supabase
      .from('nearby_listings')
      .insert([{
        tripadvisor_id: `pending-${pendingListingId}-${Date.now()}`,
        name: pending.name,
        address: pending.address,
        latitude: pending.latitude,
        longitude: pending.longitude,
        rating: pending.rating,
        category: pending.category,
        source: 'community',
        raw: { ...pending.raw, pendingId: pendingListingId }
      }])
    
    if (insertError) throw insertError

    // Update pending status
    const { error: updateError } = await supabase
      .from('pending_listings')
      .update({ status: 'approved', updated_at: new Date() })
      .eq('id', pendingListingId)
    
    if (updateError) throw updateError
  },

  // Reject a pending listing
  async rejectPendingListing(pendingListingId) {
    const { error } = await supabase
      .from('pending_listings')
      .update({ status: 'rejected', updated_at: new Date() })
      .eq('id', pendingListingId)
    
    if (error) throw error
  }
}
