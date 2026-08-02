# 《天台十句》封面、PV 与关键 CG 统一候选

> 日期：2026-07-31  
> 生成方式：内置 `imagegen`，按项目要求使用 image2 路径  
> 状态：候选阶段记录；后续生产接入见 `unified_game_cg_manifest.md`  
> 原则：本文保留当时的候选评审过程；统一 CG 已在后续阶段接入游戏

## 一、交付范围

- 1 套封面主视觉：image2 无字母图 + 现有透明标题确定性合成。
- 3 张横屏 PV 候选：推门初见、克制倾听、小幅回身。
- 5 张横屏关键 CG：临界、同机位回身、消失、相识、失败结局空镜。
- 全部保留 image2 原始 PNG，并导出 1920×1080 WebP。
- 生成九宫格审阅图、规格与色彩偏离指标。

## 二、统一视觉母版

### 角色

- 艾为 20 岁出头的成年女性，清瘦但保持成年身体比例。
- 下颌长度的深色层次波波头，发尾可被风吹散，但不得变成长发。
- 窄而疲惫的眼睛、偏瘦下颌、克制冷淡的表情；不使用幼态大眼或甜美微笑。
- 黑色连帽内搭、灰黑宽松工作外套、黑色工装裤、深色高帮系带鞋。
- 旧相机固定挂在身侧；只有相识结局额外出现无品牌、黑屏手机。

### 天台

- 左侧/中部为长金属栏杆和密集城市，右侧固定为消防门、墙体、管线与单台空调外机。
- 地面为雨后湿润混凝土，保留受控月光与门灯反射。
- 月亮位于左上云层间；城市不出现真实地标、可读招牌或品牌。

### 风格与色彩

- 高细节 16-bit 日式像素叙事 CG，使用清晰像素簇、阶梯轮廓和克制抖动。
- 主色为黑、石墨灰、冷灰与灰白。
- 紫色只作为标题、头发内染或极少数反光像素；不使用紫蓝霓虹泛光。
- 危机场景只通过距离、空镜和姿态表达，不呈现坠落、身体、冲击、伤害或血迹。

## 三、资产清单

根目录：

`legacy_vue/public/assets/images/unified_image2_2026-07-31/`

| 类别 | 文件                                            | 用途                       |
| ---- | ----------------------------------------------- | -------------------------- |
| 封面 | `cover/cover_key_art_background_image2_raw.png` | image2 无字母图            |
| 封面 | `cover/cover_key_art_background_1920x1080.webp` | 标准规格无字版             |
| 封面 | `cover/cover_key_art_title_1920x1080.png`       | 精确标题审阅版             |
| 封面 | `cover/cover_key_art_title_1920x1080.webp`      | 精确标题交付版             |
| PV   | `pv/pv_01_opening_doorway_image2_raw.png`       | 推门初见原图               |
| PV   | `pv/pv_01_opening_doorway_1920x1080.webp`       | 推门初见交付版             |
| PV   | `pv/pv_02_guarded_listening_image2_raw.png`     | 克制倾听原图               |
| PV   | `pv/pv_02_guarded_listening_1920x1080.webp`     | 克制倾听交付版             |
| PV   | `pv/pv_03_turn_back_image2_raw.png`             | 小幅回身原图               |
| PV   | `pv/pv_03_turn_back_1920x1080.webp`             | 小幅回身交付版             |
| CG   | `cg/cg_01_pressure_edge_image2_raw.png`         | 临界状态原图               |
| CG   | `cg/cg_01_pressure_edge_1920x1080.webp`         | 临界状态交付版             |
| CG   | `cg/cg_02_turn_back_image2_raw.png`             | 同机位回身原图             |
| CG   | `cg/cg_02_turn_back_1920x1080.webp`             | 同机位回身交付版           |
| CG   | `cg/cg_03_end_disappear_image2_raw.png`         | 消失结局原图               |
| CG   | `cg/cg_03_end_disappear_1920x1080.webp`         | 消失结局交付版             |
| CG   | `cg/cg_04_end_acquaintance_image2_raw.png`      | 相识结局原图               |
| CG   | `cg/cg_04_end_acquaintance_1920x1080.webp`      | 相识结局交付版             |
| CG   | `cg/cg_05_end_failure_aftermath_image2_raw.png` | 失败结局空镜原图           |
| CG   | `cg/cg_05_end_failure_aftermath_1920x1080.webp` | 失败结局空镜交付版         |
| 审阅 | `review_contact_sheet.png`                      | 九宫格总览                 |
| 审阅 | `asset_metrics.json`                            | 分辨率、比例与色彩偏离指标 |

