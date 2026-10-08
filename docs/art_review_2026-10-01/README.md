# 《天台十句》全 CG / 美术盘点与删除审批

> 2026-10-08：这批未提交清理已迁移到最新 master，并保留其仍使用的首页资源。
> 当前执行范围与验证请看 [master 迁移记录](MASTER_MIGRATION.md)。以下内容是 10 月 1 日的历史快照。

> 2026-10-01。A–F 已执行：83 个文件全部外部备份并移出当前数媒 public。
> 当前分支 `codex/first-load-shumei`；仅在本工作区生成报告并校正本地资源文档。

[清理执行结果与恢复方法](CLEANUP.md) · [当前文件清单](current_inventory.csv)

**以下盘点与比较是清理前的审查快照。当前验证与执行状态以 CLEANUP.md 为准。**

## 范围与证据

- master：`8675f6774fccbb29865bb235c2f1c722f5daf364`；数媒：`origin/shumei-merge`，`14cca4d942e9348e8893a75ffe5fc17bfaa49f00`。HEAD 与数媒 ref 一致。未执行 fetch，结论对应这些本地 Git 快照。
- 扫描两分支所有已提交图形、当前完整 `public/assets/images/`，并检查全部本地/远端分支 tip 及 Git 历史中出现的美术路径。没有切换分支或修改另一工作区。
- 181 个运行目录图形文件，合计 201.3 MiB；另有 2 个 JSON 指标文件。master 有 169 个图形，数媒有 181 个；所有原有同路径图形 blob 一致。
- 含文档拼图、截图、SVG 等，两分支合并盘点 220 个路径（master 179 / 数媒 220）。声音和字体不属于本次 CG 美术清理范围。
- 每项保存 SHA-256、尺寸、字节数、所在分支、静态运行引用位置、生成脚本线索与目视审查备注。栅格文件均解码成功，SVG 单独保留。
- 运行引用是源码检查，涵盖常量拼接、CSS 和页面；不是浏览器实测。未发现两版运行引用的候选也已搜索测试与脚本；生成/文档依赖仍须在删除时同步处理。

## 数媒版多出的 CG

仅新增 `safe_exit_20260918/` 内 4 张画面、12 个文件；每张含 PNG 原稿、1600 WebP、900 WebP。其余 CG 没有新增或替换。

| 画面 | 使用情况 |
| --- | --- |
| `01-crying` 落泪 | 哭泣状态 + 安全离开第 1 帧 |
| `02-wipe-tears` 抹泪 | 安全离开第 2 帧 |
| `03-leave-ai-only` 只画艾进入楼梯间 | 当前安全离开第 3 帧 / 结算背景 |
| `03-leave-together` 两人一起进入楼梯间 | 另一个构图候选，当前未引用，不是逐字节重复 |

数媒实际接入 3 张 CG、6 个响应式文件；另外 3 张 PNG 是相应原稿。29 张新增测试截图属于验证资料，不算新 CG。字体差异也不计入 CG。

## master 完全重复的文件

SHA-256 与完整解码像素两项校验得到相同的 6 组重复，没有额外的同尺寸像素重复。前三组是 CG，后三组是审查拼图。

| 文件一 | 文件二 | 结论 |
| --- | --- | --- |
| `docs/art_review_2026-07-31/contact_unified_cinematics.png` | `legacy_vue/public/assets/images/unified_image2_2026-07-31/game_cg/review_cinematics.png` | 文件字节完全一致 |
| `docs/art_review_2026-07-31/contact_unified_gameplay_cg.png` | `legacy_vue/public/assets/images/unified_image2_2026-07-31/game_cg/review_gameplay_states.png` | 文件字节完全一致 |
| `docs/art_review_2026-07-31/contact_unified_image2.png` | `legacy_vue/public/assets/images/unified_image2_2026-07-31/review_contact_sheet.png` | 文件字节完全一致 |
| `legacy_vue/public/assets/images/char_girl_normal.png` | `legacy_vue/public/assets/images/char_girl_sad.png` | 文件字节完全一致 |
| `legacy_vue/public/assets/images/char_girl_normal_1600.webp` | `legacy_vue/public/assets/images/char_girl_sad_1600.webp` | 文件字节完全一致 |
| `legacy_vue/public/assets/images/char_girl_normal_900.webp` | `legacy_vue/public/assets/images/char_girl_sad_900.webp` | 文件字节完全一致 |

