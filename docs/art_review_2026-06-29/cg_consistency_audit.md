# 《天台十句》CG 与美术一致性审查

> 审查日期：2026-06-29  
> 状态：首轮现有资源审查完成；候选图生成与复审完成  
> 原则：本轮不替换任何现有游戏资源。所有新图只进入 `review_candidates_2026-06-29/`。

## 一、统一基准

### 人物基准

- 成年女性，20 岁出头。
- 短层次深色波波头，长度在下颌附近，风吹时发尾分束但不能变成长发。
- 窄而疲惫的眼睛、偏瘦下颌、克制冷淡的表情。
- 黑色连帽内搭、灰黑宽松外套、黑色工装裤、深色高帮系带鞋。
- 身材清瘦但为成年人比例，不得幼态化、偶像化或性感化。

### 风格基准

- 黑、白、灰三色为主体；不使用彩色霓虹、紫蓝泛光或红色强调。
- 16-bit 日式像素叙事 CG，轮廓使用清晰像素簇，不使用平滑厚涂或写实摄影质感。
- 高对比月光、雨夜、湿地反光，但亮部面积受控。
- 天台固定元素：金属栏杆、右侧墙体/管线/空调外机、密集城市、云层与月亮、少量散落罐体。
- 无文字、无 UI、无 Logo、无水印或星形生成标记。

### 评分

- **通过**：可直接作为同一美术体系使用。
- **轻微偏差**：整体可用，但存在单项漂移，建议后续统一。
- **不一致**：风格、人物或用途明显不符，应生成候选替代。

## 二、逐图审查

| 资源 | 风格 | 人物 | 结论 | 发现 |
| --- | --- | --- | --- | --- |
| `char_girl_smoke.png` | 通过 | 通过 | 通过 | 新版灰阶、脸型、服装、吸烟动作与环境已统一；烟雾受控。 |
| `char_girl_normal.png` | 通过 | 通过 | 轻微偏差 | 仍含明显烟雾和右下星形标记，“观察/普通”状态与吸烟状态区分不足。 |
| `char_girl_sad.png` | 通过 | 不一致 | 不一致 | SHA-256 与 `char_girl_normal.png` 完全相同，不是独立的低落状态。 |
| `char_girl_sneer.png` | 通过 | 通过 | 轻微偏差 | 冷笑语义清楚，但仍含右下星形标记。 |
| `cg_opening_stair_01_16_9.webp` | 通过 | 不适用 | 通过 | 楼梯间、门缝月光、灰阶像素质感稳定。 |
| `cg_opening_stair_02_16_9.webp` | 通过 | 轻微偏差 | 轻微偏差 | 远景人物只能验证轮廓；此帧站立，后续坐/站切换缺少动作承接。 |
| `cg_opening_stair_03_16_9.webp` | 通过 | 轻微偏差 | 通过 | 第一视角、湿地、栏杆和远景人物与系列一致，人物过小但属于镜头需要。 |
| `cg_opening_stair_04_16_9.webp` | 通过 | 通过 | 轻微偏差 | 背面服装与发型成立；与前后帧的站立/坐下连续性不足。 |
| `cg_opening_stair_05_16_9.webp` | 通过 | 轻微偏差 | 轻微偏差 | 构图和服装接近基准，但脸型比主状态图更幼、更圆；与上一帧姿态缺少过渡。 |
| `cg_emotion_sting_16_9.webp` | 通过 | 通过 | 通过 | 疲惫眼神、肩颈收紧和回避方向基本表达刺痛。 |
| `cg_emotion_surprise_16_9.webp` | 通过 | 不一致 | 不一致 | 眼睛显著变圆、脸型变幼，人物身份漂移；惊讶接近可爱化。 |
| `cg_emotion_soft_16_9.webp` | 通过 | 不一致 | 不一致 | 出现明确温柔微笑，偏离“疲惫但短暂松动”；脸型与眼睛也漂移。 |
| `cg_emotion_curiosity_16_9.webp` | 通过 | 不一致 | 不一致 | 微笑和正面友好凝视过强，缺少冷淡防备；人物脸型漂移。 |
| `cg_pressure_near_jump_16_9.webp` | 通过 | 通过 | 通过 | 背面发型、外套与环境一致，危险姿态可读。 |
| `cg_pressure_turn_back_16_9.webp` | 通过 | 轻微偏差 | 轻微偏差 | 动作语义正确，但镜位、城市密度和人物比例与临界图变化较大，连续切换会跳。 |
| `cg_acquaintance_16_9.webp` | 通过 | 轻微偏差 | 轻微偏差 | 灰阶和环境一致；人物站姿合理，但交换联系方式的结局语义不够明确，脸部比例略漂。 |
| `cg_acquaintance_9_16.webp` | 不一致 | 不适用 | 不一致 | 彩色圆点抽象占位，无人物、无天台，与横屏资源完全无关。 |
| `cg_death_falling_16_9.webp` | 不一致 | 不一致 | 不一致 | 紫红抽象图形占位，不是像素叙事 CG，也无法验证人物。 |
| `cg_death_falling_9_16.webp` | 不一致 | 不一致 | 不一致 | 与横屏旧坠落图相同问题。 |
| `cg_end_disappear.png` | 轻微偏差 | 轻微偏差 | 轻微偏差 | 天台和离场语义成立；人物背面难以验证五官，烟雾抢画面，存在少量色偏。 |
| `cg_end_fall.png` | 通过 | 不适用 | 通过 | 空天台作为结局静帧与环境基准一致。 |
| `cg_end_fall_seq_01_source.png` | 通过 | 轻微偏差 | 轻微偏差 | 人物背面和服装大体一致，脸不可见；镜头质感比主状态图更写实细密。 |
| `cg_end_fall_seq_02_source.png` | 通过 | 轻微偏差 | 通过 | 手、鞋和栏杆特写延续服装道具，身份无法完整验证但镜头用途合理。 |
| `cg_end_fall_seq_03_source.png` | 通过 | 轻微偏差 | 轻微偏差 | 外套、裤装和鞋基本一致，运动姿态使脸不可验证；风格细密度略高。 |
| `cg_end_fall_seq_04_source.png` | 通过 | 不适用 | 通过 | 极远景不承担人物识别，城市与灰阶一致。 |
| `cg_end_fall_seq_05_source.png` | 通过 | 不适用 | 通过 | 空天台与前序场景一致，可作为收束镜头。 |

