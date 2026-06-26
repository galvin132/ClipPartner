param(
  [string]$Config = "workers/api/wrangler.toml",
  [string]$DotEnv = ".env.local",
  [string]$R2AccountId = "64264c4d87edeb5f9669a3194ffbcc79"
)

$ErrorActionPreference = "Stop"

function Import-DotEnv {
  param([string]$Path)

  if (-not (Test-Path $Path)) {
    return
  }

  Get-Content $Path | ForEach-Object {
    $line = $_.Trim()
    if ($line.Length -eq 0 -or $line.StartsWith("#") -or -not $line.Contains("=")) {
      return
    }

    $parts = $line.Split("=", 2)
    $name = $parts[0].Trim()
    $value = $parts[1].Trim()
    if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
      $value = $value.Substring(1, $value.Length - 2)
    }

    if (-not [string]::IsNullOrWhiteSpace($name) -and [string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable($name))) {
      [Environment]::SetEnvironmentVariable($name, $value, "Process")
    }
  }
}

function Read-SecretValue {
  param([string]$Name)

  $existing = [Environment]::GetEnvironmentVariable($Name)
  if (-not [string]::IsNullOrWhiteSpace($existing)) {
    return $existing
  }

  $secure = Read-Host "Enter $Name" -AsSecureString
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try {
    return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
  }
  finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
  }
}

Import-DotEnv $DotEnv

$secrets = [ordered]@{
  R2_ACCOUNT_ID = $R2AccountId
  R2_ACCESS_KEY_ID = Read-SecretValue "R2_ACCESS_KEY_ID"
  R2_SECRET_ACCESS_KEY = Read-SecretValue "R2_SECRET_ACCESS_KEY"
}

$serviceRole = [Environment]::GetEnvironmentVariable("SUPABASE_SERVICE_ROLE_KEY")
if (-not [string]::IsNullOrWhiteSpace($serviceRole)) {
  $secrets["SUPABASE_SERVICE_ROLE_KEY"] = $serviceRole
}
else {
  Write-Host "SUPABASE_SERVICE_ROLE_KEY not found in environment; keeping the existing Worker secret if present."
}

$betterAuthSecret = [Environment]::GetEnvironmentVariable("BETTER_AUTH_SECRET")
if (-not [string]::IsNullOrWhiteSpace($betterAuthSecret)) {
  $secrets["BETTER_AUTH_SECRET"] = $betterAuthSecret
}
else {
  Write-Host "BETTER_AUTH_SECRET not found in environment; keeping the existing Worker secret if present."
}

$configEncryptionKey = [Environment]::GetEnvironmentVariable("CONFIG_ENCRYPTION_KEY")
if (-not [string]::IsNullOrWhiteSpace($configEncryptionKey)) {
  $secrets["CONFIG_ENCRYPTION_KEY"] = $configEncryptionKey
}
else {
  Write-Host "CONFIG_ENCRYPTION_KEY not found in environment; keeping the existing Worker secret if present."
}

$wrangler = Join-Path (Get-Location) "node_modules/.bin/wrangler.cmd"
$secretFile = Join-Path ([System.IO.Path]::GetTempPath()) ("clip-partner-worker-secrets-" + [guid]::NewGuid().ToString("N") + ".json")
try {
  $secrets | ConvertTo-Json | Set-Content -LiteralPath $secretFile -Encoding UTF8
  if (Test-Path $wrangler) {
    & $wrangler secret bulk $secretFile --config $Config
    & $wrangler secret list --config $Config
  }
  else {
    npx.cmd wrangler secret bulk $secretFile --config $Config
    npx.cmd wrangler secret list --config $Config
  }
}
finally {
  if (Test-Path $secretFile) {
    Remove-Item -LiteralPath $secretFile -Force
  }
}
