# `@deepseek-ai/dsh-gstar-data-source-akshare`

[English](README.md) | 中文

可动态加载的 GSTAR AkShare 上市公司增强来源。它把 `akshare-a-share` 注册为默认关闭、面向企业和金融 AOI 的直接实体来源。启用只影响一个局点；显式同步会经 `ctx.subprocess` 运行随包 Python bridge，并在校验完成后一次性提交完整空间 patch。

配置持久化 AkShare／巨潮资讯 CSV 时，Bridge 会优先读取 `profileDatabasePath`。它接受部署侧区域企业采集器生成的规范化字段，无需远程请求即可匹配企业名称与别名，并按注册地址或办公地址过滤。`广州·南沙` 等展示名称和标准行政区名称都会被归一化为市、区地址 token；存在更精确层级时，省级 token 不作强制要求。CSV 中所有同名记录都会参与筛选，再选取地址属于局点的记录。本地结果会报告候选 AOI 数、名称命中数和地址命中数。未配置本地档案库时，它会依次尝试 AkShare 的交易所、东方财富、腾讯和新浪完整 A 股列表，对传输与响应解码失败执行重试，并以相同策略请求每个匹配企业的巨潮资讯公司概况。如果所有列表来源或必需的公司概况请求均不可用，同步会明确报告本次未更新，并保留完整的现有 AOI 发布。来源不会创建几何，不会混并集团母公司与上市子公司，也不会把企业复制到相邻行政区。

将 `profileDatabasePath` 指向部署侧采集器生成的持久化 `all_listed_companies.csv`；空值表示使用在线 AkShare 查询。请把 AkShare 安装到 `pythonExecutable` 指定的 Python 环境，例如执行 `python -m pip install --upgrade akshare`。`requestMaxRetries` 和 `requestRetryDelayMilliseconds` 限制每次股票列表或公司概况请求的重试次数与间隔。`maxProfiles`、`timeoutMilliseconds` 和 `maxOutputBytes` 分别限制远程概况调用、子进程生命周期和采集输出。模块缺失、传输失败或 TLS 失败时插件会返回简洁且可操作的提示，并且永不提交不完整 bridge 输出。

TLS 证书与主机名校验默认严格启用。请把包含企业代理 CA 的 PEM bundle 配置为 `caBundlePath`；bridge 会将其作为 `REQUESTS_CA_BUNDLE` 传给 Requests。值为空时会保留进程继承的 `REQUESTS_CA_BUNDLE`。`insecureSkipTlsVerify` 只在 bridge 子进程中关闭 Requests 校验，且不能与 `caBundlePath` 同时配置；它会接纳伪造、过期或主机名不匹配的证书，因此仅可用于可信内网中的临时排障。

## 模型体验

无，因为来源只增强 Host 产品数据，不注册提示词、工具或 Session 事件。

#### KV Cache 影响

无。

## 已知限制与暂缓事项

- 名称匹配从局点已采集 AOI 开始；AOI 发布中不存在的上市公司不会被虚构成几何。
- 公司名称与地址可能变化，AkShare 展示上游数据但不成为其权威发布方；仍需保留溯源并抽样核验。
- 一次同步会顺序调用概况接口，最多处理 `maxProfiles` 个匹配；扩大上限前，大型局点需要缓存或调度型连接器。
- 插件只读取而不刷新 `profileDatabasePath`；完整与增量档案更新由部署侧采集器负责。
- Requests 不会自动导入 Windows 系统信任；企业私有 CA 需要通过继承环境或 `caBundlePath` 提供。
- AkShare 代码采用 MIT 许可，交易所与巨潮资讯数据仍受各发布方条款约束。
