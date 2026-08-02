# 《天台十句》image2 游戏 CG 统一交付

> 日期：2026-07-31  
> 生成方式：内置 `imagegen`，按项目约束使用 image2  
> 状态：生产资产已导出，`gameContract.ts` 已切换到统一资源  
> 资产根目录：`legacy_vue/public/assets/images/unified_image2_2026-07-31/game_cg/`

## 交付范围

| 组别         | 数量 | 生产规格               | 路径                                                        |
| ------------ | ---: | ---------------------- | ----------------------------------------------------------- |
| 开场序列     |    5 | 1920×1080 WebP         | `opening/opening_01_1920.webp` 至 `opening_05_1920.webp`    |
| 游戏状态     |    5 | 1600×900、900×506 WebP | `state/state_*_1600.webp`、`state/state_*_900.webp`         |
| 情绪状态     |    4 | 1600×900、900×506 WebP | `emotion/emotion_*_1600.webp`、`emotion/emotion_*_900.webp` |
| 失败结局序列 |    5 | 1600×900、900×506 WebP | `ending/death_01_*` 至 `death_05_*`                         |
| 其他结局     |    2 | 1600×900、900×506 WebP | `ending/end_disappear_*`、`end_acquaintance_*`              |
| 对话头像     |    1 | 480×480 WebP           | `state/avatar_guarded_480.webp`                             |

共 38 个生产文件：5 个开场文件、16 个桌面文件、16 个移动端文件和 1 个头像。
所有 image2 原始 PNG 保留在各组目录中，没有删除生成目录中的原始输出。

## 统一视觉母版

- 同一位成年女性：下颌长度深色短发、窄而疲惫的眼睛、灰黑工作外套、黑色连帽内搭、深色工装裤和高帮鞋，旧相机固定为身份道具。
- 同一天台：长金属安全栏杆、右侧消防门与管线、单台空调外机、密集但无真实地标的城市、雨后湿地面。
- 同一色彩：近黑、石墨灰、冷灰与灰白；只保留极少量城市暖灯，不使用彩色霓虹。
- 同一镜头语言：16:9、克制的半写实像素绘制、低饱和、雨夜反射；不使用文字、Logo、UI 或字幕。
- 危机场景只通过安全栏杆内的人物姿态、遗留物和空镜表达，不呈现坠落、伤害、血迹或具体行为方法。

## 最终 Prompt 组

以下为本轮实际采用的共享母版与逐帧差异指令。编辑任务均把第一张参考图作为构图目标，其他参考图只用于角色、服装、相机和天台身份锚定。

### 共享母版

```text
Serious contemporary Chinese narrative game, exact cinematic 16:9 composition.
The same adult Chinese woman: short jaw-length dark hair, narrow tired eyes,
charcoal work jacket over a black hoodie, dark cargo trousers, high-top boots,
and the same old compact camera. The same rainy rooftop at night: long metal
safety railing, dense anonymous city, right-side fire door, pipes and one AC unit.
Restrained semi-realistic painterly pixel-noir rendering, near-monochrome blue-gray,
controlled wet-floor reflections, tiny dim amber city lights, grounded and humane.
No text, logo, UI, subtitles, extra people, childlike features, glamour pose,
sexualization, blood, injury, falling, exposed body, or explicit self-harm method.
```

### 基础状态与情绪

