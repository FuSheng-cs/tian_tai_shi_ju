# master 简洁首页恢复（2026-10-01）

恢复依据：`origin/Client` 提交 `29ee6f4b` 的 `StartView.vue`。只迁回首页布局和既有素材，保留当前 master 的路由、存档、后日谈校验、服务器 API 配置和首次加载优化。

- 首页显示标题、原版一句文案和“开始 / 读档 / 成就 / 设置”；移除 Web 首页的介绍面板。
- 使用仓库已有 `menu_home_bg_*`、`menu_home_title_mist_*`、`menu_home_menu_aura_*`、`menu_title.*`，没有引入新生成图片。
- 首页使用黑白灰显示；保留像素字体、声音开关、响应式 WebP、标题加载时的文字占位。
- 原版带延迟的淡入、模糊演出不恢复，避免按钮先不可见。预加载地址切换到简洁版已有背景。
- 存档菜单继续使用当前 `useSaveSlots`，路由仍使用 query 参数，不回退旧版 sessionStorage 契约。
- 被否决的新生成素材没有提交或上线，不在发布包中。

验证：master 前端 107 项测试、lint/build 通过；桌面和手机检查四个入口、存档栏位、标题、画面与横向溢出。此次不修改后端、游戏规则或 shumei 分支。

发布入口：`https://master.tiantaishiju.top/`。新前端目录 `/opt/damo/releases/master-simple-home-20261001/frontend`，原版目录 `/opt/damo/releases/master-20261001-8675f677/frontend` 保留，可通过恢复 `/var/www/damo-master` 链接回退。
