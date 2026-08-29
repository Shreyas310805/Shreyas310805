import argparse
from pathlib import Path
from PIL import Image, ImageOps, ImageEnhance, ImageFilter

RAMP_COARSE = "@%#*+=-:. "
RAMP_FINE = "$@B%8&WM#*oahkbdpqwmZO0QLCJUYXzcvunxrjft/|()1{}[]?-_+~<>i!lI;:,^`'. "
CHAR_ASPECT = 1.7
MONO = "ui-monospace,SFMono-Regular,Menlo,Consolas,monospace"


def subject_levels(small, mask, lo_pct, hi_pct):
    sp = small.load()
    mp = mask.load()
    w, h = small.size
    hist = [0] * 256
    for y in range(h):
        for x in range(w):
            if not mp[x, y]:
                hist[sp[x, y]] += 1
    total = sum(hist)
    if total == 0:
        return 0, 255
    lo, hi, acc = 0, 255, 0
    for v in range(256):
        acc += hist[v]
        if acc >= total * lo_pct / 100.0:
            lo = v
            break
    acc = 0
    for v in range(256):
        acc += hist[v]
        if acc >= total * hi_pct / 100.0:
            hi = v
            break
    if hi <= lo:
        hi = min(255, lo + 1)
    return lo, hi


def build_ramp(args):
    base = RAMP_COARSE if args.coarse_ramp else RAMP_FINE
    n = args.levels
    if n <= 1 or n >= len(base):
        return base
    step = (len(base) - 1) / (n - 1)
    return "".join(base[int(round(i * step))] for i in range(n))


def build_rows(path, args):
    img = Image.open(path).convert("L")
    w, h = img.size
    height = max(1, int(h * (args.width / w) / CHAR_ASPECT))
    small = img.resize((args.width, height), Image.LANCZOS)

    mask = small.point(lambda v: 255 if v >= args.cutoff else 0)
    lo, hi = subject_levels(small, mask, args.low, args.high)
    span = hi - lo
    tonal = small.point(lambda v: max(0, min(255, int((v - lo) * 255 / span))))

    if args.equalize:
        tonal = ImageOps.equalize(tonal)
    if args.gamma != 1.0:
        inv = 1.0 / args.gamma
        tonal = tonal.point(lambda v: int(255 * ((v / 255) ** inv)))
    if args.sharpen > 0:
        tonal = tonal.filter(
            ImageFilter.UnsharpMask(radius=1.5, percent=int(args.sharpen * 100), threshold=1)
        )
    tonal = ImageEnhance.Contrast(tonal).enhance(args.contrast)
    if not args.negative:
        tonal = ImageOps.invert(tonal)

    ramp = build_ramp(args)
    scale = (len(ramp) - 1) / 255
    tp = tonal.load()
    mp = mask.load()

    rows = []
    for y in range(height):
        line = []
        for x in range(args.width):
            if mp[x, y] and not args.keep_bg:
                line.append(" ")
            else:
                line.append(ramp[int(tp[x, y] * scale)])
        rows.append("".join(line).rstrip())
    while rows and not rows[0].strip():
        rows.pop(0)
    while rows and not rows[-1].strip():
        rows.pop()
    print("subject levels:", lo, "-", hi, "| ramp size:", len(ramp))
    return rows


