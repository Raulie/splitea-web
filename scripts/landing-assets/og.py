import json, re, subprocess, sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
BRICO = str(HERE / "brico-800-96.ttf")
MARK = str(HERE / "mark.png")
CAPTURES = Path(sys.argv[1])

if not Path(BRICO).exists():
    sys.exit("brico-800-96.ttf missing: run font.sh first")
if not Path(MARK).exists():
    subprocess.run(["magick", "-background", "none", "-density", "400", str(HERE / "mark.svg"), MARK], check=True)


def render(cfg):
    OUT = cfg["out"]
    SC = 2
    W, H = 1200 * SC, 630 * SC
    cream=(239,231,214); ink=(26,22,20); accent=(200,85,61); muted=(107,102,93); accent_ink=(181,72,47)
    im = Image.new("RGB", (W, H), cream); d = ImageDraw.Draw(im)
    cjk = cfg.get("cjk")
    def font(size):
        if cjk == "ja": return ImageFont.truetype("/System/Library/Fonts/ヒラギノ角ゴシック W8.ttc", size)
        if cjk == "ko": return ImageFont.truetype("/System/Library/Fonts/AppleSDGothicNeo.ttc", size, index=14)
        if cjk == "zh-Hans": return ImageFont.truetype("/System/Library/Fonts/Hiragino Sans GB.ttc", size, index=2)
        if cjk == "zh-Hant": return ImageFont.truetype("/System/Library/Fonts/STHeiti Medium.ttc", size, index=0)
        return ImageFont.truetype(BRICO, size)
    track_for = lambda size: 0 if cjk else -0.035 * size * SC
    def width_of(text, f, size):
        plain = re.sub(r"\[\[|\]\]", "", text)
        return sum(ImageDraw.Draw(Image.new("RGB", (1, 1))).textlength(ch, font=f) + track_for(size) for ch in plain)
    head_size = cfg.get("size", 84)
    while head_size > 44:
        f_try = font(head_size * SC)
        if max(width_of(t, f_try, head_size) for t in cfg["lines"]) <= 600 * SC:
            break
        head_size -= 2
    brico = font(head_size * SC)
    brico_word = ImageFont.truetype(BRICO, 34 * SC)
    mono = ImageFont.truetype("/System/Library/Fonts/Menlo.ttc", 17 * SC, index=1)
    sf = ImageFont.truetype("/System/Library/Fonts/SFNS.ttf", 22 * SC)
    pill_font = font(22 * SC) if cjk else sf
    x0 = 80 * SC
    mark = Image.open(MARK).convert("RGBA"); mh = 40 * SC
    mark = mark.resize((int(mark.width * mh / mark.height), mh), Image.LANCZOS)
    im.paste(mark, (x0, 92 * SC), mark)
    d.text((x0 + mark.width + 14 * SC, 92 * SC + mh / 2), "Splitea", font=brico_word, fill=ink, anchor="lm")
    track = track_for(head_size)
    def line(y, text):
        parts = re.split(r"(\[\[[^\]]+\]\])", text)
        x = x0
        for p in parts:
            if not p: continue
            col = accent if p.startswith("[[") else ink
            p = p[2:-2] if p.startswith("[[") else p
            for ch in p:
                d.text((x, y), ch, font=brico, fill=col)
                x += d.textlength(ch, font=brico) + track
        return x
    y1 = cfg.get("y1", 200) * SC
    lh = int(head_size * (1.18 if cjk else 1.02)) * SC
    for i, t in enumerate(cfg["lines"]):
        line(y1 + i * lh, t)
    ty = y1 + len(cfg["lines"]) * lh + 28 * SC
    tag_font = font(17 * SC) if cjk else mono
    x = x0
    for ch in cfg["tagline"].upper() if not cjk else cfg["tagline"]:
        d.text((x, ty), ch, font=tag_font, fill=muted); x += d.textlength(ch, font=tag_font) + (0.18 * 17 * SC if not cjk else 0.04 * 17 * SC)
    pw = 330 * SC; rail = pw * 0.018; bezel = pw * 0.0216
    fw = int(pw + 2 * (rail + bezel)); fh = int(pw * 874 / 402 + 2 * (rail + bezel))
    px = W - fw - 110 * SC; py = 150 * SC
    sh = Image.new("RGBA", (W, H), (0, 0, 0, 0)); sd = ImageDraw.Draw(sh)
    sd.rounded_rectangle([px + 10 * SC, py + 50 * SC, px + fw - 10 * SC, py + fh], radius=int(pw * 0.19), fill=(26, 22, 20, 110))
    sh = sh.filter(ImageFilter.GaussianBlur(30 * SC)); im.paste(sh, (0, 0), sh)
    frame = Image.new("RGBA", (fw, fh), (0, 0, 0, 0)); fd = ImageDraw.Draw(frame)
    r = pw * 0.15423
    fd.rounded_rectangle([0, 0, fw - 1, fh - 1], radius=int(r + bezel + rail), fill=(160, 162, 170))
    fd.rounded_rectangle([int(rail * .45), int(rail * .45), fw - 1 - int(rail * .45), fh - 1 - int(rail * .45)], radius=int(r + bezel + rail * .55), fill=(205, 207, 214))
    fd.rounded_rectangle([int(rail), int(rail), fw - 1 - int(rail), fh - 1 - int(rail)], radius=int(r + bezel), fill=(5, 6, 10))
    scr = Image.open(cfg["screen"]).convert("RGB"); sw = int(pw); shh = int(pw * 874 / 402)
    scr = scr.resize((sw, shh), Image.LANCZOS)
    mask = Image.new("L", (sw, shh), 0); ImageDraw.Draw(mask).rounded_rectangle([0, 0, sw - 1, shh - 1], radius=int(r), fill=255)
    frame.paste(scr, (int(rail + bezel), int(rail + bezel)), mask)
    iw = pw * 0.3119; ih = pw * 0.0912; ix = (fw - iw) / 2; iy = rail + bezel + pw * 0.0288
    fd.rounded_rectangle([ix, iy, ix + iw, iy + ih], radius=int(ih / 2), fill=(0, 0, 0))
    im.paste(frame, (int(px), int(py)), frame)
    def pill(anchor_x, y, n, text, side):
        tw = d.textlength(text, font=pill_font); h = 46 * SC; pl = 9 * SC; c = 28 * SC; g = 10 * SC; pr = 18 * SC
        w = pl + c + g + tw + pr
        x = anchor_x if side == "left" else anchor_x - w
        ps = Image.new("RGBA", (W, H), (0, 0, 0, 0)); psd = ImageDraw.Draw(ps)
        psd.rounded_rectangle([x, y + 8 * SC, x + w, y + h + 8 * SC], radius=int(h / 2), fill=(26, 22, 20, 60))
        ps = ps.filter(ImageFilter.GaussianBlur(12 * SC)); im.paste(ps, (0, 0), ps)
        d.rounded_rectangle([x, y, x + w, y + h], radius=int(h / 2), fill=(255, 255, 255))
        cx = x + pl + c / 2; cy = y + h / 2
        d.ellipse([cx - c / 2, cy - c / 2, cx + c / 2, cy + c / 2], fill=accent_ink)
        d.text((cx, cy), str(n), font=sf, fill=(255, 255, 255), anchor="mm")
        d.text((x + pl + c + g, cy), text, font=pill_font, fill=ink, anchor="lm")
    pill(px + fw + 34 * SC, py + fh * 0.335, 1, cfg["pills"][0], "right")
    pill(px - 44 * SC, py + fh * 0.505, 2, cfg["pills"][1], "left")
    im = im.resize((1200, 630), Image.LANCZOS)
    im.save(OUT, optimize=True)



for page in json.load(sys.stdin):
    seg = page["seg"]
    cjk = page["code"] if page["code"] in ("ja", "ko", "zh-Hans", "zh-Hant") else None
    render({
        "out": str(ROOT / "public" / "og" / f"splitea-{seg or 'en'}-v1-1200x630.png"),
        "lines": page["lines"],
        "pills": page["pills"],
        "tagline": page["tagline"],
        "screen": str(CAPTURES / (f"assign-{seg}.png" if seg else "assign.png")),
        "cjk": cjk,
    })
    print(f"wrote preview image for {seg or 'en'}")
