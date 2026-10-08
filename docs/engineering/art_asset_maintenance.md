# master 美术资源维护

当前 master 使用 `gameContract.ts`、`cgAssets.generated.ts` 与
`originalCgQuality.ts` 中的统一 CG。首页保留原黑白像素背景、标题雾层和菜单光晕；
摄影师、相机、剧情与表现约束以 [游戏设定集](../product/game_setting_bible.md)和
[Prompt 文档](prompts_and_settings.md)为准。

## 重建命令

从 `legacy_vue/` 执行：

- `npm run assets:generate`：保留现有美术，只在雨精灵图缺失时重建它。
- `npm run assets:generate -- --force`：只覆盖重建 `vfx_rain_sprite.webp`，不会生成 CG 或旧占位图。
- `node scripts/build_unified_image2_candidates.mjs`：从保留原稿重建 07 月统一 CG、封面/PV和指标。
  审查拼图输出到 `docs/art_review_generated/`，不进入 public，也不覆盖历史审查快照。
- `node scripts/optimize_cg_assets.mjs`：从统一 CG 生成桌面、手机与预览图。

上述命令进行本地格式转换，不调用图像生成模型。未来创建或修复原画时使用项目要求的 image2.5，
并检查人物、服装、相机、天台与黑白像素画风的一致性。

## 清理与恢复

2026-10-08 将原先放在数媒工作区的未提交清理迁移到最新 master。
保留 master 仍使用的 9 张首页背景/光效及原稿、全部统一 CG、原图画质文件和重建原稿。
成就页改用已有黑白天台图，桌面/窄屏分别引用 `menu_bg_rooftop_1600/900.webp`。

- [master 迁移记录](../art_review_2026-10-01/MASTER_MIGRATION.md)：当前范围与验证。
- [master 删除与备份清单](../art_review_2026-10-01/master_cleanup_result.json)。
- [原始盘点](../art_review_2026-10-01/README.md)与
  [原工作区记录](../art_review_2026-10-01/CLEANUP.md)：历史证据。

在仓库根目录只读校验 master 备份：

```powershell
python docs/art_review_2026-10-01/restore_archived_assets.py --record master_cleanup_result.json --check
```

需要还原已退役美术时，将 `--check` 改成 `--execute`。
工具只恢复缺失图片，拒绝覆盖已变化的同路径资源；源码修改另行通过 Git 恢复。
