import argparse
import datetime
import json
import os
import random
import urllib.request
from pathlib import Path

QUERY = """
query($login: String!) {
  user(login: $login) {
    contributionsCollection {
      contributionCalendar {
        totalContributions
        weeks {
          contributionDays { contributionCount date }
        }
      }
    }
  }
}
"""

W = 760
H = 210
PAD = 18
GRAPH_TOP = 118
GRAPH_BOTTOM = 192


def fetch(login, token):
    body = json.dumps({"query": QUERY, "variables": {"login": login}}).encode()
    req = urllib.request.Request(
        "https://api.github.com/graphql",
        data=body,
        headers={
            "Authorization": "bearer " + token,
            "Content-Type": "application/json",
            "User-Agent": "profile-readme",
        },
    )
    with urllib.request.urlopen(req) as r:
        data = json.load(r)
    if "errors" in data:
        raise SystemExit(data["errors"])
    return data["data"]["user"]["contributionsCollection"]["contributionCalendar"]


def demo_calendar():
    random.seed(7)
    weeks = []
    start = datetime.date.today() - datetime.timedelta(days=371)
    start -= datetime.timedelta(days=(start.weekday() + 1) % 7)
    for w in range(53):
        days = []
        for d in range(7):
            day = start + datetime.timedelta(days=w * 7 + d)
            days.append(
                {
                    "contributionCount": max(0, int(random.gauss(2, 3))),
                    "date": day.isoformat(),
                }
            )
        weeks.append({"contributionDays": days})
    total = sum(d["contributionCount"] for w in weeks for d in w["contributionDays"])
    return {"totalContributions": total, "weeks": weeks}


def summarize(cal):
    days = [d["contributionCount"] for w in cal["weeks"] for d in w["contributionDays"]]
    active = sum(1 for c in days if c > 0)
    best = 0
    for w in cal["weeks"]:
        s = sum(d["contributionCount"] for d in w["contributionDays"])
        best = max(best, s)
    return cal["totalContributions"], active, best, days


