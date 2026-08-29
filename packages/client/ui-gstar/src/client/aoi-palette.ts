import type { GstarAoiCategory } from '@deepseek-ai/dsh-gstar-spatial/types'

/** Ordered AOI filter categories shared by the toolbar and Cesium projection. */
export const AOI_CATEGORIES = [
  '政', '企', '金融', '教育', '医疗', '商场', '居民区',
] as const satisfies readonly GstarAoiCategory[]

/** Component-local CSS color properties shared by AOI legend controls and polygons. */
export const AOI_COLOR_PROPERTIES: Readonly<Record<GstarAoiCategory, string>> = {
  '政': '--gstar-map-aoi-government',
  '企': '--gstar-map-aoi-enterprise',
  '金融': '--gstar-map-aoi-finance',
  '教育': '--gstar-map-aoi-education',
  '医疗': '--gstar-map-aoi-medical',
  '商场': '--gstar-map-aoi-shopping',
  '居民区': '--gstar-map-aoi-residential',
}
