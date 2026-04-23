<#
.SYNOPSIS
    Runs the full Playwright chromium project HEADED and produces ONE
    continuous MP4 of the BROWSER WINDOW ONLY, with Arabic captions
    burned in that explain what each test is doing.

.DESCRIPTION
    Pipeline (revised 2026-04-20 — captions added):

      1. Wipe stale per-test videos under e2e/.artifacts/test-results/.
      2. Run the chromium project HEADED with `video: 'on'` (full 1440x900
         per playwright-headed-live.config.ts) AND `--reporter=line,json`
         so we capture an authoritative test->video map.
      3. Parse the JSON report to map each per-test video.webm → the test
         title (plus its parent spec/describe block).
      4. Probe the duration of every per-test webm with ffprobe, build a
         cumulative timeline, and emit an SRT file (one cue per clip)
         with an Arabic caption: "يجري اختبار: <title> | <spec file>".
      5. Concat all clips with ffmpeg's concat demuxer and BURN the SRT
         in via the `subtitles=` filter (libass — handles Arabic shaping
         and RTL correctly; ffmpeg's drawtext does NOT).

    Output:
      frontend/e2e/.artifacts/live-run/full-run-<timestamp>.mp4
      frontend/e2e/.artifacts/live-run/results-<timestamp>.json
      frontend/e2e/.artifacts/live-run/concat-<timestamp>.txt
      frontend/e2e/.artifacts/live-run/captions-<timestamp>.srt
      frontend/e2e/.artifacts/live-run/concat-<timestamp>.log

    Pre-conditions:
      - Backend running on http://localhost:8080 (V25 seed applied).
      - Vite dev server is auto-started by playwright config.
      - ffmpeg + ffprobe installed (winget install Gyan.FFmpeg).
#>

[CmdletBinding()]
param(
    [string]$OutDir = ''
)

$ErrorActionPreference = 'Stop'

# ---- Resolve paths ----------------------------------------------------------
$scriptDir   = Split-Path -Parent $MyInvocation.MyCommand.Path
$frontendDir = Resolve-Path (Join-Path $scriptDir '..\frontend')
if (-not $OutDir -or $OutDir -eq '') {
    $OutDir = Join-Path $frontendDir 'e2e\.artifacts\live-run'
}
$testResultsDir = Join-Path $frontendDir 'e2e\.artifacts\test-results'

# ---- Resolve ffmpeg + ffprobe ----------------------------------------------
function Resolve-Tool([string]$name) {
    $cmd = Get-Command $name -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    $hit = Get-ChildItem "$env:LOCALAPPDATA\Microsoft\WinGet\Packages\Gyan.FFmpeg*" `
        -Recurse -Filter "$name.exe" -ErrorAction SilentlyContinue |
        Select-Object -First 1 -ExpandProperty FullName
    return $hit
}
$ffmpeg  = Resolve-Tool 'ffmpeg'
$ffprobe = Resolve-Tool 'ffprobe'
if (-not $ffmpeg)  { throw "ffmpeg.exe not found.  winget install Gyan.FFmpeg" }
if (-not $ffprobe) { throw "ffprobe.exe not found. winget install Gyan.FFmpeg" }
Write-Host "[live-video] ffmpeg  : $ffmpeg"  -ForegroundColor Cyan
Write-Host "[live-video] ffprobe : $ffprobe" -ForegroundColor Cyan

# ---- Output paths -----------------------------------------------------------
$null = New-Item -ItemType Directory -Force -Path $OutDir
$stamp     = Get-Date -Format 'yyyyMMdd-HHmmss'
$videoPath = Join-Path $OutDir "full-run-$stamp.mp4"
$concatLog = Join-Path $OutDir "concat-$stamp.log"
$listPath  = Join-Path $OutDir "concat-$stamp.txt"
$assPath   = Join-Path $OutDir "captions-$stamp.ass"
$jsonPath  = Join-Path $OutDir "results-$stamp.json"
Write-Host "[live-video] output  : $videoPath" -ForegroundColor Cyan

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

Push-Location $frontendDir
try {
    # ---- Wipe stale per-test videos ----------------------------------------
    if (Test-Path $testResultsDir) {
        Write-Host "[live-video] cleaning stale per-test videos..." -ForegroundColor DarkGray
        Get-ChildItem $testResultsDir -Recurse -Filter 'video.webm' -ErrorAction SilentlyContinue |
            Remove-Item -Force -ErrorAction SilentlyContinue
    }

    # ---- Run Playwright (headed) with line + json reporters ----------------
    # JSON reporter writes its file to the path in PLAYWRIGHT_JSON_OUTPUT_NAME.
    # Passing --reporter on the CLI overrides the config's reporter array;
    # 'line' keeps the live console UX, 'json' gives us the test->video map.
    $env:PLAYWRIGHT_JSON_OUTPUT_NAME = $jsonPath
    Write-Host "[live-video] running playwright (chromium, headed)..." -ForegroundColor Yellow
    $exitCode = 0
    try {
        # NOTE: '--reporter=line,json' MUST be a single quoted string. If
        # left unquoted, PowerShell parses the comma as the array-literal
        # operator and passes two separate args, which Playwright then
        # joins with a space and fails with "Cannot find module 'line json'".
        & npx playwright test `
            --project=chromium `
            --config=playwright-headed-live.config.ts `
            '--reporter=line,json'
        $exitCode = $LASTEXITCODE
    } catch {
        $exitCode = 1
        Write-Host "[live-video] playwright invocation threw: $_" -ForegroundColor Red
    }
    Write-Host "[live-video] playwright exit code: $exitCode" -ForegroundColor Cyan

    # ---- Collect per-test videos in execution order ------------------------
    $videos = @()
    if (Test-Path $testResultsDir) {
        $videos = Get-ChildItem $testResultsDir -Recurse -Filter 'video.webm' -ErrorAction SilentlyContinue |
            Sort-Object LastWriteTime
    }
    Write-Host "[live-video] collected $($videos.Count) per-test video(s)." -ForegroundColor Cyan
    if ($videos.Count -eq 0) {
        Write-Host "[live-video] WARNING: no per-test videos found." -ForegroundColor Red
        exit $exitCode
    }

    # ---- Build path -> test-title map from Playwright JSON -----------------
    $titleMap = @{}     # key: lowercase full path of video.webm   value: caption string
    $specMap  = @{}     # key: lowercase full path of video.webm   value: spec file basename
    if (Test-Path $jsonPath) {
        try {
            $json = Get-Content $jsonPath -Raw -Encoding UTF8 | ConvertFrom-Json
            $stack = New-Object System.Collections.Stack
            $stack.Push(@{ node = $json; parents = @() })
            while ($stack.Count -gt 0) {
                $cur = $stack.Pop()
                $node = $cur.node
                $parents = $cur.parents
                if ($node.specs) {
                    foreach ($spec in $node.specs) {
                        $specFile = if ($spec.file) { Split-Path -Leaf $spec.file } else { '' }
                        foreach ($t in $spec.tests) {
                            foreach ($r in $t.results) {
                                if ($r.attachments) {
                                    foreach ($a in $r.attachments) {
                                        if ($a.name -eq 'video' -and $a.path) {
                                            try {
                                                $abs = (Resolve-Path -LiteralPath $a.path -ErrorAction Stop).Path
                                                $key = $abs.ToLower()
                                                # Build a readable Arabic caption: title (+ describe parents).
                                                $titleChain = @()
                                                if ($parents -and $parents.Count -gt 0) {
                                                    $titleChain += ($parents | Where-Object { $_ -and $_.Trim() -ne '' })
                                                }
                                                $titleChain += $spec.title
                                                $title = ($titleChain -join ' ‹ ')
                                                $titleMap[$key] = $title
                                                $specMap[$key]  = $specFile
                                            } catch { }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
                if ($node.suites) {
                    foreach ($child in $node.suites) {
                        $childTitle = if ($child.title) { $child.title } else { '' }
                        $newParents = @($parents) + @($childTitle)
                        $stack.Push(@{ node = $child; parents = $newParents })
                    }
                }
            }
        } catch {
            Write-Host "[live-video] WARNING: could not parse JSON report: $_" -ForegroundColor Yellow
        }
    }
    Write-Host "[live-video] mapped $($titleMap.Count) videos to test titles." -ForegroundColor Cyan

    # ---- Probe each video's duration ---------------------------------------
    $durations = New-Object System.Collections.ArrayList
    foreach ($v in $videos) {
        $d = & $ffprobe -v error -select_streams v:0 -show_entries format=duration `
            -of default=nw=1:nk=1 -- $v.FullName
        $secs = 0.0
        [double]::TryParse(($d | Select-Object -First 1), [System.Globalization.NumberStyles]::Float,
                           [System.Globalization.CultureInfo]::InvariantCulture, [ref]$secs) | Out-Null
        if ($secs -le 0) { $secs = 1.0 }   # safety floor
        [void]$durations.Add($secs)
    }

    # ---- Build the ffmpeg concat-demuxer list ------------------------------
    $sb = New-Object System.Text.StringBuilder
    foreach ($v in $videos) {
        $p = $v.FullName -replace '\\','/'
        $p = $p -replace "'", "'\''"
        [void]$sb.AppendLine("file '$p'")
    }
    [System.IO.File]::WriteAllText($listPath, $sb.ToString(), $utf8NoBom)

    # ---- Customer-friendly Arabic captions --------------------------------
    # The live-video config now runs ONLY blueprint-journey.spec.ts which
    # walks ONE case through every role of the system, matching the final
    # Arabic blueprint exactly. Each stage's leaf title is in Arabic
    # already (sentence form, no jargon, no spec/file/role-code names),
    # so we just pass it through. The map below is kept as an OPTIONAL
    # override hook in case we want to refine wording without editing
    # the spec file. Anything not mapped falls back to the leaf title
    # verbatim — which IS the customer caption.
    $friendlyTitle = @{
        # No overrides today — the spec already uses customer-friendly Arabic.
        # Add entries here only if you want to rewrite a caption without
        # touching the spec source.
    }
    # Single, neutral group label shown on caption line 2.
    $friendlyGroup = @{
        'blueprint-journey.spec.ts' = 'رحلة دعوى عبر جميع الأدوار — المخطط النهائي'
    }

    # ---- Build the ASS caption file ---------------------------------------
    # We use ASS (libass native) instead of SRT so we can pin:
    #   - FontName=Tahoma  (always installed on Windows + full Arabic glyphs).
    #   - Encoding=178     (ANSI Arabic codepage; helps libass pick the right
    #                       glyph table on Windows when fontconfig is absent).
    #   - BorderStyle=3    (opaque box behind text → readable on any UI).
    #   - PlayResX/Y matching the video so font metrics scale 1:1.
    function Format-AssTime([double]$secs) {
        if ($secs -lt 0) { $secs = 0 }
        $ts = [TimeSpan]::FromSeconds($secs)
        $h  = [int][Math]::Floor($ts.TotalHours)
        $cs = [int][Math]::Floor($ts.Milliseconds / 10)
        return ('{0}:{1:D2}:{2:D2}.{3:D2}' -f $h, $ts.Minutes, $ts.Seconds, $cs)
    }
    function Escape-AssText([string]$s) {
        if (-not $s) { return '' }
        # ASS line break is "\N"; we want a real newline between line1/line2.
        # Also strip any bare CR/LF in titles to keep the dialogue line valid.
        return ($s -replace "`r","" -replace "`n",' ')
    }

    $assSb = New-Object System.Text.StringBuilder
    [void]$assSb.AppendLine('[Script Info]')
    [void]$assSb.AppendLine('ScriptType: v4.00+')
    [void]$assSb.AppendLine('PlayResX: 1440')
    [void]$assSb.AppendLine('PlayResY: 900')
    [void]$assSb.AppendLine('WrapStyle: 0')
    [void]$assSb.AppendLine('ScaledBorderAndShadow: yes')
    [void]$assSb.AppendLine('YCbCr Matrix: TV.709')
    [void]$assSb.AppendLine('')
    [void]$assSb.AppendLine('[V4+ Styles]')
    [void]$assSb.AppendLine('Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding')
    # Encoding=178 = ANSI Arabic. Bold=1 for crisp UI screencast readability.
    [void]$assSb.AppendLine('Style: Default,Tahoma,28,&H00FFFFFF,&H000000FF,&H00000000,&HB0000000,1,0,0,0,100,100,0,0,3,3,0,2,40,40,40,178')
    [void]$assSb.AppendLine('')
    [void]$assSb.AppendLine('[Events]')
    [void]$assSb.AppendLine('Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text')

    $cursor = 0.0
    for ($i = 0; $i -lt $videos.Count; $i++) {
        $key = $videos[$i].FullName.ToLower()
        $rawTitle = if ($titleMap.ContainsKey($key)) { $titleMap[$key] } else { $videos[$i].Directory.Name }
        $rawSpec  = if ($specMap.ContainsKey($key))  { $specMap[$key] }  else { '' }

        # Leaf title = last segment of "describe1 ‹ describe2 ‹ leaf".
        $leaf = ($rawTitle -split ' ‹ ')[-1].Trim()

        # Translate to customer-friendly Arabic; fall back to leaf so we
        # can spot any unmapped tests in the next render.
        $title = if ($friendlyTitle.ContainsKey($leaf)) { $friendlyTitle[$leaf] } else { $leaf }
        $group = if ($friendlyGroup.ContainsKey($rawSpec)) { $friendlyGroup[$rawSpec] } else { '' }

        $start = $cursor
        $end   = $cursor + $durations[$i] - 0.05
        if ($end -le $start) { $end = $start + 0.5 }

        $line1 = Escape-AssText $title
        $line2 = if ($group) { Escape-AssText $group } else { '' }
        $text  = if ($line2) { "$line1\N$line2" } else { $line1 }

        $dialogue = 'Dialogue: 0,{0},{1},Default,,0,0,0,,{2}' -f `
            (Format-AssTime $start), (Format-AssTime $end), $text
        [void]$assSb.AppendLine($dialogue)

        $cursor += $durations[$i]
    }
    [System.IO.File]::WriteAllText($assPath, $assSb.ToString(), $utf8NoBom)
    Write-Host "[live-video] ASS written: $assPath" -ForegroundColor DarkGray

    # ---- Stitch + burn captions into a single MP4 --------------------------
    # The subtitles filter's `filename=` argument needs forward slashes AND
    # an escaped colon (`C\:/...`) on Windows; commas in the path would
    # break filter parsing so we wrap each value in single quotes.
    #
    # CRITICAL for Arabic readability:
    #   `fontsdir` MUST point at C:/Windows/Fonts. Without it, libass on
    #   Windows can't find Tahoma (no fontconfig in the bundled Gyan build)
    #   and silently falls back to a font that lacks Arabic glyphs — every
    #   Arabic codepoint then renders as a "tofu" box (which is exactly
    #   what we observed before this change).
    $assForFilter = ($assPath -replace '\\','/') -replace ':', '\:'
    $fontsForFilter = ('C:/Windows/Fonts' -replace ':', '\:')
    $vf = "subtitles=filename='$assForFilter':fontsdir='$fontsForFilter',setsar=1,fps=25"

    Write-Host "[live-video] concatenating $($videos.Count) clips with Arabic captions..." -ForegroundColor Yellow
    $ffArgs = @(
        '-y',
        '-hide_banner',
        '-loglevel', 'error',
        '-f', 'concat',
        '-safe', '0',
        '-i', $listPath,
        '-vf', $vf,
        '-c:v', 'libx264',
        '-preset', 'medium',
        '-tune', 'stillimage',
        '-crf', '18',
        '-pix_fmt', 'yuv420p',
        '-movflags', '+faststart',
        $videoPath
    )
    & $ffmpeg @ffArgs 2>&1 | Tee-Object -FilePath $concatLog | Out-Host
    $ffExit = $LASTEXITCODE
    if ($ffExit -ne 0) {
        Write-Host "[live-video] ffmpeg concat failed (exit $ffExit). See $concatLog" -ForegroundColor Red
    }
}
finally {
    Pop-Location
}

if (Test-Path $videoPath) {
    $sizeMB = [Math]::Round((Get-Item $videoPath).Length / 1MB, 1)
    Write-Host ""
    Write-Host "[live-video] DONE" -ForegroundColor Green
    Write-Host "[live-video] video      : $videoPath ($sizeMB MB)" -ForegroundColor Green
    Write-Host "[live-video] captions   : $assPath" -ForegroundColor DarkGray
    Write-Host "[live-video] clips list : $listPath" -ForegroundColor DarkGray
    Write-Host "[live-video] json report: $jsonPath" -ForegroundColor DarkGray
    Write-Host "[live-video] ffmpeg log : $concatLog" -ForegroundColor DarkGray
} else {
    Write-Host "[live-video] WARNING: final MP4 was not produced. See $concatLog" -ForegroundColor Red
}

exit $exitCode










