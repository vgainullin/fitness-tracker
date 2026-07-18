#!/usr/bin/env python3
"""Render the pressing-strength dashboard as a dependency-free SVG."""

from datetime import date
from html import escape
from pathlib import Path


SERIES = [
    ("2026-03-14", 100.0, 100.3, 100.1, 0.667),
    ("2026-03-24", 98.6, 91.4, 94.9, 0.500),
    ("2026-04-04", 105.3, 100.0, 102.6, 0.667),
    ("2026-04-12", 106.0, 95.3, 100.5, 0.429),
    ("2026-04-25", 105.5, 98.2, 101.8, 0.500),
    ("2026-05-17", 101.2, 93.8, 97.4, 0.571),
    ("2026-05-30", 101.4, 92.8, 97.0, 0.500),
    ("2026-06-14", 103.1, 98.5, 100.8, 0.667),
    ("2026-06-27", 94.7, 105.6, 100.0, 0.333),
    ("2026-07-08", 101.4, 101.6, 101.5, 0.167),
]

COLORS = {"bench": "#f0a84b", "incline": "#58a6ff", "combined": "#77d98b"}


def txt(x, y, value, size=14, fill="#929daa", anchor="start", weight=400):
    return (
        f'<text x="{x}" y="{y}" fill="{fill}" font-size="{size}" '
        f'font-weight="{weight}" text-anchor="{anchor}">{escape(str(value))}</text>'
    )


def hard_color(value):
    a, b = (245, 207, 102), (239, 106, 106)
    amount = max(0, min(1, (value - 0.3) / 0.6))
    rgb = tuple(round(left + (right - left) * amount) for left, right in zip(a, b))
    return f"rgb{rgb}"


def render():
    width, height = 1200, 860
    out = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}">',
        '<rect width="1200" height="860" fill="#0b0d10"/>',
        '<style>text{font-family:Inter,system-ui,-apple-system,sans-serif}.mono{font-family:ui-monospace,SFMono-Regular,monospace}</style>',
        txt(54, 42, "BARBELL BENCH + INCLINE DUMBBELL PRESS", 12, "#77d98b", weight=750),
        txt(54, 82, "Pressing strength is flat across the observed period.", 30, "#eef2f6", weight=750),
        txt(54, 110, "Normalized independently by movement · June 20 outlier removed · 65 working sets", 14),
    ]

    cards = [("CURRENT", "101.5", "+1.5% vs baseline"), ("PEAK GAP", "−1.1%", "combined capacity"), ("INTERVAL", "ρ .14", "permutation p = .72"), ("DOSE", "65", "31 bench + 34 incline")]
    for i, (label, value, detail) in enumerate(cards):
        x = 54 + i * 278
        out.append(f'<rect x="{x}" y="132" width="264" height="92" rx="12" fill="#12161b" stroke="#29313b"/>')
        out += [txt(x + 16, 156, label, 10, "#929daa", weight=700), txt(x + 16, 191, value, 25, "#eef2f6", weight=750), txt(x + 16, 211, detail, 11)]

    # Timeline chart.
    left, right, top, bottom = 62, 1142, 275, 530
    out += [txt(54, 260, "PRESSING CAPACITY OVER TIME", 15, "#eef2f6", weight=750)]
    dates = [date.fromisoformat(row[0]) for row in SERIES]
    first, last = dates[0].toordinal(), dates[-1].toordinal()
    x = lambda d: left + (d.toordinal() - first) / (last - first) * (right - left)
    y = lambda value: top + (108 - value) / 28 * (bottom - top)
    for level in (85, 90, 95, 100, 105):
        dash = ' stroke-dasharray="5 5"' if level == 100 else ""
        out += [f'<line x1="{left}" y1="{y(level):.1f}" x2="{right}" y2="{y(level):.1f}" stroke="#29313b"{dash}/>', txt(left - 10, y(level) + 4, level, 11, anchor="end")]
    for tick in ("2026-03-14", "2026-04-01", "2026-05-01", "2026-06-01", "2026-07-01"):
        day = date.fromisoformat(tick)
        out += [f'<line x1="{x(day):.1f}" y1="{top}" x2="{x(day):.1f}" y2="{bottom}" stroke="#202832"/>', txt(x(day), bottom + 25, day.strftime("%b %-d"), 11, anchor="middle")]
    for key, position in (("bench", 1), ("incline", 2), ("combined", 3)):
        points = " ".join(f"{x(day):.1f},{y(row[position]):.1f}" for day, row in zip(dates, SERIES))
        out.append(f'<polyline points="{points}" fill="none" stroke="{COLORS[key]}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>')
        for day, row in zip(dates, SERIES):
            out.append(f'<circle cx="{x(day):.1f}" cy="{y(row[position]):.1f}" r="{5 if key == "combined" else 4}" fill="{COLORS[key]}" stroke="#12161b" stroke-width="2"/>')
    legend_x = 760
    for i, (label, color) in enumerate((("Bench", COLORS["bench"]), ("Incline DB", COLORS["incline"]), ("Combined", COLORS["combined"]))):
        lx = legend_x + i * 125
        out += [f'<line x1="{lx}" y1="255" x2="{lx+20}" y2="255" stroke="{color}" stroke-width="3"/>', txt(lx + 27, 259, label, 11)]
    # Interval scatter chart.
    s_left, s_right, s_top, s_bottom = 62, 1142, 610, 816
    out += [txt(54, 588, "INTERVAL VS NEXT-SESSION RESPONSE", 15, "#eef2f6", weight=750), txt(1142, 588, "color = prior hard-set share", 11, anchor="end")]
    sx = lambda gap: s_left + (gap - 5) / 18 * (s_right - s_left)
    sy = lambda change: s_top + (15 - change) / 30 * (s_bottom - s_top)
    for level in (-10, -5, 0, 5, 10):
        dash = ' stroke-dasharray="5 5"' if level == 0 else ""
        out += [f'<line x1="{s_left}" y1="{sy(level):.1f}" x2="{s_right}" y2="{sy(level):.1f}" stroke="#29313b"{dash}/>', txt(s_left - 10, sy(level) + 4, f"{level:+d}%", 11, anchor="end")]
    for gap in range(6, 23, 2):
        out += [f'<line x1="{sx(gap):.1f}" y1="{s_top}" x2="{sx(gap):.1f}" y2="{s_bottom}" stroke="#202832"/>', txt(sx(gap), s_bottom + 25, gap, 11, anchor="middle")]
    out.append(txt((s_left + s_right) / 2, 850, "Days since prior shared pressing session", 11, anchor="middle"))
    for previous, current in zip(SERIES, SERIES[1:]):
        gap = (date.fromisoformat(current[0]) - date.fromisoformat(previous[0])).days
        change = (current[3] / previous[3] - 1) * 100
        out.append(f'<circle cx="{sx(gap):.1f}" cy="{sy(change):.1f}" r="7" fill="{hard_color(previous[4])}" stroke="#12161b" stroke-width="2"/>')
        if abs(change) > 10:
            out.append(txt(sx(gap) + 11, sy(change) + 4, date.fromisoformat(current[0]).strftime("%b %-d"), 10))
    out.append("</svg>")
    return "\n".join(out)


if __name__ == "__main__":
    output = Path(__file__).with_name("pressing-strength.svg")
    output.write_text(render(), encoding="utf-8")
    print(output)
