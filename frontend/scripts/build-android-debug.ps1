$ErrorActionPreference = 'Stop'

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$androidRoot = Join-Path $projectRoot 'android'
$gradleUserHome = Join-Path $androidRoot '.gradle-home'
$androidUserHome = Join-Path $androidRoot '.android-home'

function Get-JavaMajorVersion {
    param(
        [Parameter(Mandatory = $true)]
        [string]$JavaHome
    )

    $javaExe = Join-Path $JavaHome 'bin\java.exe'

    if (-not (Test-Path $javaExe)) {
        return $null
    }

    $previousErrorPreference = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'

    try {
        $versionOutput = & $javaExe -version 2>&1 | Out-String
    } finally {
        $ErrorActionPreference = $previousErrorPreference
    }

    if ($versionOutput -match 'version "([0-9]+)') {
        return [int]$Matches[1]
    }

    return $null
}

$candidateJavaHomes = @()

if ($env:JAVA_HOME) {
    $candidateJavaHomes += $env:JAVA_HOME
}

$candidateJavaHomes += 'C:\Program Files\Android\Android Studio\jbr'
$candidateJavaHomes += 'C:\Program Files\Android\Android Studio\jre'

$supportedJavaHome = $null

foreach ($candidate in ($candidateJavaHomes | Select-Object -Unique)) {
    $majorVersion = Get-JavaMajorVersion -JavaHome $candidate

    if ($null -eq $majorVersion) {
        continue
    }

    if ($majorVersion -eq 21) {
        $supportedJavaHome = $candidate
        break
    }
}

if (-not $supportedJavaHome) {
    throw 'No supported Java runtime was found. Install Android Studio or point JAVA_HOME to JDK 21 before building the Android app.'
}

$env:JAVA_HOME = $supportedJavaHome
$env:PATH = "$(Join-Path $supportedJavaHome 'bin');$env:PATH"
$env:GRADLE_USER_HOME = $gradleUserHome
$env:ANDROID_USER_HOME = $androidUserHome

if (Test-Path Env:ANDROID_SDK_HOME) {
    Remove-Item Env:ANDROID_SDK_HOME
}

if (-not (Test-Path $androidUserHome)) {
    New-Item -ItemType Directory -Path $androidUserHome | Out-Null
}

Write-Host "Using JAVA_HOME=$supportedJavaHome"
Write-Host "Using GRADLE_USER_HOME=$gradleUserHome"
Write-Host "Using ANDROID_USER_HOME=$androidUserHome"

Push-Location $androidRoot

try {
    & .\gradlew.bat assembleDebug
} finally {
    Pop-Location
}