文档侧审阅副本：

- `docs/art_review_2026-07-31/contact_unified_image2.png`
- `docs/art_review_2026-07-31/unified_asset_metrics.json`

## 四、参考图角色分工

| 参考图                                                                    | 角色                                     |
| ------------------------------------------------------------------------- | ---------------------------------------- |
| `pv_cover_candidates/pv_cover_tiantai_shiju_title_image2_raw.png`         | 初始封面气质、灰阶像素密度与城市月光参考 |
| `review_candidates_2026-06-29/setting/ai_turnaround_sheet.png`            | 角色身份、成年比例、发型和服装锚点       |
| `review_candidates_2026-06-29/setting/ai_expression_sheet.png`            | 窄眼、瘦下颌与克制表情锚点               |
| `review_candidates_2026-06-29/setting/ai_action_pose_sheet.png`           | 回身、离场与背面姿态参考                 |
| `review_candidates_2026-06-29/setting/rooftop_environment_sheet.png`      | 消防门、栏杆、管线、空调和天际线锚点     |
| `unified_image2_2026-07-31/cover/cover_key_art_background_image2_raw.png` | 本轮后续资产的主风格与空间母版           |
| `unified_image2_2026-07-31/pv/pv_02_guarded_listening_image2_raw.png`     | 相识结局的近景脸型与相机锚点             |

## 五、最终 Prompt 组

实际生成采用下面的共享母版，加各资产的差异 Prompt。除封面标题外，所有图均要求无文字、无 UI、无 Logo、无水印。

### 共享母版

```text
Use case: stylized-concept
Asset type: exact 16:9 narrative-game key art / PV still / key CG
Scene: the same unnamed Chinese-city rooftop at 23:47; clouded moon; long metal railing;
fixed right-side fire door, wall pipes and one AC condenser; rain-wet concrete and controlled reflections.
Character: the same clearly adult woman in her early twenties; lean adult proportions;
jaw-length layered dark bob; narrow tired eyes; lean jaw; black hoodie under a charcoal oversized
work jacket; black cargo trousers; dark high-top lace-up boots; old compact camera.
Style: high-end 16-bit Japanese pixel narrative CG; crisp deliberate pixel clusters;
stepped contours; controlled dithering; cinematic but unmistakably pixel art.
Palette: near-monochrome charcoal, graphite, cold gray and off-white; only a trace of muted lavender,
under 3 percent of the image; no colorful neon.
Mood: cold, restrained, tense and humane; never romanticized.
Constraints: no childlike face, no large round eyes, no long hair, no sexualization, no glamour pose,
no readable signs, no extra people, no explicit self-harm action, no fall, injury or blood.
Avoid: smooth painterly rendering, photorealism, 3D, watercolor, lens flare, saturated purple/cyan/red.
```

### 封面无字母图

```text
Wide low eye-level cover composition. Place the same woman in a restrained three-quarter back view
on the right third, standing safely inside the railing, head slightly lowered, camera at her side.
Keep a broad clean upper-left/upper-center negative-space area for a separate title overlay.
The rooftop and city remain the main subject. No text of any kind.
```

封面中文标题没有交给模型重画。后处理使用
`legacy_vue/public/assets/images/menu_title.png`，以 900 px 宽放置在 1920×1080 画布的
`left=330, top=130`，确保“天台十句”笔画与现有品牌资产完全一致。

