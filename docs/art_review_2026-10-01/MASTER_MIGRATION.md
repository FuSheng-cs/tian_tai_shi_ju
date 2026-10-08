# master 美术清理迁移（2026-10-08）

用户确认主要开发方向为 master 与 v2，原先留在数媒工作区的未提交美术清理应作用于 master。
迁移前已 fetch origin；master 基线为 `4055fb93`，与最新 `origin/master` 一致。
数媒分支仍为 `14cca4d9`，没有修改其提交；v2 分支和其他 worktree 保持原样。

## 本次范围

- 将原清理的 83 个文件逐项与最新 master 对比。
- 3 个安全离开候选文件本来不存在于 master，不引入，也不计入 master 删除数。
- 9 个 `menu_home_*` 首页背景、光晕、雾层及原稿仍被 master 使用，完整保留。
- 剩余 71 个旧 CG、人物、候选、占位素材与 public 审查拼图从 master 移除。
- 成就页改用已有黑白天台，再退役 2 张不再引用的彩色占位背景。
- `assets:generate` 只生成雨精灵；统一 CG 构建将审查拼图写入 docs。
- 数媒专用设置页测试不带入 master。新增生成保护与运行资源存在性回归测试。

合计退役 73 个文件、81,511,965 字节（77.74 MiB）；public 图形从 239 个降至 166 个。
精确字节数、SHA-256、保留清单和验证结果见
[master 执行记录](master_cleanup_result.json)。全部统一 CG、渐进图、原图画质文件及重建原稿保留。
角色、Prompt、结局、存档、后端与模型配置没有变化。

## 备份与恢复

迁移前完整工作区（含未跟踪审查文件）保存在 stash：
`cefb73d5147eae8b5e7cf0638c8e1aa4e7e36102`。
该 stash 来自数媒基线，恢复时需按版本审查，不能直接覆盖 master。

本次 master 删除文件另有完整外部 ZIP：
`D:\IT\program\TianTAiShiJu\art_archives\game_damo_taintaishiju\2026-10-08-master-art-cleanup-4055fb93.zip`。
删除前验证 ZIP 及每个图片 SHA-256。

在仓库根目录只读验证：

```powershell
python docs/art_review_2026-10-01/restore_archived_assets.py --record master_cleanup_result.json --check
```

显式还原图片时改用 `--execute`。原 [10 月 1 日工作区记录](CLEANUP.md)及其快照文件保持为历史证据。

## 验证

- 前端 22 个测试文件、121 项测试通过；ESLint、TypeScript 与生产构建通过。
- 后端 `go test ./...` 与 `go build ./...` 通过。
- 普通资源生成命令保留现有雨精灵，哈希不变。
- 在隔离副本完成统一 CG 全量重建，三张审查拼图只输出到 docs，未回流 public。
- 剩余 166 个图形与最新 master 基线的 Git blob 一致（文本图形按 Git 换行规则比较）。
- 生产包保留全部剩余图形，73 个退役项均不存在；外部 ZIP 的 73 个条目逐一校验通过。
- 文档本地链接与 Git 差异格式检查通过。

完整结果以 [执行记录](master_cleanup_result.json)中的 `validation` 为准。
本轮没有执行线上发布或重新进行浏览器渲染验收。
