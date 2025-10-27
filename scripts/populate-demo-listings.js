#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.PROJECT_URL || process.env.VITE_PROJECT_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Demo listings for major Philippine cities
const DEMO_LISTINGS = [
  // Manila - Attractions
  {
    tripadvisor_id: 'demo_1',
    name: 'National Museum of the Philippines',
    address: 'P. Burgos Drive, Rizal Park, Manila',
    city: 'Manila',
    country: 'Philippines',
    category: 'attractions',
    location_type: 'Attraction',
    rating: 4.5,
    review_count: 1250,
    description: 'Houses significant Filipino art and cultural artifacts. The museum complex includes art, anthropology, and natural history museums with extensive collections.',
    latitude: 14.5740,
    longitude: 120.9754,
    lat: 14.5740,
    lng: 120.9754,
    website: 'https://www.nationalmuseum.ph',
    phone_number: '+63 2 5254-5000',
    image_url: 'https://images.unsplash.com/photo-1550493473-be67b725567f?w=600&h=400&fit=crop&auto=format&q=80',
    photo_count: 156,
    highlights: ['Detailed info', '156 photos', 'Award winner', 'Highly rated'],
    duration: '2-4 hours',
    price_range: '$$',
    verified: true,
    fetch_status: 'success'
  },
  {
    tripadvisor_id: 'demo_2',
    name: 'Fort Santiago',
    address: 'General Luna Street, Intramuros, Manila',
    city: 'Manila',
    country: 'Philippines',
    category: 'attractions',
    location_type: 'Attraction',
    rating: 4.3,
    review_count: 980,
    description: 'Historic fortress built by Spanish colonial forces. Features restored citadel walls and dungeons that served as a prison during WWII.',
    latitude: 14.5995,
    longitude: 120.9830,
    lat: 14.5995,
    lng: 120.9830,
    website: 'https://www.nps.gov.ph',
    phone_number: '+63 2 5527-3040',
    image_url: 'https://images.unsplash.com/photo-1511239797713-2e201b853492?w=600&h=400&fit=crop&auto=format&q=80',
    photo_count: 234,
    highlights: ['Historical', '234 photos', 'Guided tours'],
    duration: '1-2 hours',
    price_range: '$',
    verified: true,
    fetch_status: 'success'
  },
  {
    tripadvisor_id: 'demo_3',
    name: 'Malate Church',
    address: 'Gen. Luna St, Malate, Manila',
    city: 'Manila',
    country: 'Philippines',
    category: 'attractions',
    location_type: 'Attraction',
    rating: 4.2,
    review_count: 520,
    description: 'Historic Roman Catholic church dating back to 1588. Features intricate architecture and religious artwork.',
    latitude: 14.5747,
    longitude: 120.9801,
    lat: 14.5747,
    lng: 120.9801,
    image_url: 'https://images.unsplash.com/photo-1464207687429-7505649dae38?w=600&h=400&fit=crop&auto=format&q=80',
    photo_count: 89,
    highlights: ['Religious site', 'Architecture'],
    duration: '45 mins - 1 hour',
    price_range: 'Free',
    verified: true,
    fetch_status: 'success'
  },
  // Cebu - Attractions
  {
    tripadvisor_id: 'demo_4',
    name: 'Magellan\'s Cross',
    address: 'Osmeña Boulevard, Cebu City',
    city: 'Cebu City',
    country: 'Philippines',
    category: 'attractions',
    location_type: 'Attraction',
    rating: 4.4,
    review_count: 1450,
    description: 'Historic cross erected by Portuguese explorer Ferdinand Magellan in 1521, marking the introduction of Christianity to the Philippines.',
    latitude: 10.2967,
    longitude: 123.8854,
    lat: 10.2967,
    lng: 123.8854,
    image_url: 'https://images.unsplash.com/photo-1605980776566-48ee3e2f24e0?w=600&h=400&fit=crop&auto=format&q=80',
    photo_count: 234,
    highlights: ['Historical', 'Free entry', 'Religious site'],
    duration: '30 mins',
    price_range: 'Free',
    verified: true,
    fetch_status: 'success'
  },
  {
    tripadvisor_id: 'demo_5',
    name: 'Cebu Safari and Adventure Park',
    address: 'Brgy Biasong, San Fernando, Cebu',
    city: 'Cebu City',
    country: 'Philippines',
    category: 'attractions',
    location_type: 'Attraction',
    rating: 4.1,
    review_count: 687,
    description: 'Wildlife park featuring safari rides, animal interactions, and adventure activities. Great for families.',
    latitude: 10.3258,
    longitude: 123.7658,
    lat: 10.3258,
    lng: 123.7658,
    website: 'https://cebusafari.com',
    phone_number: '+63 32 5505-2020',
    image_url: 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=600&h=400&fit=crop&auto=format&q=80',
    photo_count: 456,
    highlights: ['Family-friendly', '456 photos', 'Adventure activities'],
    duration: '4-5 hours',
    price_range: '$$$',
    verified: true,
    fetch_status: 'success'
  },
  // Restaurants
  {
    tripadvisor_id: 'demo_6',
    name: 'Abe Restaurant',
    address: 'Roxas Boulevard, Manila',
    city: 'Manila',
    country: 'Philippines',
    category: 'restaurants',
    location_type: 'Restaurant',
    rating: 4.6,
    review_count: 2100,
    description: 'Upscale Japanese-Filipino fusion cuisine with stunning bay view. Award-winning chef and innovative dishes.',
    latitude: 14.5621,
    longitude: 120.9730,
    lat: 14.5621,
    lng: 120.9730,
    website: 'https://aberestaurant.ph',
    phone_number: '+63 2 5526-5022',
    image_url: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&h=400&fit=crop&auto=format&q=80',
    photo_count: 312,
    highlights: ['Fine dining', 'Bay view', 'Award winner', 'Highly rated'],
    duration: '2-3 hours',
    price_range: '$$$$',
    verified: true,
    fetch_status: 'success'
  },
  {
    tripadvisor_id: 'demo_7',
    name: 'Aristocrat',
    address: 'Corner of Roxas Boulevard and Magdalo Street, Manila',
    city: 'Manila',
    country: 'Philippines',
    category: 'restaurants',
    location_type: 'Restaurant',
    rating: 4.2,
    review_count: 1850,
    description: 'Classic Filipino restaurant serving traditional dishes since 1936. Casual dining with authentic flavors.',
    latitude: 14.5641,
    longitude: 120.9745,
    lat: 14.5641,
    lng: 120.9745,
    website: 'https://aristocrat.com.ph',
    phone_number: '+63 2 5521-2503',
    image_url: 'https://images.unsplash.com/photo-1514432324607-2e467f4851e9?w=600&h=400&fit=crop&auto=format&q=80',
    photo_count: 187,
    highlights: ['Filipino cuisine', 'Historic', 'Casual dining'],
    duration: '1-2 hours',
    price_range: '$$',
    verified: true,
    fetch_status: 'success'
  },
  {
    tripadvisor_id: 'demo_8',
    name: 'Lantaw Native Restaurant',
    address: 'Punta Engano, Mactan, Cebu',
    city: 'Cebu City',
    country: 'Philippines',
    category: 'restaurants',
    location_type: 'Restaurant',
    rating: 4.4,
    review_count: 1620,
    description: 'Beachfront restaurant serving fresh seafood and traditional Cebuano dishes with stunning ocean views.',
    latitude: 10.3167,
    longitude: 123.9833,
    lat: 10.3167,
    lng: 123.9833,
    website: 'https://lantaw.com',
    phone_number: '+63 32 5495-1817',
    image_url: 'https://images.unsplash.com/photo-1517457373614-b7152f800fd1?w=600&h=400&fit=crop&auto=format&q=80',
    photo_count: 298,
    highlights: ['Seafood', 'Beachfront', 'Ocean view'],
    duration: '2-3 hours',
    price_range: '$$',
    verified: true,
    fetch_status: 'success'
  },
  // Hotels
  {
    tripadvisor_id: 'demo_9',
    name: 'Manila Hotel',
    address: 'One Rizal Park, Manila',
    city: 'Manila',
    country: 'Philippines',
    category: 'hotels',
    location_type: 'Hotel',
    rating: 4.5,
    review_count: 3200,
    description: 'Iconic luxury hotel dating since 1912 with colonial charm and modern amenities. Prime location near Rizal Park.',
    latitude: 14.5735,
    longitude: 120.9748,
    lat: 14.5735,
    lng: 120.9748,
    website: 'https://www.manillahotel.com.ph',
    phone_number: '+63 2 5723-0011',
    image_url: 'https://images.unsplash.com/photo-1544659206-cd5a8e48d3d7?w=600&h=400&fit=crop&auto=format&q=80',
    photo_count: 567,
    highlights: ['Luxury', '5-star', 'Historic', 'Award winner'],
    duration: 'Multiple nights',
    price_range: '$$$$',
    verified: true,
    fetch_status: 'success'
  },
  {
    tripadvisor_id: 'demo_10',
    name: 'Waterfront Cebu City Hotel and Casino',
    address: 'Salinas Drive, Lapulapu City, Cebu',
    city: 'Cebu City',
    country: 'Philippines',
    category: 'hotels',
    location_type: 'Hotel',
    rating: 4.2,
    review_count: 2450,
    description: 'Beachfront resort with casino, spa, and multiple dining options. Great for families and business travelers.',
    latitude: 10.3167,
    longitude: 123.9833,
    lat: 10.3167,
    lng: 123.9833,
    website: 'https://www.waterfrontcebucity.com',
    phone_number: '+63 32 5032-8888',
    image_url: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=600&h=400&fit=crop&auto=format&q=80',
    photo_count: 421,
    highlights: ['Beachfront', '4-star', 'Casino', 'Spa'],
    duration: 'Multiple nights',
    price_range: '$$$',
    verified: true,
    fetch_status: 'success'
  },
];

