# 首次加载体验优化（2026-10-01）

master 和 shumei 分别应用性能改动，保留各自剧情、结局、存档契约及音效。后端和模型配置不属于本次性能修改。

## 用户可见行为

- 首页立即尝试播放 BGM，使用原 MP3/OGG 的原生流式播放；不再等待整首下载并解码。浏览器拒绝自动播放时显示“开启声音”，首次页面交互也可恢复；声音按钮自身不会触发两次相反操作。
- 音乐跨路由连续播放，进入游戏不重播、不叠加；静音、零音量、重试及异步播放竞态均有覆盖。
- 未使用的音效按需加载。BGM 元素先设置 `preload=none` 再设置源，调用 `play()` 才开始缓冲；自动播放被拦截时不抢下载带宽。
- 首页美术提前请求；标题图片下载时显示同名文字占位，菜单始终可点击，首页不做淡入。
- 原像素字体分成界面字集和其余字集，通过互不重叠的 `unicode-range` 按需请求，保持原字体全部 cmap 字符覆盖；保留系统字体回退和 `font-display: swap`。
- 进入序章只加载当前与下一张图片；未解码时继续显示当前画面，重复点击不跳帧，失败/6 秒超时继续文字流程，跳过始终有效。移除隐藏游戏背景及全部结局 CG 的入场预加载。
- 手机为声音按钮保留顶部空间；原有移动端背景图、画风和滚动方式保留。

## 字体与复现

shumei 界面字体 24,464 bytes，其余字体 331,920 bytes；master 分别为 26,032、331,120 bytes。原 TTF 为 2,446,828 bytes。生成脚本校验两个产物字符无重叠且合并后覆盖原字符集合，保留原字体署名/许可元数据。

普通前端构建直接使用已提交的 WOFF2，不需要 Python。修改静态文案后，在各版本的 `legacy_vue` 目录运行：

```text
python -m pip install fonttools brotli
python scripts/generate_fonts.py
```

## 测试和线上体验

按 TDD 逐项记录失败再实现：即时音乐/不下载音效、自动播放解锁、导航不重播、异步静音竞态、零音量、格式备用、声音按钮触摸事件、字体预算、序章按需加载/慢图/跳过/失败，以及首页标题占位。

- shumei：15 个测试文件、111 项测试通过；master：14 个文件、107 项通过。两侧 lint 和生产构建通过。
- 样本环境：Chrome 冷缓存、前台页面、1.6 Mbps 下载、150 ms 延迟、CPU 4 倍降速；真实线上 HTTPS。
- 桌面原版 LCP 6,104 ms，优化后最终样本 2,940 ms（约下降 52%）；原版字体在采样期间仍下载中，优化后首页仅请求 24 KB 界面字体。
- 最终桌面首页前 15 秒传输约 478 KB，移动端约 396 KB，均处于自动播放被浏览器拦截状态；主动播放后的音乐取流不计入这一静置首页预算。
- 受限移动端样本 LCP 4,964 ms，页面无横向溢出；按钮可用。不是所有网络下的时间保证，也未替代真机 Safari/微信浏览器验收。
- 实际点击“开启声音”后音频 readyState 达到 4、paused=false、currentTime 持续递增；进入序章后同一个音频继续播放。浏览器无错误，序章能继续/跳过。自动播放允许的行为有边界测试；本轮普通浏览器实际拦截，不能承诺首次访问无需交互必然出声。

可在一个全新的专用 agent-browser 会话采样（脚本会清空目标站点缓存/存储，不用于个人已登录会话）：

```powershell
agent-browser --session load-audit open about:blank
$taskCdp = agent-browser --session load-audit get cdp-url
node scripts/measure_first_load.mjs $taskCdp https://tiantaishiju.top/ ../../tmp/load-audit.json
# 最后增加 true 参数即为移动端采样。
agent-browser --session load-audit close
```

脚本输出 JSON 和首帧/最终 PNG；前台渲染时间有波动，应比较相同条件的多次样本，避免拿本机 Vite 预览与公网混比。

## shumei 发布与回退

线上前端入口 `/var/www/damo` 当前链接至 `/opt/damo/releases/shumei-20261001-first-load/frontend`。后端仍运行原 API 更新发布目录，默认 `deepseek-flash`；健康检查通过。
原前端完整保留于 `/opt/damo/releases/shumei-20261001/frontend`。回退只需在服务器执行：

```bash
sudo ln -s /opt/damo/releases/shumei-20261001/frontend /var/www/damo-first-load-rollback
sudo mv -Tf /var/www/damo-first-load-rollback /var/www/damo
```

新发布保留旧 hash 资源，减少已打开标签页的资源 404。PWA 自动更新；已有页面可能需刷新一次才运行新代码。master 只推送源码，不替换线上 shumei。
