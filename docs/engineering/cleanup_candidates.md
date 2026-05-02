# 垃圾目录与文件清理候选清单

本文档记录当前仓库中疑似由开发、构建、调试或历史迁移过程产生的垃圾目录/文件，供后续清理前确认。

## 优先清理：已经进入 Git 的垃圾

### 根目录 `node_modules/`

- 状态：已被 Git 跟踪。
- 规模：约 292M，约 22361 个跟踪文件。
- 判断：依赖安装产物，不应提交到仓库。
- 建议：从 Git 索引移除并加入根目录 `.gitignore`。

### 根目录 `.vite/`

- 状态：已被 Git 跟踪，当前约 2 个文件。
- 判断：Vite 缓存目录，不应提交到仓库。
- 建议：从 Git 索引移除并加入根目录 `.gitignore`。

### `next_temp/`

- 状态：模板源码已被 Git 跟踪；`next_temp/node_modules/` 为本地忽略文件。
- 判断：根据 `docs/engineering/technical_overview.md`，当前主前端是 `legacy_vue/`，`next_temp/` 是未接管的 Next.js 模板/试验残留。
- 建议：如果确认不再进行 Next.js 迁移，删除整个目录；如果仍需保留迁移参考，则至少清理其本地 `node_modules/`，并在文档中明确其非主工程身份。

### 根目录音频素材

- `Chance Thrash - Chamomile Tea.mp3`
- `shitty-typing-sound.mp3`

状态：已被 Git 跟踪。

判断：代码实际引用的是：

- `legacy_vue/public/assets/audio/bgm_rooftop.mp3`
- `legacy_vue/public/assets/audio/typing_click.mp3`

根目录两个 mp3 未发现代码引用，疑似原始素材、临时素材或历史残留。

建议：确认无需保留原始素材后，从仓库移除；如果需要保留原始素材，建议移动到明确的素材归档目录并说明用途。

## 本地可清理：未跟踪或已忽略的生成物

### `legacy_vue/dist/`

- 状态：已被 `legacy_vue/.gitignore` 忽略。
- 规模：约 46M。
- 判断：Vite 构建产物。
- 建议：本地可删除，需要时重新执行 `npm run build` 生成。

### `legacy_vue/node_modules/`

- 状态：已被 `legacy_vue/.gitignore` 忽略。
- 规模：约 5.6M。
- 判断：前端依赖安装产物。
- 建议：本地可删除，需要时重新执行 `npm install`。

### `next_temp/node_modules/`

- 状态：已忽略。
- 规模：约 332M。
- 判断：未接管 Next.js 模板目录下的依赖安装产物。
- 建议：如果 `next_temp/` 不再使用，优先删除。

### `.playwright-cli/`

- 状态：未跟踪。
- 规模：约 136K。
- 判断：Playwright/浏览器调试过程产物，包含控制台日志。
- 建议：本地可删除，并加入根目录 `.gitignore`。

### `.claude/`

- 状态：未跟踪。
- 判断：Claude Code 本地工作状态/工具产物，不属于项目源码。
- 建议：不提交；可加入根目录 `.gitignore`。

### 开发日志

- `legacy_vue/vite-chat-after.log`
- `legacy_vue/vite-chat-after.err.log`
- `.playwright-cli/console-2026-04-29T08-54-35-415Z.log`

状态：已忽略或位于未跟踪目录中。

判断：开发服务或调试日志。

建议：本地可删除；保持 `*.log` 忽略规则。

## 不能提交但不算垃圾

### `backend/.env`

- 状态：已被 `backend/.gitignore` 忽略。
- 判断：本地后端环境变量，可能包含 LLM API Key。
- 建议：保留本地使用，不提交。

### `legacy_vue/.env.local`

- 状态：已被 `legacy_vue/.gitignore` 忽略。
- 判断：本地 Vite 开发配置，例如 `VITE_BACKEND_URL`。
- 建议：保留本地使用，不提交。

### `CLAUDE.md`

- 状态：当前未跟踪。
- 判断：Claude Code 仓库说明文件，不是垃圾。
- 建议：如果希望未来 Claude Code 实例自动读取本仓库开发指南，可以提交。

## 建议补充根目录 `.gitignore`

当前根目录没有 `.gitignore`。建议新增根目录忽略规则，用于覆盖跨目录生成物：

```gitignore
node_modules/
dist/
.vite/
.playwright-cli/
.claude/
output/
*.log
.env
.env.local
```

注意：添加 `.gitignore` 不会自动移除已经被 Git 跟踪的文件。对于已经进 Git 的垃圾，需要额外执行索引移除或删除操作。
