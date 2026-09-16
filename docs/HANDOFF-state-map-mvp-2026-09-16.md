# Claude handoff：州级 MapLibre choropleth 与数据接入 MVP

日期：2026-09-16。接手目录：`/Users/gordontu/Code/Svelte/ycgs-church-closing/app-map`。

## 1. 先做什么，做到哪里停止

**当前交接给 Claude 的任务是分析并提出实施方案，再由用户决定执行。** 用户的最终建设目标是：先完成真实的 state view、MapLibre 州级 choropleth、data fetching；设计时考虑 county、tract 的数据量增长。用户明确要求参考现有 MapLibre 组件的改动。不要把这份交接当作已经批准所有技术选型的最终 spec。

请按顺序：

1. 阅读第 2 节列出的现有实现及第 3 节上游证据，核实实际 Parquet 的可用性和字段。完成标志：分清实测事实、代码推断、未验证数据。
2. 分析第 4 节的指标冲突与第 5–6 节的方案。能从代码/文件解决的问题自己查；只有业务口径、数据发布版本等无法自行确认的项才列为待决策。
3. 向用户给出最小实施方案：数据来源、第一版指标与窗口、MapLibre 复用范围、请求/缓存粒度、将触及的文件、验收方式。明确哪些能立即做，哪些依赖数据团队。
4. **本轮分析结束后先交付方案，不自动部署、提交 GitHub 或修改 OneDrive。** 用户决定实施后，再进入实现流程。

用户已确定：MapLibre；州级 MVP 优先；后续支持更细地理层级；OneDrive 与上游 GitHub 保持只读。项目代码本轮尚未实现该 MVP。不要再次询问要不要用 MapLibre、要不要先做州级。

## 2. 本地项目：先读这些，复用这些

本轮检查的本地 HEAD：`6880be805ff4b63ac3b93a1eca999d52e23de48a`（`REMAKE UI`）。唯一既有工作区改动：`src/components/explore/FindPlace.svelte` 删除了一行 Search 图标；保留它。执行前重查 git status，后续用户可能继续编辑。

以下文件均相对于上述接手目录；点击链接为绝对路径。

| 阅读入口                                                                                                                                                                                                                                                                                                                 | 目前事实 / 对 MVP 的意义                                                                                                                                                   |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Explore route](</Users/gordontu/Code/Svelte/ycgs-church-closing/app-map/src/routes/(site)/explore/+page.svelte>)                                                                                                                                                                                                        | 当前地图仍是占位；View by 按钮只改局部变量；`level` 尚未进 URL；`onlocate` 直接选 CT，是原型行为。                                                                         |
| [Explore model](/Users/gordontu/Code/Svelte/ycgs-church-closing/app-map/src/lib/explore/model.ts)                                                                                                                                                                                                                        | `STATES` 的数值、`compute()`、宗教份额/倍率全部是 fixtures；以州缩写为 id；年份范围也写死。真实数据接入必须替换计算，保留可用的展示/查询逻辑。                             |
| [SelectionPanel](/Users/gordontu/Code/Svelte/ycgs-church-closing/app-map/src/components/explore/SelectionPanel.svelte)、[SummaryDialog](/Users/gordontu/Code/Svelte/ycgs-church-closing/app-map/src/components/explore/SummaryDialog.svelte)                                                                             | 显示百分比、`Open in [start]` 与 U.S. 比较；`SummaryDialog` 的地图也仍是占位。三处展示必须采用同一指标定义。                                                               |
| [MapLibre component](/Users/gordontu/Code/Svelte/ycgs-church-closing/app-map/src/components/map/maplibre-map.svelte)                                                                                                                                                                                                     | 现有地图是 `svelte-maplibre-gl` + `DeckGLOverlay` + `GeoJsonLayer`；不是自写 imperative MapLibre wrapper。底图为 CARTO Voyager。                                           |
| [LazyMapLibreMap](/Users/gordontu/Code/Svelte/ycgs-church-closing/app-map/src/components/map/LazyMapLibreMap.svelte)                                                                                                                                                                                                     | 在 onMount 动态加载地图，隔离 SSR/WebGL；保留这种边界。                                                                                                                    |
| [static-assets](/Users/gordontu/Code/Svelte/ycgs-church-closing/app-map/src/lib/map/static-assets.ts)、[topology](/Users/gordontu/Code/Svelte/ycgs-church-closing/app-map/src/lib/map/topology.ts)                                                                                                                       | 几何独立加载，Promise 去重，失败后可重试。转换函数目前取 TopoJSON 的第一个 object，实际是 counties，不能直接传同一文件就期待画 states。                                    |
| [data.remote](/Users/gordontu/Code/Svelte/ycgs-church-closing/app-map/src/lib/dashboard/data.remote.ts)、[server readers](/Users/gordontu/Code/Svelte/ycgs-church-closing/app-map/src/lib/server/data/map-data.ts)、[prebuild script](/Users/gordontu/Code/Svelte/ycgs-church-closing/app-map/scripts/prebuild-data.mjs) | 旧数据通路为 CSV → 构建时 gzip JSON → SvelteKit prerender remote functions，带 dynamic fallback。可借用静态发布方式，但输入 schema 是旧 county CSV，不能直接读新 Parquet。 |
| [legacy load](/Users/gordontu/Code/Svelte/ycgs-church-closing/app-map/src/routes/legacy/+page.ts)、[selection owner](/Users/gordontu/Code/Svelte/ycgs-church-closing/app-map/src/lib/dashboard/county-selection.svelte.ts)                                                                                               | 已有 SSR 数据读取、请求失败处理，以及“最新选择胜出”的异步竞争处理。新增州级通路应保持同样的行为。                                                                          |

