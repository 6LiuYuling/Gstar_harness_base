# `@deepseek-ai/dsh-gstar-tool-spatial-query`

English | [中文](README.zh.md)

Read-only DSH Tool Consumer for station-aware GSTAR conversation. `gstar_station_data` resolves authority from the immutable calling Session `cwd`, requires an exact `ctx.gstarSites` station path, and then reads `ctx.gstarSpatial`. Omitting `aoi_id` returns station metadata, location, AOI summaries, entity counts, and provenance; providing an AOI id returns bounded entity fields plus complete provenance for that AOI.

The tool is loaded only by the `gstar` Profile. It does not trust browser selection or a model-supplied Workspace id, so an ordinary `dsh web` Workspace cannot query GSTAR data through this path.

## Model Experience

### Tool schemas

#### What the model sees

The model sees the generated [`gstar_station_data` schema](../../../docs/tool-catalog.md#deepseek-aidsh-gstar-tool-spatial-query). It offers an optional AOI id and an optional bounded entity limit; station identity is deliberately absent from model-controlled arguments.

#### Token effect

One fixed read-only schema is sent on each request while the GSTAR tool is visible.

#### KV Cache effect

Prefix-stable while tool visibility and the definition are unchanged.

### Tool results

#### What the model sees

Successful calls return formatted JSON from the current station's Host snapshots. Overview results contain no entity arrays. AOI reads include at most 200 entities and report the complete count and whether the array was truncated.

#### Token effect

Results are data-dependent and remain in logged tool history until compaction; `entity_limit` bounds the largest entity array.

#### KV Cache effect

Append-only result text follows the reusable request prefix and does not invalidate earlier cache entries.

## Known Limitations and Deferred Work

- Session authority uses exact canonical `cwd` equality with the station path; sessions without a cwd cannot query GSTAR data.
- The tool reads only the latest spatial projection and provides no historical data-version selector.
- AOI geometry is included in AOI detail results and can still be large even when entity count is bounded.