def escape(s):
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def build_css(n, args):
    steps = max(4, args.width // 3)
    rules = [
        ".p{clip-path:inset(0 100% 0 0);}",
        "@keyframes rv{to{clip-path:inset(0 0 0 0);}}",
    ]
    if not args.loop:
        rules.append(
            ".p{animation:rv %.2fs steps(%d) both;}" % (args.sweep, steps)
        )
    else:
        total = n * args.row_delay + args.sweep + args.hold
        for i in range(n):
            t0 = i * args.row_delay
            t1 = t0 + args.sweep
            a = 100.0 * t0 / total
            b = 100.0 * t1 / total
            rules.append(
                "@keyframes k%d{0%%,%.3f%%{clip-path:inset(0 100%% 0 0);}"
                "%.3f%%,100%%{clip-path:inset(0 0 0 0);}}" % (i, a, b)
            )
            rules.append(
                ".p%d{animation:k%d %.2fs steps(%d) infinite;}" % (i, i, total, steps)
            )
    return "".join(rules)


def write_svg(rows, out, color, args):
    fs = args.font_size
    char_w = fs * 0.6
    line_h = fs
    w = int(args.width * char_w) + 20
    h = int(len(rows) * line_h) + 20

    if not args.animate:
        spans = []
        for i, row in enumerate(rows):
            y = fs + 5 + i * line_h
            spans.append(
                '<tspan x="10" y="%.1f" xml:space="preserve">%s</tspan>' % (y, escape(row))
            )
        style = ""
        body = '<text font-family="%s" font-size="%d" fill="%s">%s</text>' % (
            MONO, fs, color, "".join(spans)
        )
    else:
        style = "<style>" + build_css(len(rows), args) + "</style>"
        texts = []
        for i, row in enumerate(rows):
            y = fs + 5 + i * line_h
            if args.loop:
                attr = 'class="p p%d"' % i
            else:
                attr = 'class="p" style="animation-delay:%.2fs"' % (i * args.row_delay)
            texts.append(
                '<text %s x="10" y="%.1f" xml:space="preserve">%s</text>'
                % (attr, y, escape(row))
            )
        body = '<g font-family="%s" font-size="%d" fill="%s">%s</g>' % (
            MONO, fs, color, "".join(texts)
        )

    svg = (
        '<svg xmlns="http://www.w3.org/2000/svg" width="%d" height="%d" '
        'viewBox="0 0 %d %d" role="img" aria-label="ascii portrait">%s%s</svg>'
    ) % (w, h, w, h, style, body)
    Path(out).write_text(svg, encoding="utf-8")


def main():
    p = argparse.ArgumentParser()
    p.add_argument("image")
    p.add_argument("--width", type=int, default=180)
    p.add_argument("--contrast", type=float, default=1.3)
    p.add_argument("--cutoff", type=int, default=235)
    p.add_argument("--gamma", type=float, default=1.0)
    p.add_argument("--sharpen", type=float, default=1.2)
    p.add_argument("--low", type=float, default=2.0)
    p.add_argument("--high", type=float, default=98.0)
    p.add_argument("--levels", type=int, default=20)
    p.add_argument("--equalize", action="store_true")
    p.add_argument("--negative", action="store_true")
    p.add_argument("--keep-bg", action="store_true")
    p.add_argument("--coarse-ramp", action="store_true")
    p.add_argument("--font-size", type=int, default=7)
    p.add_argument("--outdir", default="assets")
    p.add_argument("--dark-color", default="#C9D1D9")
    p.add_argument("--light-color", default="#24292F")
    p.add_argument("--txt", action="store_true")
    p.add_argument("--static", dest="animate", action="store_false")
    p.add_argument("--row-delay", type=float, default=0.05)
    p.add_argument("--sweep", type=float, default=0.45)
    p.add_argument("--hold", type=float, default=3.0)
    p.add_argument("--loop", action="store_true")
    p.set_defaults(animate=True)
    a = p.parse_args()

    rows = build_rows(a.image, a)
    out = Path(a.outdir)
    out.mkdir(parents=True, exist_ok=True)
    write_svg(rows, out / "portrait-dark.svg", a.dark_color, a)
    write_svg(rows, out / "portrait-light.svg", a.light_color, a)
    if a.txt:
        (out / "portrait.txt").write_text("\n".join(rows), encoding="utf-8")
    mode = "loop" if (a.animate and a.loop) else ("animated" if a.animate else "static")
    print("rows:", len(rows), "cols:", a.width, "| mode:", mode)
    print("wrote:", out / "portrait-dark.svg", "and portrait-light.svg")


if __name__ == "__main__":
    main()