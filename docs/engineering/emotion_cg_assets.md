# 黑白灰情绪 CG 资源表

本表记录 4 种情绪波动标签对应的 CG 文件与生成提示词。情绪 CG 仅用于视觉反馈，不参与好感、回合或结局计分。

参考图锁定为 `legacy_vue/public/assets/images/char_girl_normal.png`。`char_girl_smoke.png` 仅用于香烟和烟雾动作参考，`char_girl_sad.png` 仅用于压抑表情参考。原 `char_girl_smile.png` 已重命名为 `char_girl_sneer.png`，其语义是冷笑/防御性讥讽，不作为“柔软”参考。

当前已入库并接入前端的是横屏资源 `cg_emotion_*_16_9.webp`。竖屏资源如需移动端专项构图，再按同一约束单独生成。

统一基础要求：

> 参考 `legacy_vue/public/assets/images/char_girl_normal.png` 的同一名女孩，人物五官、发型层次、黑色外套、比例和气质必须与参考图一致；可保留香烟作为情绪道具，场景为深夜天台栏杆旁，黑白灰三色像素风叙事游戏 CG，16-bit 日式像素艺术，高对比明暗，雨夜天台，无彩色，无霓虹彩光，无相机，无文字，无 UI。

| 文件名 | 用途 | 中文提示词 |
| --- | --- | --- |
| `cg_emotion_sting_16_9.webp` | 刺痛横屏 | 参考 `char_girl_normal.png` 与 `char_girl_sad.png`，同一名女孩，同样黑色外套和发型轮廓，黑白灰三色像素风，深夜天台，听到玩家一句话后被刺痛，眼神躲开，肩膀绷紧，可保留手边香烟，烟灰将落未落，高对比阴影，无彩色，无相机，无文字，无 UI |
| `cg_emotion_surprise_16_9.webp` | 惊讶横屏 | 参考 `char_girl_normal.png` 与 `char_girl_smoke.png`，同一名女孩，同样黑色外套和发型轮廓，黑白灰三色像素风，深夜天台，听到意外准确的话后微微回头，眼睛睁大，烟雾停在嘴边，强烈黑白明暗，无彩色，无相机，无文字，无 UI |
| `cg_emotion_soft_16_9.webp` | 柔软横屏 | 参考 `char_girl_normal.png` 与 `char_girl_smoke.png`，不参考 `char_girl_sneer.png`；同一名女孩，同样黑色外套和发型轮廓，黑白灰三色像素风，深夜天台，防备短暂松动，把烟拿远一点，肩膀放松，表情疲惫但变软，没有冷笑或讥讽感，无彩色，无相机，无文字，无 UI |
| `cg_emotion_curiosity_16_9.webp` | 好奇横屏 | 参考 `char_girl_normal.png` 与 `char_girl_smoke.png`，同一名女孩，同样黑色外套和发型轮廓，黑白灰三色像素风，深夜天台，被玩家的问题勾起好奇，微微歪头，眼神仍冷淡但开始专注，可保留香烟，无彩色，无相机，无文字，无 UI |

## 场面压力 CG

压力 CG 对应持续人物状态 `[状态:临界]` 和 `[状态:回身]`。当前接入规则：非结局状态下，`[状态:临界]` 或剩余句数进入强压力区时显示 `cg_pressure_near_jump_16_9.webp`；如果模型明确输出 `[状态:回身]`，显示 `cg_pressure_turn_back_16_9.webp`，表示艾已经把栏杆外的脚收回栏杆内。两者优先级都高于情绪 CG，低于结局 CG。

| 文件名 | 用途 | 中文提示词 |
| --- | --- | --- |
| `cg_pressure_near_jump_16_9.webp` | 临界跳下前横屏 | 参考 `char_girl_normal.png`，保持同一天台背景、城市、栏杆、摄像机视角和黑白灰像素风，只让艾转身面向楼外、背对镜头，站在或坐在栏杆临界位置，身体重心朝外，呈现快跳了但尚未坠落的危险状态，无血腥、无坠落、无彩色、无相机、无文字、无 UI |
| `cg_pressure_turn_back_16_9.webp` | 从临界退回横屏 | 参考 `cg_pressure_near_jump_16_9.webp` 和 `char_girl_normal.png`，保持同一天台背景、城市、栏杆、摄像机视角和黑白灰像素风；艾已经把栏杆外那只脚收回栏杆内，双脚都在天台内，身体从楼外半转回天台，一只手仍扶着栏杆，肩膀紧绷，表示危险被暂时打断但还没有安全，无血腥、无坠落、无彩色、无相机、无文字、无 UI |

## 人物状态 CG 状态机

状态标签是持续基线，情绪标签是单轮反馈。`GameView` 通过 `resolveVisualState()` 统一选择 CG，避免组件内分散判断。

| 状态标签 | 状态类型 | 基础 CG | 切换语义 |
| --- | --- | --- | --- |
| `[状态:戒备]` | `guarded` | `char_girl_smoke.png` | 初始/回退状态，艾抽烟、防备、保持距离 |
| `[状态:观察]` | `watching` | `char_girl_normal.png` | 艾开始观察玩家，愿意接住一句话 |
| `[状态:动摇]` | `wavering` | `char_girl_sad.png` | 艾被具体看见，防线松动但仍处在危险中 |
| `[状态:回身]` | `turnBack` | `cg_pressure_turn_back_16_9.webp` | 艾把栏杆外的脚收回栏杆内，从楼外半转回天台；这是从临界退回的必要中间态 |
| `[状态:临界]` | `edge` | `cg_pressure_near_jump_16_9.webp` | 艾转向楼外或靠近边缘，进入强危险姿态 |

CG 优先级：结局 CG > 临界/回身状态 CG > 情绪 CG > 人物状态基础 CG。情绪 CG 在下一轮没有新情绪标签时会回到状态基线；但临界和回身状态会压过情绪 CG，直到模型输出新的持续状态。
