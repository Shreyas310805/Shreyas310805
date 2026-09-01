import argparse
from pathlib import Path

MONO = "ui-monospace,SFMono-Regular,Menlo,Consolas,monospace"

SESSION = [
    ("cmd", "whoami"),
    ("out", "shreyas tiwari — cs undergrad, vit bhopal"),
    ("gap", ""),
    ("cmd", "cat focus.txt"),
    ("out", "python · llms · retrieval · prompt engineering · dsa"),
    ("gap", ""),
    ("cmd", "cat principle.txt"),
    ("out", "small sharp tools over big vague ideas."),
    ("out", "a model is only as good as the reasoning feeding it."),
    ("gap", ""),
    ("cmd", "./now"),
    ("out", "squeezing a leaf-disease model small enough to run"),
    ("out", "on a solar-powered pi, offline, in a field."),
]

STACK = [
    ("languages", "python   java   javascript   php   sql"),
    ("ml", "tensorflow   keras   tflite   scikit-learn"),
    ("data", "numpy   pandas   matplotlib   mysql"),
    ("web", "html   css   chart.js   oauth 2.0"),
    ("tools", "git   colab   kaggle   github pages   raspberry pi"),
]


def escape(s):
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def terminal_svg(fg, dim, accent, args):
    fs = 13
    lh = 22
    pad = 18
    w = args.width
    rows = [r for r in SESSION]
    h = pad * 2 + len(rows) * lh + 10

    css = [
        ".ln{clip-path:inset(0 100% 0 0);}",
        "@keyframes tp{to{clip-path:inset(0 0 0 0);}}",
        "@keyframes bl{0%,49%{opacity:1;}50%,100%{opacity:0;}}",
        ".cur{animation:bl 1.1s steps(1) infinite;}",
    ]

    t = 0.25
    body = []
    for i, (kind, text) in enumerate(rows):
        y = pad + fs + i * lh
        if kind == "gap":
            continue
        dur = max(0.25, len(text) * 0.022)
        steps = max(4, len(text))
        style = "animation:tp %.2fs steps(%d) both;animation-delay:%.2fs" % (
            dur,
            steps,
            t,
        )
        if kind == "cmd":
            body.append(
                '<text class="ln" style="%s" x="%d" y="%d" xml:space="preserve">'
                '<tspan fill="%s">$ </tspan><tspan fill="%s">%s</tspan></text>'
                % (style, pad, y, accent, fg, escape(text))
            )
        else:
            body.append(
                '<text class="ln" style="%s" x="%d" y="%d" fill="%s" '
                'xml:space="preserve">%s</text>' % (style, pad + 16, y, dim, escape(text))
            )
        t += dur + (0.22 if kind == "cmd" else 0.12)

    cy = pad + fs + (len(rows) - 1) * lh + lh
    body.append(
        '<rect class="cur" x="%d" y="%.1f" width="8" height="14" fill="%s" '
        'style="animation-delay:%.2fs"/>' % (pad, cy - fs + 1, accent, t)
    )
    h = int(cy + pad)

    return (
        '<svg xmlns="http://www.w3.org/2000/svg" width="%d" height="%d" '
        'viewBox="0 0 %d %d" role="img" aria-label="about">'
        "<style>%s</style>"
        '<rect x="0.5" y="0.5" width="%d" height="%d" rx="8" fill="none" '
        'stroke="%s" stroke-opacity="0.25"/>'
        '<g font-family="%s" font-size="%d">%s</g></svg>'
    ) % (
        w,
        h,
        w,
        h,
        "".join(css),
        w - 1,
        h - 1,
        dim,
        MONO,
        fs,
        "".join(body),
    )


def stack_svg(fg, dim, accent, args):
    fs = 12
    lh = 34
    pad = 18
    w = args.width
    h = pad * 2 + len(STACK) * lh

    css = [
        ".rw{opacity:0;}",
        "@keyframes fi{to{opacity:1;}}",
    ]
    body = []
    for i, (label, items) in enumerate(STACK):
        y = pad + fs + 4 + i * lh
        d = 0.12 * i
        body.append(
            '<g class="rw" style="animation:fi 0.5s ease-out both;animation-delay:%.2fs">'
            '<text x="%d" y="%d" fill="%s" font-size="10" letter-spacing="1.5">%s</text>'
            '<text x="%d" y="%d" fill="%s" xml:space="preserve">%s</text>'
            '<line x1="%d" y1="%.1f" x2="%d" y2="%.1f" stroke="%s" stroke-opacity="0.15"/>'
            "</g>"
            % (
                d,
                pad,
                y,
                accent,
                label.upper(),
                pad + 110,
                y,
                fg,
                escape(items),
                pad,
                y + 12,
                w - pad,
                y + 12,
                dim,
            )
        )

    return (
        '<svg xmlns="http://www.w3.org/2000/svg" width="%d" height="%d" '
        'viewBox="0 0 %d %d" role="img" aria-label="stack">'
        "<style>%s</style>"
        '<g font-family="%s" font-size="%d">%s</g></svg>'
    ) % (w, h, w, h, "".join(css), MONO, fs, "".join(body))


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--width", type=int, default=760)
    p.add_argument("--outdir", default="assets")
    a = p.parse_args()

    out = Path(a.outdir)
    out.mkdir(parents=True, exist_ok=True)

    variants = [
        ("dark", "#C9D1D9", "#8B949E", "#2DD4BF"),
        ("light", "#24292F", "#57606A", "#0F766E"),
    ]
    for name, fg, dim, accent in variants:
        (out / ("terminal-%s.svg" % name)).write_text(
            terminal_svg(fg, dim, accent, a), encoding="utf-8"
        )
        (out / ("stack-%s.svg" % name)).write_text(
            stack_svg(fg, dim, accent, a), encoding="utf-8"
        )
    print("wrote terminal and stack svgs to", out)


if __name__ == "__main__":
    main()
