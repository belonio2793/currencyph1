export interface Listing {
  id: string;
  name: string;
  slug: string;
  rating: number;
  reviewCount: number;
  category: string;
  address: string;
  latitude: number;
  longitude: number;
  image: string;
  description: string;
  highlights: string[];
  bestFor: string[];
  hours: string;
  admission: string;
  website?: string;
  phone?: string;
  reviews: Review[];
}

export interface Review {
  author: string;
  rating: number;
  text: string;
  date: string;
}

export const MANILA_LISTINGS: Listing[] = [
  {
    id: "intramuros",
    name: "Intramuros",
    slug: "intramuros-manila",
    rating: 4.5,
    reviewCount: 3847,
    category: "Historical Site",
    address: "Intramuros, Manila 1002, Philippines",
    latitude: 14.5951,
    longitude: 120.9731,
    image: "https://media.tacdn.com/media/attractions-splice-spp-360x240/06/6e/e2/11.jpg",
    description: "Intramuros is the historic walled city of Manila, known as the 'City Within the City.' This 16th-century fortress has been home to Spanish colonial architecture for over 400 years. Today, it stands as a testament to Manila's rich history and cultural heritage with well-preserved Spanish colonial architecture, museums, and cultural landmarks.",
    highlights: [
      "Fort Santiago - Spanish colonial fortress",
      "Manila Cathedral - Stunning Gothic architecture",
      "San Agustin Church - Oldest stone church",
      "Rizal Monument - National monument",
      "Walls and ramparts - Historic fortifications",
      "Casa Manila - Colonial house museum",
      "Quiapo Church - Historic church"
    ],
    bestFor: [
      "History enthusiasts",
      "Culture and heritage lovers",
      "Photography",
      "Educational visits",
      "Family outings",
      "Walking tours"
    ],
    hours: "Open daily, 8:00 AM - 6:00 PM",
    admission: "Fort Santiago: ₱50 (adults), ₱25 (students/seniors)",
    website: "https://intramuros.ph",
    phone: "+63 2 527 2640",
    reviews: [
      {
        author: "Angela M.",
        rating: 5,
        text: "Amazing historical site! The preserved architecture and well-maintained grounds make it easy to imagine life centuries ago. Very educational and worth a visit.",
        date: "2024-01-15"
      },
      {
        author: "James L.",
        rating: 4,
        text: "Great location for history buffs. The walks are long but rewarding. Bring comfortable shoes and water.",
        date: "2024-01-10"
      },
      {
        author: "Maria Santos",
        rating: 5,
        text: "A must-visit destination for anyone interested in Philippine history. The atmosphere and heritage sites are incredible!",
        date: "2024-01-05"
      }
    ]
  },
  {
    id: "manila-cathedral",
    name: "Manila Cathedral",
    slug: "manila-cathedral",
    rating: 4.6,
    reviewCount: 3421,
    category: "Religious Site",
    address: "Cabildo Street, Intramuros, Manila, Philippines",
    latitude: 14.5980,
    longitude: 120.9707,
    image: "https://media.tacdn.com/media/attractions-splice-spp-360x240/0c/e5/9a/96.jpg",
    description: "The Manila Cathedral is a Roman Catholic cathedral and one of the oldest churches in the Philippines. Built in 1588, this magnificent Gothic structure has been rebuilt several times due to earthquakes and war damage.",
    highlights: [
      "Stunning Gothic architecture",
      "Beautiful stained glass windows",
      "Historic chapels and sanctuaries",
      "The Golden Dome",
      "Vibrant religious ceremonies"
    ],
    bestFor: [
      "Religious visitors",
      "Architecture enthusiasts",
      "Photography",
      "Spiritual retreats",
      "Cultural exploration"
    ],
    hours: "6:00 AM - 6:00 PM daily",
    admission: "Free (donations welcome)",
    phone: "+63 2 529 3976",
    reviews: [
      {
        author: "Maria C.",
        rating: 5,
        text: "Absolutely beautiful church. The architecture is breathtaking and the peaceful atmosphere is perfect for prayer and meditation.",
        date: "2024-01-18"
      },
      {
        author: "Robert T.",
        rating: 5,
        text: "One of the most beautiful cathedrals I've ever visited. Worth seeing, especially during religious holidays.",
        date: "2024-01-08"
      }
    ]
  },
  {
    id: "rizal-monument",
    name: "Rizal Monument",
    slug: "rizal-monument-luneta",
    rating: 4.4,
    reviewCount: 2156,
    category: "Monument",
    address: "Rizal Park, Manila, Philippines",
    latitude: 14.5893,
    longitude: 120.9888,
    image: "https://media.tacdn.com/media/attractions-splice-spp-360x240/07/52/c3/8c.jpg",
    description: "The Rizal Monument is a marble monument erected to commemorate Dr. Jose Rizal, a national hero of the Philippines. Located in Rizal Park, this iconic monument has been a symbol of patriotism and independence since its dedication in 1913.",
    highlights: [
      "Iconic statue of Dr. Jose Rizal",
      "Beautiful Rizal Park surroundings",
      "Historical significance",
      "Great photo opportunities",
      "Cultural and patriotic landmark"
    ],
    bestFor: [
      "History and culture enthusiasts",
      "Photography",
      "Family visits",
      "Learning about Philippine history",
      "Patriotic celebrations"
    ],
    hours: "Open 24/7",
    admission: "Free",
    phone: "+63 2 555 2873",
    reviews: [
      {
        author: "Luis P.",
        rating: 5,
        text: "A must-see iconic landmark in Manila. The surrounding park is beautiful and well-maintained.",
        date: "2024-01-20"
      },
      {
        author: "Isabella R.",
        rating: 4,
        text: "Great place to learn about Filipino history. The monument is impressive and the park is lovely for walks.",
        date: "2024-01-12"
      }
    ]
  },
  {
    id: "national-museum",
    name: "National Museum of the Philippines",
    slug: "national-museum-manila",
    rating: 4.3,
    reviewCount: 1876,
    category: "Museum",
    address: "P. Burgos Drive, Rizal Park, Manila, Philippines",
    latitude: 14.5883,
    longitude: 120.9878,
    image: "https://media.tacdn.com/media/attractions-splice-spp-360x240/01/99/9a/fb.jpg",
    description: "The National Museum of the Philippines is the premier museum of the country, featuring world-class collections of natural history, fine art, and anthropology. It showcases the country's rich cultural heritage.",
    highlights: [
      "Fine art collection",
      "Natural history exhibits",
      "Anthropology displays",
      "National patrimony artifacts",
      "Educational programs"
    ],
    bestFor: [
      "Culture enthusiasts",
      "Students",
      "Art lovers",
      "History buffs",
      "Family outings"
    ],
    hours: "10:00 AM - 5:00 PM (Closed Mondays)",
    admission: "₱100 (adults), ₱50 (students/seniors)",
    website: "https://www.nationalmuseum.gov.ph",
    phone: "+63 2 527 3000",
    reviews: [
      {
        author: "David K.",
        rating: 4,
        text: "Excellent museum with diverse collections. Very educational and well-curated. Definitely worth a visit.",
        date: "2024-01-19"
      },
      {
        author: "Grace S.",
        rating: 4,
        text: "Great place to spend a few hours learning about Philippine history and culture.",
        date: "2024-01-14"
      }
    ]
  },
  {
    id: "san-agustin-church",
    name: "San Agustin Church",
    slug: "san-agustin-church-manila",
    rating: 4.7,
    reviewCount: 2534,
    category: "Religious Site",
    address: "General Luna Street, Intramuros, Manila, Philippines",
    latitude: 14.5952,
    longitude: 120.9655,
    image: "https://media.tacdn.com/media/attractions-splice-spp-360x240/0d/68/a8/29.jpg",
    description: "San Agustin Church is the oldest stone church in the Philippines, built in the 16th century. It's an architectural gem and UNESCO World Heritage Site, showcasing the fusion of Baroque and Oriental design.",
    highlights: [
      "Oldest stone church in the Philippines",
      "UNESCO World Heritage Site",
      "Baroque architecture",
      "Historic organ",
      "Beautiful interior"
    ],
    bestFor: [
      "Architecture enthusiasts",
      "Religious visitors",
      "History lovers",
      "Photography",
      "Cultural heritage tours"
    ],
    hours: "8:00 AM - 5:00 PM daily",
    admission: "₱50 per person",
    website: "https://sanagustinchurch.org.ph",
    phone: "+63 2 527 9288",
    reviews: [
      {
        author: "Patricia L.",
        rating: 5,
        text: "Absolutely stunning church! The architecture is incredible and it's amazing to think this building has stood for over 400 years.",
        date: "2024-01-17"
      },
      {
        author: "Michael R.",
        rating: 5,
        text: "One of the most beautiful churches I've ever seen. The attention to detail in the architecture is remarkable.",
        date: "2024-01-09"
      }
    ]
  },
  {
    id: "ayala-museum",
    name: "Ayala Museum",
    slug: "ayala-museum-makati",
    rating: 4.4,
    reviewCount: 1543,
    category: "Museum",
    address: "Makati Avenue, Makati City, Philippines",
    latitude: 14.5550,
    longitude: 121.0177,
    image: "https://media.tacdn.com/media/attractions-splice-spp-360x240/0a/6a/7b/ce.jpg",
    description: "The Ayala Museum is a premier museum in Metro Manila featuring world-class exhibitions of Philippine cultural heritage, ancient jewelry, historical artifacts, and contemporary art.",
    highlights: [
      "Pre-Hispanic gold jewelry collection",
      "Diorama exhibits of Philippine history",
      "Contemporary art galleries",
      "Cultural heritage displays",
      "Special exhibitions"
    ],
    bestFor: [
      "Art and history lovers",
      "Culture enthusiasts",
      "Students",
      "Families",
      "Photography"
    ],
    hours: "10:00 AM - 6:00 PM (Closed Mondays)",
    admission: "₱275 (adults), ₱150 (students/seniors)",
    website: "https://www.ayalamuseum.org",
    phone: "+63 2 759 8888",
    reviews: [
      {
        author: "Amanda T.",
        rating: 4,
        text: "Wonderful museum with excellent exhibits on Philippine history and culture. Very well organized and informative.",
        date: "2024-01-16"
      },
      {
        author: "Thomas B.",
        rating: 5,
        text: "Fantastic museum! The collections are impressive and the displays are beautifully curated.",
        date: "2024-01-11"
      }
    ]
  }
];

export function getListingBySlug(slug: string): Listing | undefined {
  return MANILA_LISTINGS.find(l => l.slug === slug);
}

export function getAllListings(): Listing[] {
  return MANILA_LISTINGS;
}

export function getRelatedListings(currentSlug: string, count = 3): Listing[] {
  return MANILA_LISTINGS
    .filter(l => l.slug !== currentSlug)
    .slice(0, count);
}
