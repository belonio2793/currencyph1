import { supabase } from './supabaseClient'

/**
 * Fetch all public shipping ports
 */
export async function fetchShippingPorts(filters = {}) {
  try {
    let query = supabase
      .from('shipping_ports')
      .select('*')
      .eq('is_public', true)
      .order('name', { ascending: true })

    // Apply filters
    if (filters.city) {
      query = query.eq('city', filters.city)
    }
    if (filters.region) {
      query = query.eq('region', filters.region)
    }
    if (filters.status) {
      query = query.eq('status', filters.status)
    }
    if (filters.portType) {
      query = query.eq('port_type', filters.portType)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching shipping ports - Status:', error.status, 'Message:', error.message, 'Details:', error)
      throw new Error(`Failed to fetch shipping ports: ${error.message} (${error.status})`)
    }

    return data || []
  } catch (err) {
    console.error('Error in fetchShippingPorts:', err.message || err)
    throw err
  }
}

/**
 * Fetch shipping ports in a specific region/city
 */
export async function fetchShippingPortsByLocation(city = null, region = null) {
  try {
    let query = supabase
      .from('shipping_ports')
      .select('*')
      .eq('is_public', true)

    if (city) {
      query = query.eq('city', city)
    }
    if (region && !city) {
      query = query.eq('region', region)
    }

    const { data, error } = await query.order('name', { ascending: true })

    if (error) throw error
    return data || []
  } catch (err) {
    console.error('Error fetching ports by location:', err)
    throw err
  }
}

/**
 * Get a single shipping port by ID
 */
export async function getShippingPort(portId) {
  try {
    const { data, error } = await supabase
      .from('shipping_ports')
      .select('*')
      .eq('id', portId)
      .single()

    if (error) throw error
    return data
  } catch (err) {
    console.error('Error fetching shipping port:', err)
    throw err
  }
}

/**
 * Create a new shipping port (admin only)
 */
export async function createShippingPort(portData) {
  try {
    const { data: userData } = await supabase.auth.getUser()
    
    const { data, error } = await supabase
      .from('shipping_ports')
      .insert([
        {
          ...portData,
          created_by: userData.user.id,
          is_public: portData.is_public !== undefined ? portData.is_public : true
        }
      ])
      .select()

    if (error) throw error
    return data?.[0] || null
  } catch (err) {
    console.error('Error creating shipping port:', err)
    throw err
  }
}

/**
 * Update a shipping port
 */
export async function updateShippingPort(portId, updates) {
  try {
    const { data, error } = await supabase
      .from('shipping_ports')
      .update(updates)
      .eq('id', portId)
      .select()

    if (error) throw error
    return data?.[0] || null
  } catch (err) {
    console.error('Error updating shipping port:', err)
    throw err
  }
}

/**
 * Delete a shipping port
 */
export async function deleteShippingPort(portId) {
  try {
    const { error } = await supabase
      .from('shipping_ports')
      .delete()
      .eq('id', portId)

    if (error) throw error
    return true
  } catch (err) {
    console.error('Error deleting shipping port:', err)
    throw err
  }
}

/**
 * Get unique cities with shipping ports
 */
export async function getShippingPortCities() {
  try {
    const { data, error } = await supabase
      .from('shipping_ports')
      .select('city')
      .eq('is_public', true)
      .order('city', { ascending: true })

    if (error) {
      console.error('Error fetching port cities - Status:', error.status, 'Message:', error.message)
      throw new Error(`Failed to fetch cities: ${error.message}`)
    }

    // Get unique cities
    const uniqueCities = [...new Set(data.map(item => item.city))]
    return uniqueCities
  } catch (err) {
    console.error('Error fetching port cities:', err.message || err)
    throw err
  }
}

/**
 * Get unique regions with shipping ports
 */
export async function getShippingPortRegions() {
  try {
    const { data, error } = await supabase
      .from('shipping_ports')
      .select('region')
      .eq('is_public', true)
      .order('region', { ascending: true })

    if (error) throw error

    // Get unique regions
    const uniqueRegions = [...new Set(data.map(item => item.region).filter(Boolean))]
    return uniqueRegions
  } catch (err) {
    console.error('Error fetching port regions:', err)
    throw err
  }
}

/**
 * Search shipping ports by name or description
 */
export async function searchShippingPorts(query) {
  try {
    if (!query || query.trim().length === 0) {
      return []
    }

    const searchTerm = query.toLowerCase()
    const { data, error } = await supabase
      .from('shipping_ports')
      .select('*')
      .eq('is_public', true)

    if (error) throw error

    // Client-side search for name and description
    const results = data.filter(port =>
      port.name.toLowerCase().includes(searchTerm) ||
      (port.description && port.description.toLowerCase().includes(searchTerm)) ||
      (port.city && port.city.toLowerCase().includes(searchTerm))
    )

    return results
  } catch (err) {
    console.error('Error searching shipping ports:', err)
    throw err
  }
}

/**
 * Get shipping port statistics
 */
export async function getShippingPortStats() {
  try {
    const { data, error } = await supabase
      .from('shipping_ports')
      .select('*')
      .eq('is_public', true)

    if (error) {
      console.error('Error fetching port stats - Status:', error.status, 'Message:', error.message, 'Details:', error)
      throw new Error(`Failed to fetch port stats: ${error.message}`)
    }

    const stats = {
      totalPorts: data.length,
      activePortsCount: data.filter(p => p.status === 'active').length,
      internationalPorts: data.filter(p => p.port_type === 'international').length,
      domesticPorts: data.filter(p => p.port_type === 'domestic').length,
      uniqueCities: [...new Set(data.map(p => p.city))].length,
      uniqueRegions: [...new Set(data.map(p => p.region).filter(Boolean))].length,
      totalCapacity: data.reduce((sum, p) => sum + (p.annual_capacity_teu || 0), 0)
    }

    return stats
  } catch (err) {
    console.error('Error fetching port stats:', err.message || err)
    throw err
  }
}
