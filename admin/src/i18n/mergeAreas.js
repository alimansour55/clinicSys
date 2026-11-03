/**
 * Merges area modules ({ './areas/booking.js': { default: { ar: {...}, en: {...} } } })
 * in file-name order, so the result does not depend on import order.
 */
export const mergeAreas = (modules) => {
  const merged = { en: {}, ar: {} }
  const conflicts = []
  const firstSeen = { en: {}, ar: {} }

  Object.keys(modules)
    .sort()
    .forEach((file) => {
      const area = modules[file]?.default ?? {}
      Object.keys(merged).forEach((language) => {
        Object.entries(area[language] ?? {}).forEach(([key, value]) => {
          if (key in firstSeen[language] && merged[language][key] !== value) {
            conflicts.push({ language, key, files: [firstSeen[language][key], file] })
          } else {
            firstSeen[language][key] = file
          }
          merged[language][key] = value
        })
      })
    })

  return { ...merged, conflicts }
}
