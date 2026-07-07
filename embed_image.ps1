$dockerfile = "C:\Users\ge230\Documents\Homematic\SonnenBatterie\HCU_Plugin_Sonnenbattie\HCU_Plugin_Sonnenbatterie\Dockerfile"
$imageFile = "C:\Users\ge230\Documents\Homematic\SonnenBatterie\HCU_Plugin_Sonnenbatterie\image_datauri.txt"

$content = Get-Content $dockerfile -Raw
$imageUri = Get-Content $imageFile -Raw

$old = '"logsEnabled": true'
$new = '"image": "' + $imageUri + `",`r`n`t`"logsEnabled": true'

$result = $content.Replace($old, $new)
$result | Out-File -Encoding UTF8 $dockerfile -NoNewline

Write-Host "Dockerfile updated with embedded image"