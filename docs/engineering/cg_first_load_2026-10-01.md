# CG 首次加载修复与首页克制回调（2026-10-01）

范围仅为 master 测试站。使用已有黑白灰像素素材，不重新生成美术，不改变剧情文字、回合规则、结局阈值、API 配置或存档契约。

## 原因与处理

原序章每张 1920px WebP 为 1.2–1.3 MB，且没有手机版本；常用状态、情绪及结局桌面图也约 1 MB。WebP 后缀不代表文件小。在 1.6 Mbps 下载条件下，进入序章同时加载当前/下一张原图，本身就会占用十几秒。

`scripts/optimize_cg_assets.mjs` 从既有原图导出 21 组带内容摘要的 WebP，原图保留：

- 桌面保持原尺寸，quality=82；序章首张约 100 KB，其他多数 100–220 KB。
- 手机 900px，quality=80；序章首张约 18 KB，状态和情绪多数 35–50 KB。
- 同图 320px 轻量预览，约 1–4 KB；缩放使用 nearest，保持像素边缘，不改变构图、颜色或人物。
- `gameContract.ts` 只更换图片引用并补齐序章手机图；ID、字幕与规则保持原样。

渐进图片先显示同图预览，再在完整图解码后交接；完整图失败时保留预览。序章仍只挂载当前和下一帧，等待解码、跳过及重复点击的原行为保留。

首页空闲、聚焦或悬停“开始”时仅准备首张序章与常用戒备场景，不拉取后续情绪及结局。保存流量/2G 模式只准备微缩预览。原音乐播放行为保持。

## 首页回调

以 `15f43648` 简洁首页的原有构图和间距为基准，撤销上一轮突出的标题染色、提亮与排版。恢复原有既有氛围层，标题保留原始笔触，仅低饱和、略压亮度；背景继续黑白灰。标题压缩文件、即时控制及当前导航/存档逻辑继续保留。

## 验证与复现

- 111 项前端测试、lint/build 通过。覆盖 CG 体积与手机尺寸、渐进加载/图片切换、有限且去重的入口预热，以及已有规则、序章、存档和导航回归。
- 原序章与优化后第一、第二帧实测位置正确、清晰图完成后正常显示；手机实际请求 `mobileImage` 版本，浏览器无错误。
- 同一公开 HTTPS 站点、冷缓存、下载 1.6 Mbps、延迟 150 ms、CPU 4 倍降速样本：直接打开 `/game?entry=new`，原第一张 13,623 ms 才出现；优化后预览 1,554 ms、清晰图 2,917 ms。
- 优化后首次打开首页并立即点击“开始”，从点击计预览 1,984 ms、清晰图 2,486 ms。该路径包含音乐解锁与页面过渡。数字是样本，不是所有用户网络的保证。

在 `legacy_vue` 可重新导出：`node scripts/optimize_cg_assets.mjs`。
使用独立浏览器会话采样（不要使用个人已登录会话，脚本会清空目标站点缓存和存储）：

```powershell
agent-browser --session cg-audit open about:blank
$taskCdp = agent-browser --session cg-audit get cdp-url
node scripts/measure_cg_entry.mjs $taskCdp https://master.tiantaishiju.top/ ../../output/cg-audit.json
# 末尾添加 true 可测手机；添加 false home 可测首次首页点击进入。
agent-browser --session cg-audit close
```

## 发布

新前端目录 `/opt/damo/releases/master-cg-entry-20261001/frontend`，入口 `/var/www/damo-master`。旧目录 `/opt/damo/releases/master-home-polish-20261001/frontend` 保留，可恢复符号链接回退。主域名 shumei 的目录和服务不变。
