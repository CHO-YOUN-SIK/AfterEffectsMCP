# CEP 디버그 모드 활성화 스크립트

Write-Host "CEP 디버그 모드 활성화 중..." -ForegroundColor Yellow

# 레지스트리 경로
$regPath = "HKEY_CURRENT_USER\Software\Adobe\CSXS.11"
$regName = "PlayerDebugMode"
$regValue = "1"

try {
    # 레지스트리 키가 없으면 생성
    if (!(Test-Path "HKCU:\Software\Adobe\CSXS.11")) {
        New-Item -Path "HKCU:\Software\Adobe" -Name "CSXS.11" -Force | Out-Null
    }
    
    # PlayerDebugMode 설정
    Set-ItemProperty -Path "HKCU:\Software\Adobe\CSXS.11" -Name "PlayerDebugMode" -Value "1" -Type String
    
    Write-Host "✅ 성공! CEP 디버그 모드가 활성화되었습니다." -ForegroundColor Green
    Write-Host ""
    Write-Host "이제 다음 단계를 진행하세요:" -ForegroundColor Cyan
    Write-Host "1. After Effects를 완전히 종료" -ForegroundColor White
    Write-Host "2. After Effects를 다시 실행" -ForegroundColor White  
    Write-Host "3. 패널을 연 상태에서 우클릭 → 'Debug' 메뉴 확인" -ForegroundColor White
    Write-Host ""
    
} catch {
    Write-Host "❌ 오류: $_" -ForegroundColor Red
}

Read-Host "Press Enter to exit"
