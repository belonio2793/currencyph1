/**
 * Service Validation Service
 * Provides comprehensive validation for all service types
 * Used on both frontend (immediate feedback) and backend (security)
 */

const VALIDATION_RULES = {
  'ride-share': {
    requiredFields: ['passengerCount'],
    validations: {
      passengerCount: {
        type: 'number',
        min: 1,
        max: 4,
        required: true,
        message: 'Passenger count must be between 1 and 4'
      },
      luggageCount: {
        type: 'number',
        min: 0,
        max: 6,
        message: 'Luggage count cannot exceed 6 items'
      },
      hasPets: {
        type: 'boolean',
        message: 'Pet option must be true or false'
      },
      petType: {
        type: 'select',
        validValues: ['dog', 'cat', 'bird', 'other'],
        conditional: 'hasPets',
        message: 'Invalid pet type'
      },
      accessibility: {
        type: 'boolean',
        message: 'Accessibility option must be true or false'
      },
      musicPreference: {
        type: 'select',
        validValues: ['quiet', 'upbeat', 'relaxing', 'no-preference'],
        message: 'Invalid music preference'
      }
    }
  },

  'package': {
    requiredFields: ['weight', 'length', 'width', 'height', 'fragility', 'contents'],
    validations: {
      weight: {
        type: 'number',
        min: 0.1,
        max: 25,
        required: true,
        message: 'Package weight must be between 0.1 and 25 kg'
      },
      length: {
        type: 'number',
        min: 1,
        max: 60,
        required: true,
        message: 'Length must be between 1 and 60 cm'
      },
      width: {
        type: 'number',
        min: 1,
        max: 60,
        required: true,
        message: 'Width must be between 1 and 60 cm'
      },
      height: {
        type: 'number',
        min: 1,
        max: 80,
        required: true,
        message: 'Height must be between 1 and 80 cm'
      },
      fragility: {
        type: 'select',
        validValues: ['none', 'medium', 'high'],
        required: true,
        message: 'Fragility level must be specified'
      },
      contents: {
        type: 'string',
        minLength: 3,
        maxLength: 200,
        required: true,
        message: 'Package contents description is required (3-200 characters)'
      },
      signatureRequired: {
        type: 'boolean',
        message: 'Signature requirement must be true or false'
      },
      insuranceLevel: {
        type: 'select',
        validValues: ['none', 'standard', 'premium'],
        message: 'Invalid insurance level'
      },
      recipientAvailable: {
        type: 'boolean',
        required: true,
        message: 'Recipient availability must be specified'
      }
    }
  },

  'food': {
    requiredFields: ['restaurantName', 'itemCount', 'foodType', 'temperature'],
    validations: {
      restaurantName: {
        type: 'string',
        minLength: 1,
        maxLength: 100,
        required: true,
        message: 'Restaurant name is required'
      },
      itemCount: {
        type: 'number',
        min: 1,
        max: 15,
        required: true,
        message: 'Item count must be between 1 and 15'
      },
      foodType: {
        type: 'select',
        validValues: ['hot', 'cold', 'mixed', 'drinks-only'],
        required: true,
        message: 'Food type must be specified'
      },
      temperature: {
        type: 'select',
        validValues: ['hot', 'cold', 'frozen', 'room'],
        required: true,
        message: 'Temperature requirements must be specified'
      },
      dietaryRestrictions: {
        type: 'string',
        maxLength: 150,
        message: 'Dietary restrictions cannot exceed 150 characters'
      },
      priority: {
        type: 'select',
        validValues: ['standard', 'fast', 'express'],
        message: 'Invalid delivery speed option'
      },
      contactlessDelivery: {
        type: 'boolean',
        message: 'Contactless delivery must be true or false'
      },
      specialHandling: {
        type: 'boolean',
        message: 'Special handling must be true or false'
      }
    }
  },

  'laundry': {
    requiredFields: ['estimatedWeight', 'garmentTypes', 'serviceType'],
    validations: {
      estimatedWeight: {
        type: 'number',
        min: 0.5,
        max: 10,
        required: true,
        message: 'Laundry weight must be between 0.5 and 10 kg'
      },
      garmentTypes: {
        type: 'select',
        validValues: ['casual', 'formal', 'delicate', 'mixed'],
        required: true,
        message: 'Garment type must be specified'
      },
      stainTreatment: {
        type: 'select',
        validValues: ['none', 'oil', 'blood', 'wine', 'mud', 'multiple'],
        message: 'Invalid stain type'
      },
      serviceType: {
        type: 'select',
        validValues: ['standard', 'express', 'same-day'],
        required: true,
        message: 'Service type must be specified'
      },
      ironing: {
        type: 'select',
        validValues: ['none', 'light', 'full'],
        message: 'Invalid ironing option'
      },
      fragrancePreference: {
        type: 'select',
        validValues: ['unscented', 'floral', 'fresh', 'lavender'],
        message: 'Invalid fragrance preference'
      },
      specialInstructions: {
        type: 'string',
        maxLength: 200,
        message: 'Special instructions cannot exceed 200 characters'
      }
    }
  },

  'medical': {
    requiredFields: ['prescriptionNumber', 'pharmacyName', 'itemType', 'temperature', 'urgency', 'patientName', 'handlersAreVaccinated'],
    validations: {
      prescriptionNumber: {
        type: 'string',
        minLength: 1,
        required: true,
        message: 'Prescription/order number is required'
      },
      pharmacyName: {
        type: 'string',
        minLength: 1,
        required: true,
        message: 'Pharmacy/supplier name is required'
      },
      itemType: {
        type: 'select',
        validValues: ['medication', 'insulin', 'vaccine', 'blood-products', 'medical-devices', 'supplements', 'equipment'],
        required: true,
        message: 'Medical supply type must be specified'
      },
      temperature: {
        type: 'select',
        validValues: ['room', 'cool', 'ultra-cold', 'ambient'],
        required: true,
        message: 'Temperature requirements must be specified'
      },
      urgency: {
        type: 'select',
        validValues: ['standard', 'urgent', 'emergency'],
        required: true,
        message: 'Delivery urgency must be specified'
      },
      patientName: {
        type: 'string',
        minLength: 1,
        required: true,
        message: 'Patient name is required'
      },
      medicalCondition: {
        type: 'string',
        maxLength: 150,
        message: 'Medical condition description cannot exceed 150 characters'
      },
      handlersAreVaccinated: {
        type: 'boolean',
        required: true,
        message: 'Must confirm handlers are vaccinated'
      },
      signatureRequired: {
        type: 'boolean',
        message: 'Signature requirement must be true or false'
      }
    }
  },

  'documents': {
    requiredFields: ['documentType', 'documentCount', 'sealingMethod', 'confidentiality', 'deliverySpeed', 'insurance'],
    validations: {
      documentType: {
        type: 'select',
        validValues: ['legal', 'financial', 'passport', 'medical', 'real-estate', 'business', 'other'],
        required: true,
        message: 'Document type must be specified'
      },
      documentCount: {
        type: 'number',
        min: 1,
        max: 50,
        required: true,
        message: 'Document count must be between 1 and 50'
      },
      sealingMethod: {
        type: 'select',
        validValues: ['envelope', 'sealed-certified', 'secure-pouch', 'locked'],
        required: true,
        message: 'Sealing method must be specified'
      },
      confidentiality: {
        type: 'select',
        validValues: ['standard', 'confidential', 'top-secret'],
        required: true,
        message: 'Confidentiality level must be specified'
      },
      deliverySpeed: {
        type: 'select',
        validValues: ['standard', 'express', 'same-day'],
        required: true,
        message: 'Delivery speed must be specified'
      },
      insurance: {
        type: 'select',
        validValues: ['none', 'standard', 'premium'],
        required: true,
        message: 'Insurance option must be specified'
      },
      requiredSignature: {
        type: 'boolean',
        message: 'Signature requirement must be true or false'
      },
      photoProof: {
        type: 'boolean',
        message: 'Photo proof option must be true or false'
      },
      trackingUpdates: {
        type: 'boolean',
        message: 'GPS tracking option must be true or false'
      },
      recipientVerification: {
        type: 'boolean',
        message: 'Recipient verification option must be true or false'
      }
    }
  }
}

