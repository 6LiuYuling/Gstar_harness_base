import { useEffect, useRef, useState } from 'react'
import * as Cesium from 'cesium'
import type { Cartesian2, Entity, ScreenSpaceEventHandler, Viewer } from 'cesium'
import type { WorkspaceId } from '@deepseek-ai/dsh-client-runtime/client'
import type {
  GstarAoiCategory, GstarLinearRing, GstarSpatialSnapshot,
} from '@deepseek-ai/dsh-gstar-spatial/types'
import type { GstarSiteSnapshot } from '@deepseek-ai/dsh-gstar-site/types'
import css from './CesiumGlobe.module.css'

const CESIUM_ASSET_BASE = '/gstar/cesium/'
const CESIUM_WIDGET_STYLES = `${CESIUM_ASSET_BASE}Widgets/widgets.css`

type CesiumModule = typeof Cesium
type CesiumBuildModuleUrl = typeof Cesium.buildModuleUrl & { setBaseUrl(value: string): void }

/** User-selected Cesium projection for the station map. */
export type GstarMapMode = '2d' | '3d'

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
  readonly mode: GstarMapMode
  readonly visibleAoiCategories: readonly GstarAoiCategory[]
  readonly selectedSiteId?: WorkspaceId
  readonly selectedAoiId?: string
  /** Monotonic selection request, allowing a repeated click to refit the camera. */
  readonly focusRevision: number
  readonly onSelectSite: (workspaceId: WorkspaceId) => void
  readonly onSelectAoi: (workspaceId: WorkspaceId, aoiId: string) => void
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
  /* v8 ignore next -- persisted AOI schemas reject polygons without an outer ring. */
  if (outer === undefined) throw new Error('GSTAR AOI polygon requires an outer ring')
  return new Cesium.PolygonHierarchy(
    ringPositions(Cesium, outer),
    rings.slice(1).map(hole => new Cesium.PolygonHierarchy(ringPositions(Cesium, hole))),
  )
}

