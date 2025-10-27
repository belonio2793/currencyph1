import { supabase } from './supabaseClient.js'

const BUCKET_NAME = 'listing-images'
const CACHE_DURATION = 7 * 24 * 60 * 60 * 1000 // 7 days

class ImageManager {
  constructor() {
    this.urlCache = new Map()
    this.downloadQueue = []
    this.isProcessing = false
  }

  /**
   * Get image URL for a listing
   * Returns stored image URL if available, otherwise returns raw URL or placeholder
   */
  async getImageUrl(listing) {
    if (!listing) return null

    // Check cache first
    if (this.urlCache.has(listing.tripadvisor_id)) {
      return this.urlCache.get(listing.tripadvisor_id)
    }

    // If stored image path exists, get public URL
    if (listing.stored_image_path) {
      try {
        const { data } = supabase.storage
          .from(BUCKET_NAME)
          .getPublicUrl(listing.stored_image_path)

        if (data?.publicUrl) {
          this.urlCache.set(listing.tripadvisor_id, data.publicUrl)
          return data.publicUrl
        }
      } catch (err) {
        console.warn('Error getting stored image URL:', err)
      }
    }

    // Fall back to original image URL
    if (listing.image_url) {
      this.urlCache.set(listing.tripadvisor_id, listing.image_url)
      return listing.image_url
    }

    // Return null if no image available
    return null
  }

  /**
   * Generate placeholder image URL
   */
  getPlaceholderUrl(name) {
    return `https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&h=300&fit=crop&auto=format`
  }

  /**
   * Queue image for download and storage
   */
  async queueImageDownload(listing) {
    if (!listing.image_url || listing.stored_image_path) {
      return // Already stored or no image
    }

    return new Promise((resolve) => {
      this.downloadQueue.push({ listing, resolve })
      this.processQueue()
    })
  }

  /**
   * Process image download queue
   */
  async processQueue() {
    if (this.isProcessing || this.downloadQueue.length === 0) {
      return
    }

    this.isProcessing = true

    while (this.downloadQueue.length > 0) {
      const { listing, resolve } = this.downloadQueue.shift()

      try {
        const success = await this.downloadAndStoreImage(listing)
        resolve(success)
      } catch (err) {
        console.error(`Failed to download image for ${listing.name}:`, err)
        resolve(false)
      }

      // Rate limit: wait 500ms between downloads
      await new Promise(r => setTimeout(r, 500))
    }

    this.isProcessing = false
  }

  /**
   * Download image from URL and store in Supabase storage
   */
  async downloadAndStoreImage(listing) {
    if (!listing.image_url) {
      return false
    }

    try {
      // Download image
      const response = await fetch(listing.image_url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      })

      if (!response.ok) {
        console.warn(`Failed to download image: ${response.status}`)
        return false
      }

      const buffer = await response.arrayBuffer()

      // Determine file extension
      const contentType = response.headers.get('content-type')
      let ext = 'jpg'
      if (contentType?.includes('png')) ext = 'png'
      else if (contentType?.includes('webp')) ext = 'webp'
      else if (contentType?.includes('gif')) ext = 'gif'

      const fileName = `listings/${listing.tripadvisor_id}.${ext}`

      // Upload to Supabase storage
      const { data, error } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(fileName, buffer, {
          contentType,
          upsert: true,
        })

      if (error) {
        console.error('Upload error:', error)
        return false
      }

      // Update database with stored image path
      const { error: updateError } = await supabase
        .from('nearby_listings')
        .update({
          stored_image_path: fileName,
          image_downloaded_at: new Date().toISOString(),
        })
        .eq('tripadvisor_id', listing.tripadvisor_id)

      if (updateError) {
        console.error('Update error:', updateError)
        return false
      }

      // Clear cache
      this.urlCache.delete(listing.tripadvisor_id)

      return true
    } catch (err) {
      console.error('Image download error:', err)
      return false
    }
  }

  /**
   * Batch download images for multiple listings
   */
  async batchDownloadImages(listings, onProgress) {
    const total = listings.length
    let completed = 0

    for (const listing of listings) {
      await this.queueImageDownload(listing)
      completed++

      if (onProgress) {
        onProgress({ completed, total, percentage: (completed / total) * 100 })
      }

      // Small delay between batches
      await new Promise(r => setTimeout(r, 100))
    }

    return true
  }

  /**
   * Clear image cache
   */
  clearCache() {
    this.urlCache.clear()
  }

  /**
   * Get cache stats
   */
  getCacheStats() {
    return {
      cachedUrls: this.urlCache.size,
      queuedImages: this.downloadQueue.length,
      isProcessing: this.isProcessing,
    }
  }
}

export const imageManager = new ImageManager()

/**
 * React hook to get image URL with fallback
 */
export function useListingImage(listing) {
  const [imageUrl, setImageUrl] = React.useState(null)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    if (!listing) {
      setLoading(false)
      return
    }

    const loadImage = async () => {
      try {
        const url = await imageManager.getImageUrl(listing)
        setImageUrl(url || imageManager.getPlaceholderUrl(listing.name))
      } catch (err) {
        console.error('Error loading image:', err)
        setImageUrl(imageManager.getPlaceholderUrl(listing.name))
      } finally {
        setLoading(false)
      }
    }

    loadImage()
  }, [listing?.tripadvisor_id])

  return { imageUrl, loading }
}
