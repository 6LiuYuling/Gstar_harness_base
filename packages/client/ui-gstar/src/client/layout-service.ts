/** GSTAR implementation of the standard DSH `ctx.layout` action service. */

import type { BoundActions } from '@deepseek-ai/dsh-client-ui-slots'
import type { ILayout } from '@deepseek-ai/dsh-client-ui-layout/client'
import type { createGstarStore } from './stores.ts'

type GstarActions = BoundActions<ReturnType<typeof createGstarStore>>

/** Bridges standard conversation panel actions into the GSTAR root store. */
export class GstarLayoutController implements ILayout {
  private actions?: GstarActions

  /** Attach the root entry's bound actions during its first render. */
  attach(actions: GstarActions): void {
    this.actions = actions
  }

  /** Toggle the GSTAR station column. */
  toggleSidebar(): void { this.requireActions().toggleSidebar() }
  /** Open standard DSH tool-call details over the conversation column. */
  openDetails(): void { this.requireActions().openDetails() }
  /** Close standard DSH tool-call details. */
  closeDetails(): void { this.requireActions().closeDetails() }

  /** Resolve actions after the root renderer has bound its store. */
  private requireActions(): GstarActions {
    if (this.actions === undefined) throw new Error('gstar layout: root actions are not attached')
    return this.actions
  }
}
