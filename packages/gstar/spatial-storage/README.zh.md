# `@deepseek-ai/dsh-gstar-spatial-storage`

[English](README.md) | 中文

基于 `storage-domain` 的 `ctx.gstarSpatial` Provider。它打开 `gstar_spatial` 域，以局点 `WorkspaceId` 保存一条记录，并通过 `ctx.gstarSites` 过滤所有读取和写入。因此，普通 `dsh web` Workspace 在未被持久化分类为局点前，不能获得或暴露 GSTAR 空间记录。

写入由 Provider 自有操作链串行化，并在域关闭前全部完成。未提供的位置或 AOI 字段保留持久化值；空 AOI 数组表示一次明确发布，用于清空当前 AOI 投影。

## 模型体验

无，因为该 Provider 不贡献模型可见输入。

#### KV Cache 影响

无。

## 已知限制与暂缓事项

- 当前 KV 记录只保存最新空间投影，不保留数据版本历史。
- 大型实体集合仍内嵌在局点记录中；对象存储和索引化空间数据库将作为同一 Service Definition 的后续 Provider。
- 授权目前只基于持久化局点成员关系，而不是已认证用户策略。
