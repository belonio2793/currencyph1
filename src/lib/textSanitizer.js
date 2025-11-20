export function sanitizeText(text) {
  if (!text) return ''
  
  return String(text)
    .replace(/[^\x20-\x7E\u00C0-\u00FF]/g, '')
    .trim()
}

export function fixCharacterEncoding(text) {
  if (!text) return ''
  
  const str = String(text)
  
  const encodingMap = {
    'Ã¡': 'á',
    'Ã©': 'é',
    'Ã­': 'í',
    'Ã³': 'ó',
    'Ã º': 'ú',
    'Ã±': 'ñ',
    'Â': ''
  }

  let result = str
  Object.keys(encodingMap).forEach(key => {
    result = result.replace(new RegExp(key, 'g'), encodingMap[key])
  })

  return result
}

export function cleanProjectName(name) {
  if (!name) return 'Project'
  
  return fixCharacterEncoding(sanitizeText(name))
    .replace(/[^a-zA-Z0-9\s\-]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function cleanDescription(description) {
  if (!description) return ''
  
  return fixCharacterEncoding(description)
    .replace(/[?]{2,}/g, '?')
    .replace(/[\u0000-\u001F]/g, '')
    .trim()
}

export function removeInvalidChars(text) {
  if (!text) return ''
  
  return String(text)
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
    .replace(/[?]{2,}/g, '?')
    .trim()
}

export default {
  sanitizeText,
  fixCharacterEncoding,
  cleanProjectName,
  cleanDescription,
  removeInvalidChars
}