async function main() {
  console.log('\n🎬 Populating Database with Demo Listings');
  console.log('========================================\n');

  try {
    // Upsert all listings
    const { error } = await supabase
      .from('nearby_listings')
      .upsert(DEMO_LISTINGS, { onConflict: 'tripadvisor_id' });

    if (error) {
      console.error('❌ Error inserting listings:', error);
      process.exit(1);
    }

    console.log(`✅ Successfully inserted ${DEMO_LISTINGS.length} demo listings\n`);
    console.log('📊 Listings by Category:');
    console.log('  - Attractions: 5');
    console.log('  - Restaurants: 3');
    console.log('  - Hotels: 2\n');

    console.log('📍 Cities Covered:');
    console.log('  - Manila (5 listings)');
    console.log('  - Cebu City (5 listings)\n');

    console.log('🎯 Next Steps:');
    console.log('  1. Go to http://localhost:5173/nearby');
    console.log('  2. Use the A-Z selector to browse cities');
    console.log('  3. Click a city to see its listings');
    console.log('  4. View detailed information for each listing\n');

    console.log('📝 To add real TripAdvisor data:');
    console.log('  1. Verify your TripAdvisor API key is correct');
    console.log('  2. Check API key permissions (private API access)');
    console.log('  3. Run: npm run fetch-all-cities-node\n');

    console.log('✅ Demo data loaded successfully!\n');
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

main();
