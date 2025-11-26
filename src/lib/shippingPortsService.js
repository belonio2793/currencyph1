import { supabase, executeWithRetry } from './supabaseClient'

/**
 * Fetch all public shipping ports with retry logic
 */
export async function fetchShippingPorts(filters = {}) {
  try {
    return await executeWithRetry(async () => {
      let query = supabase
        .from('shipping_ports')
        .select('*')
        .eq('is_active', true)
        .order('port_name', { ascending: true })

      // Apply filters
      if (filters.city) {
        query = query.eq('city', filters.city)
      }
      if (filters.province) {
        query = query.eq('province', filters.province)
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
    }, 3)
  } catch (err) {
    console.error('Error in fetchShippingPorts:', err.message || err)
    throw err
  }
}

/**
 * Fetch shipping ports in a specific region/city with retry logic
 */
export async function fetchShippingPortsByLocation(city = null, province = null) {
  try {
    return await executeWithRetry(async () => {
      let query = supabase
        .from('shipping_ports')
        .select('*')
        .eq('is_active', true)

      if (city) {
        query = query.eq('city', city)
      }
      if (province && !city) {
        query = query.eq('province', province)
      }

      const { data, error } = await query.order('port_name', { ascending: true })

      if (error) throw error
      return data || []
    }, 3)
  } catch (err) {
    console.error('Error fetching ports by location:', err)
    throw err
  }
}

/**
 * Get a single shipping port by ID with retry logic
 */
export async function getShippingPort(portId) {
  try {
    return await executeWithRetry(async () => {
      const { data, error } = await supabase
        .from('shipping_ports')
        .select('*')
        .eq('id', portId)
        .single()

      if (error) throw error
      return data
    }, 3)
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
 * Get unique cities with shipping ports with retry logic
 */
export async function getShippingPortCities() {
  try {
    return await executeWithRetry(async () => {
      const { data, error } = await supabase
        .from('shipping_ports')
        .select('city')
        .eq('is_active', true)
        .order('city', { ascending: true })

      if (error) {
        console.error('Error fetching port cities - Status:', error.status, 'Message:', error.message)
        throw new Error(`Failed to fetch cities: ${error.message}`)
      }

      // Get unique cities
      const uniqueCities = [...new Set(data.map(item => item.city).filter(Boolean))]
      return uniqueCities
    }, 3)
  } catch (err) {
    console.error('Error fetching port cities:', err.message || err)
    return []
  }
}

/**
 * Get unique regions with shipping ports with retry logic
 */
export async function getShippingPortRegions() {
  try {
    return await executeWithRetry(async () => {
      const { data, error } = await supabase
        .from('shipping_ports')
        .select('province')
        .eq('is_active', true)
        .order('province', { ascending: true })

      if (error) {
        console.error('Error fetching port provinces - Status:', error.status, 'Message:', error.message)
        throw new Error(`Failed to fetch provinces: ${error.message}`)
      }

      // Get unique provinces
      const uniqueProvinces = [...new Set(data.map(item => item.province).filter(Boolean))]
      return uniqueProvinces
    }, 3)
  } catch (err) {
    console.error('Error fetching port provinces:', err.message || err)
    return []
  }
}

/**
 * Search shipping ports by name or description with retry logic
 */
export async function searchShippingPorts(query) {
  try {
    if (!query || query.trim().length === 0) {
      return []
    }

    return await executeWithRetry(async () => {
      const searchTerm = query.toLowerCase()
      const { data, error } = await supabase
        .from('shipping_ports')
        .select('*')
        .eq('is_active', true)

      if (error) throw error

      // Client-side search for port_name and city
      const results = data.filter(port =>
        port.port_name.toLowerCase().includes(searchTerm) ||
        (port.port_code && port.port_code.toLowerCase().includes(searchTerm)) ||
        (port.city && port.city.toLowerCase().includes(searchTerm)) ||
        (port.province && port.province.toLowerCase().includes(searchTerm))
      )

      return results
    }, 3)
  } catch (err) {
    console.error('Error searching shipping ports:', err)
    return []
  }
}

/**
 * Get shipping port statistics with retry logic
 */
export async function getShippingPortStats() {
  try {
    return await executeWithRetry(async () => {
      const { data, error } = await supabase
        .from('shipping_ports')
        .select('*')
        .eq('is_active', true)

      if (error) {
        console.error('Error fetching port stats - Status:', error.status, 'Message:', error.message, 'Details:', error)
        throw new Error(`Failed to fetch port stats: ${error.message}`)
      }

      const stats = {
        totalPorts: data.length,
        activePortsCount: data.filter(p => p.is_active).length,
        internationalPorts: data.filter(p => p.port_type === 'international').length,
        domesticPorts: data.filter(p => p.port_type === 'domestic').length,
        uniqueCities: [...new Set(data.map(p => p.city))].length,
        uniqueRegions: [...new Set(data.map(p => p.province).filter(Boolean))].length,
        totalCapacity: data.reduce((sum, p) => sum + (p.annual_capacity_teu || 0), 0)
      }

      return stats
    }, 3)
  } catch (err) {
    console.error('Error fetching port stats:', err.message || err)
    return {
      totalPorts: 0,
      activePortsCount: 0,
      internationalPorts: 0,
      domesticPorts: 0,
      uniqueCities: 0,
      uniqueRegions: 0,
      totalCapacity: 0
    }
  }
}
