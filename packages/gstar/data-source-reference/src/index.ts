/** Register one declarative authoritative reference as a dynamically loadable GSTAR source plugin. */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { GstarDataSourceId } from '@deepseek-ai/dsh-gstar-data-source'
import type { GstarAoiCategory } from '@deepseek-ai/dsh-gstar-spatial/types'

/** Cordis plugin name. */
export const name = 'gstar-data-source-reference'
/** Service required to register a source contribution. */
export const inject = ['gstarDataSources']

/** Configuration for one authoritative public reference plugin instance. */
export interface Config {
  /** Stable source identity. */
  id: string
  /** Human-readable platform or dataset name. */
  name: string
  /** Publishing organization. */
  publisher: string
  /** Public platform entry point. */
  url: string
  /** GSTAR categories verified by this reference. */
  categories: GstarAoiCategory[]
  /** Whether newly classified stations admit this reference before an explicit override. */
  defaultEnabled: boolean
}

const category = z.union([
  z.const('政'), z.const('企'), z.const('金融'), z.const('教育'),
  z.const('医疗'), z.const('商场'), z.const('居民区'),
])

/** Loader-visible reference source configuration. */
export const Config: z<Config> = z.object({
  id: z.string().required(),
  name: z.string().required(),
  publisher: z.string().required(),
  url: z.string().required(),
  categories: z.array(category).required(),
  defaultEnabled: z.boolean().required(),
})

/**
 * Register one configured reference source.
 * @param ctx - Host context carrying source management.
 * @param config - Validated public reference metadata.
 * @returns disposer for the exact live source contribution.
 */
export function apply(ctx: Context, config: Config): () => void {
  const url = new URL(config.url)
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error('gstar-data-source-reference: url must use http or https')
  }
  return ctx.gstarDataSources.register({
    descriptor: {
      id: GstarDataSourceId(config.id),
      name: config.name,
      publisher: config.publisher,
      url: url.href,
      categories: [...config.categories],
      capabilities: ['verification'],
      accessMode: 'reference',
      defaultEnabled: config.defaultEnabled,
    },
  })
}
