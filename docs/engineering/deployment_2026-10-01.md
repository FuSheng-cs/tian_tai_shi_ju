# shumei 上线记录（2026-10-01）

- 地址：<https://tiantaishiju.top>
- 版本基线：`origin/shumei-merge`，`03021910`（青少年心理安全竞赛版）。
- 本地修改分支：`codex/shumei-deploy-20261001`。
- 发布目录：`/opt/damo/releases/shumei-20261001`，含 frontend、backend 与 source。
- 前端入口：`/var/www/damo` 链接到发布目录 frontend；Nginx 配置保持现有同域 API 代理。
- systemd 覆盖文件：`/etc/systemd/system/damo-backend.service.d/shumei-release.conf`，指定发布目录 backend 为工作目录和程序路径。
- 当前运行环境：发布目录 `backend/.env`。密钥由原配置复制，在服务器上保留，不进入源码或前端。
- 服务器默认：`LLM_PROVIDER=deepseek`、`LLM_MODEL=deepseek-flash`、`LLM_BASE_URL=https://api.deepseek.com`。
- Linux amd64 后端 SHA256：`67b0a08b3f331a074b1020db62538285b8b803b9e2d472a7a26d17659d553d17`。

## API 信息修改

前后端同步更新千问、DeepSeek、豆包、Kimi、智谱、OpenAI、Claude 的默认模型、候选模型和说明，参见 [Prompt 与 API 说明](prompts_and_settings.md)。
更新后端采样和思考参数，避免新模型因旧参数拒绝请求。现有玩家 Key、自定义模型和地址保持原样；旧模型使用者可清空模型字段采用最新默认值。
服务器未收到玩家 Key 时继续完整使用服务器配置。剧情、Prompt 和存档规则采用 shumei 原版，没有额外修改。

## 验证

- 前端 `npm test -- --run`：11 个文件、97 项测试通过。
- 前端 `npm run lint`、`npm run build` 通过。验证时设 `VITE_BACKEND_URL=/`，覆盖本地开发 `.env.local`；生产包没有 `localhost:8080`。
- 后端 `go test ./...`、`go build ./...` 通过；增加前后端 Provider 默认值同步、模型请求参数和 Kimi 不兼容历史拦截回归测试。
- `node scripts/check_docs.mjs`：25 个 Markdown 文件、73 个本地链接通过。
- 服务器 `nginx -t` 通过；systemd 服务 active；HTTPS `/api/health` 返回 `{"status":"ok"}`。
- HTTPS `/api/chat` 使用服务器 Key，返回 HTTP 200、真实对白及 emotion/ai_state/trust_delta/pressure_delta/ending_type/confidence，耗时约 1.9 秒。
- 日志确认演员和裁判两次调用均使用 `deepseek-flash`。
- 浏览器设置页确认 DeepSeek 默认模型为 `deepseek-flash`；进入 shumei 开场、发送一句话后收到真实回复，页面恢复可输入状态，浏览器无错误，服务器该请求 HTTP 200、耗时约 1.0 秒。
- 其他服务商按官方文档及本地模拟请求验证；未使用其他服务商真实 Key 验收，也未完成真实模型整局结局验收。

## 备份与回退

备份目录：`/opt/damo/backups/shumei-20261001`，权限 700，含原前端、后端程序、环境配置和 systemd 配置。
回退命令（在服务器执行）：

```bash
sudo bash /opt/damo/backups/shumei-20261001/rollback.sh
```

脚本恢复原前端目录和后端运行路径，重启服务并检查健康状态。原 `/opt/damo/backend/.env` 未改写；当前有效配置位于新发布目录。
发布目录同时保留旧前端 hash 资源，以减少已打开页面切换版本时的资源 404。PWA 会自动更新，已有页面必要时刷新。
