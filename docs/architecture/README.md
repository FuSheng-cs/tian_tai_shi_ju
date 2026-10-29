# UML 图维护与字体规范

本目录使用 PlantUML 维护组件图和时序图。完整函数入口和接口字段见[技术说明](../engineering/technical_overview.md)与[Prompt 规范](../engineering/prompts_and_settings.md)。图内使用短标签展示职责和调用顺序。

## 生成环境

- Java 17 或更新版本。
- PlantUML 1.2025.2：[官方 Maven 制品](https://repo.maven.apache.org/maven2/net/sourceforge/plantuml/plantuml/1.2025.2/plantuml-1.2025.2.jar)。下载到 `output/toolchain/plantuml-1.2025.2.jar`，或通过 `--jar` 指定路径。
- Python 3.10 或更新版本及 `fonttools`：`python -m pip install fonttools`。
- 微软雅黑常规体和粗体：Windows 字体目录中的 `msyh.ttc`、`msyhbd.ttc`；也可通过 `--font-regular`、`--font-bold` 指定这两种字体的路径。

在项目根目录执行：

```powershell
python scripts/render_plantuml.py .
python scripts/render_plantuml.py . --check
node scripts/check_docs.mjs
```

## 导出规则

1. Java 启动器显式注册常规体和粗体，在同一字体环境中完成文字测量与绘制。
2. PNG 使用三倍分辨率输出，供 README 缩放展示。
3. SVG 使用同一字体的字形轮廓，固定“门、槛、阈”等中文笔画；每行文字保留在可访问标签中。
4. 字体保留在本机，仓库只提交 PlantUML 源码、PNG 和 SVG 产物。
5. 脚本检查缺失字形、渲染诊断、SVG 轮廓和 PNG/SVG 三倍画布关系，通过后再替换产物。

## 视觉验收

每次调整源图，打开两种格式并完成以下检查：

- 在 537 像素窗口及桌面正文宽度下阅读完整图。
- 放大检查“程序守门”“信任门槛校验”等中文字形。
- 检查标签换行、组件边界、生命线、箭头、序号和图注。
- 确认 PNG 与 SVG 内容一致。
- 推送后在 GitHub README 检查实际嵌图。

PlantUML 源码提供可编辑文字，SVG 提供固定字形的矢量展示。
