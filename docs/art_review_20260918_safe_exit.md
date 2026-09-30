# 安全离开结局 CG

2026-09-18，使用内置 image_gen（imagegen 技能）生成，未使用 API/CLI 付费回退。参考素材：`legacy_vue/public/assets/images/unified_image2_2026-07-31/game_cg/state/state_guarded_1600.webp`，用于保持人物身份与黑白像素画风。

资产目录：`legacy_vue/public/assets/images/safe_exit_20260918/`。保留 PNG 原稿，另生成 1600 与 900 宽 WebP，用于桌面和移动端。三个动作：01-crying（哭泣）、02-wipe-tears（抹泪）、03-leave-together（共同离开）。

前端 SAFE_EXIT_SEQUENCE_FRAMES 定义逐帧字幕；EndingSequenceOverlay 负责点击/Enter/空格推进及跳过；GameView 在好结局对白完成后播放，完成后显示结算并提供重看。拒绝结局不播放这组画面。

## 生成提示词

### 1

Use case: illustration-story. Create one 16:9 landscape game cinematic CG, no text, no panels, no UI. Reference image is character identity and style reference: same young adult college woman Ai, short black bob hair with bangs, dark hooded jacket, trousers, monochrome detailed pixel-art/dithered anime visual novel style. Same rainy-night rooftop building, rain has stopped, restrained humane emotion, no cigarettes, no self-harm, no romantic embrace. Clear readable subject in central area with bottom space for subtitles. Frame 1: medium close-up of Ai safely standing by the rooftop entrance brick wall, away from the railing. Tears visibly roll down both cheeks, eyes wet, lips trembling, her hands lowered. She finally allows herself to cry. Doorway and distant city lights softly visible, luminous face readable in grayscale.

### 2

Use case: illustration-story. Create one 16:9 landscape game cinematic CG, no text, no panels, no UI. Reference image is character identity and style reference: same young adult college woman Ai, short black bob hair with bangs, dark hooded jacket, trousers, monochrome detailed pixel-art/dithered anime visual novel style. Same rainy-night rooftop building, rain has stopped, restrained humane emotion, no cigarettes, no self-harm, no romantic embrace. Clear readable subject in central area with bottom space for subtitles. Frame 2: medium close-up of Ai safely by the rooftop entrance brick wall. She raises one jacket sleeve and gently wipes a tear off her cheek below her eye, her other hand relaxed. Visible tear tracks and damp eyes, expression still tired but steadier. Clearly show wiping action, natural hand anatomy. Doorway and distant city lights behind.

### 3

Use case: illustration-story. Create one 16:9 landscape game cinematic CG, no text, no panels, no UI. Reference image is character identity and style reference: same young adult college woman Ai, short black bob hair with bangs, dark hooded jacket, trousers, monochrome detailed pixel-art/dithered anime visual novel style. Same rainy-night rooftop building, rain has stopped, restrained humane emotion, no cigarettes, no self-harm, no romantic embrace. Clear readable subject in central area with bottom space for subtitles. Frame 3: wider rear three-quarter view of Ai and the player, a second young adult in a simple dark coat with face unseen, walking side by side THROUGH the open rooftop door INTO a softly lit interior stairwell landing. Both have crossed the threshold, moving away from camera and rooftop. Her short bob and hooded jacket consistent. Show interior stair railing and steps ahead, rooftop city only outside behind them. Peaceful companionship, not romance; both feet on safe solid floor. Door remains open, not an empty rooftop. Central figures readable.