### 用户已有的 MapLibre 改动，不能无意退回

查看本地提交 `97376f3`（移除 vendored map fork，隔离客户端 bundle）、`cd411b7`、`2250fdc`（地图边界与导出加固）、`088efd0`（remote functions 数据迁移）。这些提交及现有代码才是复用依据。

- 保持懒加载、地图加载失败反馈、共享资产加载与错误后重试。
- 现有 Deck 图层 interleaved，并依赖 `beforeId: waterway`。改底图时必须验证该 layer 是否存在及覆盖顺序。
- 现有导出依赖 `preserveDrawingBuffer`、antialias/stencil/alpha 和 map idle + Deck 完成渲染的 capture revision；若改共享地图，保护 `/legacy`、`/PDF`。
- Hover 与 selection 是不同状态；新地图要让选中州在 hover 其他州时仍可辨认。旧代码 `hoveredCountyId || geoid` 的单一高亮层不能直接等价于这个要求。
- 旧相机查 `county-camera.json`，州级应有自己的 bounds/fit 行为；不要让州 GEOID 因查不到 county camera 而退回全国。
- 旧 click 用 `geoContains` 扫所有 feature。州级规模可以接受；tract 时应使用图层 picking 或渲染器命中的 feature，避免全国逐个扫描。
- 旧颜色是 `scaleQuantize` 等宽区间；新 UI 的 `<2 / 2–3.9 / 4–5.9 / 6–8.9 / 9+` 是不等宽阈值。图层与 legend 必须共享一个与真实指标匹配的分级规则，不能机械移植。
- 当前定位逻辑返回 county；MVP 可以暂不接定位，但不能继续保留点击后假选 CT 的行为。

实测 [counties-10m.json](/Users/gordontu/Code/Svelte/ycgs-church-closing/app-map/src/data/counties-10m.json) 为 1,576,578 bytes，含 counties 3,231、states 56、nation 1 个 geometry；州 id 已是 `"04"` 这样的字符串。**有州界可复用，但来源 vintage/覆盖范围未验证。** 先核对；可在构建时抽出只含 states 的资产，避免州级页面下载所有县界。

## 3. 已找到的数据与证据边界

### 3.1 上游代码和方法

