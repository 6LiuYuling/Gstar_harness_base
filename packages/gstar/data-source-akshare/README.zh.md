# `@deepseek-ai/dsh-gstar-data-source-akshare`

[English](README.md) | 中文

可动态加载的 GSTAR AkShare 上市公司增强来源。它把 `akshare-a-share` 注册为默认关闭、面向企业和金融 AOI 的直接实体来源。启用只影响一个局点；显式同步会经 `ctx.subprocess` 运行随包 Python bridge，并在校验完成后一次性提交完整空间 patch。

Bridge 先使用 AkShare 的 A 股代码／名称列表匹配现有 AOI 名称与别名，再请求匹配公司的巨潮资讯公司概况。只有注册地址或办公地址包含局点名称中全部可用市、区 token 时，概况才会被接纳。来源会在现有 AOI 中补充 `listed_company` 实体，并记录 AkShare／巨潮资讯来源、获取时间和校验和。它不会创建几何，不会混并集团母公司与上市子公司，也不会把企业复制到相邻行政区。

请把 AkShare 安装到 `pythonExecutable` 指定的 Python 环境，例如执行 `python -m pip install --upgrade akshare`。`maxProfiles`、`timeoutMilliseconds` 和 `maxOutputBytes` 分别限制远程概况调用、子进程生命周期和采集输出。模块缺失时插件会返回明确安装提示，并且永不提交不完整 bridge 输出。

## 模型体验

无，因为来源只增强 Host 产品数据，不注册提示词、工具或 Session 事件。

#### KV Cache 影响

无。

## 已知限制与暂缓事项

- 名称匹配从局点已采集 AOI 开始；AOI 发布中不存在的上市公司不会被虚构成几何。
- 公司名称与地址可能变化，AkShare 展示上游数据但不成为其权威发布方；仍需保留溯源并抽样核验。
- 一次同步会顺序调用概况接口，最多处理 `maxProfiles` 个匹配；扩大上限前，大型局点需要缓存或调度型连接器。
- AkShare 代码采用 MIT 许可，交易所与巨潮资讯数据仍受各发布方条款约束。
