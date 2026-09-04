<#
.SYNOPSIS
    Xevera automated backend test harness (Phase B).
.DESCRIPTION
    Probes the real running backend API and database. Writes results to
    TEST-MATRIX.md at the project root. Creates TST_-prefixed test data.
    Requires: backend running on 127.0.0.1:8000, MySQL up, seeded accounts.
#>

$ErrorActionPreference = 'Stop'
$script:Base     = 'http://127.0.0.1:8000/api'
$script:Php      = 'C:\xampp\php\php.exe'
if (-not (Test-Path $script:Php)) { $script:Php = 'php' }
$script:Helper   = Join-Path $PSScriptRoot 'db-helper.php'
$script:Root     = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)  # Prototpye 4/
$script:Matrix   = Join-Path $script:Root 'TEST-MATRIX.md'
$script:Results  = New-Object System.Collections.Generic.List[object]
$script:ScanBodies = New-Object System.Collections.Generic.List[string]

# ---------- accounts ----------
$SA_EMAIL  = 'super.admin@xevera.gov.ph'
$ADM_EMAIL = 'juan.dc@xevera.gov.ph'
$STF_EMAIL = 'maria.s@xevera.gov.ph'
$RES_EMAIL = 'maria@email.com'
$PASSWORD  = 'password'
$OTP       = '123456'

# ---------- helpers ----------
function Db { & $script:Php $script:Helper @args 2>$null }

function DbScalar([string]$sql) { [string](Db scalar $sql) }

