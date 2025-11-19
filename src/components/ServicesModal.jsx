import React, { useState, useMemo } from 'react'

const SERVICES = [
  {
    id: 'ride-share',
    label: 'Ride Share',
    icon: '🚙',
    color: 'from-cyan-500 to-cyan-600',
    description: 'Share a ride with other passengers',
    category: 'transportation',
    criteria: [
      { label: 'Passengers', icon: '👥', hint: '1-4 people' },
      { label: 'Route', icon: '🗺️', hint: 'Shared route' },
      { label: 'Cost', icon: '💰', hint: 'Split fare' }
    ],
    details: {
      maxPassengers: 4,
      baseFare: 40,
      perKm: 10
    },
    formFields: [
      { 
        name: 'passengerCount', 
        label: 'Number of Passengers', 
        type: 'number', 
        min: 1, 
        max: 4, 
        required: true,
        description: 'Including yourself'
      },
      { 
        name: 'luggageCount', 
        label: 'Luggage Items', 
        type: 'number', 
        min: 0, 
        max: 6, 
        default: 0,
        description: 'Large bags/suitcases'
      },
      { 
        name: 'hasPets', 
        label: 'Do you have pets?', 
        type: 'checkbox',
        description: 'Additional cleaning fee applies'
      },
      { 
        name: 'petType', 
        label: 'Pet Type', 
        type: 'select',
        options: [
          { value: 'dog', label: 'Dog' },
          { value: 'cat', label: 'Cat' },
          { value: 'bird', label: 'Bird' },
          { value: 'other', label: 'Other' }
        ],
        conditional: 'hasPets',
        description: 'Help us prepare for your pet'
      },
      { 
        name: 'accessibility', 
        label: 'Accessibility Requirements', 
        type: 'checkbox',
        description: 'Wheelchair accessible vehicle needed'
      },
      { 
        name: 'musicPreference', 
        label: 'Music Preference', 
        type: 'select',
        options: [
          { value: 'quiet', label: 'Quiet ride preferred' },
          { value: 'upbeat', label: 'Upbeat music' },
          { value: 'relaxing', label: 'Relaxing music' },
          { value: 'no-preference', label: 'No preference' }
        ],
        default: 'no-preference',
        description: 'Optional: Let driver know your preference'
      }
    ],
    requirements: [
      'Valid ID required',
      'Passengers must wear seatbelts',
      'No smoking or vaping',
      'Respect driver and other passengers'
    ],
    warnings: [
      'Pets incur additional ₱50-150 cleaning fee',
      'Cancelation within 5 minutes incurs ₱20 fee',
      'Luggage fees: ₱20 per item beyond 2'
    ],
    pricingBreakdown: [
      { item: 'Base Fare', value: 40, type: 'flat' },
      { item: 'Per km', value: 10, type: 'variable' },
      { item: 'Luggage Fee (per item)', value: 20, type: 'optional' },
      { item: 'Pet Cleaning Fee', value: 100, type: 'optional' },
      { item: 'Accessibility Surcharge', value: 30, type: 'optional' }
    ],
    insuranceOptions: [
      { id: 'basic', label: 'Basic Coverage', amount: 10, coverage: 'Trip cancellation' },
      { id: 'premium', label: 'Premium Coverage', amount: 25, coverage: 'Trip cancellation + personal items up to ₱5000' }
    ]
  },
  {
    id: 'package',
    label: 'Package Delivery',
    icon: '📦',
    color: 'from-purple-500 to-purple-600',
    description: 'Deliver packages and parcels',
    category: 'logistics',
    criteria: [
      { label: 'Weight', icon: '⚖️', hint: 'Up to 25kg' },
      { label: 'Size', icon: '���', hint: 'Standard boxes' },
      { label: 'Fragility', icon: '🛡️', hint: 'Handle with care' }
    ],
    details: {
      maxWeight: 25,
      maxDimensions: '60x60x80 cm',
      baseFare: 40,
      perKm: 10
    },
    formFields: [
      { 
        name: 'weight', 
        label: 'Package Weight (kg)', 
        type: 'number', 
        min: 0.1, 
        max: 25, 
        step: 0.1,
        required: true,
        description: 'Weight of the package'
      },
      { 
        name: 'length', 
        label: 'Length (cm)', 
        type: 'number', 
        min: 1, 
        max: 60,
        required: true,
        description: 'Longest dimension'
      },
      { 
        name: 'width', 
        label: 'Width (cm)', 
        type: 'number', 
        min: 1, 
        max: 60,
        required: true,
        description: 'Second dimension'
      },
      { 
        name: 'height', 
        label: 'Height (cm)', 
        type: 'number', 
        min: 1, 
        max: 80,
        required: true,
        description: 'Height/depth'
      },
      { 
        name: 'fragility', 
        label: 'Fragility Level', 
        type: 'select',
        options: [
          { value: 'none', label: 'Not fragile' },
          { value: 'medium', label: 'Medium fragility (glassware, ceramics)' },
          { value: 'high', label: 'High fragility (electronics, art)' }
        ],
        default: 'none',
        required: true,
        description: 'Determines handling care'
      },
      { 
        name: 'contents', 
        label: 'Brief Description of Contents', 
        type: 'textarea',
        maxLength: 200,
        required: true,
        description: 'What is in the package?'
      },
      { 
        name: 'signatureRequired', 
        label: 'Signature Required on Delivery', 
        type: 'checkbox',
        description: 'Add ₱15 for signature confirmation'
      },
      { 
        name: 'insuranceLevel', 
        label: 'Package Insurance', 
        type: 'select',
        options: [
          { value: 'none', label: 'No insurance' },
          { value: 'standard', label: 'Standard (₱10 for up to ₱2000 value)' },
          { value: 'premium', label: 'Premium (₱25 for up to ₱10000 value)' }
        ],
        default: 'none',
        description: 'Protect your package'
      },
      { 
        name: 'recipientAvailable', 
        label: 'Recipient Will Be Available', 
        type: 'checkbox',
        required: true,
        description: 'Packages require recipient signature'
      }
    ],
    requirements: [
      'Package must not exceed 25kg or 60x60x80cm',
      'No prohibited items (weapons, explosives, hazardous materials)',
      'Accurate weight and dimensions required',
      'Recipient contact number must be valid'
    ],
    warnings: [
      'Underreporting weight/dimensions may result in additional charges',
      'Fragile items require careful handling - extra fee applies',
      'Signature required packages incur ₱15 fee if recipient unavailable',
      'Insurance does not cover items in original packaging'
    ],
    prohibitedItems: [
      'Weapons and ammunition',
      'Explosives and flammable materials',
      'Hazardous chemicals',
      'Perishable foods',
      'Live animals',
      'High-value items without insurance',
      'Counterfeit goods'
    ],
    pricingBreakdown: [
      { item: 'Base Fare', value: 40, type: 'flat' },
      { item: 'Per km', value: 10, type: 'variable' },
      { item: 'Weight Fee (over 5kg)', value: 5, type: 'variable', unit: 'per kg' },
      { item: 'Fragile Handling', value: 30, type: 'optional' },
      { item: 'Signature Requirement', value: 15, type: 'optional' },
      { item: 'Standard Insurance', value: 10, type: 'optional' },
      { item: 'Premium Insurance', value: 25, type: 'optional' }
    ]
  },
  {
    id: 'food',
    label: 'Food Pickup',
    icon: '🍔',
    color: 'from-orange-500 to-orange-600',
    description: 'Delivery of food orders',
    category: 'food',
    criteria: [
      { label: 'Temperature', icon: '🌡️', hint: 'Insulated bag' },
      { label: 'Items', icon: '🥗', hint: 'Multiple items' },
      { label: 'Speed', icon: '⚡', hint: 'Quick delivery' }
    ],
    details: {
      maxItems: 10,
      baseFare: 35,
      perKm: 8,
      maxDeliveryTime: 45
    },
    formFields: [
      { 
        name: 'restaurantName', 
        label: 'Restaurant Name', 
        type: 'text',
        required: true,
        description: 'Where is the order from?'
      },
      { 
        name: 'itemCount', 
        label: 'Number of Items/Bags', 
        type: 'number', 
        min: 1, 
        max: 15,
        required: true,
        description: 'How many items to pickup'
      },
      { 
        name: 'foodType', 
        label: 'Food Type', 
        type: 'select',
        options: [
          { value: 'hot', label: 'Hot food (requires insulated bag)' },
          { value: 'cold', label: 'Cold food (frozen/refrigerated)' },
          { value: 'mixed', label: 'Mixed hot and cold' },
          { value: 'drinks-only', label: 'Drinks only' }
        ],
        required: true,
        description: 'Affects handling requirements'
      },
      { 
        name: 'temperature', 
        label: 'Temperature Requirements', 
        type: 'select',
        options: [
          { value: 'hot', label: 'Keep hot (above 60°C)' },
          { value: 'cold', label: 'Keep cold (below 4°C)' },
          { value: 'frozen', label: 'Keep frozen (below -5°C)' },
          { value: 'room', label: 'Room temperature' }
        ],
        required: true,
        description: 'Critical for food safety'
      },
      { 
        name: 'dietaryRestrictions', 
        label: 'Special Instructions / Allergies', 
        type: 'textarea',
        maxLength: 150,
        description: 'E.g., "No peanuts", "Extra napkins", etc.'
      },
      { 
        name: 'priority', 
        label: 'Delivery Speed', 
        type: 'select',
        options: [
          { value: 'standard', label: 'Standard (45 min)' },
          { value: 'fast', label: 'Fast (30 min) - ₱15 extra' },
          { value: 'express', label: 'Express (15 min) - ₱30 extra' }
        ],
        default: 'standard',
        description: 'Faster delivery available for rush orders'
      },
      { 
        name: 'contactlessDelivery', 
        label: 'Contactless Delivery', 
        type: 'checkbox',
        description: 'Leave at door if unavailable'
      },
      { 
        name: 'specialHandling', 
        label: 'Special Handling Required', 
        type: 'checkbox',
        description: 'E.g., fragile items, separating hot/cold'
      }
    ],
    requirements: [
      'Recipient must be available for delivery',
      'Hot food must be delivered within 45 minutes',
      'Driver will not open sealed packages',
      'Special dietary restrictions will be communicated to restaurant'
    ],
    warnings: [
      'Food quality deteriorates over time - standard delivery recommended for optimal quality',
      'Hot food requiring express delivery has limited window - may affect restaurant prep',
      'Refunds not available if food spoils due to delay caused by recipient unavailability',
      'Driver cannot verify dietary restrictions - confirm with restaurant'
    ],
    pricingBreakdown: [
      { item: 'Base Fare', value: 35, type: 'flat' },
      { item: 'Per km', value: 8, type: 'variable' },
      { item: 'Hot/Cold Insulation', value: 5, type: 'optional' },
      { item: 'Fast Delivery (30 min)', value: 15, type: 'optional' },
      { item: 'Express Delivery (15 min)', value: 30, type: 'optional' },
      { item: 'Special Handling Fee', value: 10, type: 'optional' }
    ]
  },
  {
    id: 'laundry',
    label: 'Laundry Service',
    icon: '👕',
    color: 'from-pink-500 to-pink-600',
    description: 'Laundry pickup and delivery',
    category: 'personal-care',
    criteria: [
      { label: 'Weight', icon: '⚖️', hint: 'Up to 10kg' },
      { label: 'Type', icon: '👔', hint: 'Clothes & fabric' },
      { label: 'Cleaning', icon: '✨', hint: 'Same-day service' }
    ],
    details: {
      maxWeight: 10,
      baseFare: 60,
      perKg: 8,
      pickupTime: '24-48 hours'
    },
    formFields: [
      { 
        name: 'estimatedWeight', 
        label: 'Estimated Weight (kg)', 
        type: 'number', 
        min: 0.5, 
        max: 10,
        required: true,
        description: 'Total weight of clothes'
      },
      { 
        name: 'garmentTypes', 
        label: 'Primary Garment Types', 
        type: 'select',
        options: [
          { value: 'casual', label: 'Casual wear (t-shirts, jeans)' },
          { value: 'formal', label: 'Formal wear (suits, dresses)' },
          { value: 'delicate', label: 'Delicate (silk, wool, underwear)' },
          { value: 'mixed', label: 'Mixed items' }
        ],
        required: true,
        description: 'Affects pricing and handling'
      },
      { 
        name: 'stainTreatment', 
        label: 'Stain Type(s)', 
        type: 'select',
        options: [
          { value: 'none', label: 'No stains' },
          { value: 'oil', label: 'Oil/grease stains - ₱8 extra' },
          { value: 'blood', label: 'Blood stains - ₱8 extra' },
          { value: 'wine', label: 'Wine/coffee stains - ₱8 extra' },
          { value: 'mud', label: 'Mud/dirt - included' },
          { value: 'multiple', label: 'Multiple types - ₱15 extra' }
        ],
        default: 'none',
        description: 'Special treatment may apply'
      },
      { 
        name: 'serviceType', 
        label: 'Service Type', 
        type: 'select',
        options: [
          { value: 'standard', label: 'Standard (48 hours) - ₱60' },
          { value: 'express', label: 'Express (24 hours) - ₱90' },
          { value: 'same-day', label: 'Same-day (12 hours) - ₱150' }
        ],
        required: true,
        description: 'Turnaround time'
      },
      { 
        name: 'ironing', 
        label: 'Ironing Service', 
        type: 'select',
        options: [
          { value: 'none', label: 'No ironing' },
          { value: 'light', label: 'Light ironing - ₱10' },
          { value: 'full', label: 'Full ironing - ₱20' }
        ],
        default: 'none',
        description: 'Additional finishing'
      },
      { 
        name: 'fragrancePreference', 
        label: 'Fragrance Preference', 
        type: 'select',
        options: [
          { value: 'unscented', label: 'Unscented' },
          { value: 'floral', label: 'Floral' },
          { value: 'fresh', label: 'Fresh/Citrus' },
          { value: 'lavender', label: 'Lavender' }
        ],
        default: 'unscented',
        description: 'Optional detergent fragrance'
      },
      { 
        name: 'specialInstructions', 
        label: 'Special Care Instructions', 
        type: 'textarea',
        maxLength: 200,
        description: 'E.g., "Hand wash only", "Gentle cycle", "Do not bleach"'
      }
    ],
    requirements: [
      'Maximum 10kg per order',
      'Items must be in laundry bag or basket',
      'Check pockets and remove items before pickup',
      'Declare valuable items (buttons, zippers)'
    ],
    warnings: [
      'Items damaged by user (rips, tears) not covered by service',
      'Color bleeding from new denim may occur - separate if concerned',
      'Delicate items must be specified to avoid damage',
      'Same-day service not available on weekends',
      'Pickup/delivery within 1km radius - beyond incurs ₱15 surcharge'
    ],
    delicateItems: [
      'Silk and satin',
      'Wool and cashmere',
      'Lace and embroidered items',
      'Vintage or antique clothing',
      'Leather and suede'
    ],
    pricingBreakdown: [
      { item: 'Base Service (up to 5kg)', value: 60, type: 'flat' },
      { item: 'Per additional kg', value: 8, type: 'variable' },
      { item: 'Express Service (24h)', value: 30, type: 'optional' },
      { item: 'Same-day Service (12h)', value: 90, type: 'optional' },
      { item: 'Stain Treatment', value: 8, type: 'optional' },
      { item: 'Ironing (light)', value: 10, type: 'optional' },
      { item: 'Ironing (full)', value: 20, type: 'optional' }
    ]
  },
  {
    id: 'medical',
    label: 'Medical Supplies',
    icon: '⚕️',
    color: 'from-red-500 to-red-600',
    description: 'Delivery of medications and medical items',
    category: 'medical',
    criteria: [
      { label: 'Temperature', icon: '🌡️', hint: 'Climate controlled' },
      { label: 'Sensitivity', icon: '⚠️', hint: 'Handle with care' },
      { label: 'Urgency', icon: '🚨', hint: 'Priority delivery' }
    ],
    details: {
      maxItems: 20,
      baseFare: 80,
      perKm: 15,
      requiresCertification: true
    },
    formFields: [
      { 
        name: 'prescriptionNumber', 
        label: 'Prescription/Order Number', 
        type: 'text',
        required: true,
        description: 'For verification purposes'
      },
      { 
        name: 'pharmacyName', 
        label: 'Pharmacy/Medical Supplier', 
        type: 'text',
        required: true,
        description: 'Source of medical supplies'
      },
      { 
        name: 'itemType', 
        label: 'Type of Medical Supplies', 
        type: 'select',
        options: [
          { value: 'medication', label: 'Prescription medication' },
          { value: 'insulin', label: 'Insulin/injectable (requires cold chain)' },
          { value: 'vaccine', label: 'Vaccines (requires cold chain)' },
          { value: 'blood-products', label: 'Blood products (requires urgent cold chain)' },
          { value: 'medical-devices', label: 'Medical devices (oxygen, dialysis)' },
          { value: 'supplements', label: 'Supplements/vitamins' },
          { value: 'equipment', label: 'Medical equipment (testing strips, etc)' }
        ],
        required: true,
        description: 'Determines handling protocol'
      },
      { 
        name: 'temperature', 
        label: 'Temperature Requirements', 
        type: 'select',
        options: [
          { value: 'room', label: 'Room temperature (15-25°C)' },
          { value: 'cool', label: 'Cool (2-8°C) - refrigerated bag' },
          { value: 'ultra-cold', label: 'Ultra-cold (-20°C) - special container' },
          { value: 'ambient', label: 'No temperature control needed' }
        ],
        required: true,
        description: 'Critical for efficacy and safety'
      },
      { 
        name: 'urgency', 
        label: 'Delivery Urgency', 
        type: 'select',
        options: [
          { value: 'standard', label: 'Standard (within 24 hours)' },
          { value: 'urgent', label: 'Urgent (within 6 hours) - ₱50 extra' },
          { value: 'emergency', label: 'Emergency (within 2 hours) - ₱100 extra' }
        ],
        required: true,
        description: 'For critical medical needs'
      },
      { 
        name: 'patientName', 
        label: 'Patient Name', 
        type: 'text',
        required: true,
        description: 'For verification and privacy'
      },
      { 
        name: 'medicalCondition', 
        label: 'Patient Medical Condition (Optional)', 
        type: 'textarea',
        maxLength: 150,
        description: 'Helps driver understand urgency - confidential'
      },
      { 
        name: 'handlersAreVaccinated', 
        label: 'Confirm: All handlers are vaccinated', 
        type: 'checkbox',
        required: true,
        description: 'For safety of immunocompromised patients'
      },
      { 
        name: 'signatureRequired', 
        label: 'Signature Required on Delivery', 
        type: 'checkbox',
        default: true,
        description: 'Recommended for prescription items'
      }
    ],
    requirements: [
      'All drivers have medical delivery certification',
      'Cold chain maintained throughout delivery',
      'Prescription verification may be required',
      'ID verification at delivery (patient or authorized person)',
      'Temperature monitoring devices included'
    ],
    warnings: [
      'Temperature deviation may render medication ineffective - proper handling critical',
      'Cold chain must be maintained throughout - no delays permitted',
      'Blood products must be delivered within 2 hours of receipt',
      'Some medications require specific storage after delivery - inform patient',
      'Delays may result in medical emergency - priority routing applied',
      'Insurance required for high-value medications (>₱5000)'
    ],
    prohibitedItems: [
      'Controlled substances (without additional licensing)',
      'Experimental drugs',
      'Undocumented/unregistered medications',
      'Medical waste for disposal'
    ],
    healthRequirements: [
      'All drivers vaccinated against common illnesses',
      'Regular health screening required',
      'CPR/First Aid certification required',
      'Background check completed'
    ],
    pricingBreakdown: [
      { item: 'Base Fare', value: 80, type: 'flat' },
      { item: 'Per km', value: 15, type: 'variable' },
      { item: 'Cold Chain Maintenance', value: 20, type: 'optional' },
      { item: 'Ultra-Cold (-20°C)', value: 40, type: 'optional' },
      { item: 'Urgent Delivery (6 hours)', value: 50, type: 'optional' },
      { item: 'Emergency Delivery (2 hours)', value: 100, type: 'optional' },
      { item: 'Temperature Monitoring Device', value: 10, type: 'optional' }
    ]
  },
  {
    id: 'documents',
    label: 'Document Courier',
    icon: '📄',
    color: 'from-green-500 to-green-600',
    description: 'Important document delivery',
    category: 'documents',
    criteria: [
      { label: 'Security', icon: '🔒', hint: 'Secure delivery' },
      { label: 'Signature', icon: '✍️', hint: 'Signed receipt' },
      { label: 'Speed', icon: '⏰', hint: 'Same-day' }
    ],
    details: {
      maxDocuments: 50,
      baseFare: 75,
      perKm: 12,
      insurable: true
    },
    formFields: [
      { 
        name: 'documentType', 
        label: 'Type of Documents', 
        type: 'select',
        options: [
          { value: 'legal', label: 'Legal documents' },
          { value: 'financial', label: 'Financial/banking documents' },
          { value: 'passport', label: 'Passport/ID documents' },
          { value: 'medical', label: 'Medical records' },
          { value: 'real-estate', label: 'Real estate/property documents' },
          { value: 'business', label: 'Business contracts/agreements' },
          { value: 'other', label: 'Other important documents' }
        ],
        required: true,
        description: 'Affects handling and security level'
      },
      { 
        name: 'documentCount', 
        label: 'Number of Documents/Envelopes', 
        type: 'number',
        min: 1,
        max: 50,
        required: true,
        description: 'How many separate items'
      },
      { 
        name: 'sealingMethod', 
        label: 'Document Sealing', 
        type: 'select',
        options: [
          { value: 'envelope', label: 'Standard envelope' },
          { value: 'sealed-certified', label: 'Sealed & certified (witnessed)' },
          { value: 'secure-pouch', label: 'Security pouch with tamper seal' },
          { value: 'locked', label: 'Locked briefcase/box' }
        ],
        required: true,
        description: 'Security level affects pricing'
      },
      { 
        name: 'confidentiality', 
        label: 'Confidentiality Level', 
        type: 'select',
        options: [
          { value: 'standard', label: 'Standard (basic security)' },
          { value: 'confidential', label: 'Confidential (no opening/scanning)' },
          { value: 'top-secret', label: 'Top Secret (armed courier option) - ₱150 extra' }
        ],
        required: true,
        description: 'Determines driver training level'
      },
      { 
        name: 'deliverySpeed', 
        label: 'Delivery Speed', 
        type: 'select',
        options: [
          { value: 'standard', label: 'Standard (within business day)' },
          { value: 'express', label: 'Express (within 4 hours) - ₱50 extra' },
          { value: 'same-day', label: 'Same-day (within 2 hours) - ₱100 extra' }
        ],
        required: true,
        description: 'Urgency of delivery'
      },
      { 
        name: 'insurance', 
        label: 'Document Insurance', 
        type: 'select',
        options: [
          { value: 'none', label: 'No insurance' },
          { value: 'standard', label: 'Standard (₱20 for up to ₱5000 value)' },
          { value: 'premium', label: 'Premium (₱50 for up to ₱50000 value)' }
        ],
        required: true,
        description: 'Protection against loss or damage'
      },
      { 
        name: 'requiredSignature', 
        label: 'Signature Required', 
        type: 'checkbox',
        default: true,
        description: 'Proof of delivery with signature'
      },
      { 
        name: 'photoProof', 
        label: 'Photo Proof of Delivery', 
        type: 'checkbox',
        description: 'Additional verification with photo'
      },
      { 
        name: 'trackingUpdates', 
        label: 'Real-time GPS Tracking', 
        type: 'checkbox',
        description: 'Live location updates during delivery - ₱10'
      },
      { 
        name: 'recipientVerification', 
        label: 'Recipient Verification Required', 
        type: 'checkbox',
        description: 'ID check at delivery (confidential documents)'
      }
    ],
    requirements: [
      'Documents must be properly sealed/packaged',
      'Sender identity verification required',
      'Recipient signature required (unless specified otherwise)',
      'No illegal or prohibited documents',
      'Declaration of document value required if insuring'
    ],
    warnings: [
      'Lost or damaged documents may not be recoverable - insurance recommended',
      'Delays in signature confirmation may extend delivery time',
      'Photo/tracking adds 10-15 minutes to delivery time',
      'Armed courier service only available in metro areas',
      'Confidential documents cannot be handled by temporary couriers',
      'Insurance does not cover content verification - sender responsibility'
    ],
    prohibitedDocuments: [
      'Counterfeit documents',
      'Illegally obtained documents',
      'Classified government documents',
      'Original irreplaceable documents (recommend certified copies)',
      'Documents containing biometric data (without authorization)'
    ],
    pricingBreakdown: [
      { item: 'Base Fare', value: 75, type: 'flat' },
      { item: 'Per km', value: 12, type: 'variable' },
      { item: 'Sealed/Certified Sealing', value: 10, type: 'optional' },
      { item: 'Security Pouch', value: 15, type: 'optional' },
      { item: 'Confidential Handling', value: 20, type: 'optional' },
      { item: 'Top Secret / Armed Courier', value: 150, type: 'optional' },
      { item: 'Express Delivery (4h)', value: 50, type: 'optional' },
      { item: 'Same-day Delivery (2h)', value: 100, type: 'optional' },
      { item: 'Standard Insurance', value: 20, type: 'optional' },
      { item: 'Premium Insurance', value: 50, type: 'optional' },
      { item: 'Real-time GPS Tracking', value: 10, type: 'optional' },
      { item: 'Photo Proof of Delivery', value: 5, type: 'optional' }
    ]
  }
]

