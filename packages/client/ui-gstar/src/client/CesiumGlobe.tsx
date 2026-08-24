import { useEffect, useRef, useState } from 'react'
import * as Cesium from 'cesium'
import type { Cartesian2, Entity, ScreenSpaceEventHandler, Viewer } from 'cesium'
import type { WorkspaceId } from '@deepseek-ai/dsh-client-runtime/client'
import type {
  GstarAoiSnapshot, GstarCoordinate, GstarLinearRing, GstarSpatialSnapshot,
} from '@deepseek-ai/dsh-gstar-spatial/types'
import type { GstarSiteSnapshot } from '@deepseek-ai/dsh-gstar-site/types'
import css from './CesiumGlobe.module.css'

const CESIUM_ASSET_BASE = '/gstar/cesium/'
const CESIUM_WIDGET_STYLES = `${CESIUM_ASSET_BASE}Widgets/widgets.css`

type CesiumModule = typeof Cesium

interface GlobeRuntime {
  readonly Cesium: CesiumModule
  readonly viewer: Viewer
  readonly handler: ScreenSpaceEventHandler
  readonly picks: Map<string, GlobePick>
}

type GlobePick =
  | { readonly kind: 'site'; readonly workspaceId: WorkspaceId }
  | { readonly kind: 'aoi'; readonly workspaceId: WorkspaceId; readonly aoiId: string }

/** Properties supplied by the GSTAR root; all business data comes from Host snapshots. */
export interface CesiumGlobeProps {
  readonly sites: readonly GstarSiteSnapshot[]
  readonly spatial: readonly GstarSpatialSnapshot[]
  readonly selectedSiteId?: WorkspaceId
  readonly selectedAoiId?: string
  readonly locatingSiteId?: WorkspaceId
  readonly onSelectSite: (workspaceId: WorkspaceId) => void
  readonly onSelectAoi: (workspaceId: WorkspaceId, aoiId: string) => void
  readonly onLocate: (workspaceId: WorkspaceId, coordinate: GstarCoordinate) => void
}

/** Convert one persisted linear ring into Cesium world positions. */
function ringPositions(Cesium: CesiumModule, ring: GstarLinearRing) {
  return ring.map(position => Cesium.Cartesian3.fromDegrees(
    position.longitude,
    position.latitude,
    position.height ?? 0,
  ))
}

/** Build a Cesium hierarchy including polygon holes. */
function hierarchy(Cesium: CesiumModule, rings: readonly GstarLinearRing[]) {
  const outer = rings[0]
  if (outer === undefined) throw new Error('GSTAR AOI polygon requires an outer ring')
  return new Cesium.PolygonHierarchy(
    ringPositions(Cesium, outer),
    rings.slice(1).map(hole => new Cesium.PolygonHierarchy(ringPositions(Cesium, hole))),
  )
}

/** Stable category bucket for the three theme-backed AOI colors. */
function categoryBucket(category: string): 0 | 1 | 2 {
  let hash = 0
  for (const char of category) hash = (hash * 31 + char.codePointAt(0)!) >>> 0
  return (hash % 3) as 0 | 1 | 2
}

/** Read a theme-backed CSS color for canvas rendering. */
function canvasColor(Cesium: CesiumModule, root: HTMLElement, name: string, fallback: import('cesium').Color) {
  const value = getComputedStyle(root).getPropertyValue(name).trim()
  return Cesium.Color.fromCssColorString(value) ?? fallback
}

/** Load Cesium's global widget sheet through the DSH Host route. */
function ensureCesiumStyles(): () => void {
  const existing = document.querySelector<HTMLLinkElement>(`link[data-gstar-cesium="${CESIUM_WIDGET_STYLES}"]`)
  if (existing !== null) return () => {}
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = CESIUM_WIDGET_STYLES
  link.dataset.gstarCesium = CESIUM_WIDGET_STYLES
  document.head.append(link)
  return () => { link.remove() }
}

/**
 * Render the GSTAR globe and project station/AOI snapshots as Cesium entities.
 * @param props - Host projections and plain selection callbacks.
 * @returns the map surface.
 */
