$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$sourceRoot = Join-Path $projectRoot "assets\generated\sprite_sheets\2026-09-22"
$outputRoot = Join-Path $projectRoot "assets\generated\normalized"
$frameSize = 320
$contentSize = 304
New-Item -ItemType Directory -Path $outputRoot -Force | Out-Null

$sheets = @(
  @{ Source = "player\grid-guide-player-sprite-sheet.png"; Output = "player-atlas.png" },
  @{ Source = "enemy\void-parasite-enemy-sprite-sheet.png"; Output = "enemy-atlas.png" },
  @{ Source = "vfx\block-puzzle-vfx-atlas.png"; Output = "vfx-atlas.png" }
)

foreach ($sheet in $sheets) {
  $sourcePath = Join-Path $sourceRoot $sheet.Source
  $source = [System.Drawing.Image]::FromFile($sourcePath)
  $atlas = [System.Drawing.Bitmap]::new(4 * $frameSize, 4 * $frameSize, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($atlas)
  try {
    $graphics.Clear([System.Drawing.Color]::Transparent)
    $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceOver
    $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

    for ($row = 0; $row -lt 4; $row++) {
      for ($column = 0; $column -lt 4; $column++) {
        $left = [int][Math]::Floor($column * $source.Width / 4)
        $top = [int][Math]::Floor($row * $source.Height / 4)
        $right = [int][Math]::Floor(($column + 1) * $source.Width / 4)
        $bottom = [int][Math]::Floor(($row + 1) * $source.Height / 4)
        $sourceRect = [System.Drawing.Rectangle]::new($left, $top, $right - $left, $bottom - $top)

        $scale = [Math]::Min($contentSize / $sourceRect.Width, $contentSize / $sourceRect.Height)
        $width = [int][Math]::Round($sourceRect.Width * $scale)
        $height = [int][Math]::Round($sourceRect.Height * $scale)
        $x = ($column * $frameSize) + [int][Math]::Floor(($frameSize - $width) / 2)
        $y = ($row * $frameSize) + [int][Math]::Floor(($frameSize - $height) / 2)
        $destinationRect = [System.Drawing.Rectangle]::new($x, $y, $width, $height)
        $graphics.DrawImage($source, $destinationRect, $sourceRect, [System.Drawing.GraphicsUnit]::Pixel)
      }
    }

    $outputPath = Join-Path $outputRoot $sheet.Output
    $atlas.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    Write-Output "$($sheet.Output): $($atlas.Width)×$($atlas.Height)"
  }
  finally {
    $graphics.Dispose()
    $atlas.Dispose()
    $source.Dispose()
  }
}
