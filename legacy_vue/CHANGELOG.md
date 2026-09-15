# Changelog

## 2026-09-15 · v1 分支整合

- 合入代码审查修复、统一 image2 CG、Web 首页与移动布局，保留共用存档和演出逻辑。
- 迁移 ESLint flat config，修复检查暴露的未使用变量，补首页菜单与存档整合回归测试。
- 更新架构、模型配置、Key 传输说明与文档入口，分离历史审查和当前待办。
- v2 设计单独进入 v2/roadmap，不混入本版已实现范围。
- 测试和构建结果见 [整合记录](../docs/engineering/integration_2026-09-15.md)，不沿用下面历史版本的覆盖率声明。

## [1.0.0] - 2026-03-23

> 历史初始化记录；当时的资源路径、功能描述和覆盖率口径不作为当前事实。
### Added
- 初始化 Vue 3 + TypeScript + Vite 游戏项目架构。
- 引入 Pinia 状态管理与 Howler.js 音频控制。
- 引入 TailwindCSS 样式引擎。
- 支持 PWA，提供 manifest 与 service-worker（基于 vite-plugin-pwa）。
- 实现了 `SaveSystem` 支持 localStorage 和 CRC32 数据校验。
- 实现了 `AchievementTracker` 记录和展示游戏结局成就。
- 实现了打字机组件、分支选择模块。
- 提供全局设置功能（音频音量、字体、深色模式）。
- 提供了基础单元测试；未保留可核对的覆盖率报告，不声称覆盖率达标。

### Resource Status
- 初始化阶段使用过 Mock 或 CSS 回退；当前资源以 [统一 CG 清单](../docs/art_review_2026-07-31/unified_game_cg_manifest.md) 和游戏契约为准。
