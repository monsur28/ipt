$body = @{
    url = "https://raw.githubusercontent.com/Free-TV/IPTV/master/playlist.m3u8"
    name = "Free-TV IPTV Sports"
} | ConvertTo-Json

$result = Invoke-RestMethod -Uri "http://localhost:8080/api/playlist/import" -Method POST -ContentType "application/json" -Body $body
$result | ConvertTo-Json -Depth 5
