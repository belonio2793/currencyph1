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
    rating: 4.1,
    reviewCount: 3645,
    category: "Historical Site",
    address: "Intramuros, Manila 1002, Philippines",
    latitude: 14.5951,
    longitude: 120.9731,
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/96/Intramuros%2C_Manila_by_Dominic_Sansone.jpg/1280px-Intramuros%2C_Manila_by_Dominic_Sansone.jpg",
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
    rating: 4.2,
    reviewCount: 1176,
    category: "Religious Site",
    address: "Cabildo Street, Intramuros, Manila, Philippines",
    latitude: 14.5980,
    longitude: 120.9707,
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f7/Manila_Cathedral_2015.jpg/1280px-Manila_Cathedral_2015.jpg",
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
    id: "luneta-park",
    name: "Rizal Park (Luneta Park)",
    slug: "rizal-park-luneta",
    rating: 4.5,
    reviewCount: 29795,
    category: "Park",
    address: "Roxas Boulevard, Manila, Philippines",
    latitude: 14.5893,
    longitude: 120.9888,
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/51/Luneta_Park_Rizal_Monument.JPG/1280px-Luneta_Park_Rizal_Monument.JPG",
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
    id: "national-museum-fine-arts",
    name: "National Museum of Fine Arts",
    slug: "national-museum-fine-arts-manila",
    rating: 4.7,
    reviewCount: 8865,
    category: "Museum",
    address: "P. Burgos Drive, Rizal Park, Manila, Philippines",
    latitude: 14.5883,
    longitude: 120.9878,
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0d/National_Museum_of_Fine_Arts%2C_Manila%2C_Philippines.jpg/1280px-National_Museum_of_Fine_Arts%2C_Manila%2C_Philippines.jpg",
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
    rating: 4.3,
    reviewCount: 1604,
    category: "Religious Site",
    address: "General Luna Street, Intramuros, Manila, Philippines",
    latitude: 14.5952,
    longitude: 120.9655,
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e0/San_Agustin_Church_07.jpg/1280px-San_Agustin_Church_07.jpg",
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
    reviewCount: 1943,
    category: "Museum",
    address: "Makati Avenue, Makati City, Philippines",
    latitude: 14.5550,
    longitude: 121.0177,
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2f/Ayala_Museum_Makati_City.jpg/1280px-Ayala_Museum_Makati_City.jpg",
    description: "The Ayala Museum is a premier museum in Metro Manila featuring world-class exhibitions of Philippine cultural heritage, ancient jewelry, historical artifacts, and contemporary art. Located in Makati, it showcases the country's most treasured collections.",
    highlights: [
      "Pre-Hispanic gold jewelry collection",
      "Diorama exhibits of Philippine history",
      "Contemporary art galleries",
      "Cultural heritage displays",
      "Special exhibitions",
      "Interactive exhibits"
    ],
    bestFor: [
      "Art and history lovers",
      "Culture enthusiasts",
      "Students",
      "Families",
      "Photography",
      "School groups"
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
      },
      {
        author: "John D.",
        rating: 5,
        text: "Excellent representation of Philippine cultural heritage. A must-see for anyone interested in Asian art and history.",
        date: "2024-01-02"
      }
    ]
  },
  {
    id: "fort-santiago",
    name: "Fort Santiago",
    slug: "fort-santiago-manila",
    rating: 4.5,
    reviewCount: 11922,
    category: "Historical Site",
    address: "General Luna Street, Intramuros, Manila, Philippines",
    latitude: 14.5952,
    longitude: 120.9731,
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/54/Fort_Santiago_Park%2C_Manila.jpg/1280px-Fort_Santiago_Park%2C_Manila.jpg",
    description: "Fort Santiago is a historic Spanish colonial fortress located within Intramuros, Manila. Built in 1571, it's one of the most significant historical sites in the Philippines and the birthplace of national hero Dr. Jose Rizal. The fort features beautifully preserved structures and museums.",
    highlights: [
      "Spanish stone fortress",
      "Rizal Shrine and Museum",
      "Underground tunnels and dungeons",
      "Beautiful stone walls",
      "Historic gates and bastions",
      "Scenic views of Pasig River",
      "Well-preserved colonial architecture"
    ],
    bestFor: [
      "History enthusiasts",
      "Museum visitors",
      "Photography",
      "Educational tours",
      "Culture lovers",
      "Families",
      "Walking tours"
    ],
    hours: "9:00 AM - 6:00 PM daily",
    admission: "₱100 (adults), ₱50 (students/seniors)",
    website: "https://www.fortsantiago.ph",
    phone: "+63 2 527 2640",
    reviews: [
      {
        author: "Patricia L.",
        rating: 5,
        text: "One of Manila's most important historical sites. The Rizal shrine is particularly moving. Highly recommended!",
        date: "2024-01-17"
      },
      {
        author: "Michael R.",
        rating: 5,
        text: "Excellent preservation of colonial architecture. The dungeon tours are fascinating and give great insight into Manila's past.",
        date: "2024-01-09"
      }
    ]
  },
  {
    id: "quiapo-church",
    name: "Minor Basilica of the Black Nazarene (Quiapo Church)",
    slug: "quiapo-church-manila",
    rating: 4.2,
    reviewCount: 1876,
    category: "Religious Site",
    address: "M.H. Del Pilar Street, Quiapo, Manila, Philippines",
    latitude: 14.5965,
    longitude: 120.9808,
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/Quiapo_Church_facade%2C_Manila%2C_Philippines.jpg/1280px-Quiapo_Church_facade%2C_Manila%2C_Philippines.jpg",
    description: "Quiapo Church, officially the Minor Basilica of the Black Nazarene, is one of the oldest churches in Manila and one of the most visited religious sites in the Philippines. Its iconic black statue attracts millions of devotees annually.",
    highlights: [
      "Iconic Black Nazarene statue",
      "Gothic-Renaissance architecture",
      "Historic religious site",
      "Beautiful interior designs",
      "Annual Sinulog festival",
      "Important pilgrimage destination",
      "Ornate decorations"
    ],
    bestFor: [
      "Religious pilgrims",
      "Architecture enthusiasts",
      "Photography",
      "Cultural exploration",
      "Spiritual visits",
      "History lovers"
    ],
    hours: "5:00 AM - 6:00 PM daily",
    admission: "Free",
    phone: "+63 2 732 3677",
    reviews: [
      {
        author: "Rosa C.",
        rating: 5,
        text: "A deeply spiritual place. The devotion of the people and the historical significance of this basilica is remarkable.",
        date: "2024-01-14"
      },
      {
        author: "Antonio M.",
        rating: 4,
        text: "Beautiful church with rich history. Very busy on weekends, so best visited on weekdays for a peaceful experience.",
        date: "2024-01-08"
      }
    ]
  },
  {
    id: "casa-manila",
    name: "Casa Manila",
    slug: "casa-manila-intramuros",
    rating: 4.5,
    reviewCount: 1234,
    category: "Museum",
    address: "General Luna Street, Intramuros, Manila, Philippines",
    latitude: 14.5956,
    longitude: 120.9668,
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a7/Casa_Manila_exterior%2C_Manila%2C_Philippines.jpg/1280px-Casa_Manila_exterior%2C_Manila%2C_Philippines.jpg",
    description: "Casa Manila is a restored 18th-century townhouse museum located in Intramuros. It offers visitors an intimate glimpse into the daily life of Manila's Spanish colonial upper class with period furniture, decorations, and authentic architectural details.",
    highlights: [
      "18th-century Spanish colonial mansion",
      "Authentic period furniture and decor",
      "Courtyard with period plants",
      "Kitchen exhibits",
      "Bedroom displays",
      "Living room recreation",
      "Architectural tour"
    ],
    bestFor: [
      "History enthusiasts",
      "Architecture lovers",
      "Photography",
      "Museum visitors",
      "Educational groups",
      "Cultural tours",
      "Heritage lovers"
    ],
    hours: "9:00 AM - 5:00 PM (Closed Mondays)",
    admission: "₱100 (adults), ₱50 (students/seniors)",
    phone: "+63 2 527 2490",
    reviews: [
      {
        author: "Elizabeth S.",
        rating: 5,
        text: "A wonderful museum that perfectly captures life during the Spanish colonial period. The attention to detail is impressive.",
        date: "2024-01-16"
      },
      {
        author: "David H.",
        rating: 5,
        text: "Intimate and well-preserved. This gives you a real sense of how Manila's colonial elite lived.",
        date: "2024-01-07"
      }
    ]
  },
  {
    id: "chinese-cemetery",
    name: "Chinese Cemetery of Manila",
    slug: "chinese-cemetery-manila",
    rating: 4.3,
    reviewCount: 876,
    category: "Historical Site",
    address: "Lavish Road, Santa Cruz, Manila, Philippines",
    latitude: 14.6099,
    longitude: 121.0087,
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/51/Chinese_Cemetery_Manila_4.jpg/1280px-Chinese_Cemetery_Manila_4.jpg",
    description: "The Chinese Cemetery of Manila is one of the oldest and most historically significant Chinese cemeteries in the world. It features ornate family tombs, mausoleums, and monuments that reflect centuries of Chinese-Filipino heritage and architecture.",
    highlights: [
      "Historic Chinese tombs and mausoleums",
      "Ornate architectural designs",
      "Chinese-Filipino cultural heritage",
      "Centuries of history",
      "Beautiful traditional structures",
      "Historical significance",
      "Photo opportunities"
    ],
    bestFor: [
      "History enthusiasts",
      "Cultural explorers",
      "Photography",
      "Heritage lovers",
      "Educational groups",
      "Architecture buffs",
      "Genealogy researchers"
    ],
    hours: "8:00 AM - 5:00 PM daily",
    admission: "₱30 per person",
    phone: "+63 2 731 5058",
    reviews: [
      {
        author: "Wong M.",
        rating: 5,
        text: "A fascinating glimpse into the Chinese-Filipino heritage. The architecture and craftsmanship of the tombs is remarkable.",
        date: "2024-01-13"
      },
      {
        author: "Sophia L.",
        rating: 4,
        text: "Unique historical site. A bit off the beaten path but definitely worth visiting for cultural understanding.",
        date: "2024-01-04"
      }
    ]
  },
  {
    id: "marikina-shoe-museum",
    name: "Marikina Shoe Museum",
    slug: "marikina-shoe-museum",
    rating: 4.2,
    reviewCount: 654,
    category: "Museum",
    address: "Andres Bonifacio Avenue, Marikina, Philippines",
    latitude: 14.5740,
    longitude: 121.0299,
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/Marikina_Shoe_Museum.jpg/1280px-Marikina_Shoe_Museum.jpg",
    description: "The Marikina Shoe Museum showcases the world's largest personal collection of shoes. This unique museum features thousands of footwear pieces from around the world and tells the story of Marikina's renowned shoe-making heritage.",
    highlights: [
      "World's largest personal shoe collection",
      "Thousands of designer and traditional shoes",
      "International footwear exhibits",
      "Historical shoe displays",
      "Celebrity shoe collection",
      "Marikina heritage exhibits",
      "Manufacturing displays"
    ],
    bestFor: [
      "Fashion enthusiasts",
      "Collectors",
      "Photography",
      "Unique museums",
      "Families",
      "Fashion students",
      "Culture lovers"
    ],
    hours: "9:00 AM - 5:00 PM (Closed Mondays)",
    admission: "₱200 (adults), ₱100 (students)",
    phone: "+63 2 645 1000",
    reviews: [
      {
        author: "Maria G.",
        rating: 5,
        text: "A truly unique museum! The collection is impressive and it's fascinating to learn about Marikina's shoe-making tradition.",
        date: "2024-01-12"
      },
      {
        author: "Fashion Designer",
        rating: 5,
        text: "Every fashion lover must visit. The craftsmanship displayed here is inspiring and educational.",
        date: "2024-01-01"
      }
    ]
  },
  {
    id: "national-library",
    name: "National Library of the Philippines",
    slug: "national-library-philippines",
    rating: 4.1,
    reviewCount: 512,
    category: "Museum",
    address: "Kalaw Avenue, Rizal Park, Manila, Philippines",
    latitude: 14.5870,
    longitude: 120.9878,
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d9/National_Library_of_the_Philippines_building.jpg/1280px-National_Library_of_the_Philippines_building.jpg",
    description: "The National Library of the Philippines is an important institution housing extensive collections of Philippine books, manuscripts, rare documents, and historical records. It serves as a repository of the nation's literary and cultural heritage.",
    highlights: [
      "Extensive book collection",
      "Rare manuscripts",
      "Historical documents",
      "Philippine literature",
      "Research facilities",
      "Digital archives",
      "Special collections"
    ],
    bestFor: [
      "Book lovers",
      "Researchers",
      "Students",
      "History enthusiasts",
      "Writers",
      "Scholars",
      "Culture lovers"
    ],
    hours: "8:00 AM - 5:00 PM (Closed Sundays)",
    admission: "Free",
    phone: "+63 2 734 3000",
    reviews: [
      {
        author: "Dr. Santos",
        rating: 5,
        text: "An invaluable resource for anyone interested in Philippine history and culture. Well-organized and helpful staff.",
        date: "2024-01-11"
      },
      {
        author: "Literature Student",
        rating: 4,
        text: "Great collection of Philippine literature and historical documents. Essential for research.",
        date: "2024-01-03"
      }
    ]
  },
  {
    id: "planetarium",
    name: "Manila Planetarium",
    slug: "manila-planetarium-rizal-park",
    rating: 4.0,
    reviewCount: 743,
    category: "Museum",
    address: "Rizal Park, Manila, Philippines",
    latitude: 14.5870,
    longitude: 120.9888,
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b5/Manila_Planetarium.jpg/1280px-Manila_Planetarium.jpg",
    description: "The Manila Planetarium in Rizal Park offers immersive shows about the cosmos, celestial bodies, and astronomy. It's an educational and entertaining destination for families and students interested in space science and astronomy.",
    highlights: [
      "Planetarium shows",
      "Astronomical exhibits",
      "Interactive displays",
      "Telescope viewing",
      "Science education programs",
      "Star and constellation shows",
      "Space exploration exhibits"
    ],
    bestFor: [
      "Families with children",
      "Students",
      "Science enthusiasts",
      "Astronomy lovers",
      "Educational groups",
      "School visits",
      "Learning and discovery"
    ],
    hours: "10:00 AM - 5:00 PM (Closed Mondays)",
    admission: "₱150 (adults), ₱75 (students/children)",
    phone: "+63 2 555 2873",
    reviews: [
      {
        author: "Pedro R.",
        rating: 5,
        text: "Great educational experience for kids. The planetarium shows are engaging and visually stunning.",
        date: "2024-01-10"
      },
      {
        author: "Anna L.",
        rating: 4,
        text: "Fun and educational. Perfect for families who want to learn about space and astronomy.",
        date: "2024-01-02"
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
