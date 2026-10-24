param([switch]$Release,[switch]$SkipFrontend,[switch]$Offline,[string]$TargetDirectory)
$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$appRoot = Join-Path $projectRoot 'apps\readest-app'
$buildTarget = if ($TargetDirectory) { [IO.Path]::GetFullPath($TargetDirectory) } else { Join-Path $projectRoot 'build\selection-public' }
$saved = @{}
foreach ($key in @('CARGO_TARGET_DIR','CARGO_BUILD_JOBS','NUM_JOBS','RAYON_NUM_THREADS','RUSTFLAGS','CARGO_ENCODED_RUSTFLAGS','READEST_DISABLE_UPDATER','SENTRY_DSN','NEXT_PUBLIC_APP_PLATFORM','NEXT_PUBLIC_PORTABLE_APP')) {
  $saved[$key] = [Environment]::GetEnvironmentVariable($key,'Process')
}
try {
  Remove-Item Env:CARGO_TARGET_DIR -ErrorAction SilentlyContinue
  $env:CARGO_BUILD_JOBS='1'; $env:NUM_JOBS='1'; $env:RAYON_NUM_THREADS='1'
  $env:READEST_DISABLE_UPDATER='1'; $env:SENTRY_DSN=''
  $env:NEXT_PUBLIC_APP_PLATFORM='tauri'; $env:NEXT_PUBLIC_PORTABLE_APP='1'
  if ($saved['RUSTFLAGS']) { throw 'Use a clean RUSTFLAGS environment for this reproducible experimental build' }
  $sourcePrefix=$projectRoot.Replace('\','/'); $profilePrefix=$env:USERPROFILE.Replace('\','/')
  $remap=@("--remap-path-prefix=$($env:USERPROFILE)=/user","--remap-path-prefix=$profilePrefix=/user","--remap-path-prefix=$projectRoot=/readest","--remap-path-prefix=$sourcePrefix=/readest")
  if ($env:CARGO_HOME) { $remap += @("--remap-path-prefix=$($env:CARGO_HOME)=/cargo","--remap-path-prefix=$($env:CARGO_HOME.Replace('\','/'))=/cargo") }
  $remap += @("--remap-path-prefix=$buildTarget=/build","--remap-path-prefix=$($buildTarget.Replace('\','/'))=/build",'-C','link-arg=/PDBALTPATH:%_PDB%')
  # Encoded flags preserve paths containing spaces; ordinary RUSTFLAGS does not.
  $env:CARGO_ENCODED_RUSTFLAGS=(@($saved['CARGO_ENCODED_RUSTFLAGS'])+$remap | Where-Object { $_ }) -join [char]31
  Push-Location $appRoot
  try {
    if (-not $SkipFrontend) {
      & pnpm build
      if ($LASTEXITCODE -ne 0) { throw 'Frontend build failed' }
    } elseif (-not (Test-Path 'out/index.html')) { throw 'No prebuilt frontend export exists' }
    $tauriArgs=@('node_modules/@tauri-apps/cli/tauri.js','build','--no-bundle','--target','x86_64-pc-windows-msvc','--config','../../experiments/windows-selection/tauri.conf.json')
    if (-not $Release) { $tauriArgs += @('--debug','--features','devtools') }
    $tauriArgs += @('--','--target-dir',$buildTarget)
    if ($Offline) { $tauriArgs += @('--offline','--locked') }
    & node @tauriArgs
    if ($LASTEXITCODE -ne 0) { throw 'Native build failed' }
  } finally { Pop-Location }
} finally {
  foreach ($key in $saved.Keys) { [Environment]::SetEnvironmentVariable($key,$saved[$key],'Process') }
}