| 资产                   | 差异 Prompt                                                                                              |
| ---------------------- | -------------------------------------------------------------------------------------------------------- |
| `state_guarded_normal` | 人物坐在安全栏杆内侧的湿地面，位于右侧三分之一；膝盖收起、手臂自然搭放、目光克制，旧相机在身侧；不微笑。 |
| `state_smoke`          | 保留基础状态的镜位、背景和身体比例；只抬起一只手持烟，加入一缕很小且受控的烟，不遮脸。                   |
| `state_wavering`       | 保留基础状态；目光下垂、肩膀轻微内收、手指略放松；不流泪，不夸张崩溃。                                   |
| `emotion_sting`        | 保留基础状态；目光移开、下颌和嘴角收紧，表现被刺痛后的防御。                                             |
| `emotion_surprise`     | 保留基础状态；眼睛只略微睁大、头部轻抬，表现克制意外；禁止圆眼和夸张张嘴。                               |
| `emotion_soft`         | 保留基础状态；肩膀轻微放松、手掌打开、目光变柔和；不微笑，不浪漫化。                                     |
| `emotion_curiosity`    | 保留基础状态；头部与视线小幅转向玩家，表现谨慎兴趣；不微笑。                                             |
| `state_turn_back`      | 使用统一候选 `cg_02_turn_back`：人物离开栏杆一步并小幅回身。                                             |
| `state_edge`           | 使用统一候选 `cg_01_pressure_edge`：人物完全位于栏杆内，双脚留在天台地面，只以距离和姿态表达压力。       |

### 开场五帧

```text
01 — First-person view in a dark wet stairwell. Preserve the metal rooftop door,
handrail and pipes. Door closed, only a narrow cold light leak, no person visible.

02 — Preserve frame 01 camera and architecture. Open the door partly into a narrow
wedge of moonlight. Far beyond it, show the same woman very small, seated safely on
the rooftop floor at the inner base of the railing, viewed from behind.

03 — Wide rooftop entry view. The same woman remains small and seated at the inner
base of the railing; fixed right-side door block and AC unit; no turn toward camera.

04 — Advance the first-person camera several cautious steps into a medium-wide view.
Preserve the same rooftop continuity. The woman remains seated, back or three-quarter
back, and has not turned around yet.

05 — Reuse the canonical guarded seated master as the first-words frame so the
cinematic resolves directly into the gameplay composition without an identity jump.
```

### 失败结局五帧

```text
01 — Tight symbolic crop safely inside the railing: the same charcoal jacket sleeve
and relaxed hand lower the old compact camera by its strap toward the wet floor.
The extinguished cigarette is already on the floor; face and body stay outside crop.

02 — Low floor-level close-up: the compact camera has come to rest on wet tiles,
strap loosely coiled, extinguished cigarette beside it. Only a small jacket hem and
one boot may leave the far edge of frame; show no direction or dangerous action.

03 — Low medium-wide empty rooftop. Camera and cigarette remain in the foreground;
empty railing and city recede behind; rooftop door slightly ajar with weak cold light.

04 — Extreme-wide empty-rooftop aftermath, pulled back near the entrance. Camera and
cigarette are tiny on the wet floor; fine mist, reflections fading toward black.

05 — Reuse the unified empty-rooftop aftermath master. Keep only the compact camera
and extinguished cigarette safely inside the railing; no person or body visible.
```

### 其他结局

- `end_disappear`：人物背向玩家走向消防门，栏杆后方为空；无回头、无告别手势。
- `end_acquaintance`：人物在远离栏杆的位置递出无品牌黑屏手机，玩家只露出一只手；不接触、不微笑、不恋爱化。

## 接入映射

`legacy_vue/src/domain/gameContract.ts` 已统一切换：

- `OPENING_SEQUENCE_FRAMES` → `game_cg/opening/`
- `SCENE_BACKGROUNDS` / `SCENE_MOBILE_BACKGROUNDS` → `game_cg/state/`
- `EMOTIONS` → `game_cg/emotion/`
- `DEATH_ENDING_SEQUENCE_FRAMES` / `ENDINGS` → `game_cg/ending/`
- `CHAT_AVATAR_IMAGE` → `game_cg/state/avatar_guarded_480.webp`

## 审阅与复现

- 游戏状态与情绪总览：`docs/art_review_2026-07-31/contact_unified_gameplay_cg.png`
- 开场与结局总览：`docs/art_review_2026-07-31/contact_unified_cinematics.png`
- 尺寸与色彩指标：`legacy_vue/public/assets/images/unified_image2_2026-07-31/game_cg/asset_metrics.json`

从 `legacy_vue/` 运行：

```powershell
node scripts/build_unified_image2_candidates.mjs
```

脚本会从保留的 image2 原始 PNG 重建候选集、游戏生产集、头像、接触表和指标文件。
