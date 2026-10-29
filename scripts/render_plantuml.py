import argparse
import struct
import urllib.request
import xml.etree.ElementTree as ET
import zlib
from pathlib import Path


def encode6bit(value: int) -> str:
    if value < 10:
        return chr(48 + value)
    value -= 10
    if value < 26:
        return chr(65 + value)
    value -= 26
    if value < 26:
        return chr(97 + value)
    value -= 26
    return "-" if value == 0 else "_" if value == 1 else "?"


def append3(first: int, second: int, third: int) -> str:
    values = (
        first >> 2,
        ((first & 0x3) << 4) | (second >> 4),
        ((second & 0xF) << 2) | (third >> 6),
        third & 0x3F,
    )
    return "".join(encode6bit(value) for value in values)


def plantuml_encode(source: str) -> str:
    compressed = zlib.compress(source.encode("utf-8"), 9)[2:-4]
    chunks = []
    for index in range(0, len(compressed), 3):
        block = compressed[index : index + 3]
        if len(block) == 1:
            chunks.append(append3(block[0], 0, 0))
        elif len(block) == 2:
            chunks.append(append3(block[0], block[1], 0))
        else:
            chunks.append(append3(block[0], block[1], block[2]))
    return "".join(chunks)


def validate_pair(svg: bytes, png: bytes) -> tuple[int, int]:
    document = ET.fromstring(svg)
    if document.tag != "{http://www.w3.org/2000/svg}svg":
        raise ValueError("Renderer did not return an SVG document")

    # PlantUML can return a valid image containing a syntax error or warning.
    # Reject those images before replacing the published diagram files.
    visible_text = " ".join(document.itertext()).lower()
    for marker in ("syntax error", "is ignored: use a style instead", "</size>"):
        if marker in visible_text:
            raise ValueError(f"PlantUML diagnostic found in rendered text: {marker}")
    if not visible_text.strip():
        raise ValueError("Rendered SVG has no text")

    if png[:8] != b"\x89PNG\r\n\x1a\n" or png[12:16] != b"IHDR":
        raise ValueError("Renderer did not return a PNG image")
    width, height = struct.unpack(">II", png[16:24])
    view_box = [float(value) for value in document.attrib["viewBox"].split()]
    if width < 1 or height < 1 or any(
        abs(actual - expected) > 1
        for actual, expected in zip((width, height), view_box[2:])
    ):
        raise ValueError("SVG and PNG canvas dimensions do not match")
    return width, height


def main() -> None:
    parser = argparse.ArgumentParser(description="Render PlantUML source to SVG and PNG")
    parser.add_argument("root", nargs="?", default=".")
    parser.add_argument("--check", action="store_true", help="Validate existing image pairs offline")
    args = parser.parse_args()
    root = Path(args.root)
    for source in sorted((root / "docs" / "architecture").glob("*.puml")):
        if args.check:
            width, height = validate_pair(
                source.with_suffix(".svg").read_bytes(),
                source.with_suffix(".png").read_bytes(),
            )
            print(f"{source.stem}: SVG + PNG validated ({width} x {height})")
            continue

        encoded = plantuml_encode(source.read_text(encoding="utf-8"))
        rendered = {}
        for extension in ("svg", "png"):
            url = f"https://www.plantuml.com/plantuml/{extension}/{encoded}"
            request = urllib.request.Request(
                url,
                headers={"User-Agent": "AIC-PlantUML-Renderer/1.0"},
            )
            with urllib.request.urlopen(request, timeout=60) as response:
                rendered[extension] = response.read()

        width, height = validate_pair(rendered["svg"], rendered["png"])
        for extension, data in rendered.items():
            target = source.with_suffix(f".{extension}")
            temporary = target.with_suffix(f".{extension}.tmp")
            temporary.write_bytes(data)
            temporary.replace(target)
        print(f"{source.stem}: SVG + PNG rendered ({width} x {height})")


if __name__ == "__main__":
    main()

