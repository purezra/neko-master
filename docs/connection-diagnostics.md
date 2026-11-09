# 连接排查 / Connection diagnostics

在侧栏打开 **连接排查**，使用直接连接的 Clash / OpenClash / Mihomo 网关。网关地址和 API 密钥沿用面板设置，浏览器无需连接路由器 API。

1. 保持网关的监听开启，重新访问打不开的网站。
2. 在“最近连接”输入 **1–5 分钟的整数**，搜索域名、粘贴完整链接，或搜索设备 IP、进程和策略组。
3. 查看命中规则、上传/下载流量及实际策略链。链路按“外层策略组 → 内层策略组 → 节点”显示。点击策略组可查看当前成员；Selector 组选择成员后立即生效。
4. 已有连接保留原路径。需要重连时，点击目标记录的“断开此连接”，再访问网站并检查新连接。
5. 在“策略组与节点”查看当前运行配置的组和节点，搜索节点或代理集合，执行单节点延迟检测或全部节点检测。

连接窗口按**最后观察时间**筛选，因此也包含较早建立但仍活跃的连接。零流量和刚结束的连接会保留。每个网关最多保留 10,000 条观察记录，查询每页 100 条；超出上限会显示提示。记录仅存在采集器内存中，保留 5 分钟，服务重启或清空网关数据后消失。没有历史回填，不依赖 SQLite/ClickHouse 的统计刷新间隔。采样过期时显示状态待更新，避免将旧记录误认为当前活跃。

DNS 失败、采样间隔内开始并结束、以及尚未进入内核连接快照的请求可能没有记录。零下载不等于连接一定失败。自动策略组只读展示，由内核调度；手动切换使用 Selector 组。Surge 和探针模式暂不支持此功能。

检测请求由内核通过节点访问 `https://www.gstatic.com/generate_204`，最多并发 6 个，内核超时 5 秒。全部节点检测作为后台任务执行，可查看完成数量，离开页面或刷新页面不会中断；采集器重启会中止任务。每个网关同一时间只能运行一个检测任务。结果只说明测试地址的可达性，不保证 Twitter 等目标网站可访问。演示模式禁止切换、断开和检测，API 同样校验。

实现使用 [Mihomo 官方控制 API](https://wiki.metacubex.one/api/)：连接 WebSocket、当前代理配置、Selector 切换、单连接断开及节点延迟检测。不会修改 OpenClash 配置文件或订阅内容。

---

Open **Connections** in the sidebar with a directly connected Clash / OpenClash / Mihomo gateway. The collector reuses the configured gateway address and secret.

1. Enable gateway listening and visit the failing website again.
2. Enter a whole number from **1 to 5 minutes**. Search by domain, URL, device IP, process or policy group.
3. Inspect the matched rule, byte counters and actual chain, shown from outer policy group to node. Click a group to inspect it; selecting a member of a Selector group takes effect immediately.
4. Existing connections keep their original route. Disconnect only the target connection, then visit again to verify a new route.
5. Open **Policies & nodes** to inspect the running configuration, search nodes/providers and test one or all nodes.

The window uses the last observation time, including long-lived, zero-byte and recently ended connections. Observations live in collector memory for five minutes, with a 10,000-entry limit per gateway and 100 results per page. Eviction and stale samples are indicated. Restarting the collector or clearing backend data removes observations. There is no historical backfill or dependency on SQLite/ClickHouse flushes. DNS failures and connections missed between snapshots may be absent. Zero download does not establish failure. Automatic policy groups are read-only; manual switching uses Selector groups. Surge and agent backends are currently unsupported.

Health checks request `https://www.gstatic.com/generate_204` through each node, with six concurrent tests and a five-second core timeout. Bulk tests run in the background and expose progress; navigation and reloads do not interrupt them, but collector restart does. Only one job per gateway runs at a time. Results describe reachability of the test URL, not the destination website. Showcase mode blocks all control actions in both UI and API. The feature uses the [official Mihomo API](https://wiki.metacubex.one/en/api/) and does not edit OpenClash configuration files or subscriptions.