function FormField({ field, value, onChange, formData }) {
  const shouldShow = !field.conditional || (formData?.[field.conditional] === true)

  if (!shouldShow) return null

  const commonClasses = 'w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200'

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-slate-900">
        {field.label}
        {field.required && <span className="text-red-500 ml-1">*</span>}
      </label>

      {field.type === 'number' && (
        <input
          type="number"
          min={field.min}
          max={field.max}
          step={field.step || 1}
          value={value || field.default || ''}
          onChange={(e) => onChange(field.name, e.target.value ? parseFloat(e.target.value) : '')}
          className={commonClasses}
        />
      )}

      {field.type === 'text' && (
        <input
          type="text"
          value={value || ''}
          onChange={(e) => onChange(field.name, e.target.value)}
          className={commonClasses}
        />
      )}

      {field.type === 'textarea' && (
        <textarea
          value={value || ''}
          onChange={(e) => onChange(field.name, e.target.value)}
          maxLength={field.maxLength}
          rows="3"
          className={`${commonClasses} resize-none`}
        />
      )}

      {field.type === 'select' && (
        <select
          value={value || field.default || ''}
          onChange={(e) => onChange(field.name, e.target.value)}
          className={commonClasses}
        >
          <option value="">Select an option...</option>
          {field.options?.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      )}

      {field.type === 'checkbox' && (
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={value || false}
            onChange={(e) => onChange(field.name, e.target.checked)}
            className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-slate-700">{field.description || ''}</span>
        </label>
      )}

      {field.description && field.type !== 'checkbox' && (
        <p className="text-xs text-slate-500 mt-1">{field.description}</p>
      )}
    </div>
  )
}

