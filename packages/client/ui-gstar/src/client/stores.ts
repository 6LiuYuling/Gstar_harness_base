/** GSTAR root viewing-state store. */

import {
  defineStore, type EngineStoreHandle, type WorkspaceId,
} from '@deepseek-ai/dsh-client-runtime/client'

/** Three-column GSTAR viewing state; Host business data stays in object-layer runtimes. */
interface GstarViewState {
  selectedSiteId: WorkspaceId | undefined
  selectedAoiId: string | undefined
  locatingSiteId: WorkspaceId | undefined
  focusRevision: number
  leftCollapsed: boolean
  detailsOpen: boolean
}

/** Complete mutation set for GSTAR viewing state and the DSH layout face. */
type GstarViewActions = {
  selectSite: (draft: GstarViewState, workspaceId: WorkspaceId) => void
  clearSelection: (draft: GstarViewState) => void
  selectAoi: (draft: GstarViewState, aoiId: string) => void
  closeAoi: (draft: GstarViewState) => void
  beginLocating: (draft: GstarViewState, workspaceId: WorkspaceId) => void
  finishLocating: (draft: GstarViewState) => void
  toggleSidebar: (draft: GstarViewState) => void
  openDetails: (draft: GstarViewState) => void
  closeDetails: (draft: GstarViewState) => void
}

/**
 * Create the root store used by the GSTAR shell and its `ctx.layout` provider.
 * @returns the root GSTAR state and bound-action store handle.
 */
export function createGstarStore(): EngineStoreHandle<GstarViewState, GstarViewActions> {
  return defineStore({
    init: (): GstarViewState => ({
      selectedSiteId: undefined,
      selectedAoiId: undefined,
      locatingSiteId: undefined,
      focusRevision: 0,
      leftCollapsed: false,
      detailsOpen: false,
    }),
    actions: {
      selectSite: (draft, workspaceId) => {
        draft.selectedSiteId = workspaceId
        draft.selectedAoiId = undefined
        draft.locatingSiteId = undefined
        draft.focusRevision++
      },
      clearSelection: (draft) => {
        draft.selectedSiteId = undefined
        draft.selectedAoiId = undefined
        draft.locatingSiteId = undefined
      },
      selectAoi: (draft, aoiId) => { draft.selectedAoiId = aoiId },
      closeAoi: (draft) => { draft.selectedAoiId = undefined },
      beginLocating: (draft, workspaceId) => {
        draft.selectedSiteId = workspaceId
        draft.selectedAoiId = undefined
        draft.locatingSiteId = workspaceId
        draft.focusRevision++
      },
      finishLocating: (draft) => { draft.locatingSiteId = undefined },
      toggleSidebar: (draft) => { draft.leftCollapsed = !draft.leftCollapsed },
      openDetails: (draft) => { draft.detailsOpen = true },
      closeDetails: (draft) => { draft.detailsOpen = false },
    },
  })
}
