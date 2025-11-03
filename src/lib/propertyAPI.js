import { supabase } from './supabaseClient'

export async function listPropertiesByCity(city) {
  const { data, error } = await supabase
    .from('properties')
    .select('*')
    .eq('city', city)
    .order('created_at', { ascending: true })

  if (error) throw error
  return data || []
}

export async function getProperty(id) {
  const { data, error } = await supabase
    .from('properties')
    .select('*')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export function subscribeToProperties(city, onChange) {
  // Listen to realtime changes for properties in a city
  try {
    const channel = supabase
      .channel(`properties:city=${city}`)

    channel.on('postgres_changes', { event: '*', schema: 'public', table: 'properties', filter: `city=eq.${city}` }, (payload) => {
      if (onChange) onChange(payload)
    })

    channel.subscribe()
    return channel
  } catch (e) {
    console.warn('Realtime subscription failed', e)
    return null
  }
}

export async function createProperty(property) {
  const { data, error } = await supabase
    .from('properties')
    .insert([property])
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updatePropertyPrice(propertyId, newPrice) {
  const { data, error } = await supabase
    .from('properties')
    .update({ price: newPrice, updated_at: new Date() })
    .eq('id', propertyId)
    .select()
    .single()
  if (error) throw error
  // insert price_history record
  try {
    await supabase.from('price_history').insert([{ property_id: propertyId, price: newPrice, source: 'admin_update' }])
  } catch(e) {
    console.warn('failed to record price_history', e)
  }
  return data
}

export async function buyPropertyAtomic(buyerId, propertyId) {
  // Calls the SQL function created in migration: buy_property_atomic
  const { data, error } = await supabase.rpc('buy_property_atomic', { buyer: buyerId, prop_id: propertyId })
  if (error) throw error
  return data
}

export default {
  listPropertiesByCity,
  getProperty,
  subscribeToProperties,
  createProperty,
  updatePropertyPrice,
  buyPropertyAtomic
}
