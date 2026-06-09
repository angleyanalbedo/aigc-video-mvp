$images = @(
    "AB测试.png",
    "backend-startup.png",
    "guided-step-1.png",
    "guided-step-2.png",
    "guided-step-3.png",
    "multi-factor-analysis.png",
    "native-agent-canvas.png",
    "step-1-material-analysis.png",
    "step-2-script-planning.png",
    "step-3-scene-editor.png",
    "step-4-scene-rendering.png",
    "step-5-final-composite.png",
    "video-workbench-1.png",
    "video-workbench-2.png",
    "workbench-projects.png",
    "一键成片.png",
    "优质视频库.png",
    "合规审查.png",
    "多音字归因分析.png",
    "灵感模板库.png",
    "系统观测.png",
    "素材管理.png"
)

$folderToken = "E31cfagO6lsHmxdMniLcrSxan1d"
$results = @{}

foreach ($img in $images) {
    if (Test-Path $img) {
        Write-Host "上传中: $img"
        $output = npx @larksuite/cli drive +upload --file "./$img" --folder-token $folderToken --as user 2>&1
        
        try {
            $json = $output | ConvertFrom-Json -ErrorAction Stop
            if ($json.ok -and $json.data.file_token) {
                $results[$img] = $json.data.url
                Write-Host "✅ 成功: " $json.data.url
            } else {
                Write-Host "❌ 失败: $img"
                Write-Host $output
            }
        } catch {
            Write-Host "❌ 解析失败: $img"
            Write-Host $output
        }
    } else {
        Write-Host "⚠️ 文件不存在: $img"
    }
    Start-Sleep -Milliseconds 300
}

Write-Host "`n`n=== 上传完成，结果保存到 image-urls.json ==="
$results | ConvertTo-Json -Depth 10 | Out-File -FilePath "image-urls.json" -Encoding utf8
$results