这些重复均存在于 master。普通/低落同规格实际上同图；并非两种情绪。保留 docs 中的审查拼图即可。

## 老图与新图的重合

- 旧 `cg_opening_stair_01…05` → 统一 `game_cg/opening/opening_01…05`。旧版站立/坐下连续性较弱，新版以安全栏杆内的坐姿承接。
- 旧 `cg_emotion_*` → 统一 `game_cg/emotion/emotion_*`；旧 normal/sad → 新 guarded/wavering；旧 sneer 缩略图 → 正方形统一头像。
- 旧临界/回身、消失/认识/坠落序列 → master 已使用的统一 state/ending 图。数媒取消旧临界与三结局，并增加安全离开；不能据此删除 master 仍用的新资源。
- 旧 `menu_home_bg_*` 含吸烟人物，现首页使用无人 `menu_bg_rooftop_*`；旧 aura/mist 图层已没有运行引用。
- `opening_05` 与 `state_guarded` 共用同一原稿；统一候选 `cg_01…05` 与部分游戏 state/ending 也共用原稿。不同尺寸/编码/用途属于派生文件，保留其运行图与重建原稿。
- `cg_end_fall.png` 是空天台，但同名前缀 `_1600/_900.webp` 是实际坠落画面；旧 PNG/WebP 并不总是原稿与压缩图的一一对应。不能仅按文件名清理。

逐文件对应见 [old_to_new.csv](old_to_new.csv)。视觉近似指标见 [visual_similarity.csv](visual_similarity.csv)，只用于辅助审阅，不作为自动删除条件。

## 目视质量结论

| 类别 | 发现 | 建议 |
| --- | --- | --- |
| 明显不合格占位图 | `cg_death_falling_16_9/9_16` 是紫红抽象图；`cg_acquaintance_9_16` 是彩色圆点，缺少叙事主体 | A，审批后删除 |
| 旧人物/情绪 | normal/sad 同图；部分右下有星形标记；旧惊讶/柔软/好奇脸型和微笑漂移、烟雾明显 | A，已由统一图接替，原稿先留归档 |
| 旧实际坠落镜头 | 与当前数媒无伤亡演出设定冲突；两分支均未引用这些根目录图 | A，审批后退役 |
| 成就页当前背景 | `bg_rooftop_night_1920/750.webp` 仍是彩色几何占位，两版都在用 | 保留文件；需先选择合格天台图替换页面引用 |
| 新统一主状态 | 人物与雨夜像素环境一致，但 guarded/wavering/turn_back 等仍有旧相机道具，opening 第 5 帧也来自旧相机母版，与数媒手机设定存在表现落差 | 不删活跃图；后续局部修图、统一手机/道具后替换 |
| 新安全离开 | 落泪、抹泪与门口背影色调一致；近景/远景变化属演出镜头；两人版与第一人称只画艾是构图选择 | C 仅属于未使用候选，不把两人版判为质量不合格 |
| 06 月设定表/候选、PV封面 | 没有运行引用，仍可作历史、身份参考、营销复用 | 归档，不以未引用推断质量差 |

## 原审查批次（现已执行 A–F）

共 **83 个文件 / 85.3 MiB**。清单逐项固定路径和 SHA-256；所有批次默认未批准。

| 批次 | 数量 | 大小 MiB | 内容 / 执行边界 |
| --- | ---: | ---: | --- |
| A | 46 | 39.56 | 根目录旧 CG/人物。46 项均未被两版运行引用；同步停用旧生成项，原稿先归档。 |
| B | 15 | 32.11 | 06 月候选 CG 与 5 张设定表。建议归档后从 public 移除，保留历史审查拼图。 |
| C | 3 | 2.61 | 未使用的两人离开 PNG + 两个 WebP。先确认保留第一人称只画艾版，原稿归档。 |
| D | 3 | 6.00 | 3 张 public 审查拼图，docs 中已有完全相同副本；同步更改生成输出目录。 |
| E | 7 | 0.05 | 7 个旧街景/图标/按钮/进度条/雪与火特效。两版均未引用，仍需停用旧生成项。 |
| F | 9 | 4.98 | 9 个旧首页背景、菜单光效和标题雾层；现页不用，源 PNG 归档后移出 public。 |