def smooth(values, k=5):
    out = []
    for i in range(len(values)):
        lo = max(0, i - k // 2)
        hi = min(len(values), i + k // 2 + 1)
        window = values[lo:hi]
        out.append(sum(window) / len(window))
    return out


def area_path(values):
    if not values:
        return ""
    vals = smooth(values)
    top = max(vals) or 1
    n = len(vals)
    span = W - 2 * PAD
    pts = []
    for i, v in enumerate(vals):
        x = PAD + span * i / (n - 1)
        y = GRAPH_BOTTOM - (v / top) * (GRAPH_BOTTOM - GRAPH_TOP)
        pts.append("%.2f,%.2f" % (x, y))
    line = "M" + " L".join(pts)
    return line + " L%.2f,%.2f L%.2f,%.2f Z" % (
        PAD + span,
        GRAPH_BOTTOM,
        PAD,
        GRAPH_BOTTOM,
    )


def render(total, active, best, days, fg, dim, fill):
    mono = "ui-monospace,SFMono-Regular,Menlo,Consolas,monospace"
    path = area_path(days)
    return f"""<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}" role="img" aria-label="contribution activity">
<g font-family="{mono}">
<text x="{PAD}" y="62" font-size="42" font-weight="700" fill="{fg}">{total}</text>
<text x="{PAD}" y="82" font-size="11" fill="{dim}">contributions in the last year</text>
<text x="{W - PAD}" y="44" font-size="18" font-weight="700" fill="{fg}" text-anchor="end">{active}</text>
<text x="{W - PAD}" y="60" font-size="10" fill="{dim}" text-anchor="end">active days</text>
<text x="{W - PAD}" y="84" font-size="18" font-weight="700" fill="{fg}" text-anchor="end">{best}</text>
<text x="{W - PAD}" y="100" font-size="10" fill="{dim}" text-anchor="end">best week</text>
</g>
<path d="{path}" fill="{fill}" stroke="{fg}" stroke-width="1.1" stroke-linejoin="round"/>
</svg>"""


CELL = 11
GAP = 3
TOP = 22


def calendar_svg(weeks, fg, dim):
    counts = [d["contributionCount"] for w in weeks for d in w["contributionDays"]]
    peak = max(counts) if counts else 1
    steps = [0.10, 0.30, 0.50, 0.72, 1.0]

    cells = []
    labels = []
    seen = set()
    for wi, week in enumerate(weeks):
        x = wi * (CELL + GAP)
        for day in week["contributionDays"]:
            d = datetime.date.fromisoformat(day["date"])
            row = (d.weekday() + 1) % 7
            y = TOP + row * (CELL + GAP)
            c = day["contributionCount"]
            if c == 0:
                op = steps[0]
            else:
                q = c / peak
                if q <= 0.15:
                    op = steps[1]
                elif q <= 0.35:
                    op = steps[2]
                elif q <= 0.65:
                    op = steps[3]
                else:
                    op = steps[4]
            cells.append(
                '<rect x="%d" y="%d" width="%d" height="%d" rx="2.5" fill="%s" opacity="%.2f"/>'
                % (x, y, CELL, CELL, fg, op)
            )
            if d.day <= 7 and d.strftime("%b") not in seen:
                seen.add(d.strftime("%b"))
                labels.append(
                    '<text x="%d" y="14" font-size="9" fill="%s">%s</text>'
                    % (x, dim, d.strftime("%b").lower())
                )

    w = len(weeks) * (CELL + GAP)
    h = TOP + 7 * (CELL + GAP) + 26
    legend_x = w - 150
    ly = h - 8
    legend = ['<text x="%d" y="%d" font-size="9" fill="%s">less</text>' % (legend_x, ly, dim)]
    for i, op in enumerate(steps):
        legend.append(
            '<rect x="%d" y="%d" width="%d" height="%d" rx="2.5" fill="%s" opacity="%.2f"/>'
            % (legend_x + 32 + i * (CELL + 3), ly - 9, CELL, CELL, fg, op)
        )
    legend.append(
        '<text x="%d" y="%d" font-size="9" fill="%s">more</text>'
        % (legend_x + 32 + 5 * (CELL + 3) + 4, ly, dim)
    )

    mono = "ui-monospace,SFMono-Regular,Menlo,Consolas,monospace"
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" width="%d" height="%d" viewBox="0 0 %d %d" '
        'role="img" aria-label="contribution calendar"><g font-family="%s">%s%s%s</g></svg>'
    ) % (w, h, w, h, mono, "".join(labels), "".join(cells), "".join(legend))


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--user", default=os.environ.get("GH_USER", ""))
    p.add_argument("--outdir", default="assets")
    p.add_argument("--demo", action="store_true")
    a = p.parse_args()

    if a.demo:
        cal = demo_calendar()
    else:
        token = os.environ.get("GH_TOKEN", "")
        if not token or not a.user:
            raise SystemExit("set GH_TOKEN and GH_USER, or pass --demo")
        cal = fetch(a.user, token)

    total, active, best, days = summarize(cal)
    out = Path(a.outdir)
    out.mkdir(parents=True, exist_ok=True)
    (out / "contributions-dark.svg").write_text(
        render(total, active, best, days, "#C9D1D9", "#8B949E", "rgba(201,209,217,0.10)"),
        encoding="utf-8",
    )
    (out / "contributions-light.svg").write_text(
        render(total, active, best, days, "#24292F", "#57606A", "rgba(36,41,47,0.08)"),
        encoding="utf-8",
    )
    (out / "calendar-dark.svg").write_text(
        calendar_svg(cal["weeks"], "#C9D1D9", "#8B949E"), encoding="utf-8"
    )
    (out / "calendar-light.svg").write_text(
        calendar_svg(cal["weeks"], "#24292F", "#57606A"), encoding="utf-8"
    )
    print("total:", total, "active:", active, "best week:", best)


if __name__ == "__main__":
    main()