- [Development / reports](https://socah-lab.github.io/Church-Closures-Dashboard/Pages/Development.html#reports)：以 2026 Format 为当前方法。
- 上游 repo：<https://github.com/SOCAH-Lab/Church-Closures-Dashboard>。
- 本次调查固定的上游 commit：`194e893fa98562e6f8607e8cf335b3faddee433d`；本地只读副本在 `/tmp/church-closures-research-20260915`。
- [2026 导出实现](https://github.com/SOCAH-Lab/Church-Closures-Dashboard/blob/194e893fa98562e6f8607e8cf335b3faddee433d/Code/Generate%20the%20Metrics_2026%20Format.R#L1170-L1192)。
- [字段定义与 sample 说明](https://github.com/SOCAH-Lab/Church-Closures-Dashboard/blob/194e893fa98562e6f8607e8cf335b3faddee433d/Pages/Reports/Metrics_2026%20Format.qmd#L490-L577)。
- [DuckDB 分块合并示例](https://github.com/SOCAH-Lab/Church-Closures-Dashboard/blob/194e893fa98562e6f8607e8cf335b3faddee433d/Code/Generate%20the%20Metrics_2026%20Format.R#L1550-L1600)。这里 D3 是脚本章节编号，不是 D3.js 数据服务。

完整字段语义、示例 SQL、代码聚合问题的可运行重现已在 [upstream research](/tmp/church-upstream-research.md)，需要实现 importer 或验证源数据时必读。不要重新猜 schema。

### 3.2 OneDrive 中已通过浏览器验证的文件位置

从用户给的 Meeting Summaries 回到 `Church closing`，进入：

```text
SOCAH LAB / Church closing /
Church-Closures-Dashboard GitHub LOCAL ONLY Files /
Data / Results / KEEP LOCAL / From Generate the Metrics /
```

该位置下面有：

| 路径                                                       | 浏览器验证结果                               |
| ---------------------------------------------------------- | -------------------------------------------- |
| `All Metric Results/by_geoid/state/`                       | 33 个 `chunk_*.parquet`，2026-08-31 修改     |
| `All Metric Results/by_geoid/county/`                      | 34 items；这是目录项数，不能全部当成 Parquet |
| `All Metric Results/by_geoid/tract/`                       | 34 items                                     |
| `All Metric Results/by_geoid/block_group/`                 | 34 items                                     |
| `All Metric Results/by_zcta/`                              | 33 items                                     |
| `PART D Confirm Deliverables/state_combined.parquet`       | 194 KB                                       |
| `PART D Confirm Deliverables/county_combined.parquet`      | 2.98 MB                                      |
| `PART D Confirm Deliverables/tract_combined.parquet`       | 33.8 MB                                      |
| `PART D Confirm Deliverables/block_group_combined.parquet` | 52.5 MB                                      |
| `PART D Confirm Deliverables/zcta_combined.parquet`        | 13.2 MB                                      |
| `PART D Confirm Deliverables/milwaukee_tract.csv` 与 plot  | 可作为以后 tract 检查的候选样本              |

上述大小是 OneDrive 显示大小，不是解压后浏览器内存，更不是全窗口全集大小。`*_combined` 按公开脚本/报告只含 `2000_2006`、`2007_2024`、`2010_2015` 三组窗口；**文件内部尚未核验**。33 个 state chunk 对应更完整输出。

浏览器成功读取了 08/19 meeting summary 与该共享目录的 README：团队保留 2000/2010/2020 不同边界版本；社区指标由 Nick 匹配相应边界；README 说明 OneDrive 镜像公开 repo 中未跟踪的本地文件。此前公开网页所说的 Raw data 不是最直接的当前聚合结果入口。

**已验证的是目录、文件名、显示大小和公开实现；没有完成私有 Parquet 内部 schema/值的验证。** 上次尝试了下载小样本，但未确认本地落盘路径；不要假定它已在 Downloads 或当前 repo。下一步先正常下载/定位本地副本，再检查。不要把“存在文件”写成“数据正确”。

## 4. 会改变实现的四个数据事实

这里只列会影响 MVP 的约束，详细证据见 upstream research。

1. **指标不匹配。** 当前 Explore 的百分比和起始基数是原型。上游 `n_open` 是窗口内曾活跃的企业数，不是起始时开放数；`*_per_10k` 是每万居民，`*_per_sqmi` 是每平方英里。保留“起始的 Y 个中 X 个关闭”的文案，需要数据团队提供同一初始 cohort 的分母和关闭分子。不能重命名 `n_open`，也不能把每万人数标成 `%`。
2. **窗口不可由年度值自由相加。** 关闭判断依赖连续至少四个不活跃年，且对每个窗口重新评估。上游是预计算窗口列；`year` 是 census vintage，不是关闭年份。上游最短 5 个含首尾年份，与当前 UI `to - from >= 5` 差一年；从 manifest 枚举真实窗口。样本只有三个窗口时，旧 `deriveYearWindowBounds()` 要求完整连续组合的假设不适用。
3. **chunk 是窗口列分块。** 按 `(geoid, year, religion)` 合并，`read_parquet(..., union_by_name=true)` 后对选定列取唯一有效值；上游示例用 MAX。先验证重复非空值是否冲突，不能用 MAX 隐藏冲突，不能按行简单追加再求和。ZCTA 的原字段是 `zcta`。
4. **公开聚合实现有已重现的问题。** Geography 人口、面积和部分计数重复附着到 ABI 行后被累加；移动企业还可能跨 block group 在州级重复计数。重现验证的是固定 commit 的 helper，不代表已经证明 OneDrive 结果有错。引入数据前核对 actual release、分母与 distinct ABI 计数。不要只靠“county 相加等于 state”通过自洽检查，两边可能同错。

第一版推荐先用 `state_combined` 的一个已核验窗口、`all_religions`，保留 `no_moves/all` 的明确选择。指标由用户/数据团队确认；在那之前可完成数据通路和地图结构，但不能把未核验结果包装为正式研究指标。若要暂用 count 做 demo，明确其单位并得到产品口径决定，不能偷偷替换 UI 的 percentage。

其他直接相关限制：

- 当前 app 的旧 CSV 有 count 小数、CT geography 混杂、没有 type/tract/baseline 等问题，不建议拿它们生成新的真实州级结果。
- 宗教类可能重叠；优先使用上游 `all_religions`，不要默认分类可相加，也不要沿用原型 share/factor。实际宗教值需从 Parquet 读取。
- 明确 50 州 + DC / 是否含 PR 等总体范围；现有 geometry 有 56 个州级实体，原型是 51，旧上游 state GeoJSON 是 52 × 3 vintages。当前私有数据范围待核验。
- 缺数据、没有观测、真实 0 要区分；undefined/null 不能转换成 0。原型 `<15` suppression 不是本次确认的业务规则。
- U.S. 参考值若没有可靠同口径汇总，先标记不可用；不能无条件平均州率或相加可能重叠的细地理计数。

## 5. 候选 MVP 方案（待 Claude 评估，未实施）

### 数据获取与请求

```text
OneDrive 聚合 Parquet（本地只读副本）
  → 离线提取 + 验证 + 发布清单
  → 按查询切片的 JSON + 独立 geometry
  → SvelteKit 数据读取 / CDN 缓存
  → MapLibre choropleth + 同一查询下的 panel
```

- OneDrive 是维护者导入源；网页的交互请求读取发布好的摘要数据。不要让访客直接登录 OneDrive，也不要在浏览器打包完整研究 Parquet/企业记录。
- 复用现有构建/静态读取方式，添加最小的 Parquet 适配步骤。不能将新数据强塞进需要 persistence/reopening 的旧 `MapDatum`，制造不存在的字段。
- 第一条完整链路只做一个真实 state window + all_religions + 一个明确 vintage。验证后增加实际可用窗口和类别。
- 面向 UI 的概念查询：`level, boundaryYear, from, to, religion, parentGeoid?`。发布版本与 metric/closure variant 若固定在 release 中就写进 manifest；可切换才成为 query 维度。所有影响结果的值必须参与缓存身份。
- 聚合行最少：字符串 GEOID、name、已确认指标的数值/单位及明确缺失状态。metadata 记录 release、boundaryYear、窗口、宗教口径、总体范围、geometry 资产。`baseline` 仅在真实存在且定义正确时返回。
- 旧 `data.remote.ts` 的详情 GEOID 校验只接受 5 位，`getMapData` 也只有 from/to；新查询必须明确 level/vintage 等维度，不能把 2 位州 ID 补成伪县 ID。
- 小的 manifest 列出真实支持的窗口、类型、层级和 geometry 来源；不需要通用 schema 框架。
- 首次 SSR 可以输出 selection/panel 的真实数据，地图继续 client-only 懒加载。交互 fetch 需要 loading/error/retry、相同查询去重、旧请求不能覆盖新查询。不能静默退回 synthetic 数据。
- 一次读整个 state slice，不按每个州发请求。选州只更新 selection，不重新下载全国 state 指标。
- `geoid` 做机器身份，州名/缩写用于展示和搜索；兼容 landing 的 `where` 输入，避免破坏入口链接。share URL 能还原已应用查询。

### 地图接入

默认先评估复用已有 `MapLibre` + `DeckGLOverlay`：已有依赖和可验证行为，无需另起地图体系。是否直接将现有 renderer 的 geometry/选中项输入泛化，还是加一个小的州级组件，取决于最小 diff 与 legacy 风险；不要为了未来四层视图先造通用引擎。

只用原生 MapLibre fill/line 也满足用户要求，Claude 可以比较；如果没有明确简化收益，不同时迁移旧 Deck 渲染与做新数据接入。无论选哪种，保留第 2 节提到的已修行为。

MVP 行为：全国州级分级设色；清晰的 legend/单位/No data；hover 预览；click/search 选中、更新 panel 与 URL；reset；实际缩放按钮；AK/HI 和明确纳入的其他地区可访问；地图失败有提示；键盘可以通过搜索/州选择完成与点击同等的选择。不要把仅有一张底图当成 choropleth 完成。

county/tract/ZIP 按钮若未接数据，明确禁用或标记未提供。Summary 只需避免继续显示错误口径；完整报告布局和重做旧 PDF 不属于州级数据+地图 MVP。

## 6. 为 county / tract 留出的最小扩展点

| 层级        | 建议加载粒度                                       | 实施时验证                                                  |
| ----------- | -------------------------------------------------- | ----------------------------------------------------------- |
| State       | 一个小 geometry；每个实际查询一个全国指标 slice    | 不下载县界/tract 数据；选择州不重复请求该 slice             |
| County      | 可全国或按所选州切片，用实际体积决定               | 同 vintage 的 county ids；CT 旧县与 planning regions 不混用 |
| Tract       | 先选州，再下载该州 geometry 与指标；大州可再按县拆 | 下载/解析/绘制时间与内存；切 query 不重新下载 geometry      |
| ZCTA        | 独立 geography 与 scope 映射                       | 不能用 ZCTA 前两位推断州，也不能假设严格嵌套于一个县        |
| Block group | 现有数据层级，暂不在这次地图范围内                 | 真正需要时复用查询/分片结构                                 |

GEOID 保留前导零：state 2、county 5、tract 11、block_group 12、ZCTA 5。county 和 ZCTA 同为 5 位，不能仅按长度判定 level。boundaryYear 与指标观察期分别记录，geometry 和指标必须匹配。

状态/县级可以继续用小规模静态 prerender。**不要直接把旧 `inputs: every geoid` 模式扩成所有 tract × window × religion × vintage 的组合。** 将 geometry 与统计值分别缓存，以地理范围为分片单位；客户端只按需读取。静态资产数量/部署大小真正超出现有部署能力时，再考虑对象存储；某州简化后的 geometry 实测仍慢，再考虑 vector tiles/PMTiles。当前不新增数据库、全国 tract 预加载或瓦片服务。

其他地理层级不是从 state 反推，直接使用已经生成的相应层级输出。Tract 的父县/州可由匹配 vintage 的 GEOID 推导，但业务计数的向上汇总仍需去重规则，不能仅切前缀就认为统计正确。

边界与社区指标的详细官方来源已在 [geography research](/tmp/church-geography-sources.md)。实施 county/tract 或 SDOH 时读它。优先用团队已有匹配版本的 geometry/SDOH；不要直接混入最新 ACS。当前 Census API 认证、变量、地理年份在那份笔记中有官方链接，实际接入时再核验。

## 7. 现有文档的适用范围和冲突

- [CONTEXT.md](/Users/gordontu/Code/Svelte/ycgs-church-closing/app-map/CONTEXT.md) 描述的是旧 county 数据 plane；`00000` sentinel 与 2001–2021 窗口不是新数据的固有事实。
- [原产品 handoff](/Users/gordontu/Code/Svelte/ycgs-church-closing/app-map/docs/HANDOFF-places-of-worship-site.md) 是页面/职责/设计背景的依据，不必复制全文。§10 明确还是未同意的 draft；其中 A 年度求和方案不能直接套上当前算法，B 预计算窗口更接近现实。百分比/baseline 仍是产品要求与真实数据的待解决接缝。
- [术语表](/Users/gordontu/Code/Svelte/ycgs-church-closing/app-map/docs/UBIQUITOUS_LANGUAGE.md) 保留 place of worship、window、level、unit、vintage 等统一词汇。它记录了某些设计假设，不能用来证明上游字段含义。
- [现有地图回归测试](/Users/gordontu/Code/Svelte/ycgs-church-closing/app-map/tests/e2e/map-migration.spec.ts) 覆盖 canvas 截图、layer order、camera、样式失败、PDF、定位竞争。改共享地图时将它作为回归依据。

## 8. 后续实现的完成标准

- 一个实际 Parquet 样本完成 schema、重复键、缺失值、单位/分母验证，并有可复现的源值对照；source revision 和发布版本可追踪。
- Explore 的图层、tooltip、panel、legend、share 使用同一个已应用查询，展示同一指标；失败不能显示伪造成功或旧查询结果。
- 州界和记录 GEOID 完整匹配；unmatched 有可检查报告；数据范围一致，零值和 No data 可分辨。
- 一个最小 importer/数据契约回归检查：leading zero、chunk 合并冲突、null vs 0、实际窗口。再加一个州选择→URL→panel→reload 的浏览器检查。
- 新地图真正有填色；可鼠标和键盘选择；快速切窗口不被旧请求覆盖；geometry 不随统计筛选反复下载；state 请求中没有 tract payload。
- 若改共享组件，跑现有地图/PDF 相关回归。现有脚本 `npm run check`、`npm run test:unit` 会触发 generate:data；浏览器测试需要先 build。只运行与实际改动有关的验证，不顺便重构全仓库。

本轮只有阅读与 handoff 写作；没有执行 app build、修改 app 实现或验证运行中的州级地图。对现有 `maplibre-map.svelte` 运行 Svelte autofixer：issues 为空，只有 effect/bind:this 通用建议；不代表功能、数据或性能验证通过。

## 9. Suggested skills

接手后用可用的 Skill 工具加载对应 skill；如果当前 harness 未暴露名称，读取已安装文件，不要只靠名称猜流程。

1. **现在：`mattpocock-skills:handoff`。** Codex → Claude 正是换 harness 的适用场景。本文件即交接结果；按该 skill 规定保存在 OS 临时目录，没有改写 repo 的长期文档。
2. **Claude 分析：`/grill-with-docs`。** 只澄清剩余业务决定，先查证能查证的事实；保留已确定的 MapLibre/州级优先约束。若问题已充分明确，不强行追加采访。
3. **方案收敛：`/to-spec`。** 将源数据、指标选择、MVP 行为和验收落成 spec。只有确实跨多轮实现时才 `/to-tickets`；需要跟踪配置时先检查 `/setup-matt-pocock-skills`，本次只写交接无需创建 tracker/labels 或修改 GitHub。
4. **用户决定执行后：`/implement`。** 按真实行为做 TDD，并在结束时 code-review。读取本仓库 `.agents/skills/svelte-code-writer/SKILL.md` 和 `svelte-core-bestpractices/SKILL.md`，遵循已有 Svelte 5 组件模式。
5. **按需：`/to-questionnaire`。** 只有 baseline/cohort、closure variant 或发布版本确实必须由 Ryan/研究团队提供时，整理最小问题清单给用户；不自动发消息。

不需要因为叫 MVP 就选 `/prototype`：本次目标是可接入现有 app 的实际功能。只有出现必须实测才能回答的独立问题（例如大型州的 tract 渲染性能）时，才另做有限原型。
