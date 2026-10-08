# master 美术清理上线记录（2026-10-08）

- 站点：<https://master.tiantaishiju.top/>
- 已推送的运行源码：`a0f1b1c5ef3caa9672a3ec1e156814b8978151e7`。
- 前端发布目录：`/opt/damo/releases/master-art-cleanup-20261008-a0f1b1c5/frontend`。
- 入口：`/var/www/damo-master`，通过临时符号链接和原子替换切换。
- 公网 [版本标记](https://master.tiantaishiju.top/release.json)记录源码提交与图片数量。

## 发布范围

本次发布资源清理后的 master 前端。生产构建设置 `VITE_BACKEND_URL=/`，使用原有同域 API。
数媒入口仍为 `/opt/damo/releases/shumei-20261001-first-load/frontend`；v2 入口也保持原样。
三套后端服务均保持 active，数媒与 v2 的入口链接及首页 SHA-256 在发布前后完全一致。

208 个原始发布文件逐一核对 SHA-256；生产图片为 166 个，73 个退役项全部不在新发布目录。
另外保留上一版 assets 顶层的旧 hash JS/CSS，兼容已有标签页；没有复制退役图片。

上传包 SHA-256：
`ac1ad828642bc7f425f55e6f9e35e53a77591418812fa860c0381135193d0108`。

本地清理、备份与自动测试见 [master 迁移记录](../art_review_2026-10-01/MASTER_MIGRATION.md)。

## 公网验收

- HTTPS `release.json` 的 commit 与运行源码一致。
- master 与数媒 HTTPS `/api/health` 均返回 `{"status":"ok"}`。
- 退役图片 URL 的抽查返回 HTTP 404；服务器逐项检查完整的 73 项删除清单。
- 在新建 Chromium 会话检查桌面首页、390×844 手机首页、手机成就页及手机序章。
- 首页的背景、光晕、标题雾层、原图交接和标题图均加载正常，首页与成就页无横向溢出。
- 成就页使用保留的黑白天台图；序章可见继续/跳过入口，当前画面加载正常。
- 浏览器页面错误列表为空。这些检查未调用真实模型，也不代表真机 Safari 验收。

验收截图：
[桌面首页](master_art_cleanup_2026-10-08/home-desktop.png)、
[手机首页](master_art_cleanup_2026-10-08/home-mobile.png)、
[手机成就页](master_art_cleanup_2026-10-08/achievements-mobile.png)、
[手机序章](master_art_cleanup_2026-10-08/opening-mobile.png)。

## 回退

旧前端完整保留在 `/opt/damo/releases/master-original-home-refine-20261001/frontend`。
新发布目录的回退脚本已通过 `bash -n`，运行时会先核对当前入口仍指向本次发布：

```bash
sudo bash /opt/damo/releases/master-art-cleanup-20261008-a0f1b1c5/rollback.sh
```

该脚本仅恢复 master 的前端链接，保留新旧发布目录。
