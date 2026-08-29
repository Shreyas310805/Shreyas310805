import argparse
from pathlib import Path
from PIL import Image, ImageOps, ImageEnhance

RAMP = "@%#*+=-:. "
CHAR_ASPECT = 1.7
FONT_SIZE = 9
CHAR_W = FONT_SIZE * 0.6
LINE_H = FONT_SIZE * 1.0


def build_rows(path, width, contrast, invert, cutoff, equalize):
    img = Image.open(path).convert("L")
    img = ImageOps.autocontrast(img)
    if equalize:
        img = ImageOps.equalize(img)
    img = ImageEnhance.Contrast(img).enhance(contrast)
    if invert:
        img = ImageOps.invert(img)
    w, h = img.size
    height = max(1, int(h * (width / w) / CHAR_ASPECT))
    img = img.resize((width, height))
    px = img.load()
    scale = (len(RAMP) - 1) / 255
    rows = []
    for y in range(height):
        line = []
        for x in range(width):
            v = px[x, y]
            line.append(" " if v >= cutoff else RAMP[int(v * scale)])
        rows.append("".join(line).rstrip())
    while rows and not rows[0].strip():
        rows.pop(0)
    while rows and not rows[-1].strip():
        rows.pop()
    return rows


def escape(s):
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def write_svg(rows, out, color, width):
    w = int(width * CHAR_W) + 20
    h = int(len(rows) * LINE_H) + 20
    spans = []
    for i, row in enumerate(rows):
        y = 14 + i * LINE_H
        spans.append(
            '<tspan x="10" y="%.1f" xml:space="preserve">%s</tspan>' % (y, escape(row))
        )
    svg = (
        '<svg xmlns="http://www.w3.org/2000/svg" width="%d" height="%d" '
        'viewBox="0 0 %d %d" role="img" aria-label="ascii portrait">'
        '<text font-family="ui-monospace,SFMono-Regular,Menlo,Consolas,monospace" '
        'font-size="%d" fill="%s">%s</text></svg>'
    ) % (w, h, w, h, FONT_SIZE, color, "".join(spans))
    Path(out).write_text(svg, encoding="utf-8")


def main():
    p = argparse.ArgumentParser()
    p.add_argument("image")
    p.add_argument("--width", type=int, default=110)
    p.add_argument("--contrast", type=float, default=1.4)
    p.add_argument("--cutoff", type=int, default=250)
    p.add_argument("--invert", action="store_true")
    p.add_argument("--equalize", action="store_true")
    p.add_argument("--outdir", default="assets")
    p.add_argument("--dark-color", default="#C9D1D9")
    p.add_argument("--light-color", default="#24292F")
    p.add_argument("--txt", action="store_true")
    a = p.parse_args()

    rows = build_rows(a.image, a.width, a.contrast, a.invert, a.cutoff, a.equalize)
    out = Path(a.outdir)
    out.mkdir(parents=True, exist_ok=True)
    write_svg(rows, out / "portrait-dark.svg", a.dark_color, a.width)
    write_svg(rows, out / "portrait-light.svg", a.light_color, a.width)
    if a.txt:
        (out / "portrait.txt").write_text("\n".join(rows), encoding="utf-8")
    print("rows:", len(rows), "cols:", a.width)
    print("wrote:", out / "portrait-dark.svg", "and portrait-light.svg")


if __name__ == "__main__":
    main()