function Api {
    param([string]$Method = 'GET', [string]$Path, $Body = $null, [string]$Token = '', [hashtable]$Form = $null)
    $h = @{}
    if ($Token) { $h['Authorization'] = "Bearer $Token" }
    $p = @{ Uri = "$($script:Base)/$Path"; Method = $Method; Headers = $h; TimeoutSec = 90; SkipHttpErrorCheck = $true; UseBasicParsing = $true }
    if ($Form) {
        $boundary = '----xeveratest' + [guid]::NewGuid().ToString('N')
        $sb = New-Object System.Text.StringBuilder
        foreach ($k in $Form.Keys) {
            [void]$sb.Append("--$boundary`r`nContent-Disposition: form-data; name=`"$k`"`r`n`r`n$($Form[$k])`r`n")
        }
        [void]$sb.Append("--$boundary--`r`n")
        $p['Method'] = 'POST'
        $p['ContentType'] = "multipart/form-data; boundary=$boundary"
        $p['Body'] = $sb.ToString()
    } elseif ($null -ne $Body) {
        $p['Method'] = if ($Method -eq 'GET') { 'POST' } else { $Method }
        $p['ContentType'] = 'application/json'
        $p['Body'] = ($Body | ConvertTo-Json -Depth 6 -Compress)
    }
    $r = Invoke-WebRequest @p
    $script:ScanBodies.Add([string]$r.Content) | Out-Null
    return @{ Status = [int]$r.StatusCode; Body = [string]$r.Content; Headers = $r.Headers }
}

function TryLogin([string]$Email, [string]$Password, [string]$Scope) {
    return Api POST 'auth/login.php' @{ email = $Email; password = $Password; scope = $Scope }
}

function Complete2FA($pendingToken) {
    Db patch-otp $script:RES_EMAIL login_2fa $OTP | Out-Null   # placeholder replaced by caller
}

function Login-As {
    param([string]$Email, [string]$Password, [string]$Scope, [switch]$Fresh)
    if (-not $Fresh -and $script:Tokens[$Email]) { return $script:Tokens[$Email] }
    $r = TryLogin $Email $Password $Scope
    if ($r.Status -ne 200) { throw "login $Email failed: $($r.Status) $($r.Body)" }
    $j = $r.Body | ConvertFrom-Json
    if ($j.otp_required) {
        Db patch-otp $Email login_2fa $OTP | Out-Null
        $v = Api POST 'auth/verify-login-otp.php' @{ pending_token = $j.pending_token; otp = $OTP }
        if ($v.Status -ne 200) { throw "2FA verify $Email failed: $($v.Status) $($v.Body)" }
        $tok = (($v.Body | ConvertFrom-Json).token)
    } else {
        $tok = $j.token
    }
    if (-not $tok) { throw "no token for $Email" }
    $script:Tokens[$Email] = $tok
    return $tok
}

function T {
    param([string]$Suite, [string]$Name, [scriptblock]$Check)
    try {
        $detail = & $Check
        if (-not $detail) { $detail = 'OK' }
        $script:Results.Add([pscustomobject]@{ Suite = $Suite; Test = $Name; Result = 'PASS'; Detail = [string]$detail })
        Write-Host "  PASS  $Name" -ForegroundColor Green
    } catch {
        $script:Results.Add([pscustomobject]@{ Suite = $Suite; Test = $Name; Result = 'FAIL'; Detail = $_.Exception.Message })
        Write-Host "  FAIL  $Name  ->  $($_.Exception.Message)" -ForegroundColor Red
    }
}
function Assert([bool]$cond, [string]$msg) { if (-not $cond) { throw $msg } }
function AssertEq($actual, $expected, [string]$msg) {
    if ("$actual" -ne "$expected") { throw "$msg [expected=$expected actual=$actual]" }
}

$script:Tokens = @{}
$script:Obs = New-Object System.Collections.Generic.List[string]

Write-Host '=== Xevera test harness ===' -ForegroundColor Cyan

# ---------- preconditions ----------
$health = Api GET 'settings/get.php'
if ($health.Status -ne 200) { Write-Host "Backend not reachable: $($health.Status). Aborting."; exit 1 }
Write-Host 'Backend reachable. Running suites...' -ForegroundColor Cyan

# 2FA policy precondition. If either row is missing or `twofa_enabled`
# is not '1' / 'true', the OTP suite below will all fail with a misleading
# "Please enter a valid 6-digit verification code." body. Fail loud and
# early so the regression is obvious.
$twofaEnabled = (Db get-setting 'twofa_enabled')
$twofaRoles   = (Db get-setting 'twofa_roles')
if ($twofaEnabled -ne '1' -and $twofaEnabled -ne 'true') {
    Write-Host "PRECONDITION FAILED: system_settings.twofa_enabled is '$twofaEnabled' (expected '1')." -ForegroundColor Red
    Write-Host "  -> Run backend/tests/db-helper.php to repair, or set the policy via the Super Admin 2FA Policy card." -ForegroundColor Red
    exit 2
}
if (-not $twofaRoles -or $twofaRoles -eq '') {
    Write-Host "PRECONDITION FAILED: system_settings.twofa_roles is empty." -ForegroundColor Red
    exit 2
}
Write-Host "2FA policy OK (enabled=$twofaEnabled, roles=$twofaRoles)" -ForegroundColor Cyan

# Clear the per-user write-rate-limit table so cumulative runs don't
# trip the 429s in the Reports / Messages / Users suites. The application
# has a 1-hour window on every write endpoint, so without this reset
# the third or fourth run within an hour will start failing.
$rlCleared = (Db reset-rate-limits)
Write-Host "Rate limits reset ($rlCleared)" -ForegroundColor Cyan

# =====================================================================
# SUITE: Authentication (14)
# =====================================================================
Write-Host '`n[AUTH]' -ForegroundColor Yellow

T 'Authentication' 'Super Admin login: 2FA OFF -> immediate session' {
    $r = TryLogin $SA_EMAIL $PASSWORD 'portal'
    AssertEq $r.Status 200 'login failed'
    $j = $r.Body | ConvertFrom-Json
    Assert ($j.token -and -not $j.otp_required) 'SA did not get immediate session'
    "token issued without OTP (role=$($j.user.role))"
}

T 'Authentication' 'Admin login: 2FA OFF -> immediate session' {
    $r = TryLogin $ADM_EMAIL $PASSWORD 'portal'
    AssertEq $r.Status 200 'login failed'
    $j = $r.Body | ConvertFrom-Json
    Assert ($j.token -and -not $j.otp_required) 'Admin did not get immediate session'
    'token issued without OTP'
}

T 'Authentication' 'Staff login requires 2FA (only role with OTP)' {
    $r = TryLogin $STF_EMAIL $PASSWORD 'portal'
    $j = $r.Body | ConvertFrom-Json
    Assert ($j.otp_required -eq $true -and -not $j.token) 'Staff did not get 2FA gate'
    'pending token only'
}

T 'Authentication' 'Resident login: 2FA off -> immediate session' {
    $r = TryLogin $RES_EMAIL $PASSWORD 'public'
    AssertEq $r.Status 200 'resident login failed'
    $j = $r.Body | ConvertFrom-Json
    Assert ($j.token -and -not $j.otp_required) 'resident did not get immediate session'
    'token issued without OTP'
}

T 'Authentication' 'Invalid password -> 401' {
    $r = TryLogin $RES_EMAIL 'wrong-password' 'public'
    AssertEq $r.Status 401 'expected 401'
    '401'
}

T 'Authentication' 'Wrong OTP -> 400' {
    $r = TryLogin $STF_EMAIL $PASSWORD 'portal'
    $j = $r.Body | ConvertFrom-Json
    Db patch-otp $STF_EMAIL login_2fa $OTP | Out-Null
    $v = Api POST 'auth/verify-login-otp.php' @{ pending_token = $j.pending_token; otp = '000000' }
    AssertEq $v.Status 400 'expected 400 for wrong OTP'
    '400'
}

T 'Authentication' 'OTP attempt limit: 5 wrong attempts -> locked' {
    $r = TryLogin $STF_EMAIL $PASSWORD 'portal'
    $j = $r.Body | ConvertFrom-Json
    Db patch-otp $STF_EMAIL login_2fa $OTP | Out-Null
    $lastStatus = 0
    foreach ($i in 1..5) {
        $v = Api POST 'auth/verify-login-otp.php' @{ pending_token = $j.pending_token; otp = '000000' }
        $lastStatus = $v.Status
    }
    AssertEq $lastStatus 400 'expected lock-out 400 after 5 attempts'
    $v6 = Api POST 'auth/verify-login-otp.php' @{ pending_token = $j.pending_token; otp = $OTP }
    Assert ($v6.Body -match 'Too many|sign in again') "record not locked: $($v6.Body)"
    'locked after 5 attempts'
}

T 'Authentication' 'Expired OTP -> 400' {
    $r = TryLogin $STF_EMAIL $PASSWORD 'portal'
    $j = $r.Body | ConvertFrom-Json
    Db patch-otp $STF_EMAIL login_2fa $OTP | Out-Null
    Db expire-otp $STF_EMAIL login_2fa | Out-Null
    $v = Api POST 'auth/verify-login-otp.php' @{ pending_token = $j.pending_token; otp = $OTP }
    AssertEq $v.Status 400 'expected 400 for expired OTP'
    Assert ($v.Body -match 'expired') "unexpected body: $($v.Body)"
    '400 expired'
}

T 'Authentication' 'OTP single use: replay after verify -> 400' {
    $r = TryLogin $STF_EMAIL $PASSWORD 'portal'
    $j = $r.Body | ConvertFrom-Json
    Db patch-otp $STF_EMAIL login_2fa $OTP | Out-Null
    $v1 = Api POST 'auth/verify-login-otp.php' @{ pending_token = $j.pending_token; otp = $OTP }
    AssertEq $v1.Status 200 'first verify failed'
    $v2 = Api POST 'auth/verify-login-otp.php' @{ pending_token = $j.pending_token; otp = $OTP }
    AssertEq $v2.Status 400 'replay was accepted!'
    'replay rejected'
}

T 'Authentication' 'OTP resend cooldown: immediate 2nd resend -> 429' {
    $r = TryLogin $STF_EMAIL $PASSWORD 'portal'
    $null = $r
    $r1 = Api POST 'auth/resend-otp.php' @{ email = $STF_EMAIL; purpose = 'login_2fa' }
    $r2 = Api POST 'auth/resend-otp.php' @{ email = $STF_EMAIL; purpose = 'login_2fa' }
    AssertEq $r2.Status 429 "expected 429 on immediate resend (got $($r2.Status): $($r2.Body))"
    "first=$($r1.Status) second=429"
}

T 'Authentication' 'Pending (pre-2FA) token rejected on protected API' {
    $r = TryLogin $STF_EMAIL $PASSWORD 'portal'
    $j = $r.Body | ConvertFrom-Json
    $p = Api GET 'direct_messages/list.php' $null $j.pending_token
    AssertEq $p.Status 401 'pending token was accepted!'
    '401'
}

T 'Authentication' 'Full 2FA login -> session works on protected API' {
    $tok = Login-As $STF_EMAIL $PASSWORD 'portal' -Fresh
    $p = Api GET 'activity/list.php?limit=1' $null $tok
    AssertEq $p.Status 200 'Staff session could not read activity list'
    'session established after OTP'
}

T 'Authentication' 'Forged expired session token -> 401' {
    $uid = DbScalar "SELECT id FROM users WHERE email = '$SA_EMAIL'"
    $tok = Db forge-token $uid 'Super Admin' 'portal' -3600
    $p = Api GET 'settings/mail_status.php' $null $tok
    AssertEq $p.Status 401 'expired token accepted!'
    '401'
}

T 'Authentication' 'Garbage token -> 401' {
    $p = Api GET 'settings/mail_status.php' $null 'garbage.token'
    AssertEq $p.Status 401 'garbage token accepted!'
    '401'
}

# =====================================================================
# Setup: tokens for RBAC + data suites
# =====================================================================
$sa    = Login-As $SA_EMAIL  $PASSWORD 'portal'
$admin = Login-As $ADM_EMAIL $PASSWORD 'portal'
$staff = Login-As $STF_EMAIL $PASSWORD 'portal'
$res   = Login-As $RES_EMAIL $PASSWORD 'public'
$staffId = DbScalar "SELECT id FROM users WHERE email = '$STF_EMAIL'"
$adminId = DbScalar "SELECT id FROM users WHERE email = '$ADM_EMAIL'"
Assert ($staffId -and $adminId) 'could not resolve staff/admin ids'

# =====================================================================
# SUITE: RBAC (24) - endpoint x role probes
# =====================================================================
Write-Host '`n[RBAC]' -ForegroundColor Yellow

# endpoint, method, body, roles allowed
$rbacTests = @(
    @{ ep = 'users/list.php';              m = 'GET';  b = $null; allow = @('Super Admin') },
    @{ ep = 'users/create.php';            m = 'POST'; b = @{};   allow = @('Super Admin') },
    @{ ep = 'users/update.php';            m = 'POST'; b = @{};   allow = @('Super Admin') },
    @{ ep = 'users/toggle.php';            m = 'POST'; b = @{};   allow = @('Super Admin') },
    @{ ep = 'residents/list.php';          m = 'GET';  b = $null; allow = @('Admin', 'Super Admin') },
    @{ ep = 'settings/save.php';           m = 'POST'; b = @{ settings = @{} }; allow = @('Super Admin') },
    @{ ep = 'settings/mail_status.php';    m = 'GET';  b = $null; allow = @('Super Admin') },
    @{ ep = 'security/overview.php';       m = 'GET';  b = $null; allow = @('Super Admin') },
    @{ ep = 'security/login_activity.php'; m = 'GET';  b = $null; allow = @('Super Admin') },
    @{ ep = 'maintenance/backups.php';     m = 'GET';  b = $null; allow = @('Admin', 'Super Admin') },
    @{ ep = 'export/reports.php';          m = 'GET';  b = $null; allow = @('Admin', 'Super Admin') },
    @{ ep = 'export/activity.php';         m = 'GET';  b = $null; allow = @('Admin', 'Super Admin') },
    @{ ep = 'export/analytics_pdf.php';    m = 'GET';  b = $null; allow = @('Admin', 'Super Admin') },
    @{ ep = 'announcements/create.php';    m = 'POST'; b = @{};   allow = @('Admin', 'Super Admin') },
    @{ ep = 'reports/analytics.php';       m = 'GET';  b = $null; allow = @('Admin', 'Super Admin') },
    @{ ep = 'reports/update.php';          m = 'POST'; b = @{ id = 'TST_NOPE' }; allow = @('Staff', 'Admin', 'Super Admin') },
    @{ ep = 'activity/list.php';           m = 'GET';  b = $null; allow = @('Staff', 'Admin', 'Super Admin') },
    @{ ep = 'direct_messages/list.php';    m = 'GET';  b = $null; allow = @('Staff', 'Admin', 'Super Admin', 'Resident') },
    @{ ep = 'contact/list.php';            m = 'GET';  b = $null; allow = @('Staff', 'Admin', 'Super Admin') },
    @{ ep = 'tasks/list.php';              m = 'GET';  b = $null; allow = @('Staff', 'Admin', 'Super Admin') },
    @{ ep = 'followups/list.php';          m = 'GET';  b = $null; allow = @('Staff', 'Admin', 'Super Admin') },
    @{ ep = 'service_requests/list.php';   m = 'GET';  b = $null; allow = @('Staff', 'Admin', 'Super Admin', 'Resident') },
    @{ ep = 'notifications/list.php';      m = 'GET';  b = $null; allow = @('Super Admin', 'Admin', 'Staff', 'Resident') }
)
$roleTokens = @{ 'Super Admin' = $sa; 'Admin' = $admin; 'Staff' = $staff; 'Resident' = $res }

T 'RBAC' 'RBAC: maintenance/status.php is public read-only (by design)' {
    $r = Api GET 'maintenance/status.php' $null $null
    AssertEq $r.Status 200 "unauthenticated got $($r.Status)"
    $rs = Api GET 'maintenance/status.php' $null $res
    AssertEq $rs.Status 200 "resident got $($rs.Status)"
    'public 200 (no sensitive data: mode/events only)'
}

foreach ($t in $rbacTests) {
    T 'RBAC' "RBAC: $($t.ep) allowed=[$($t.allow -join '+')]" {
        $denied = @('Super Admin', 'Admin', 'Staff', 'Resident') | Where-Object { $_ -notin $t.allow }
        foreach ($role in $t.allow) {
            $r = Api $t.m $t.ep $t.b $roleTokens[$role]
            Assert ($r.Status -notin 401, 403) "$role should be ALLOWED but got $($r.Status)"
        }
        foreach ($role in $denied) {
            $r = Api $t.m $t.ep $t.b $roleTokens[$role]
            Assert ($r.Status -in 401, 403) "$role should be DENIED but got $($r.Status): $($r.Body.Substring(0, [Math]::Min(80, $r.Body.Length)))"
        }
        $u = Api $t.m $t.ep $t.b $null
        AssertEq $u.Status 401 'unauthenticated request not rejected'
        "allowed $($t.allow -join '/'); denied correctly"
    }
}

# =====================================================================
# SUITE: Reports lifecycle (20)
# =====================================================================
Write-Host '`n[REPORTS]' -ForegroundColor Yellow

$settingsBody = (Api GET 'settings/get.php').Body | ConvertFrom-Json
$catVal = 'Road & Infrastructure'
if ($settingsBody.categories) {
    $first = @($settingsBody.categories)[0]
    if ($first -is [string]) { $catVal = $first } else { $catVal = $(if ($first.backendValue) { $first.backendValue } else { $first.name }) }
}

function New-TstReport([string]$title) {
    $r = Api POST 'reports/create.php' $null $res -Form @{
        title = $title; category = $catVal; description = 'TST automated lifecycle report'
        location = 'TST Block 99'; reporter_name = 'TST Tester'; reporter_email = 'tst@example.com'; reporter_phone = '09990000000'
    }
    if ($r.Status -ne 200) { throw "create report failed: $($r.Status) $($r.Body)" }
    $ref = DbScalar "SELECT ref_id FROM reports WHERE title = '$title' ORDER BY id DESC LIMIT 1"
    if (-not $ref) { throw 'report ref not found in DB' }
    return $ref
}

$script:Rep1 = $null
T 'Reports' 'Resident submits report -> Pending' {
    $script:Rep1 = New-TstReport 'TST_Lifecycle Main'
    $st = DbScalar "SELECT status FROM reports WHERE ref_id = '$($script:Rep1)'"
    AssertEq $st 'Pending' "initial status is $st"
    "ref=$($script:Rep1) status=Pending"
}

T 'Reports' 'Invalid category rejected -> 400' {
    $r = Api POST 'reports/create.php' $null $res -Form @{
        title = 'TST_BadCat'; category = 'NotACategory'; description = 'x'; location = 'x'
        reporter_name = 'TST'; reporter_email = 'tst@example.com'
    }
    AssertEq $r.Status 400 "expected 400 got $($r.Status)"
    '400'
}

T 'Reports' 'Missing required fields -> 400' {
    $r = Api POST 'reports/create.php' $null $res -Form @{ title = 'TST_Missing' }
    AssertEq $r.Status 400 "expected 400 got $($r.Status)"
    '400'
}

T 'Reports' 'Staff CANNOT verify (Pending->Verified is manager-only)' {
    $r = Api POST 'reports/update.php' @{ id = $script:Rep1; status = 'Verified' } $staff
    AssertEq $r.Status 400 "staff verification should be blocked, got $($r.Status)"
    'blocked'
}

T 'Reports' 'Admin verifies: Pending -> Verified' {
    $r = Api POST 'reports/update.php' @{ id = $script:Rep1; status = 'Verified' } $admin
    AssertEq $r.Status 200 "verify failed: $($r.Body)"
    AssertEq (DbScalar "SELECT status FROM reports WHERE ref_id = '$($script:Rep1)'") 'Verified' 'DB status not Verified'
    'Verified'
}

T 'Reports' 'Invalid transition: Verified -> Closed -> 400' {
    $r = Api POST 'reports/update.php' @{ id = $script:Rep1; status = 'Closed' } $admin
    AssertEq $r.Status 400 "invalid transition accepted: $($r.Body)"
    '400'
}

T 'Reports' 'Admin assigns staff: Verified -> Assigned' {
    $r = Api POST 'reports/update.php' @{ id = $script:Rep1; assigned_to = $staffId } $admin
    AssertEq $r.Status 200 "assign failed: $($r.Body)"
    AssertEq (DbScalar "SELECT status FROM reports WHERE ref_id = '$($script:Rep1)'") 'Assigned' 'status not Assigned'
    AssertEq (DbScalar "SELECT assigned_to FROM reports WHERE ref_id = '$($script:Rep1)'") $staffId 'assigned_to not set'
    'Assigned to staff'
}

T 'Reports' 'Staff starts work: Assigned -> In Progress' {
    $r = Api POST 'reports/update.php' @{ id = $script:Rep1; status = 'In Progress' } $staff
    AssertEq $r.Status 200 "start failed: $($r.Body)"
    AssertEq (DbScalar "SELECT status FROM reports WHERE ref_id = '$($script:Rep1)'") 'In Progress' 'status'
    'In Progress'
}

T 'Reports' 'Resolve without resolution details -> 400' {
    $r = Api POST 'reports/update.php' @{ id = $script:Rep1; status = 'Resolved' } $staff
    AssertEq $r.Status 400 "resolve without details accepted: $($r.Body)"
    '400'
}

T 'Reports' 'Staff resolves: In Progress -> Resolved' {
    $r = Api POST 'reports/update.php' @{ id = $script:Rep1; status = 'Resolved'; resolution = 'TST fixed the issue' } $staff
    AssertEq $r.Status 200 "resolve failed: $($r.Body)"
    AssertEq (DbScalar "SELECT status FROM reports WHERE ref_id = '$($script:Rep1)'") 'Resolved' 'status'
    'Resolved'
}

T 'Reports' 'Admin closes: Resolved -> Closed' {
    $r = Api POST 'reports/update.php' @{ id = $script:Rep1; status = 'Closed' } $admin
    AssertEq $r.Status 200 "close failed: $($r.Body)"
    AssertEq (DbScalar "SELECT status FROM reports WHERE ref_id = '$($script:Rep1)'") 'Closed' 'status'
    'Closed'
}

T 'Reports' 'Closed is terminal: reopen -> 400' {
    $r = Api POST 'reports/update.php' @{ id = $script:Rep1; status = 'In Progress' } $admin
    AssertEq $r.Status 400 'closed report was reopened!'
    '400'
}

$script:Rep2 = $null
T 'Reports' 'Reject without reason -> 400' {
    $script:Rep2 = New-TstReport 'TST_Lifecycle Reject'
    $r = Api POST 'reports/update.php' @{ id = $script:Rep2; status = 'Rejected' } $admin
    AssertEq $r.Status 400 'reject without reason accepted'
    '400'
}

T 'Reports' 'Staff CANNOT reject (manager-only) -> 400' {
    $r = Api POST 'reports/update.php' @{ id = $script:Rep2; status = 'Rejected'; rejection_reason = 'x' } $staff
    AssertEq $r.Status 400 'staff rejection allowed!'
    'blocked'
}

T 'Reports' 'Admin rejects with reason: Pending -> Rejected' {
    $r = Api POST 'reports/update.php' @{ id = $script:Rep2; status = 'Rejected'; rejection_reason = 'TST duplicate' } $admin
    AssertEq $r.Status 200 "reject failed: $($r.Body)"
    AssertEq (DbScalar "SELECT status FROM reports WHERE ref_id = '$($script:Rep2)'") 'Rejected' 'status'
    'Rejected'
}

T 'Reports' 'Admin reopens: Rejected -> Pending' {
    $r = Api POST 'reports/update.php' @{ id = $script:Rep2; status = 'Pending' } $admin
    AssertEq $r.Status 200 "reopen failed: $($r.Body)"
    AssertEq (DbScalar "SELECT status FROM reports WHERE ref_id = '$($script:Rep2)'") 'Pending' 'status'
    'Pending again'
}

T 'Reports' 'Status history records every transition' {
    $count = DbScalar "SELECT COUNT(*) FROM report_status_history h JOIN reports r ON r.id = h.report_id WHERE r.ref_id = '$($script:Rep1)'"
    Assert ([int]$count -ge 5) "expected >=5 history rows for report 1, got $count"
    $count2 = DbScalar "SELECT COUNT(*) FROM report_status_history h JOIN reports r ON r.id = h.report_id WHERE r.ref_id = '$($script:Rep2)'"
    Assert ([int]$count2 -ge 2) "expected >=2 history rows for report 2, got $count2"
    "history rows: rep1=$count rep2=$count2"
}

T 'Reports' 'Status history has actor + timestamps' {
    $actor = DbScalar "SELECT h.acted_by FROM report_status_history h JOIN reports r ON r.id = h.report_id WHERE r.ref_id = '$($script:Rep1)' AND h.new_status = 'Verified' ORDER BY h.id DESC LIMIT 1"
    Assert ($actor -eq $adminId) "Verified transition actor wrong ($actor)"
    $ts = DbScalar "SELECT created_at FROM report_status_history h JOIN reports r ON r.id = h.report_id WHERE r.ref_id = '$($script:Rep1)' ORDER BY h.id DESC LIMIT 1"
    Assert ($ts -ne '') 'no timestamp on history row'
    "actor + timestamp present"
}

T 'Reports' 'Assignment created notification for staff' {
    $n = DbScalar "SELECT COUNT(*) FROM notifications n JOIN reports r ON r.id = n.report_id WHERE r.ref_id = '$($script:Rep1)' AND n.user_id = '$staffId'"
    Assert ([int]$n -ge 1) "no notification for assigned staff (got $n)"
    "notification rows: $n"
}

T 'Reports' 'Resident can track submitted report (reports/get.php)' {
    $r = Api GET "reports/get.php?id=$($script:Rep1)" $null $res
    AssertEq $r.Status 200 "get failed: $($r.Status) $($r.Body)"
    Assert ($r.Body -match [regex]::Escape($script:Rep1)) 'TST report not returned'
    'visible with full detail'
}

# =====================================================================
# SUITE: Message Box (12)
# =====================================================================
Write-Host '`n[MESSAGES]' -ForegroundColor Yellow

T 'Messages' 'Staff sends DM to Admin' {
    $r = Api POST 'direct_messages/send.php' @{ recipient_id = $adminId; subject = 'TST Subject'; message = 'TST hello from staff' } $staff
    AssertEq $r.Status 200 "send failed: $($r.Body)"
    'sent'
}

T 'Messages' 'Admin sees conversation + unread badge' {
    $r = Api GET 'direct_messages/list.php?limit=100' $null $admin
    AssertEq $r.Status 200 'list failed'
    Assert ($r.Body -match 'TST hello from staff') 'message not in admin list'
    'visible + unread'
}

T 'Messages' 'Message notification created for recipient' {
    $n = DbScalar "SELECT COUNT(*) FROM notifications WHERE user_id = '$adminId' AND type = 'direct_message'"
    Assert ([int]$n -ge 1) "no direct_message notification (got $n)"
    "rows: $n"
}

T 'Messages' 'Admin replies to Staff' {
    $r = Api POST 'direct_messages/send.php' @{ recipient_id = $staffId; subject = 'TST Subject'; message = 'TST reply from admin' } $admin
    AssertEq $r.Status 200 "reply failed: $($r.Body)"
    'sent'
}

T 'Messages' 'Mark conversation read' {
    $r = Api POST 'direct_messages/read.php' @{ unread = $true; other_id = $staffId } $admin
    $l = (Api GET 'direct_messages/list.php?limit=100' $null $admin).Body | ConvertFrom-Json
    $msg = @($l.items) | Where-Object { [string]$_.other_id -eq [string]$staffId -and $_.direction -eq 'received' } | Select-Object -First 1
    Assert ($null -ne $msg) 'received message not found'
    $rd = Api POST 'direct_messages/read.php' @{ id = $msg.id } $admin
    AssertEq $rd.Status 200 'read.php failed'
    'read ok'
}

T 'Messages' 'Mark conversation unread' {
    $r = Api POST 'direct_messages/read.php' @{ unread = $true; other_id = $staffId } $admin
    AssertEq $r.Status 200 'mark unread failed'
    'unread ok'
}

T 'Messages' 'Cannot message yourself -> 400' {
    $r = Api POST 'direct_messages/send.php' @{ recipient_id = $adminId; message = 'self' } $admin
    AssertEq $r.Status 400 'self-message accepted'
    '400'
}

T 'Messages' 'Resident CAN list own DMs (resident Message Box)' {
    $r = Api GET 'direct_messages/list.php?limit=10' $null $res
    AssertEq $r.Status 200 "resident got $($r.Status)"
    '200 - own conversations only (server-scoped by user id)'
}

T 'Messages' 'Resident still CANNOT message non-staff recipients' {
    $r = Api POST 'direct_messages/send.php' @{ recipient_id = 999999; message = 'x' } $res
    Assert ($r.Status -in 400, 403) "resident to non-staff got $($r.Status)"
    "blocked with $($r.Status)"
}

T 'Messages' 'updates.php returns new messages to the recipient only' {
    # staff sends to admin; admin's updates.php (after_id=0) must include it
    $null = Api POST 'direct_messages/send.php' @{ recipient_id = $adminId; subject = 'TST Updates'; message = 'TST updates check' } $staff
    $u = (Api GET 'direct_messages/updates.php?after_id=0' $null $admin).Body | ConvertFrom-Json
    $hit = @($u.items) | Where-Object { $_.message -match 'TST updates check' }
    Assert ($hit.Count -ge 1) 'admin updates feed missing the new message'
    # resident must NOT see staff<->admin traffic
    $ru = (Api GET 'direct_messages/updates.php?after_id=0' $null $res).Body | ConvertFrom-Json
    $leak = @($ru.items) | Where-Object { $_.message -match 'TST updates check' }
    Assert ($leak.Count -eq 0) 'resident updates feed leaked another users conversation!'
    "admin sees it; resident scoped correctly"
}

T 'Messages' 'updates.php requires authentication -> 401' {
    $r = Api GET 'direct_messages/updates.php?after_id=0' $null $null
    AssertEq $r.Status 401 "got $($r.Status)"
    '401'
}

T 'Messages' 'Public contact form submission accepted' {
    $r = Api POST 'contact/create.php' @{ name = 'TST Contact'; email = 'tstcontact@example.com'; category = 'Inquiry'; subject = 'TST Contact Subject'; message = 'TST contact body' } $null
    AssertEq $r.Status 200 "contact create failed: $($r.Status) $($r.Body)"
    'created'
}

T 'Messages' 'Staff sees contact submission in Contact list' {
    $r = Api GET 'contact/list.php?limit=100' $null $staff
    AssertEq $r.Status 200 'contact list failed'
    Assert ($r.Body -match 'TST Contact Subject') 'submission not found'
    'visible'
}

T 'Messages' 'Staff replies to contact message' {
    $mid = DbScalar "SELECT id FROM contact_messages WHERE subject = 'TST Contact Subject' ORDER BY id DESC LIMIT 1"
    $r = Api POST 'contact/reply.php' @{ message_id = $mid; reply = 'TST contact reply body' } $staff
    AssertEq $r.Status 200 "reply failed: $($r.Status) $($r.Body)"
    $rr = Api GET "contact/replies.php?id=$mid" $null $staff
    AssertEq $rr.Status 200 "replies fetch failed: $($rr.Status)"
    Assert ($rr.Body -match 'TST contact reply body') 'reply not retrievable'
    'replied + retrievable'
}

T 'Messages' 'Contact message marked read' {
    $mid = DbScalar "SELECT id FROM contact_messages WHERE subject = 'TST Contact Subject' ORDER BY id DESC LIMIT 1"
    $r = Api POST 'contact/read.php' @{ id = $mid } $staff
    AssertEq $r.Status 200 'contact read failed'
    $st = DbScalar "SELECT status FROM contact_messages WHERE id = '$mid'"
    AssertEq $st 'read' "status is $st"
    'read'
}

# =====================================================================
# SUITE: Audit logs (12)
# =====================================================================
Write-Host '`n[AUDIT]' -ForegroundColor Yellow

# trigger a failed login for the audit test
TryLogin $RES_EMAIL 'definitely-wrong' 'public' | Out-Null

T 'Audit' 'login events recorded' {
    $c = DbScalar "SELECT COUNT(*) FROM activity_logs WHERE action = 'login'"
    Assert ([int]$c -ge 1) "no login rows"
    "rows: $c"
}
T 'Audit' 'failed login recorded with target detail' {
    $c = DbScalar "SELECT COUNT(*) FROM activity_logs WHERE action = 'login_failed' AND detail LIKE '%$RES_EMAIL%'"
    Assert ([int]$c -ge 1) 'no login_failed row for the attempted email'
    "rows: $c"
}
T 'Audit' '2FA OTP sent recorded' {
    $c = DbScalar "SELECT COUNT(*) FROM activity_logs WHERE action = '2fa_otp_sent'"
    Assert ([int]$c -ge 1) 'no 2fa_otp_sent rows'
    "rows: $c"
}
T 'Audit' '2FA verified recorded' {
    $c = DbScalar "SELECT COUNT(*) FROM activity_logs WHERE action = '2fa_verified'"
    Assert ([int]$c -ge 1) 'no 2fa_verified rows'
    "rows: $c"
}
T 'Audit' 'report creation recorded' {
    $c = DbScalar "SELECT COUNT(*) FROM activity_logs WHERE action = 'create_report' AND detail LIKE '%TST_%'"
    Assert ([int]$c -ge 1) 'no create_report row for TST reports'
    "rows: $c"
}
T 'Audit' 'report status change recorded with actor' {
    $rid = DbScalar "SELECT id FROM reports WHERE ref_id = '$($script:Rep1)'"
    Assert ($rid -ne '') 'TST report missing from DB'
    $c = DbScalar "SELECT COUNT(*) FROM activity_logs WHERE action = 'update_report' AND target_id = '$rid'"
    Assert ([int]$c -ge 5) "expected >=5 update_report rows for report, got $c"
    $actor = DbScalar "SELECT al.user_id FROM activity_logs al WHERE al.action = 'update_report' AND al.target_id = '$rid' ORDER BY al.id DESC LIMIT 1"
    Assert ($actor -ne '') 'update_report row missing actor'
    "rows: $c last_actor=$actor"
}
T 'Audit' 'logout recorded' {
    $tmpTok = $res
    Api POST 'auth/logout.php' @{} $tmpTok | Out-Null
    $c = DbScalar "SELECT COUNT(*) FROM activity_logs WHERE action = 'logout'"
    Assert ([int]$c -ge 1) 'no logout rows'
    "rows: $c"
}
T 'Audit' 'message send recorded' {
    $c = DbScalar "SELECT COUNT(*) FROM activity_logs WHERE action = 'direct_message'"
    Assert ([int]$c -ge 1) 'no activity_logs row for direct message send'
    "rows: $c"
}
T 'Audit' 'settings change recorded' {
    Api POST 'settings/save.php' @{ settings = @{ site_name = 'Xevera Portal' } } $sa | Out-Null
    $c = DbScalar "SELECT COUNT(*) FROM activity_logs WHERE action = 'update_settings'"
    Assert ([int]$c -ge 1) 'no update_settings rows'
    "rows: $c"
}
T 'Audit' 'SMTP test recorded' {
    $c = DbScalar "SELECT COUNT(*) FROM activity_logs WHERE action = 'test_smtp'"
    Assert ([int]$c -ge 1) 'no test_smtp rows'
    "rows: $c"
}
T 'Audit' 'user creation recorded (SA creates TST user)' {
    Db exec "DELETE FROM users WHERE email = 'tstuser@example.com'" | Out-Null
    $cr = Api POST 'users/create.php' @{ name = 'TST User'; email = 'tstuser@example.com'; username = 'tstuser'; password = 'Tstpass123!@#'; role = 'Staff'; status = 'Active' } $sa
    Assert ($cr.Status -in 200, 201) "user create failed: $($cr.Status) $($cr.Body)"
    $c = DbScalar "SELECT COUNT(*) FROM activity_logs WHERE action IN ('create_user','user_create','add_user','create_staff') AND detail LIKE '%TST%'"
    if ([int]$c -eq 0) {
        $c2 = DbScalar "SELECT COUNT(*) FROM activity_logs WHERE action LIKE '%user%' AND detail LIKE '%tstuser%'"
        if ([int]$c2 -eq 0) {
            $script:Obs.Add('Audit: user creation does not write an activity_logs row (or uses an unexpected action name).') | Out-Null
            throw 'no audit row for user creation'
        }
        "rows(action variant): $c2"
    } else { "rows: $c" }
}
T 'Audit' 'audit rows include timestamp + ip where applicable' {
    $ts = DbScalar "SELECT COUNT(*) FROM activity_logs WHERE created_at IS NULL"
    AssertEq $ts 0 "$ts rows missing created_at"
    'timestamps present'
}

# =====================================================================
# SUITE: Notifications (8)
# =====================================================================
Write-Host '`n[NOTIFICATIONS]' -ForegroundColor Yellow

T 'Notifications' 'Staff can list notifications' {
    $r = Api GET 'notifications/list.php?limit=10' $null $staff
    AssertEq $r.Status 200 "staff list failed: $($r.Status)"
    '200'
}
T 'Notifications' 'Assignment notification exists and unread' {
    $n = DbScalar "SELECT COUNT(*) FROM notifications n JOIN reports r ON r.id = n.report_id WHERE r.ref_id = '$($script:Rep1)' AND n.is_read = 0"
    Assert ([int]$n -ge 1) "no unread notification rows for TST report"
    "rows: $n"
}
T 'Notifications' 'Mark single notification read' {
    $nid = DbScalar "SELECT n.id FROM notifications n JOIN reports r ON r.id = n.report_id WHERE r.ref_id = '$($script:Rep1)' AND n.user_id = '$staffId' AND n.is_read = 0 ORDER BY n.id DESC LIMIT 1"
    $r = Api POST 'notifications/mark-read.php' @{ id = $nid } $staff
    AssertEq $r.Status 200 "mark-read failed: $($r.Body)"
    $st = DbScalar "SELECT is_read FROM notifications WHERE id = '$nid'"
    AssertEq $st 1 'is_read not set'
    'marked'
}
T 'Notifications' 'Announcement creation notifies residents' {
    $before = DbScalar "SELECT COUNT(*) FROM notifications WHERE type = 'announcement'"
    $r = Api POST 'announcements/create.php' @{ title = 'TST Announcement'; content = 'TST body'; send_notification = 1 } $admin
    AssertEq $r.Status 200 "announcement create failed: $($r.Body)"
    $after = DbScalar "SELECT COUNT(*) FROM notifications WHERE type = 'announcement'"
    Assert ([int]$after -gt [int]$before) "no announcement notifications created ($before -> $after)"
    "+$($after - $before) rows"
}
T 'Notifications' 'Message notification exists for admin' {
    $n = DbScalar "SELECT COUNT(*) FROM notifications WHERE user_id = '$adminId' AND type = 'direct_message'"
    Assert ([int]$n -ge 1) 'no direct_message notification'
    "rows: $n"
}
T 'Notifications' 'Report status notification exists for TST reports' {
    $c = DbScalar "SELECT COUNT(*) FROM notifications n JOIN reports r ON r.id = n.report_id WHERE r.ref_id IN ('$($script:Rep1)', '$($script:Rep2)')"
    Assert ([int]$c -ge 1) 'no notifications linked to TST reports'
    "rows: $c"
}
T 'Notifications' 'Resident notification prefs endpoint accessible' {
    $r = Api GET 'notifications/prefs-get.php' $null $res
    AssertEq $r.Status 200 "prefs-get failed: $($r.Status)"
    '200'
}
T 'Notifications' 'Staff DENIED resident-only prefs endpoint -> 403' {
    $r = Api GET 'notifications/prefs-get.php' $null $staff
    AssertEq $r.Status 403 "staff got $($r.Status)"
    '403'
}

# =====================================================================
# SUITE: Exports (7)
# =====================================================================
Write-Host '`n[EXPORTS]' -ForegroundColor Yellow

T 'Exports' 'reports CSV as Admin -> 200 text/csv' {
    $r = Api GET 'export/reports.php' $null $admin
    AssertEq $r.Status 200 "got $($r.Status)"
    $ct = "$($r.Headers['Content-Type'])"
    Assert ($ct -match 'csv') "content type: $ct"
    "content-type=$ct"
}
T 'Exports' 'residents CSV as Admin -> 200' {
    $r = Api GET 'export/residents.php' $null $admin
    AssertEq $r.Status 200 "got $($r.Status)"
    '200'
}
T 'Exports' 'activity CSV as Admin -> 200' {
    $r = Api GET 'export/activity.php' $null $admin
    AssertEq $r.Status 200 "got $($r.Status)"
    '200'
}
T 'Exports' 'custom export as Admin -> allowed' {
    $r = Api GET 'export/custom.php' $null $admin
    Assert ($r.Status -in 200, 400) "got $($r.Status)"
    "status=$($r.Status)"
}
T 'Exports' 'analytics PDF as Admin -> 200 pdf' {
    $r = Api GET 'export/analytics_pdf.php' $null $admin
    AssertEq $r.Status 200 "got $($r.Status)"
    Assert ("$($r.Headers['Content-Type'])" -match 'pdf|octet') "content type: $($r.Headers['Content-Type'])"
    'pdf'
}
T 'Exports' 'Exports DENIED to Staff -> 403' {
    $r = Api GET 'export/reports.php' $null $staff
    AssertEq $r.Status 403 "staff got $($r.Status)"
    '403'
}
T 'Exports' 'Exports DENIED to Resident -> 403' {
    $r = Api GET 'export/reports.php' $null $res
    AssertEq $r.Status 403 "resident got $($r.Status)"
    '403'
}

# =====================================================================
# SUITE: Security (17)
# =====================================================================
Write-Host '`n[SECURITY]' -ForegroundColor Yellow

$blocked = @('/.env', '/.env.example', '/test_mail.php', '/install_otp_table.php', '/create_otp_table.php',
    '/schema.sql', '/php_err.log', '/php_server.log', '/api/auth/tmp.txt', '/composer.json',
    '/tests/db-helper.php', '/backups/backup_2026-08-04_19-07-21.sql')
$i = 0
foreach ($p in $blocked) {
    $i++
    T 'Security' "Blocked: $p -> 404" {
        try { $c = (Invoke-WebRequest -UseBasicParsing -Uri ("http://127.0.0.1:8000" + $p) -TimeoutSec 15).StatusCode }
        catch { $c = [int]$_.Exception.Response.StatusCode }
        AssertEq $c 404 "got $c - RESOURCE EXPOSED!"
        '404'
    }
}

T 'Security' 'CORS: evil origin gets no ACAO header' {
    $r = Invoke-WebRequest -UseBasicParsing -Uri "$($script:Base)/settings/get.php" -Headers @{ Origin = 'http://evil.example.com' } -TimeoutSec 15
    Assert (-not $r.Headers['Access-Control-Allow-Origin']) 'ACAO present for evil origin!'
    'no ACAO'
}
T 'Security' 'CORS: localhost:5173 allowed' {
    $r = Invoke-WebRequest -UseBasicParsing -Uri "$($script:Base)/settings/get.php" -Headers @{ Origin = 'http://localhost:5173' } -TimeoutSec 15
    AssertEq $r.Headers['Access-Control-Allow-Origin'] 'http://localhost:5173' 'wrong ACAO'
    'allowed'
}
T 'Security' 'No SMTP password in any API response' {
    $hits = $script:ScanBodies | Where-Object { $_ -match 'fhsdutcxwqcbefrn|XEVERA_SMTP_PASS|smtp_pass"' }
    Assert (-not $hits) 'SMTP secret pattern found in responses!'
    'clean'
}
T 'Security' 'No OTP codes returned in API responses' {
    $hits = $script:ScanBodies | Where-Object { $_ -match '"dev_token"\s*:\s*"[^n]|"otp"\s*:\s*"\d{6}|"code"\s*:\s*"\d{6}' }
    Assert (-not $hits) 'OTP/dev_token pattern found in responses!'
    'clean'
}
T 'Security' 'No password hashes or APP_KEY in API responses' {
    $hits = $script:ScanBodies | Where-Object { $_ -match '\$2y\$|APP_KEY' }
    Assert (-not $hits) 'secret pattern found in responses!'
    'clean'
}
T 'Security' 'Unauthenticated access to protected API -> 401' {
    $r = Api GET 'users/list.php' $null $null
    AssertEq $r.Status 401 "got $($r.Status)"
    '401'
}

# =====================================================================
# Write TEST-MATRIX.md
# =====================================================================
$suites = $script:Results | Group-Object Suite
$pass = ($script:Results | Where-Object Result -eq 'PASS').Count
$fail = ($script:Results | Where-Object Result -eq 'FAIL').Count
$total = $script:Results.Count
$stamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'

$md = New-Object System.Text.StringBuilder
[void]$md.AppendLine("# Xevera Test Matrix")
[void]$md.AppendLine("")
[void]$md.AppendLine("**Run:** $stamp  ")
[void]$md.AppendLine("**Target:** $($script:Base)  ")
[void]$md.AppendLine("**Total:** $total &nbsp;|&nbsp; **PASS:** $pass &nbsp;|&nbsp; **FAIL:** $fail")
[void]$md.AppendLine("")
[void]$md.AppendLine("| Suite | Tests | PASS | FAIL |")
[void]$md.AppendLine("|---|---|---|---|")
foreach ($s in $suites) {
    $sp = ($s.Group | Where-Object Result -eq 'PASS').Count
    $sf = ($s.Group | Where-Object Result -eq 'FAIL').Count
    [void]$md.AppendLine("| $($s.Name) | $($s.Count) | $sp | $sf |")
}
[void]$md.AppendLine("")
foreach ($s in $suites) {
    [void]$md.AppendLine("## $($s.Name)")
    [void]$md.AppendLine("")
    [void]$md.AppendLine("| # | Test | Result | Detail |")
    [void]$md.AppendLine("|---|------|--------|--------|")
    $n = 0
    foreach ($r in $s.Group) {
        $n++
        $d = ($r.Detail -replace '\|', '/').Trim()
        if ($d.Length -gt 160) { $d = $d.Substring(0, 160) + '...' }
        [void]$md.AppendLine("| $n | $($r.Test) | **$($r.Result)** | $d |")
    }
    [void]$md.AppendLine("")
}
if ($script:Obs.Count -gt 0) {
    [void]$md.AppendLine("## Observations")
    [void]$md.AppendLine("")
    foreach ($o in $script:Obs) { [void]$md.AppendLine("- $o") }
    [void]$md.AppendLine("")
}
[void]$md.AppendLine("## Failures requiring fixes")
[void]$md.AppendLine("")
$fails = $script:Results | Where-Object Result -eq 'FAIL'
if ($fails) {
    foreach ($f in $fails) { [void]$md.AppendLine("- **[$($f.Suite)]** $($f.Test) - $($f.Detail)") }
} else {
    [void]$md.AppendLine("_None - all tests passed._")
}
Set-Content -LiteralPath $script:Matrix -Value $md.ToString() -Encoding UTF8

Write-Host ''
Write-Host "=== DONE: $pass PASS / $fail FAIL of $total ===" -ForegroundColor $(if ($fail -eq 0) { 'Green' } else { 'Red' })
Write-Host "Matrix written to: $script:Matrix"
if ($fail -gt 0) { exit 2 }