/**
 * Validate service data against predefined rules
 * @param {string} serviceId - The service ID (e.g., 'ride-share', 'package', etc.)
 * @param {object} formData - The service form data to validate
 * @returns {object} - { isValid: boolean, errors: array }
 */
export function validateServiceData(serviceId, formData = {}) {
  const rules = VALIDATION_RULES[serviceId]
  const errors = []

  if (!rules) {
    return {
      isValid: false,
      errors: [`Unknown service type: ${serviceId}`]
    }
  }

  // Check required fields
  for (const field of rules.requiredFields) {
    if (!formData[field]) {
      const validation = rules.validations[field]
      errors.push(validation?.message || `${field} is required`)
    }
  }

  // Validate each field
  for (const [fieldName, fieldValue] of Object.entries(formData)) {
    const validation = rules.validations[fieldName]

    if (!validation) {
      // Unknown field, skip validation
      continue
    }

    // Skip validation if field is not required and is empty
    if (!validation.required && !fieldValue && fieldValue !== false && fieldValue !== 0) {
      continue
    }

    // Check conditional fields
    if (validation.conditional && !formData[validation.conditional]) {
      continue
    }

    // Type validation
    if (validation.type === 'number') {
      const numValue = parseFloat(fieldValue)
      if (isNaN(numValue)) {
        errors.push(`${fieldName} must be a number`)
        continue
      }

      if (validation.min !== undefined && numValue < validation.min) {
        errors.push(validation.message || `${fieldName} must be at least ${validation.min}`)
      }

      if (validation.max !== undefined && numValue > validation.max) {
        errors.push(validation.message || `${fieldName} must not exceed ${validation.max}`)
      }
    }

    if (validation.type === 'string') {
      const strValue = String(fieldValue || '')

      if (validation.minLength && strValue.length < validation.minLength) {
        errors.push(validation.message || `${fieldName} must be at least ${validation.minLength} characters`)
      }

      if (validation.maxLength && strValue.length > validation.maxLength) {
        errors.push(validation.message || `${fieldName} cannot exceed ${validation.maxLength} characters`)
      }
    }

    if (validation.type === 'boolean' && typeof fieldValue !== 'boolean') {
      errors.push(validation.message || `${fieldName} must be true or false`)
    }

    if (validation.type === 'select' && validation.validValues) {
      if (!validation.validValues.includes(fieldValue)) {
        errors.push(validation.message || `${fieldName} has an invalid value`)
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors: errors
  }
}

/**
 * Get validation rules for a specific service
 * @param {string} serviceId - The service ID
 * @returns {object} - The validation rules for the service
 */
export function getServiceValidationRules(serviceId) {
  return VALIDATION_RULES[serviceId] || null
}

/**
 * Get all available service IDs
 * @returns {array} - Array of service IDs
 */
export function getAvailableServices() {
  return Object.keys(VALIDATION_RULES)
}

/**
 * Validate multiple service data objects at once
 * @param {object} servicesData - Object with serviceId as key and formData as value
 * @returns {object} - { isValid: boolean, results: object }
 */
export function validateMultipleServices(servicesData = {}) {
  const results = {}
  let isValid = true

  for (const [serviceId, formData] of Object.entries(servicesData)) {
    const validation = validateServiceData(serviceId, formData)
    results[serviceId] = validation
    if (!validation.isValid) {
      isValid = false
    }
  }

  return {
    isValid,
    results
  }
}

/**
 * Get human-readable description of validation error
 * @param {array} errors - Array of error messages
 * @returns {string} - Formatted error message
 */
export function formatValidationErrors(errors = []) {
  if (errors.length === 0) {
    return 'No errors'
  }

  if (errors.length === 1) {
    return errors[0]
  }

  return 'Please fix the following errors:\n' + errors.map((e, i) => `${i + 1}. ${e}`).join('\n')
}
