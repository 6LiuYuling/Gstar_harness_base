/** Register OpenStreetMap/Overpass as a dynamically loadable GSTAR AOI source. */

import type { Context } from '@deepseek-ai/cordis'
import { GstarDataSourceId } from '@deepseek-ai/dsh-gstar-data-source'
import type {} from '@deepseek-ai/dsh-gstar-spatial'

/** Cordis plugin name. */
export const name = 'gstar-data-source-osm'
/** Services required to register and execute the OSM source. */
export const inject = ['gstarDataSources', 'gstarSpatial']

/** Stable source identity shared with OSM provenance records. */
export const OSM_DATA_SOURCE_ID = GstarDataSourceId('osm-overpass')

/**
 * Register the OpenStreetMap source contribution.
 * @param ctx - Host context carrying source management and spatial acquisition.
 * @returns disposer for the exact live source contribution.
 */
export function apply(ctx: Context): () => void {
  return ctx.gstarDataSources.register({
    descriptor: {
      id: OSM_DATA_SOURCE_ID,
      name: 'OpenStreetMap / Overpass API',
      publisher: 'OpenStreetMap contributors',
      url: 'https://www.openstreetmap.org/',
      categories: ['政', '企', '金融', '教育', '医疗', '商场', '居民区'],
      capabilities: ['aoi', 'entity'],
      accessMode: 'direct',
      license: 'ODbL-1.0',
      defaultEnabled: true,
    },
    async synchronize(workspaceId) {
      const spatial = await ctx.gstarSpatial.refreshAois({ workspaceId })
      return `已从 OpenStreetMap 发布 ${String(spatial.aois.length)} 个 AOI`
    },
  })
}