## 三、首轮结论

### 明确不一致

1. `char_girl_sad.png`：与普通状态重复。
2. `cg_emotion_surprise_16_9.webp`：脸型与眼睛幼态化。
3. `cg_emotion_soft_16_9.webp`：微笑过强，人物身份漂移。
4. `cg_emotion_curiosity_16_9.webp`：友好感过强，人物身份漂移。
5. `cg_acquaintance_9_16.webp`：彩色抽象占位。
6. `cg_death_falling_16_9.webp`、`cg_death_falling_9_16.webp`：彩色抽象占位。

### 系列级问题

- `normal` 与 `sad` 没有状态差异；旧人物基准中还混有生成标记。
- 开场第 2—5 帧人物在站立、远处坐姿、近处站立、栏杆坐姿之间跳变，动作连续性弱。
- 情绪 CG 保留了同一服装和场景，但五官随情绪重画，缺少稳定角色模型表。
- 临界与回身镜头不是同机位，连续切换时缺乏空间承接。
- 结局资源同时混有完整像素 CG、彩色抽象占位和不同细密度的电影式镜头。

## 四、本轮候选产物范围

### 设定集美术资源

1. 人物三视图：正面、侧面、背面。
2. 人物表情表：戒备、观察、动摇、刺痛、惊讶、柔软、好奇、冷笑。
3. 服装与道具设定：外套、连帽内搭、工装裤、高帮鞋、旧相机、香烟。
4. 动作姿态表：栏杆坐姿、吸烟、观察、临界、回身、离场。
5. 天台环境设定：平面关系、核心镜位、栏杆、门、管线、空调外机、城市天际线。

### 新 CG 审核候选

1. 基础人物状态表：普通、低落、冷笑、吸烟。
2. 开场接近镜头。
3. 四情绪统一角色表。
4. 临界镜头。
5. 同机位回身镜头。
6. 消失结局。
7. 相识结局横屏与竖屏。
8. 坠落/失败结局非直观五镜头分镜表。
9. 坠落/失败结局竖屏空镜。

候选图只用于风格和人物审核，不改动 `gameContract.ts`，不替换现有 PNG/WebP。

## 五、自动指标说明

`existing_asset_metrics.json` 记录分辨率、宽高比和色彩偏离比例。明确异常包括：

- `cg_acquaintance_9_16.webp` 强彩色像素比例为 100%。
- 两张 `cg_death_falling_*` 强彩色像素比例约为 43%。
- 其余主要 CG 接近灰阶；`cg_end_disappear.png` 存在轻微色偏。

自动指标只能发现色彩和规格问题，人物身份、姿态和镜头连续性仍以人工视觉审查为准。

`candidate_asset_metrics.json` 记录本轮候选图指标。候选图未出现强彩色偏离；横屏候选多为 1672×941，接近 16:9；两张竖屏结局候选为 941×1672，接近 9:16。`candidate_end_fall_storyboard.png` 是分镜设定表，比例不是单张 16:9 CG，若后续落到游戏中应拆帧或单独导出。

## 六、候选图复审

### 设定集资源复审

