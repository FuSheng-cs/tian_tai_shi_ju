"""Local PlantUML export with explicit CJK fonts, outlined SVG and 3x PNG."""
import argparse
import os
import shutil
import struct
import subprocess
import xml.etree.ElementTree as ET
from pathlib import Path

from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.ttLib import TTFont

SVG = "http://www.w3.org/2000/svg"
ET.register_namespace("", SVG)


def outline_text(data: bytes, regular: Path, bold: Path) -> bytes:
    fonts = [TTFont(str(path), fontNumber=0) for path in (regular, bold)]
    document = ET.fromstring(data)
    try:
        for parent in list(document.iter()):
            for element in list(parent):
                if element.tag != f"{{{SVG}}}text":
                    continue
                text = "".join(element.itertext())
                font = fonts[1 if element.get("font-weight") in ("bold", "700") else 0]
                glyphs, cmap = font.getGlyphSet(), font.getBestCmap()
                names = []
                for char in text:
                    if ord(char) not in cmap:
                        raise ValueError(f"Font missing U+{ord(char):04X}: {char}")
                    names.append(cmap[ord(char)])
                size = float(element.get("font-size", "16"))
                scale = size / font["head"].unitsPerEm
                advance = sum(glyphs[name].width for name in names) * scale
                target = float(element.get("textLength", str(advance)))
                stretch = target / advance if advance else 1
                group = ET.Element(f"{{{SVG}}}g", {
                    "aria-label": text,
                    "fill": element.get("fill", "#172B4D"),
                    "transform": f"translate({element.get('x', '0')} {element.get('y', '0')})",
                })
                ET.SubElement(group, f"{{{SVG}}}title").text = text
                cursor = 0
                for name in names:
                    pen = SVGPathPen(glyphs)
                    glyphs[name].draw(pen)
                    commands = pen.getCommands()
                    if commands:
                        ET.SubElement(group, f"{{{SVG}}}path", {
                            "d": commands,
                            "transform": f"translate({cursor:.5f} 0) scale({scale * stretch:.7f} {-scale:.7f})",
                        })
                    cursor += glyphs[name].width * scale * stretch
                parent.insert(list(parent).index(element), group)
                parent.remove(element)
        document.set("data-aic-font", "Microsoft YaHei; glyph outlines")
        document.set("role", "img")
        return ET.tostring(document, encoding="utf-8", xml_declaration=True)
    finally:
        for font in fonts:
            font.close()


def validate_pair(svg: bytes, png: bytes) -> tuple[int, int]:
    document = ET.fromstring(svg)
    if document.tag != f"{{{SVG}}}svg":
        raise ValueError("Not SVG")
    visible = " ".join(document.itertext()).lower()
    for marker in ("syntax error", "is ignored: use a style instead", "</size>"):
        if marker in visible:
            raise ValueError(f"PlantUML diagnostic: {marker}")
    if list(document.iter(f"{{{SVG}}}text")):
        raise ValueError("SVG contains font-dependent text; outline conversion required")
    if "data-aic-font" not in document.attrib:
        raise ValueError("Missing font provenance")
    if png[:8] != b"\x89PNG\r\n\x1a\n" or png[12:16] != b"IHDR":
        raise ValueError("Not PNG")
    width, height = struct.unpack(">II", png[16:24])
    box = [float(value) for value in document.attrib["viewBox"].split()]
    if any(abs(actual - expected * 3) > 4
           for actual, expected in zip((width, height), box[2:])):
        raise ValueError("PNG must match SVG at 3x resolution")
    return width, height


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("root", nargs="?", default=".")
    parser.add_argument("--check", action="store_true")
    parser.add_argument("--jar", default=os.environ.get(
        "PLANTUML_JAR", "output/toolchain/plantuml-1.2025.2.jar"))
    parser.add_argument("--font-regular", default="C:/Windows/Fonts/msyh.ttc")
    parser.add_argument("--font-bold", default="C:/Windows/Fonts/msyhbd.ttc")
    args = parser.parse_args()
    root = Path(args.root).resolve()
    regular, bold = Path(args.font_regular), Path(args.font_bold)
    java = shutil.which("java")
    jar = Path(args.jar).resolve()
    if not args.check and (not java or not jar.is_file()):
        raise SystemExit("Java and a local PlantUML jar are required; set PLANTUML_JAR.")
    env = dict(os.environ, AIC_FONT_REGULAR=str(regular), AIC_FONT_BOLD=str(bold))
    for source in sorted((root / "docs/architecture").glob("*.puml")):
        if args.check:
            rendered = {ext: source.with_suffix("." + ext).read_bytes() for ext in ("svg", "png")}
        else:
            rendered = {}
            for ext in ("svg", "png"):
                content = source.read_text(encoding="utf-8").strip()
                if ext == "png":
                    content = content.replace("\n", "\nscale 3\n", 1)
                process = subprocess.run([
                    java, "-Djava.awt.headless=true", "-DPLANTUML_LIMIT_SIZE=16384",
                    "-cp", str(jar), str(root / "scripts/PlantUMLWithFonts.java"),
                    "-charset", "UTF-8", "-pipe", "-t" + ext,
                ], input=content.encode("utf-8"), capture_output=True, env=env, check=True)
                if ext == "svg":
                    data = outline_text(process.stdout, regular, bold)
                else:
                    data = process.stdout
                rendered[ext] = data
        width, height = validate_pair(rendered["svg"], rendered["png"])
        if not args.check:
            for ext, data in rendered.items():
                target = source.with_suffix("." + ext)
                temporary = target.with_suffix("." + ext + ".tmp")
                temporary.write_bytes(data)
                temporary.replace(target)
        print(f"{source.stem}: outlined SVG + 3x PNG ({width} x {height})")


if __name__ == "__main__":
    main()