export default function ServicesModal({ 
  isOpen, 
  onClose, 
  onSelectService,
  selectedService = null
}) {
  const [expandedService, setExpandedService] = useState(selectedService || 'ride-share')
  const [formData, setFormData] = useState({})
  
  const selectedServiceData = SERVICES.find(s => s.id === expandedService)

  const handleFieldChange = (fieldName, value) => {
    setFormData(prev => ({
      ...prev,
      [fieldName]: value
    }))
  }

  const calculatePrice = () => {
    if (!selectedServiceData?.pricingBreakdown) return 0
    let total = 0

    selectedServiceData.pricingBreakdown.forEach(item => {
      if (item.type === 'flat') {
        total += item.value
      } else if (item.type === 'optional' && formData[item.item.toLowerCase().replace(/\s+/g, '')]) {
        total += item.value
      }
    })

    return total
  }

  if (!isOpen) return null

  const getBackgroundColor = (serviceId) => {
    switch(serviceId) {
      case 'ride-share': return 'bg-cyan-600'
      case 'package': return 'bg-purple-600'
      case 'food': return 'bg-orange-600'
      case 'laundry': return 'bg-pink-600'
      case 'medical': return 'bg-red-600'
      case 'documents': return 'bg-green-600'
      default: return 'bg-slate-600'
    }
  }

  const handleSelect = () => {
    onSelectService(expandedService, formData)
    setFormData({})
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-[9999] flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-6xl max-h-[95vh] flex flex-col relative z-[10000] my-4">
        {/* Header */}
        <div className="bg-slate-900 text-white p-6 flex items-center justify-between sticky top-0 z-10">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Select Service & Details
          </h2>
          <button
            onClick={onClose}
            className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-2 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Service Selection List */}
            <div className="lg:col-span-1 space-y-3">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Available Services</h3>
              <div className="space-y-2 max-h-[calc(95vh-300px)] overflow-y-auto">
                {SERVICES.map((service) => (
                  <button
                    key={service.id}
                    onClick={() => {
                      setExpandedService(service.id)
                      setFormData({})
                    }}
                    className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                      expandedService === service.id
                        ? 'border-blue-500 bg-blue-50 shadow-md'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{service.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-900 text-sm">{service.label}</p>
                        <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{service.description}</p>
                      </div>
                      {expandedService === service.id && (
                        <svg className="w-5 h-5 text-blue-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Service Details and Form */}
            {selectedServiceData && (
              <div className="lg:col-span-2 space-y-6 max-h-[calc(95vh-300px)] overflow-y-auto pr-4">
                {/* Service Header */}
                <div className={`rounded-lg p-6 text-white space-y-4 ${getBackgroundColor(expandedService)}`}>
                  <div className="flex items-center gap-4">
                    <span className="text-5xl">{selectedServiceData.icon}</span>
                    <div>
                      <h3 className="text-2xl font-bold">{selectedServiceData.label}</h3>
                      <p className="text-white text-opacity-90 text-sm">{selectedServiceData.description}</p>
                    </div>
                  </div>
                </div>

                {/* Service Form */}
                {selectedServiceData.formFields && selectedServiceData.formFields.length > 0 && (
                  <div className="bg-slate-50 rounded-lg p-6 space-y-4 border border-slate-200">
                    <h4 className="text-lg font-semibold text-slate-900">Service Details</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {selectedServiceData.formFields.map(field => (
                        <div key={field.name} className={field.type === 'textarea' ? 'md:col-span-2' : ''}>
                          <FormField
                            field={field}
                            value={formData[field.name]}
                            onChange={handleFieldChange}
                            service={selectedServiceData}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Requirements */}
                {selectedServiceData.requirements && (
                  <div className="space-y-3">
                    <h4 className="font-semibold text-slate-900 text-sm uppercase tracking-wide">Requirements</h4>
                    <div className="space-y-2">
                      {selectedServiceData.requirements.map((req, idx) => (
                        <div key={idx} className="flex gap-3 bg-blue-50 rounded-lg p-3 border-l-4 border-blue-500">
                          <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          <span className="text-sm text-slate-700">{req}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Warnings */}
                {selectedServiceData.warnings && (
                  <div className="space-y-3">
                    <h4 className="font-semibold text-slate-900 text-sm uppercase tracking-wide">Important Warnings</h4>
                    <div className="space-y-2">
                      {selectedServiceData.warnings.map((warning, idx) => (
                        <div key={idx} className="flex gap-3 bg-amber-50 rounded-lg p-3 border-l-4 border-amber-500">
                          <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                          <span className="text-sm text-slate-700">{warning}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Prohibited Items */}
                {selectedServiceData.prohibitedItems && (
                  <div className="space-y-3">
                    <h4 className="font-semibold text-slate-900 text-sm uppercase tracking-wide">Prohibited Items</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {selectedServiceData.prohibitedItems.map((item, idx) => (
                        <div key={idx} className="flex gap-2 bg-red-50 rounded-lg p-3 border-l-4 border-red-500">
                          <svg className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                          <span className="text-sm text-slate-700">{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Pricing */}
                <div className="space-y-3">
                  <h4 className="font-semibold text-slate-900 text-sm uppercase tracking-wide">Pricing Breakdown</h4>
                  <div className="bg-slate-50 rounded-lg p-4 border border-slate-200 space-y-2 max-h-48 overflow-y-auto">
                    {selectedServiceData.pricingBreakdown?.map((item, idx) => (
                      <div key={idx} className="flex justify-between text-sm pb-2 border-b border-slate-200 last:border-0">
                        <span className="text-slate-700">{item.item}</span>
                        <span className="font-medium text-slate-900">
                          {item.type === 'variable' ? `₱${item.value}/${item.unit || 'unit'}` : `₱${item.value}`}
                        </span>
                      </div>
                    ))}
                  </div>
                  {selectedServiceData.pricingBreakdown && (
                    <div className="bg-blue-50 rounded-lg p-4 border border-blue-200 flex justify-between items-center">
                      <span className="font-semibold text-slate-900">Estimated Base Price:</span>
                      <span className="text-xl font-bold text-blue-600">₱{calculatePrice()}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 bg-slate-50 p-6 flex gap-3 justify-end sticky bottom-0">
          <button
            onClick={onClose}
            className="px-6 py-2 border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-100 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSelect}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 hover:shadow-lg transition-all flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Select {selectedServiceData?.label}
          </button>
        </div>
      </div>
    </div>
  )
}
