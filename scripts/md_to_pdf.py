#!/usr/bin/env python3
"""
Convert a Markdown file (Arabic-friendly, RTL) to PDF using:
  1. python-markdown → HTML with GitHub-like styling
  2. Microsoft Edge (or Chrome) in headless mode → PDF

Usage:  python md_to_pdf.py <input.md> <output.pdf>
"""
import sys
import pathlib
import subprocess
import tempfile
import markdown

HTML_TEMPLATE = """<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<title>{title}</title>
<style>
  @page {{
    size: A4;
    margin: 22mm 18mm 22mm 18mm;
  }}
  html, body {{
    direction: rtl;
    font-family: "Segoe UI", "Tahoma", "Arial Unicode MS", "Arial", sans-serif;
    font-size: 11pt;
    line-height: 1.75;
    color: #1f2328;
    background: #fff;
    margin: 0;
    padding: 0;
    text-align: right;
    unicode-bidi: plaintext;
  }}
  .container {{
    max-width: 170mm;
    margin: 0 auto;
  }}
  h1, h2, h3, h4, h5, h6 {{
    margin-top: 1.3em;
    margin-bottom: 0.6em;
    font-weight: 700;
    color: #11325a;
    page-break-after: avoid;
  }}
  h1 {{ font-size: 20pt; border-bottom: 2px solid #11325a; padding-bottom: 0.25em; }}
  h2 {{ font-size: 16pt; border-bottom: 1px solid #d0d7de; padding-bottom: 0.2em; }}
  h3 {{ font-size: 13pt; }}
  h4 {{ font-size: 12pt; color: #444; }}
  p, ul, ol {{ margin: 0.5em 0 0.9em 0; }}
  ul, ol {{ padding-right: 1.8em; padding-left: 0; }}
  li {{ margin-bottom: 0.3em; }}
  code {{
    font-family: "Consolas", "Courier New", monospace;
    background: #eef1f4;
    padding: 1px 5px;
    border-radius: 3px;
    font-size: 90%;
    direction: ltr;
    unicode-bidi: embed;
    display: inline-block;
  }}
  pre {{
    background: #f3f5f8;
    border: 1px solid #d0d7de;
    border-radius: 6px;
    padding: 10px 14px;
    overflow-x: auto;
    direction: ltr;
    text-align: left;
    font-family: "Consolas", "Courier New", monospace;
    font-size: 9.5pt;
    line-height: 1.5;
  }}
  pre code {{ background: transparent; padding: 0; border: 0; display: block; }}
  blockquote {{
    border-right: 4px solid #11325a;
    border-left: none;
    background: #f6f8fa;
    margin: 0.8em 0;
    padding: 0.5em 1em;
    color: #424a53;
  }}
  table {{
    border-collapse: collapse;
    width: 100%;
    margin: 0.8em 0;
    page-break-inside: avoid;
  }}
  th, td {{
    border: 1px solid #d0d7de;
    padding: 6px 10px;
    text-align: right;
    vertical-align: top;
  }}
  th {{
    background: #eef3fa;
    font-weight: 700;
    color: #11325a;
  }}
  tr:nth-child(even) td {{ background: #fafbfc; }}
  hr {{
    border: 0;
    border-top: 1px solid #d0d7de;
    margin: 1.4em 0;
  }}
  a {{ color: #0969da; }}
  strong {{ color: #11325a; }}
  /* English tokens / technical values should render LTR even inside Arabic lines */
  code, pre {{ unicode-bidi: embed; }}
  /* Make emoji visible without fallback squares */
  .emoji {{ font-family: "Segoe UI Emoji", "Segoe UI Symbol", sans-serif; }}
</style>
</head>
<body>
<div class="container">
{content}
</div>
</body>
</html>
"""


def find_edge():
    candidates = [
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    ]
    for c in candidates:
        if pathlib.Path(c).exists():
            return c
    raise SystemExit("No Edge/Chrome found — needed for headless PDF render.")


def main(md_path, pdf_path):
    md_text = pathlib.Path(md_path).read_text(encoding="utf-8")
    html_body = markdown.markdown(
        md_text,
        extensions=["tables", "fenced_code", "toc", "sane_lists"],
    )
    title = pathlib.Path(md_path).stem

    # Save HTML to a temp file next to the PDF (so file:// URL works on Windows)
    with tempfile.NamedTemporaryFile(
        "w", encoding="utf-8", suffix=".html", delete=False
    ) as f:
        f.write(HTML_TEMPLATE.format(title=title, content=html_body))
        html_path = f.name

    browser = find_edge()
    pdf_abs = pathlib.Path(pdf_path).resolve()
    html_abs = pathlib.Path(html_path).resolve()
    # Convert Windows path → file:// URL
    html_url = "file:///" + str(html_abs).replace("\\", "/")

    cmd = [
        browser,
        "--headless=new",
        "--disable-gpu",
        "--no-pdf-header-footer",
        f"--print-to-pdf={pdf_abs}",
        html_url,
    ]
    print(f"Rendering: {md_path} -> {pdf_path}")
    print(f"  via: {pathlib.Path(browser).name}")
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
    if result.returncode != 0:
        print("STDERR:", result.stderr[:1000])
        raise SystemExit(f"Browser exited with {result.returncode}")

    if not pdf_abs.exists():
        raise SystemExit("PDF was not produced. Check browser output above.")
    size = pdf_abs.stat().st_size
    print(f"OK Wrote {pdf_abs}  ({size:,} bytes)")
    # Clean up intermediate HTML
    try:
        pathlib.Path(html_path).unlink()
    except OSError:
        pass


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print(__doc__)
        sys.exit(1)
    main(sys.argv[1], sys.argv[2])
