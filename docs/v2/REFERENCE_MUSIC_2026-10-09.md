# 四首参考曲的本地配乐试听

用户提供 `rooftop_reference_tracks_part1.zip` 与 `rooftop_reference_tracks_part2.zip`。本轮将其中四首 Chance Thrash 曲目接入独立的本地试听环境，用实际游戏画面、对白和雨声作对照。原有配乐仍可随时切回；没有改变普通启动方式或上线版本。

包内 brief 的场景安排属于参考建议，不是用户额外授权或游戏已有事实。因此不把 Home 当成获得安全结局的奖励，也不按句数、好感或推测的情绪强制切换歌曲；试听曲由玩家手动选择。

## 使用

启动原有本地 v2 API（8082），然后在仓库根目录运行：

```sh
node v2/scripts/dev-audio-audition.mjs
```

打开 `http://127.0.0.1:5178`，在「声音与显示」中选择「本地配乐试听」。默认预选 Late Night Earl Grey；只有主动开启声音才加载并播放 MP3。可以切到另外三首或原创配乐，同时独立调节音乐与雨声。选曲跨剧情回合保持，刷新回到默认试听曲，但不自动播放。

此入口是开发专用，本地文件缺失或哈希不符会拒绝启动。原始 MP3 在忽略目录 `v2/.run/reference-music/originals/`，普通 `npm run dev` 和生产构建没有这些文件或试听入口。发布脚本也只打包正常 `web/dist` 与后端，不打包 `.run` 音频。

## 文件与响度

两份包中所有 MP3 的字节长度与 SHA-256 均匹配随包清单；三份重复说明文件也一致。原文件保持原始 MP3 320 kbps / 44.1 kHz 双声道，没有转码、裁剪或覆盖。完整曲目循环播放，没有声称已经制作无缝音乐循环。

| 曲目 | 时长 | 输入综合响度 | 原始真峰值 | 播放匹配增益 |
| --- | --- | --- | --- | --- |
| Chamomile Tea | 2:20 | −17.23 LUFS | −2.47 dBTP | 0.514636 |
| Home | 2:43 | −17.01 LUFS | −4.02 dBTP | 0.501765 |
| Late Night Earl Grey | 2:43 | −23.54 LUFS | −8.36 dBTP | 1.000000 |
| Peppermint Tea | 2:41 | −12.62 LUFS | +0.01 dBTP | 0.302691 |

以上来自对原文件的完整 ffmpeg 解码与 loudnorm 测量。运行时先把较响曲目降低到约 −23 LUFS，再经过玩家音乐音量与总线；Earl Grey 不作增益放大。音量匹配避免切歌时突增，不修改原始录音。候选曲可播放后才淡入，原创音色与文件配乐在稳定状态下不叠放；文件曲绕过合成乐器专用低通与反射，雨声保持独立。

这份记录证明导入、测量和播放行为，不冒称已完成主观耳机听评或最终配乐评选。默认曲是比较起点，四首可在同一场景下直接 A/B 试听。

## 来源与署名

2026-10-09 另行核对了艺术家的官方曲目页与实际许可证链接，而非仅接受压缩包中的许可陈述。

| 曲目与官方来源 | 页面显示的许可 |
| --- | --- |
| [Chamomile Tea](https://chancethrash.bandcamp.com/track/chamomile-tea) | all rights reserved |
| [Home](https://chancethrash.bandcamp.com/track/home) | all rights reserved |
| [Peppermint Tea](https://chancethrash.bandcamp.com/track/peppermint-tea) | all rights reserved |
| [Late Night Earl Grey](https://chancethrash.bandcamp.com/track/late-night-earl-grey) | some rights reserved，指向 [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |

前三首来自 [Tea Time](https://chancethrash.bandcamp.com/album/tea-time)；Late Night Earl Grey 为另一首单曲。试听界面保留作者与官方来源链接，并为 CC BY 4.0 曲目链接许可证。记录没有验证另行授权合同或本地字节与官方页面录音的一一对应，仅验证了文件与用户所给清单一致。

本地播放处理说明：原始录音未改动；播放时可与原创合成雨声混合，进行音量控制、切曲淡化及整曲循环。若未来另行公开采用 Late Night Earl Grey，应依据 [CC BY 4.0 正文](https://creativecommons.org/licenses/by/4.0/legalcode.en)落实署名、来源/许可链接和实际处理说明，不暗示作者背书。本轮四首都不随仓库音频或可分发构建发布。

## 实现边界

- 专属 Vite 进程只绑定 127.0.0.1:5178，按固定 ID 提供四个文件，支持 GET/HEAD/单段 Range；不接受任意路径，也不公开原文件目录。
- 清单不含本机绝对路径。私有音频响应使用 no-store、same-origin 资源策略，并拒绝外部 Host/Origin。
- 试听组件与媒体能力同时受 DEV 和本地试听标志控制。曲目不写入 localStorage；生产页面不会发出试听清单或音频请求。
- 页面隐藏、手动关闭与恢复均控制媒体本体，防止看不见的标签页继续走曲。加载失败、播放拒绝或解码失败回退原创，雨声不中断。

原包说明、原始哈希清单和测量 JSON 留在 `v2/.run/reference-music/`，便于本地复核。

## 本轮验收

前端 54 项单元测试、ESLint、Prettier、类型检查和构建通过；正常生产预览的完整浏览器回归 11/11 通过（46.1 秒）。本地试听的实际 Chromium 验证了四首播放与切换、快速连续选择只保留最新曲、断网失败回原创和重试、后台暂停与原位置恢复、音乐归零但保留雨声、双轨归零。

默认预选状态下实际观测为 0 AudioContext、0 AudioElement、0 MP3 请求。主动开启后只有一个 AudioContext，文件曲确实绕过合成乐器低通和混响。桌面 1440 × 1000 与移动视口 375 × 812 的设置面板没有横向溢出；[桌面截图](review/2026-10-09/music-audition-desktop.png)、[手机截图](review/2026-10-09/music-audition-mobile.png)可复核。

独立检查还验证了四份完整 HTTP 响应的 SHA-256、HEAD 与合法/非法 Range、未知文件和遍历拒绝、外部 Host/Origin 拒绝；普通 Vite 和生产预览不能读取私有 MP3。最终 dist 与公开资源中没有四首录音、曲目清单、艺术家信息或本地试听 URL，四份原文件都被 Git 忽略。
