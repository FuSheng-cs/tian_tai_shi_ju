# 游戏资源维护

前端将 `legacy_vue/public/` 随构建产物发布。游戏图片、字体与音频分别位于其中的
`assets/images/`、`assets/fonts/` 和 `assets/audio/`。

- 首页使用桌面、窄屏图与光效层，`menu_home_bg_original.webp` 用于原画模式。
  标题 PNG 用于高分辨率展示，也可生成首页预加载用的两种尺寸。
- 主线、开场与结局的画面映射见 `src/domain/gameContract.ts`。
  `cgAssets.generated.ts` 声明首显、窄屏和预览图，`originalCgQuality.ts` 根据同一清单定位原画模式使用的 WebP。
- 音频入口为 `gameContract.ts` 和 `src/modules/AudioManager.ts`，包括背景音乐、打字音、脚步和结局音效。
- 浏览器加载 WOFF2。字体重建使用 `scripts/font-source/` 中的 TTF。

在 `legacy_vue/` 安装锁定依赖后执行所需的生成命令。

```sh
node scripts/optimize_cg_assets.mjs
node scripts/optimize_home_title.mjs
python scripts/generate_fonts.py
```

字体脚本需要 Python 的 `fonttools` 和 `brotli`。生成脚本会更新带内容哈希的资源及对应清单。
提交前核对新清单、首页预加载和图标引用，删除被替换且无引用的输出，再运行
`npm test -- --run` 和 `npm run build`。剧情画面以 [游戏设定集](../product/game_setting_bible.md)
和 [Prompt 与结算规则](prompts_and_settings.md) 为准。
