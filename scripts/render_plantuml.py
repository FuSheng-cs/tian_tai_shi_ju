import sys
import urllib.request
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


def main() -> None:
    root = Path(sys.argv[1] if len(sys.argv) > 1 else ".")
    for source in sorted((root / "docs" / "architecture").glob("*.puml")):
        encoded = plantuml_encode(source.read_text(encoding="utf-8"))
        for extension in ("svg", "png"):
            url = f"https://www.plantuml.com/plantuml/{extension}/{encoded}"
            request = urllib.request.Request(
                url,
                headers={"User-Agent": "AIC-PlantUML-Renderer/1.0"},
            )
            data = urllib.request.urlopen(request, timeout=60).read()
            target = source.with_suffix(f".{extension}")
            target.write_bytes(data)
            print(f"{target}: {len(data)} bytes")


if __name__ == "__main__":
    main()

