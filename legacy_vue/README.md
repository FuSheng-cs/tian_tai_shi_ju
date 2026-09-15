# 天台十句 · Vue 客户端

`legacy_vue` 是当前实际使用的主前端，不是待废弃的旧实现。

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

Web 首页及移动布局、主线自由对话、独立裁判、动态机会、提示、三结局、成就、三栏位主线/后日谈存档、开场/结局演出和统一 CG。后日谈由相识状态或可读后日谈存档解锁。

玩家可自带模型 Key；无 Key 时使用服务器配置；两侧均无 Key 时只提供标注的模拟演示。Key 会从浏览器经后端传给服务商。模型配置已持久化，音量/显示设置刷新恢复仍待实现。

当前没有网络流式、多模态上传或 v2 碎片/循环系统。虚构结局不是现实危机处置指导，暂时离开栏杆不代表治愈。

## 文档入口

- [项目说明](../README.md)
- [当前状态与待办](../docs/STATUS.md)
- [技术说明](../docs/engineering/technical_overview.md)
- [人物与叙事正典](../docs/product/game_setting_bible.md)
- [整合与验证](../docs/engineering/integration_2026-09-15.md)