### PV 01：推门初见

```text
First-person establishing shot from the dark fire-stairwell through a half-open rooftop door.
The same woman appears small in the middle distance, three-quarter back, fully inside the railing.
Use the door frame as a dark foreground and lead the eye from the stairwell to the moonlit rooftop.
```

### PV 02：克制倾听

```text
Medium shot from mid-thigh upward on the right third. The same woman stands inside the railing,
shoulders drawn in against the cold, looking toward the unseen player but not directly into camera.
Her expression is guarded and tired, with only the faintest sign that she is listening.
Keep the old camera at her hip and leave modest caption space on the left.
```

### PV 03：小幅回身

```text
Wide eye-level shot. The same woman has moved one clear step inward from the railing and half-turns
toward the unseen player. One hand lowers away from the rail; her expression remains uncertain
and guarded. Read as a small return from danger, not a triumphant rescue.
```

### CG 01：临界

```text
Wide fixed camera. Show the same woman from three-quarter back, close to but fully inside the railing.
One hand rests lightly on the top rail; both feet remain visible on the rooftop floor.
Communicate pressure through posture, distance and silence only. No climbing or body beyond the rail.
```

### CG 02：同机位回身

此图以 `cg_01_pressure_edge_image2_raw.png` 为编辑目标，使用 `precise-object-edit`：

```text
Change only the woman’s pose. Move her exactly one small step inward, lower her hand completely away
from the railing, and rotate torso and head into a restrained half-turn toward the unseen player.
Preserve camera position, horizon, moon, clouds, skyline, railing, fire door, pipes, AC unit,
wet-floor reflections, palette, lighting and pixel density. Change only the minimal local shadow
and reflection required by the new pose.
```

### CG 03：消失

```text
The same woman walks alone toward the now-open fire door, seen from behind, camera at her hip.
The railing is empty behind her and the viewer remains on the rooftop. No looking back, no phone,
no farewell gesture and no dramatic glowing doorway.
```

### CG 04：相识

```text
After leaving the railing, the same woman stands near the fire-door side and offers one ordinary
unbranded smartphone with a completely dark blank screen. The player appears only as a small hand
and sleeve entering from the lower-left, not touching her. She remains tired and guarded, with no smile.
Read as consent to continue the conversation tomorrow, not romance or cure.
```

### CG 05：失败结局空镜

```text
The rooftop is completely empty of people. Place the same old compact camera and one extinguished
cigarette butt on the wet floor safely inside the railing. Keep the fire door closed.
Communicate interruption and absence only. No body, limbs, falling figure, impact, injury, blood,
memorial imagery or romantic moonlit tragedy.
```

## 六、复核结果

- 9 张交付图全部为 1920×1080、16:9。
- 除封面标题设计层外，所有图的强彩色像素比例均为 0。
- 封面强彩色像素比例为 0.62%，来源为项目既有紫色标题，不是场景色偏。
- 消防门、墙体、栏杆、管线、空调外机、月亮与城市密度在系列中保持稳定。
- 发型、外套、连帽内搭、工装裤、高帮鞋和旧相机在人物镜头中保持统一。
- 临界与回身使用同一镜位；背景微观像素仍可能存在生成式细节差异，但连续切换不再出现旧资源的空间跳变。
- 临界/回身左侧 900×940 无人物区域的平均通道绝对差为 `3.21 / 255`，说明编辑过程较好地保留了固定背景。
- 相识结局明确表达交换联系方式，人物不微笑、不触碰玩家、不恋爱化。
- 失败结局只使用空天台、相机与熄灭烟头，不直接展示坠落、身体或伤害。

## 七、后处理复现

从 `legacy_vue/` 运行：

```powershell
node scripts/build_unified_image2_candidates.mjs
```

脚本只读取本轮原始 PNG 与现有 `menu_title.png`，重新生成 1920×1080 WebP、精确标题封面、
九宫格审阅图和色彩指标。
