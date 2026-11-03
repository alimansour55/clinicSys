import { mergeAreas } from './mergeAreas.js'

/* Any new file in ./areas is picked up here: adding an area needs no edit to a shared file. */
export const areas = mergeAreas(import.meta.glob('./areas/*.js', { eager: true }))
