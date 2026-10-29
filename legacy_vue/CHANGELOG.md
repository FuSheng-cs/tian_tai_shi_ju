# AIC 前端变更记录

## 2026-10-29｜心理健康沟通复盘

- 增加 `psychologicalReading`、`supportSkills`、`nextStep` 和 `safetyBoundary` 类型。
- 解析并白名单过滤后端复盘字段，最多保留四项支持技能。
- 结算页增加 AI × 心理健康沟通复盘卡片。
- 旧存档缺少新增字段时保持兼容，不写入空字段。
- 测试覆盖复盘字段映射和保守归一化。

## 当前前端范围

- Vue 3、TypeScript、Pinia、Vite、Tailwind CSS 和 Howler。
- 自由对话、独立裁判、十句话、提示、两个结局、成就、存档、结局演出和安全回访。
- 本地测试使用模拟模型服务，覆盖前端契约与交互行为。