export function CesiumGlobe(props: CesiumGlobeProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const callbacksRef = useRef(props)
  callbacksRef.current = props
  const [runtime, setRuntime] = useState<GlobeRuntime>()
  const [error, setError] = useState<string>()

  useEffect(() => {
    const container = containerRef.current
    if (container === null) return
    const disposeStyles = ensureCesiumStyles()
    ;(window as typeof window & { CESIUM_BASE_URL?: string }).CESIUM_BASE_URL = CESIUM_ASSET_BASE
    Cesium.buildModuleUrl.setBaseUrl(CESIUM_ASSET_BASE)
    let viewer: Viewer | undefined
    let handler: ScreenSpaceEventHandler | undefined
    try {
      const createdViewer = new Cesium.Viewer(container, {
        animation: false,
        baseLayerPicker: false,
        baseLayer: new Cesium.ImageryLayer(new Cesium.OpenStreetMapImageryProvider({
          url: 'https://tile.openstreetmap.org/',
        })),
        fullscreenButton: false,
        geocoder: false,
        homeButton: false,
        infoBox: false,
        navigationHelpButton: false,
        scene3DOnly: true,
        sceneModePicker: false,
        selectionIndicator: false,
        timeline: false,
        terrainProvider: new Cesium.EllipsoidTerrainProvider(),
        requestRenderMode: true,
        maximumRenderTimeChange: Number.POSITIVE_INFINITY,
      })
      viewer = createdViewer
      const picks = new Map<string, GlobePick>()
      const createdHandler = new Cesium.ScreenSpaceEventHandler(createdViewer.scene.canvas)
      handler = createdHandler
      createdHandler.setInputAction((movement: { position: Cartesian2 }) => {
        const current = callbacksRef.current
        if (current.locatingSiteId !== undefined) {
          const ellipsoid = createdViewer.scene.globe?.ellipsoid
          if (ellipsoid === undefined) return
          const cartesian = createdViewer.camera.pickEllipsoid(movement.position, ellipsoid)
          if (cartesian === undefined) return
          const cartographic = Cesium.Cartographic.fromCartesian(cartesian, ellipsoid)
          current.onLocate(current.locatingSiteId, {
            longitude: Cesium.Math.toDegrees(cartographic.longitude),
            latitude: Cesium.Math.toDegrees(cartographic.latitude),
            height: cartographic.height,
          })
          return
        }
        const picked = createdViewer.scene.pick(movement.position) as { id?: Entity } | undefined
        const id = picked?.id?.id
        if (typeof id !== 'string') return
        const target = picks.get(id)
        if (target?.kind === 'site') current.onSelectSite(target.workspaceId)
        if (target?.kind === 'aoi') current.onSelectAoi(target.workspaceId, target.aoiId)
      }, Cesium.ScreenSpaceEventType.LEFT_CLICK)
      setRuntime({ Cesium, viewer: createdViewer, handler: createdHandler, picks })
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    }
    return () => {
      handler?.destroy()
      if (viewer !== undefined && !viewer.isDestroyed()) viewer.destroy()
      disposeStyles()
    }
  }, [])

  useEffect(() => {
    if (runtime === undefined) return
    const { Cesium, viewer, picks } = runtime
    viewer.entities.removeAll()
    picks.clear()
    const root = containerRef.current
    if (root === null) return
    const siteColor = canvasColor(Cesium, root.parentElement ?? root, '--gstar-map-site', Cesium.Color.CYAN)
    const outlineColor = canvasColor(
      Cesium, root.parentElement ?? root, '--gstar-map-site-outline', Cesium.Color.BLACK,
    )
    const labelColor = canvasColor(Cesium, root.parentElement ?? root, '--gstar-map-label', Cesium.Color.WHITE)
    const aoiColors = [
      canvasColor(Cesium, root.parentElement ?? root, '--gstar-map-aoi-1', Cesium.Color.LIME),
      canvasColor(Cesium, root.parentElement ?? root, '--gstar-map-aoi-2', Cesium.Color.ORANGE),
      canvasColor(Cesium, root.parentElement ?? root, '--gstar-map-aoi-3', Cesium.Color.CYAN),
    ] as const
    const spatialById = new Map(props.spatial.map(item => [item.workspaceId, item]))
    const focusEntities: Entity[] = []

    props.sites.forEach((site, index) => {
      const location = spatialById.get(site.workspaceId)?.location
      if (location === undefined) return
      const id = `gstar-site-${String(index)}`
      const entity = viewer.entities.add({
        id,
        position: Cesium.Cartesian3.fromDegrees(
          location.longitude, location.latitude, location.height ?? 0,
        ),
        point: {
          color: siteColor,
          outlineColor,
          outlineWidth: 2,
          pixelSize: props.selectedSiteId === site.workspaceId ? 16 : 12,
        },
        label: {
          text: site.title,
          fillColor: labelColor,
          outlineColor,
          outlineWidth: 3,
          pixelOffset: new Cesium.Cartesian2(0, -24),
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        },
      })
      picks.set(id, { kind: 'site', workspaceId: site.workspaceId })
      if (props.selectedSiteId === site.workspaceId) focusEntities.push(entity)
    })

    const selectedSpatial = props.selectedSiteId === undefined
      ? undefined
      : spatialById.get(props.selectedSiteId)
    selectedSpatial?.aois.forEach((aoi, aoiIndex) => {
      const polygons = aoi.geometry.type === 'Polygon'
        ? [aoi.geometry.coordinates]
        : aoi.geometry.coordinates
      polygons.forEach((rings, partIndex) => {
        const id = `gstar-aoi-${String(aoiIndex)}-${String(partIndex)}`
        const color = aoiColors[categoryBucket(aoi.category)]
        const entity = viewer.entities.add({
          id,
          polygon: {
            hierarchy: hierarchy(Cesium, rings),
            material: color.withAlpha(props.selectedAoiId === aoi.id ? 0.48 : 0.26),
            outline: true,
            outlineColor: color.withAlpha(0.95),
          },
        })
        picks.set(id, { kind: 'aoi', workspaceId: selectedSpatial.workspaceId, aoiId: aoi.id })
        focusEntities.push(entity)
      })
    })
    viewer.scene.requestRender()
    if (focusEntities.length > 0) {
      void viewer.flyTo(focusEntities, {
        duration: 1.2,
        offset: new Cesium.HeadingPitchRange(0, -0.65, selectedSpatial?.aois.length === 0 ? 450_000 : 0),
      })
    }
  }, [props.sites, props.spatial, props.selectedSiteId, props.selectedAoiId, runtime])

  return (
    <div className={css.root} data-locating={props.locatingSiteId === undefined ? undefined : ''}>
      <div ref={containerRef} className={css.canvas} aria-label="GSTAR Cesium 地球" />
      {runtime === undefined && error === undefined ? <p className={css.status}>正在加载 Cesium 地球…</p> : null}
      {error === undefined ? null : <p className={css.status} role="alert">Cesium 加载失败：{error}</p>}
    </div>
  )
}