审查时优先建议 A+D+E；用户授权后已将 A–F 全部原文件归档，逐项验证 SHA-256，再移出运行目录。

用户查看清单后授权自主处理，已执行 A–F。[逐图盘点页](review.html)保留所有原图预览并显示完成状态。

## 不应跨版本直接删除

**22 个文件**在数媒未引用但 master 仍引用；均标为 KEEP。包括 root `char_girl_smoke` 的 3 个规格、香烟机会图、统一 smoke/edge 状态各 2 个文件、统一 7 张旧结局各 2 个文件。香烟机会图原稿同样保留。

若只清理数媒发布目录，可以单独审批这 22 项的“仅数媒退役”；master 不动，历史原稿归档。当前 A–F 清单不包含这些文件。

历史只出现、当前 master/数媒都不存在的名称只有 `char_girl_smile.png`、`icon_cigarette.svg`。前者与当前 sneer 的 Git blob 不相同；不会当作只是重命名，也没有恢复到运行目录。分支位置见 [other_branch_only.csv](other_branch_only.csv)，历史预览在 `historical_only/`。

## 历史遗留问题与本轮处理

1. 本地 `docs/engineering/emotion_cg_assets.md` 原来声称旧根目录情绪图和吸烟设定正在使用，已校正为数媒实际契约、两种规格、正确第三帧文件以及当前状态优先级。该路径被 `.gitignore` 明确忽略，因此只是本地文档修正，不会自动进入提交。
2. `npm run assets:generate` 的 `generate_assets.mjs` 仍写入旧占位 CG/人物；例如会把现有像素版 `cg_acquaintance_16_9.webp` 和 `char_girl_*.png` 覆盖成早期几何图。审批后须退役获批项，保护仍被 master 使用的资源，再验证该命令不会重建已清理旧图。
3. 统一构建脚本仍在 public 生成审查拼图、封面/PV以及 master 的旧结局；D 需调整拼图产出到 docs，不能只删文件。
4. PNG 原稿、900/1600 响应图、1920 开场图、480 头像职责不同。已保留活跃原稿，不把全部低引用项批量列入删除。
5. 首屏优化并不会去掉 public 内的候选/原稿；Vite 会复制 public，因此本次清理能缩减发布包，但不能直接等同于首屏网络节省。

本轮只完成盘点、文档校正和审批准备，生成脚本退役、页面替换和删除等待具体批次批准。没有生成新图；未来需要生成时遵循项目要求使用 image2.5。

## 文件与验证

- [逐图审批页](review.html)：离线 HTML，220 项；KEEP/HOLD 禁止勾选，A–F 未默认选择。
- [全量 inventory.csv](inventory.csv)、[master_inventory.csv](master_inventory.csv)、[shumei_inventory.csv](shumei_inventory.csv)：完整尺寸/哈希/引用证据。
- [deletion_candidates.csv](deletion_candidates.csv)、[approval_manifest.json](approval_manifest.json)：83 项候选与审批状态。
- [audit.json](audit.json)：完整结构化结果；`contact_*.jpg` 是按类别分页的缩略图。
- 重跑：仓库根目录执行 `python docs/art_review_2026-10-01/audit_assets.py`，再执行 `python docs/art_review_2026-10-01/build_report.py`。只写报告，不改图。
- 校验覆盖：两分支 blob 差异、181 个图形哈希/尺寸、6 组精确重复、生成原稿关系、全部分支和历史路径。审批页另做本地浏览器验证，结果见 `validation.json`。
- 尚未删除/改动游戏资源与运行代码，因此未运行前后端完整测试。审批后清理需做静态引用检查、前端 test/lint/build 与运行页面验证。