| 候选资源 | 风格 | 人物/设定 | 结论 | 备注 |
| --- | --- | --- | --- | --- |
| `review_candidates_2026-06-29/setting/ai_turnaround_sheet.png` | 通过 | 通过 | 通过 | 三视图发型、外套、连帽内搭、工装裤和鞋型统一，可作为后续角色生成锚点。 |
| `review_candidates_2026-06-29/setting/ai_expression_sheet.png` | 通过 | 通过 | 通过 | 表情变化克制，没有明显微笑或幼态化；但均为相近角度，更适合作为表情基准，不建议直接当游戏 CG。 |
| `review_candidates_2026-06-29/setting/ai_outfit_props_sheet.png` | 通过 | 通过 | 通过 | 服装与相机、香烟等道具清楚；额外食物道具不是当前核心剧情物件，正式使用前应确认是否保留。 |
| `review_candidates_2026-06-29/setting/ai_action_pose_sheet.png` | 通过 | 通过 | 通过 | 坐姿、吸烟、回身、离场等动作统一，适合作为 CG 姿态参考。 |
| `review_candidates_2026-06-29/setting/rooftop_environment_sheet.png` | 通过 | 不适用 | 通过 | 天台门、栏杆、管线、空调外机、湿地反光和城市天际线稳定，可作为背景镜头参考。 |

### 新 CG 候选复审

| 候选资源 | 对应问题 | 风格 | 人物 | 结论 | 备注 |
| --- | --- | --- | --- | --- | --- |
| `review_candidates_2026-06-29/cg/candidate_char_states_4up.png` | `normal/sad/sneer/smoke` 状态统一 | 通过 | 轻微偏差 | 轻微偏差 | 普通、低落、吸烟有区分，能解决 `normal` 与 `sad` 重复问题；冷笑格表情略明显，后续可再压低嘴角。 |
| `review_candidates_2026-06-29/cg/candidate_opening_approach.png` | 开场接近镜头连续性 | 通过 | 通过 | 通过 | 第一视角从门口接近，天台空间、背影、风吹头发和湿地反光一致；可作为开场第 3—5 帧之间的过渡候选。 |
| `review_candidates_2026-06-29/cg/candidate_emotions_4up.png` | 情绪 CG 脸型漂移 | 通过 | 轻微偏差 | 轻微偏差 | 四格服装和场景统一，表情比旧图克制；惊讶与柔软格脸部仍略圆、略柔，若要求严格一致建议二次生成。 |
| `review_candidates_2026-06-29/cg/candidate_pressure_near_railing.png` | 临界镜头统一 | 通过 | 通过 | 通过 | 背影、外套、门和栏杆位置稳定；画面更克制，不直接表现坠落动作。 |
| `review_candidates_2026-06-29/cg/candidate_pressure_turn_back.png` | 临界后回身同机位 | 通过 | 通过 | 通过 | 与临界候选的门、栏杆、城市和地面反光基本连续，解决旧回身图机位跳变问题。 |
| `review_candidates_2026-06-29/cg/candidate_end_disappear.png` | 消失结局色偏与烟雾过重 | 通过 | 通过 | 通过 | 灰阶更纯，烟雾更少，背影和离场语义清楚。 |
| `review_candidates_2026-06-29/cg/candidate_end_acquaintance.png` | 相识结局语义弱 | 通过 | 轻微偏差 | 轻微偏差 | 递出联系方式的动作明确，没有恋爱化；脸部比三视图略柔，正式替换前建议再收紧五官。 |
| `review_candidates_2026-06-29/cg/candidate_end_acquaintance_9_16.png` | 竖屏相识占位 | 通过 | 轻微偏差 | 轻微偏差 | 9:16 规格正确，环境和动作与横屏一致；同样存在脸部略柔风险。 |
| `review_candidates_2026-06-29/cg/candidate_end_fall_storyboard.png` | 彩色坠落占位/失败结局分镜 | 通过 | 不适用 | 通过 | 使用手、鞋、栏杆、相机和空天台表达失败，不画坠落、身体、冲击或血迹；作为分镜表通过。 |
| `review_candidates_2026-06-29/cg/candidate_end_fall_9_16.png` | 竖屏坠落占位 | 通过 | 不适用 | 通过 | 9:16 空镜、相机和烟头语义明确，可替代旧彩色抽象占位方向。 |

### 候选组综合判断

- 本轮候选图整体满足灰阶、像素叙事、雨夜天台和人物服装统一原则，比旧资源中的彩色占位和情绪脸型漂移更一致。
- 可以优先进入人工审核的候选：`ai_turnaround_sheet.png`、`ai_action_pose_sheet.png`、`rooftop_environment_sheet.png`、`candidate_opening_approach.png`、`candidate_pressure_near_railing.png`、`candidate_pressure_turn_back.png`、`candidate_end_disappear.png`、`candidate_end_fall_9_16.png`。
- 建议二次生成或人工微调后再替换的候选：`candidate_emotions_4up.png`、`candidate_char_states_4up.png`、`candidate_end_acquaintance.png`、`candidate_end_acquaintance_9_16.png`。
- 本轮没有替换任何现有游戏 PNG/WebP；所有候选图均保存在 `legacy_vue/public/assets/images/review_candidates_2026-06-29/` 下，等待人工审核。
