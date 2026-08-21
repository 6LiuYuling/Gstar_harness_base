/** GSTAR browser plugin that registers the product shell into the root slot. */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import { GstarApp } from './GstarApp.tsx'

/** Services required by the GSTAR browser plugin. */
export const inject = ['slots']

/**
 * Register the GSTAR product shell.
 * @param ctx - Client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(
    () => ctx.slots.register({ name: 'root' }, GstarApp),
    'ui-gstar: root registration',
  )
}
