# 原图画质交接与像素背景候选（2026-10-01）

## 发布边界

只修改 master 测试站；原首页构图和默认背景不替换。新生成背景通过 `/?homeArt=pixel-candidate` 单独预览，未作为默认首页。shumei、后端、Prompt、剧情文字、存档和结局规则保持原样。

## 最终画质

此前质量 82 的显示版和 900px 手机图只作为快速显示层，不再作为最终质量上限。

- CG 完成快速图后，加载其对应的既有原始 1600/1920px WebP；解码完成才交接，随后隐藏显示层，避免两张图片混合导致细节发软。
- 原图直接使用原文件，不做二次压缩或缩放导出；原图失败保留已显示画面，场景改变时隔离上一张的异步完成事件。
- 隐藏的下一帧不主动加载原图；当前原图就绪后再串行准备下一张。首页仅准备入口与常用场景的原图，后台队列一次一张并去重。
- 手机也可补齐到同一原图，保留原图颗粒；省流量模式不自动请求原图，提供“加载原画”入口。
- 默认首页保持已有内容，但在快速背景后补到 `menu_home_bg_source.png` 的无损 WebP 导出；导出与 PNG 的解码像素逐字节相同。
- 自适应编码不能让大原图在首次慢网中零时间下载；本方案保证先有画面且可操作，再逐步提高质量，并利用后续缓存。若需要远超素材原尺寸的清晰度，需要更高分辨率原画，不能靠锐化伪造细节。

## 验证

- 116 项前端测试、lint/build 通过，覆盖原图路径映射、快速图到原图、错误回退、隐藏帧、显式省流量加载，以及原图预热队列串行/去重。
- 浏览器确认 `data-original-ready=true`，序章最终地址为原始 `opening/opening_01_1920.webp`。默认首页最终地址为已有源图的无损导出；候选最终地址为新 PNG 的无损导出。
- 同一 HTTPS 站点，冷缓存、下载 1.6 Mbps、150ms 延迟、CPU 4 倍降速，首次直接进入序章样本：预览 1,731ms、快速图 2,867ms、原图 9,256ms，无浏览器错误。原图冷下载时间仍存在；不是所有网络下的时间保证。
- AVIF 编码试验：首张原 CG 的无损 AVIF 约 2,119KB，原 WebP 约 1,197KB，解码像素相同；因此未采用更大的 AVIF。

## 背景候选与出处

使用内置 `image_gen`，请求 Image 2.5，未使用 CLI/API fallback。参考图分别为仓库已有 `menu_home_bg_source.png` 和 `game_cg/state/state_guarded_1600.webp`；没有使用之前被否决的彩色背景。

候选源图保存于 `legacy_vue/public/assets/images/home_pixel_20261001/background-source.png`；运行导出在同目录，生成脚本 `scripts/build_pixel_home_candidate.mjs`。
候选显示图约 183KB，预览约 16KB，无损原图约 1,466KB。PNG 与原图 WebP 解码像素完全相同。桌面保持左侧人物、右侧菜单；手机版在候选预览中将菜单放到人物右侧，避免覆盖脸部。默认首页不采用这一布局变化。

### 最终生成 Prompt（原文）

```text
Model requested: Image 2.5. Asset type: one new main-menu background for the established MONOCHROME PIXEL-ART game 天台十句. Generate a single wide 16:9 canvas. The two attached references define an existing art system and must be matched very closely. Reference 1 defines left-character/right-menu composition and fine rooftop environment grain. Reference 2 is the AUTHORITATIVE character identity, jacket, camera, anatomy, grayscale values, pixel cluster scale and material texture. This is actual finely detailed PIXEL ART, NOT a smooth anime painting, NOT a painted illustration given a grain filter. STRICTLY BLACK / WHITE / NEUTRAL GRAYS ONLY, no violet, blue, amber or colored lighting anywhere. All shading is constructed with discrete gray pixel clusters and sparse, irregular one-pixel stippling. Match the references' small 1–3 pixel contour steps and 2–5 pixel texture clusters at a roughly 1600–1920px-wide canvas; NOT big blocky 8-bit squares and NOT a rigid mosaic grid. Character boundaries, jacket fold edges, railing edges and tiny window patterns stay crisp without antialiased soft brushes. Use 12–20 restrained neutral gray values with most of the canvas in dark values, clearly separated midtones on the woman, and sparse near-white highlights. Preserve the adult woman in her early 20s from reference 2: short irregular dark bob, tired serious eyes, oversized dark hooded jacket, dark trousers, worn lace-up shoes, old rectangular camera. Character must read as the SAME person, no glamour, no huge cute eyes, no redesigned costume. Recompose her to the LEFT 20–35 percent, sitting safely on a low INNER-rooftop concrete step with BOTH feet clearly on the rooftop floor, behind a full-height metal railing. Do not copy reference 1's dangerous ledge pose. The floor must continue under her feet; no feet dangling beyond the building. Her slightly lowered gaze and restrained posture should feel human and weary, not posed romantically. Rooftop after rain, ordinary unnamed Chinese city with a few tiny window lights, weathered metal, shallow wet reflections, utility wall / stairwell at the far-left border. A partly clouded moon provides modest grayscale edge lighting, not a brilliant halo. Camera sits beside her. The setting should have stronger spatial clarity than reference 1: organize the railing and roof perspective cleanly, do not pile multiple images on top of each other. Keep RIGHT 55 percent quiet and low-detail, especially x=58–92 percent and y=10–58 percent, for a live title and vertical menu; dark sky and controlled distant city forms, not a giant blank flat rectangle. Fine pixel texture continues through the negative space without high-contrast specks. Keep a clear hierarchy: woman first, quiet rooftop depth second, distant lights third. Avoid excessive smoke, weather streaks, glitter, flower petals or busy overlays. No text, NO title, no UI, no buttons, no lettering, no borders, no watermarks. No blur, no bokeh, no airbrushed gradients, no photorealism, no color, no sexualization, no injuries, no falling, no glamorization of danger. One polished cohesive MONOCHROME PIXEL-ART environment, matching both supplied resources in grain and pixel granularity.
```

## 回退

前端发布到 `/opt/damo/releases/master-original-quality-20261001/frontend`，旧版 `/opt/damo/releases/master-cg-entry-20261001/frontend` 保留，恢复 `/var/www/damo-master` 链接即可回退。新生成候选通过查询参数单独启用；移除参数就回到原首页。
