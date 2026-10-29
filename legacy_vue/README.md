# 天台十句 · Vue 客户端

`legacy_vue` 是 AIC 独立项目的主前端。

## 运行与验证

使用 Node.js 24，在本目录执行：

```sh
npm ci
npm run dev
npm run lint
npm test -- --run
npm run build
```

开发环境在 .env.local 设置 VITE_BACKEND_URL=http://localhost:8080，另行启动 Go 后端。生产默认同源 /api/*。

## 已实现范围

Web 首页及移动布局、主线自由对话、独立裁判、固定十句话、提示、安全离开/拒绝离开两个结局、成就、三栏位主线/后日谈存档、开场/结局演出和统一 CG。后日谈由安全离开状态或符合安全结局条件的可读后日谈存档解锁。

玩家可自带模型 Key；无 Key 时使用服务器配置；两侧均无 Key 时只提供标注的模拟演示。Key 会从浏览器经后端传给服务商。模型配置已持久化，音量/显示设置刷新恢复仍待实现。

当前功能聚焦于完整响应后的本地打字机、文本对话、心理健康沟通提示、两个结局和安全回访；现实支持由现实中的可信任成年人、专业人员和服务系统承担。

## 文档入口

- [项目说明](../README.md)
- [当前状态与待办](../docs/STATUS.md)
- [技术说明](../docs/engineering/technical_overview.md)
- [人物与叙事正典](../docs/product/game_setting_bible.md)
- [项目状态](../docs/STATUS.md)
- [AIC UML 架构图](../docs/architecture/aic_dual_call_component.puml)