/** Read a theme-backed CSS color for canvas rendering. */
function canvasColor(Cesium: CesiumModule, root: HTMLElement, name: string, fallback: import('cesium').Color) {
  const value = getComputedStyle(root).getPropertyValue(name).trim()
  return value.length === 0 ? fallback : Cesium.Color.fromCssColorString(value)
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
    // React invokes this effect only after committing the element carrying the ref.
    const container = containerRef.current as HTMLDivElement
    const disposeStyles = ensureCesiumStyles()
    ;(window as typeof window & { CESIUM_BASE_URL?: string }).CESIUM_BASE_URL = CESIUM_ASSET_BASE
    ;(Cesium.buildModuleUrl as CesiumBuildModuleUrl).setBaseUrl(CESIUM_ASSET_BASE)
    let viewer: Viewer | undefined
    let handler: ScreenSpaceEventHandler | undefined
    try {
      const satelliteLayer = new Cesium.ImageryLayer(new Cesium.UrlTemplateImageryProvider({
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        credit: new Cesium.Credit('Esri, Maxar, Earthstar Geographics, and the GIS User Community'),
      }))
      // Preserve the dark product character without hiding roads, buildings,
      // and terrain texture after the camera flies down to station scale.
      satelliteLayer.brightness = 0.84
      satelliteLayer.contrast = 1.12
      satelliteLayer.saturation = 0.82
      satelliteLayer.gamma = 1.05
      const createdViewer = new Cesium.Viewer(container, {
        animation: false,
        baseLayerPicker: false,
        baseLayer: satelliteLayer,
        fullscreenButton: false,
        geocoder: false,
        homeButton: false,
        infoBox: false,
        navigationHelpButton: false,
        scene3DOnly: false,
        sceneModePicker: false,
        selectionIndicator: false,
        timeline: false,
        terrainProvider: new Cesium.EllipsoidTerrainProvider(),
        requestRenderMode: true,
        maximumRenderTimeChange: Number.POSITIVE_INFINITY,
      })
      viewer = createdViewer
      createdViewer.scene.globe.baseColor = Cesium.Color.fromCssColorString('#050a10')
      const picks = new Map<string, GlobePick>()
      const createdHandler = new Cesium.ScreenSpaceEventHandler(createdViewer.scene.canvas)
      handler = createdHandler
      createdHandler.setInputAction((movement: { position: Cartesian2 }) => {
        const current = callbacksRef.current
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
    const { Cesium, viewer } = runtime
    const targetMode = props.mode === '2d' ? Cesium.SceneMode.SCENE2D : Cesium.SceneMode.SCENE3D
    if (viewer.scene.mode === targetMode) return
    if (props.mode === '2d') viewer.scene.morphTo2D(0)
    else viewer.scene.morphTo3D(0)
    viewer.scene.requestRender()
  }, [props.mode, runtime])

  useEffect(() => {
    if (runtime === undefined) return
    const { Cesium, viewer, picks } = runtime
    viewer.entities.removeAll()
    picks.clear()
    // The canvas is always nested by the component root before runtime publication.
    const root = containerRef.current as HTMLDivElement
    const colorRoot = root.parentElement as HTMLElement
    const siteColor = canvasColor(Cesium, colorRoot, '--gstar-map-site', Cesium.Color.CYAN)
    const outlineColor = canvasColor(
      Cesium, colorRoot, '--gstar-map-site-outline', Cesium.Color.BLACK,
    )
    const labelColor = canvasColor(Cesium, colorRoot, '--gstar-map-label', Cesium.Color.WHITE)
    const aoiColors: Readonly<Record<GstarAoiCategory, import('cesium').Color>> = {
      '政': canvasColor(Cesium, colorRoot, '--gstar-map-aoi-government', Cesium.Color.RED),
      '企': canvasColor(Cesium, colorRoot, '--gstar-map-aoi-enterprise', Cesium.Color.ORANGE),
      '金融': canvasColor(Cesium, colorRoot, '--gstar-map-aoi-finance', Cesium.Color.GOLD),
      '教育': canvasColor(Cesium, colorRoot, '--gstar-map-aoi-education', Cesium.Color.CYAN),
      '医疗': canvasColor(Cesium, colorRoot, '--gstar-map-aoi-medical', Cesium.Color.HOTPINK),
      '商场': canvasColor(Cesium, colorRoot, '--gstar-map-aoi-shopping', Cesium.Color.VIOLET),
      '居民区': canvasColor(Cesium, colorRoot, '--gstar-map-aoi-residential', Cesium.Color.LIME),
    }
    const spatialById = new Map(props.spatial.map(item => [item.workspaceId, item]))
    let selectedMarker: Entity | undefined

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
      if (props.selectedSiteId === site.workspaceId) selectedMarker = entity
    })

    const selectedSpatial = props.selectedSiteId === undefined
      ? undefined
      : spatialById.get(props.selectedSiteId)
    const boundaryEntities: Entity[] = []
    if (selectedSpatial?.boundary !== undefined) {
      const polygons = selectedSpatial.boundary.type === 'Polygon'
        ? [selectedSpatial.boundary.coordinates]
        : selectedSpatial.boundary.coordinates
      polygons.forEach((rings, partIndex) => {
        const fillId = `gstar-site-boundary-fill-${String(partIndex)}`
        const fill = viewer.entities.add({
          id: fillId,
          polygon: {
            hierarchy: hierarchy(Cesium, rings),
            material: siteColor.withAlpha(0.08),
          },
        })
        picks.set(fillId, { kind: 'site', workspaceId: selectedSpatial.workspaceId })
        boundaryEntities.push(fill)
        rings.forEach((ring, ringIndex) => {
          const lineId = `gstar-site-boundary-line-${String(partIndex)}-${String(ringIndex)}`
          viewer.entities.add({
            id: lineId,
            polyline: {
              positions: ringPositions(Cesium, ring),
              width: 3,
              material: siteColor.withAlpha(0.98),
              arcType: Cesium.ArcType.GEODESIC,
            },
          })
          picks.set(lineId, { kind: 'site', workspaceId: selectedSpatial.workspaceId })
        })
      })
    }
    const selectedAoiEntities: Entity[] = []
    selectedSpatial?.aois.forEach((aoi, aoiIndex) => {
      if (!props.visibleAoiCategories.includes(aoi.category)) return
      const polygons = aoi.geometry.type === 'Polygon'
        ? [aoi.geometry.coordinates]
        : aoi.geometry.coordinates
      polygons.forEach((rings, partIndex) => {
        const id = `gstar-aoi-${String(aoiIndex)}-${String(partIndex)}`
        const color = aoiColors[aoi.category]
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
        if (props.selectedAoiId === aoi.id) selectedAoiEntities.push(entity)
      })
    })
    viewer.scene.requestRender()
    const focusEntities = selectedAoiEntities.length > 0
      ? selectedAoiEntities
      : boundaryEntities.length > 0 ? boundaryEntities : selectedMarker === undefined ? [] : [selectedMarker]
    if (focusEntities.length > 0) {
      void viewer.flyTo(focusEntities, {
        duration: 1.2,
        offset: new Cesium.HeadingPitchRange(
          0,
          props.mode === '2d' ? -Math.PI / 2 : -0.65,
          boundaryEntities.length === 0 && selectedAoiEntities.length === 0 ? 450_000 : 0,
        ),
      })
    }
  }, [
    props.sites, props.spatial, props.mode, props.visibleAoiCategories,
    props.selectedSiteId, props.selectedAoiId, props.focusRevision, runtime,
  ])

  return (
    <div className={css.root}>
      <div ref={containerRef} className={css.canvas} aria-label={`GSTAR Cesium ${props.mode.toUpperCase()} 地图`} />
      {runtime === undefined && error === undefined ? <p className={css.status}>正在加载 Cesium 地图…</p> : null}
      {error === undefined ? null : <p className={css.status} role="alert">Cesium 加载失败：{error}</p>}
    </div>
  )
}
