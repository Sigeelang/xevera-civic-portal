<?php
/**
 * Xevera Portal - OTP Email Templates
 *
 * Single source of truth for OTP email copy and subjects. Every OTP
 * endpoint resolves its subject through xevera_otp_subject() and its
 * body through xevera_otp_email_html() / xevera_otp_email_text(),
 * passing the REAL purpose (the same string stored in otp_verifications)
 * plus the recipient's name.
 *
 * Purpose registry covers:
 *   resident_register | resident_password_reset | password_change
 *   password_change_first_login | email_change | login_2fa
 */

/**
 * Copy + subject per OTP purpose.
 * Returns: title, subtitle, message, subject, action, password_line.
 */
function xevera_otp_purpose_meta(string $purpose): array
{
    $registry = [
        'resident_register' => [
            'title' => 'Verify Your Email',
            'subtitle' => 'Verification Code',
            'message' => 'Thank you for registering with Xevera Portal. Use the verification code below to verify your email address.',
            'subject' => 'Xevera Portal: Verify your email',
            'action' => 'verify your email',
            'password_line' => null,
        ],
        'resident_password_reset' => [
            'title' => 'Password Reset',
            'subtitle' => 'Verification Code',
            'message' => 'We received a request to reset your Xevera Portal account password. Use the verification code below to complete your password reset.',
            'subject' => 'Xevera Portal: Password Reset Code',
            'action' => 'reset your password',
            'password_line' => 'Your password will only be changed after you enter this code.',
        ],
        'password_change' => [
            'title' => 'Password Change',
            'subtitle' => 'Verification Code',
            'message' => 'We received a request to change your Xevera Portal account password. Use the verification code below to confirm the change.',
            'subject' => 'Xevera Portal: Password Change Code',
            'action' => 'confirm your password change',
            'password_line' => 'Your password will only be changed after you enter this code.',
        ],
        'password_change_first_login' => [
            'title' => 'Set Your Password',
            'subtitle' => 'Verification Code',
            'message' => 'Set your new Xevera Portal password. Use the verification code below to confirm the change.',
            'subject' => 'Xevera Portal: Set your password',
            'action' => 'set your password',
            'password_line' => 'Your password will only be changed after you enter this code.',
        ],
        'email_change' => [
            'title' => 'Email Change',
            'subtitle' => 'Verification Code',
            'message' => 'You requested to change your email address. Use the verification code below to confirm the change.',
            'subject' => 'Xevera Portal: Confirm your new email',
            'action' => 'confirm your email change',
            'password_line' => null,
        ],
        'login_2fa' => [
            'title' => 'Login Verification',
            'subtitle' => 'Verification Code',
            'message' => 'A login attempt was made on your account. Use the verification code below to verify your identity.',
            'subject' => 'Xevera Portal: Login verification code',
            'action' => 'verify your login',
            'password_line' => null,
        ],
        'superadmin_recovery' => [
            'title' => 'Super Admin Recovery',
            'subtitle' => 'Verification Code',
            'message' => 'A Super Admin recovery was requested for this email address. Use the verification code below to verify your identity and complete the recovery.',
            'subject' => 'Xevera Portal: Super Admin recovery code',
            'action' => 'complete your Super Admin recovery',
            'password_line' => null,
        ],
    ];

    // Legacy aliases used by older callers.
    $aliases = [
        'password_reset' => 'resident_password_reset',
        'registration' => 'resident_register',
    ];
    if (isset($aliases[$purpose])) {
        $purpose = $aliases[$purpose];
    }

    if (isset($registry[$purpose])) {
        return $registry[$purpose];
    }

    return [
        'title' => 'Verification Code',
        'subtitle' => 'Verification Code',
        'message' => 'Use the code below to complete your action on Xevera Portal.',
        'subject' => 'Xevera Portal: Verification code',
        'action' => 'complete your request',
        'password_line' => null,
    ];
}

/**
 * Canonical, brand-first subject line for a given OTP purpose.
 */
function xevera_otp_subject(string $purpose): string
{
    return xevera_otp_purpose_meta($purpose)['subject'];
}

/**
 * Branded HTML OTP email.
 */
function xevera_otp_email_html(string $otp, string $purpose = 'resident_password_reset', string $userName = ''): string {
    $meta = xevera_otp_purpose_meta($purpose);
    $displayName = $userName ?: 'there';

    $safeTitle = htmlspecialchars((string) ($meta['title'] ?? 'Verification Code'), ENT_QUOTES, 'UTF-8');
    $safeMessage = htmlspecialchars((string) ($meta['message'] ?? ''), ENT_QUOTES, 'UTF-8');
    $safeName = htmlspecialchars($displayName ?: 'there', ENT_QUOTES, 'UTF-8');
    $safeOtp = htmlspecialchars($otp, ENT_QUOTES, 'UTF-8');
    $appName = htmlspecialchars(getenv('APP_NAME') ?: 'Xevera Portal', ENT_QUOTES, 'UTF-8');
    $year = date('Y');
    $passwordHtml = !empty($meta['password_line'])
        ? '<p style="margin:0 0 12px 0;font-size:14px;color:#374151;">'
            . htmlspecialchars((string) $meta['password_line'], ENT_QUOTES, 'UTF-8')
            . '</p>'
        : '';

    /*
     * Minimal transactional HTML. Deliberately avoids marketing-style
     * gradients, social icons and bulk headers: Gmail is far more likely
     * to keep a short, plain verification email in the inbox.
     */
    return <<<HTML
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{$safeTitle}</title>
</head>
<body style="margin:0;padding:0;background:#f4f7fb;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f7fb;padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;background:#ffffff;border:1px solid #e5e7eb;border-radius:8px;">
<tr><td style="padding:24px 28px 8px 28px;font-size:18px;font-weight:bold;color:#0f3d91;">{$appName}</td></tr>
<tr><td style="padding:0 28px;font-size:15px;line-height:1.6;">
<p style="margin:0 0 12px 0;">Hello {$safeName},</p>
<p style="margin:0 0 16px 0;">{$safeMessage}</p>
<p style="margin:0 0 8px 0;font-size:13px;color:#6b7280;text-transform:uppercase;letter-spacing:0.08em;">Your verification code</p>
<div style="font-size:34px;font-weight:bold;letter-spacing:8px;color:#0f3d91;padding:12px 0 18px 0;font-family:Consolas,monospace;">{$safeOtp}</div>
<p style="margin:0 0 8px 0;font-size:14px;color:#374151;">This code expires in 5 minutes.</p>
{$passwordHtml}
<p style="margin:0 0 20px 0;font-size:13px;color:#6b7280;">If you didn't request this, you can ignore this email. Your account is safe and no changes will be made.</p>
</td></tr>
<tr><td style="padding:16px 28px 24px 28px;border-top:1px solid #e5e7eb;font-size:12px;color:#9ca3af;">
This is an automated message from {$appName}. Please do not reply.<br>
&copy; {$year} {$appName}. All rights reserved.
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>
HTML;
}

/**
 * Returns a plain-text fallback for OTP emails.
 */
function xevera_otp_email_text(string $otp, string $purpose = 'resident_password_reset', string $userName = ''): string {
    $meta = xevera_otp_purpose_meta($purpose);
    $title = $meta['title'];
    $message = $meta['message'];

    $year = date('Y');
    $appName = getenv('APP_NAME') ?: 'Xevera Portal';
    $displayName = $userName ?: 'there';

    $passwordLine = !empty($meta['password_line'])
        ? "Your password will only be changed after you enter this code.\n"
        : '';

    return <<<TEXT
{$title} - Verification Code

Hello {$displayName},

{$message}

Your verification code: {$otp}

This code expires in 5 minutes.
{$passwordLine}
If you didn't request this change, please ignore this email. Your account is safe and no changes will be made.

---
This is an automated message from {$appName}.
Please do not reply to this email.

(c) {$year} {$appName}. All rights reserved.
TEXT;
}

/**
 * Canonical subject for the residency-approval (activation) email.
 */
function xevera_activation_email_subject(): string
{
    return 'Your Xevera Civic Portal Account Has Been Activated';
}

/**
 * Branded HTML account-activation email sent when a Super Admin /
 * Admin approves a resident's proof of residency.
 *
 * Lines are kept short on purpose: the mailer ships bodies raw
 * (8bit, no quoted-printable), so a single glued line longer than
 * the SMTP 998-character limit gets wrapped/mangled in transit.
 */
function xevera_activation_email_html(string $fullName, string $email, string $loginUrl): string
{
    $safeName = htmlspecialchars($fullName !== '' ? $fullName : 'Resident', ENT_QUOTES, 'UTF-8');
    $safeEmail = htmlspecialchars($email, ENT_QUOTES, 'UTF-8');
    $safeLogin = htmlspecialchars($loginUrl, ENT_QUOTES, 'UTF-8');

    return <<<HTML
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Xevera Account Activated</title>
</head>
<body style="margin:0;padding:0;background:#f4f7fb;
font-family:Arial, Helvetica, sans-serif;color:#172d53;">
<table width="100%" cellpadding="0" cellspacing="0" border="0"
style="background:#f4f7fb;padding:35px 15px;">
    <tr>
        <td align="center">
            <table width="600" cellpadding="0" cellspacing="0" border="0"
            style="max-width:600px;width:100%;background:#ffffff;
            border-radius:14px;overflow:hidden;
            border:1px solid #e1e8f2;">
                <tr>
                    <td style="background:#102a56;padding:28px 35px;
                    text-align:center;">
                        <div style="display:inline-block;width:48px;
                        height:48px;line-height:48px;background:#1769ed;
                        border-radius:12px;color:#ffffff;font-size:25px;
                        font-weight:bold;margin-bottom:10px;">&#10003;</div>
                        <div style="color:#ffffff;font-size:25px;
                        font-weight:bold;letter-spacing:.5px;">XEVERA</div>
                        <div style="color:#bcd5ff;font-size:11px;
                        margin-top:3px;letter-spacing:1.5px;">
                        CIVIC PORTAL</div>
                    </td>
                </tr>
                <tr>
                    <td style="padding:30px 35px 10px;text-align:center;">
                        <div style="display:inline-block;width:62px;
                        height:62px;line-height:62px;border-radius:50%;
                        background:#e5f8ef;color:#079455;font-size:32px;
                        font-weight:bold;">&#10003;</div>
                        <h1 style="margin:18px 0 8px;color:#102a56;
                        font-size:25px;">Account Activated!</h1>
                        <p style="margin:0;color:#7184a2;font-size:14px;
                        line-height:1.6;">
                        Your Xevera Civic Portal account has been
                        successfully verified and activated.</p>
                    </td>
                </tr>
                <tr>
                    <td style="padding:20px 35px 30px;">
                        <p style="margin:0 0 18px;font-size:14px;
                        line-height:1.7;color:#344c70;">
                        Hello <strong>{$safeName}</strong>,</p>
                        <p style="margin:0 0 20px;font-size:14px;
                        line-height:1.7;color:#344c70;">
                        Thank you for registering with the
                        <strong>Xevera Civic Portal</strong>.
                        We have reviewed your submitted proof of residency
                        and your account has been approved.</p>
                        <table width="100%" cellpadding="0"
                        cellspacing="0"
                        style="background:#f5f8fd;
                        border:1px solid #e1e8f2;border-radius:10px;
                        margin-bottom:22px;">
                            <tr>
                                <td colspan="2"
                                style="padding:16px 18px 10px;font-size:14px;
                                font-weight:bold;color:#102a56;">
                                Account Information</td>
                            </tr>
                            <tr>
                                <td style="padding:7px 18px;color:#7184a2;
                                font-size:12px;width:40%;">Full Name</td>
                                <td style="padding:7px 18px;color:#172d53;
                                font-size:12px;font-weight:bold;">
                                {$safeName}</td>
                            </tr>
                            <tr>
                                <td style="padding:7px 18px;color:#7184a2;
                                font-size:12px;">Email Address</td>
                                <td style="padding:7px 18px;color:#172d53;
                                font-size:12px;font-weight:bold;">
                                {$safeEmail}</td>
                            </tr>
                            <tr>
                                <td style="padding:7px 18px 16px;
                                color:#7184a2;font-size:12px;">
                                Account Status</td>
                                <td style="padding:7px 18px 16px;">
                                    <span style="display:inline-block;
                                    background:#e5f8ef;color:#079455;
                                    padding:5px 10px;border-radius:6px;
                                    font-size:11px;font-weight:bold;">
                                    &#9679; Active</span>
                                </td>
                            </tr>
                        </table>
                        <div style="text-align:center;margin:25px 0;">
                            <a href="{$safeLogin}"
                            style="display:inline-block;background:#1265ed;
                            color:#ffffff;text-decoration:none;
                            padding:13px 30px;border-radius:8px;
                            font-size:13px;font-weight:bold;">
                            Sign In to Xevera Portal</a>
                        </div>
                        <table width="100%" cellpadding="0"
                        cellspacing="0"
                        style="background:#eef6ff;border-radius:9px;
                        border:1px solid #d6e8ff;">
                            <tr>
                                <td style="padding:14px 16px;
                                color:#24558f;font-size:12px;
                                line-height:1.6;">
                                <strong>&#128274; Security
                                Reminder</strong><br>
                                Never share your password, verification
                                codes, or other account credentials
                                with anyone.</td>
                            </tr>
                        </table>
                        <p style="margin:22px 0 0;color:#526987;
                        font-size:13px;line-height:1.7;">
                        You can now use your account to submit civic
                        reports, track report updates, receive community
                        announcements, and stay connected with the Xevera
                        community.</p>
                        <p style="margin:20px 0 0;color:#526987;
                        font-size:13px;line-height:1.7;">
                        Welcome to the Xevera community!</p>
                        <p style="margin:20px 0 0;color:#172d53;
                        font-size:13px;line-height:1.7;">
                        Regards,<br>
                        <strong>Xevera Civic Portal Team</strong></p>
                    </td>
                </tr>
                <tr>
                    <td style="background:#f7f9fc;
                    border-top:1px solid #e6ebf2;padding:20px 30px;
                    text-align:center;">
                        <div style="color:#6d7f9d;font-size:11px;
                        line-height:1.6;">
                        This is an automated message from the
                        Xevera Civic Portal.</div>
                        <div style="color:#9aa8bb;font-size:10px;
                        margin-top:7px;">
                        Please do not reply directly to this email.</div>
                        <div style="margin-top:12px;color:#1265ed;
                        font-size:10px;font-weight:bold;">
                        XEVERA CIVIC PORTAL</div>
                    </td>
                </tr>
            </table>
        </td>
    </tr>
</table>
</body>
</html>
HTML;
}

/**
 * Plain-text fallback for the account-activation email.
 */
function xevera_activation_email_text(string $fullName, string $email, string $loginUrl): string
{
    $displayName = $fullName !== '' ? $fullName : 'Resident';

    return <<<TEXT
Account Activated!

Hello {$displayName},

Thank you for registering with the Xevera Civic Portal.
We have reviewed your submitted proof of residency
and your account has been approved.

Account Information
Full Name: {$displayName}
Email Address: {$email}
Account Status: Active

Sign in here: {$loginUrl}

Security Reminder: never share your password,
verification codes, or other account credentials
with anyone.

You can now use your account to submit civic reports,
track report updates, receive community announcements,
and stay connected with the Xevera community.

Welcome to the Xevera community!

Regards,
Xevera Civic Portal Team

---
This is an automated message from the Xevera Civic Portal.
Please do not reply directly to this email.
TEXT;
}

function xevera_account_created_email_subject(string $role): string
{
    $kind = strtolower($role) === 'admin' ? 'Administrator' : 'Staff';
    return "Your Xevera {$kind} Account Has Been Created";
}

/**
 * Branded HTML welcome email with temporary credentials, sent when a
 * Super Admin creates a Staff / Admin account.
 *
 * Table-based layout with inline styles (email-client safe) and short
 * source lines (raw 8bit shipping, SMTP 998-char limit).
 */
function xevera_account_created_email_html(
    string $fullName,
    string $username,
    string $email,
    string $role,
    string $status,
    string $tempPassword,
    string $loginUrl
): string {
    $safeName = htmlspecialchars($fullName !== '' ? $fullName : 'Team Member', ENT_QUOTES, 'UTF-8');
    $safeUsername = htmlspecialchars($username, ENT_QUOTES, 'UTF-8');
    $safeEmail = htmlspecialchars($email, ENT_QUOTES, 'UTF-8');
    $safeRole = htmlspecialchars($role !== '' ? $role : 'Staff', ENT_QUOTES, 'UTF-8');
    $safeStatus = htmlspecialchars($status !== '' ? $status : 'Active', ENT_QUOTES, 'UTF-8');
    $safePass = htmlspecialchars($tempPassword, ENT_QUOTES, 'UTF-8');
    $safeLogin = htmlspecialchars($loginUrl, ENT_QUOTES, 'UTF-8');
    $isAdmin = strtolower($role) === 'admin' || strtolower($role) === 'administrator';
    $kindWord = $isAdmin ? 'administrator' : 'staff';
    $kindTitle = $isAdmin ? 'Administrator' : 'Staff';

    return <<<HTML
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>XEVERA Account Created</title>
</head>
<body style="margin:0;padding:0;background:#f3f6fa;
font-family:Arial, Helvetica, sans-serif;color:#17264d;">
<table width="100%" cellpadding="0" cellspacing="0" border="0"
style="background:#f3f6fa;padding:40px 20px;">
    <tr>
        <td align="center">
            <table width="600" cellpadding="0" cellspacing="0" border="0"
            style="max-width:600px;width:100%;background:#ffffff;
            border-radius:12px;overflow:hidden;
            border:1px solid #e1e7ef;">
                <tr>
                    <td style="background:#053170;padding:30px 40px;">
                        <div style="color:#ffffff;font-size:30px;
                        font-weight:bold;letter-spacing:3px;
                        line-height:1;">XEVERA</div>
                        <div style="color:#8dbbff;font-size:11px;
                        letter-spacing:3px;margin-top:8px;">
                        CIVIC REPORTING SYSTEM</div>
                    </td>
                </tr>
                <tr>
                    <td style="padding:27px 32px 10px;">
                        <div style="font-size:26px;line-height:1.2;
                        color:#14244c;font-weight:bold;">
                        Your Xevera Account Has Been Created</div>
                        <p style="margin:12px 0 7px;font-size:18px;
                        color:#24385f;">Hello
                        <strong style="color:#1768e5;">{$safeName}</strong>,</p>
                        <p style="margin:0 0 20px;color:#4c6083;
                        font-size:14px;line-height:1.55;">
                        Your {$kindWord} account has been created in the
                        Xevera Civic Reporting System by a
                        Super Administrator. You can now sign in
                        using the account credentials below.</p>
                    </td>
                </tr>
                <tr>
                    <td style="padding:0 32px 7px;">
                        <div style="color:#5574a8;font-size:12px;
                        font-weight:bold;letter-spacing:2px;
                        margin-bottom:10px;">ACCOUNT INFORMATION</div>
                        <table width="100%" cellpadding="0"
                        cellspacing="0" border="0"
                        style="border:1px solid #dce6f2;
                        border-radius:8px;">
                            <tr>
                                <td style="padding:9px 14px;
                                font-size:13px;color:#354a70;
                                font-weight:bold;
                                border-bottom:1px solid #e5ebf3;"
                                width="40%">Name</td>
                                <td style="padding:9px 14px;
                                font-size:13px;color:#17264d;
                                border-bottom:1px solid #e5ebf3;">
                                {$safeName}</td>
                            </tr>
                            <tr>
                                <td style="padding:9px 14px;
                                font-size:13px;color:#354a70;
                                font-weight:bold;
                                border-bottom:1px solid #e5ebf3;"
                                width="40%">Username</td>
                                <td style="padding:9px 14px;
                                font-size:13px;color:#17264d;
                                border-bottom:1px solid #e5ebf3;">
                                {$safeUsername}</td>
                            </tr>
                            <tr>
                                <td style="padding:9px 14px;
                                font-size:13px;color:#354a70;
                                font-weight:bold;
                                border-bottom:1px solid #e5ebf3;"
                                width="40%">Email Address</td>
                                <td style="padding:9px 14px;
                                font-size:13px;color:#17264d;
                                border-bottom:1px solid #e5ebf3;">
                                {$safeEmail}</td>
                            </tr>
                            <tr>
                                <td style="padding:9px 14px;
                                font-size:13px;color:#354a70;
                                font-weight:bold;
                                border-bottom:1px solid #e5ebf3;"
                                width="40%">Role</td>
                                <td style="padding:9px 14px;
                                font-size:13px;color:#1465df;
                                font-weight:bold;
                                border-bottom:1px solid #e5ebf3;">
                                {$safeRole}</td>
                            </tr>
                            <tr>
                                <td style="padding:9px 14px;
                                font-size:13px;color:#354a70;
                                font-weight:bold;"
                                width="40%">Account Status</td>
                                <td style="padding:9px 14px;
                                font-size:13px;color:#17264d;">
                                <span style="color:#16b364;">
                                &#9679;</span> {$safeStatus}</td>
                            </tr>
                        </table>
                    </td>
                </tr>
                <tr>
                    <td style="padding:7px 32px;">
                        <div style="color:#5574a8;font-size:12px;
                        font-weight:bold;letter-spacing:2px;
                        margin-bottom:10px;">
                        YOUR TEMPORARY LOGIN CREDENTIALS</div>
                        <table width="100%" cellpadding="0"
                        cellspacing="0" border="0">
                            <tr>
                                <td width="50%" style="padding-right:7px;">
                                    <div style="background:#ffffff;
                                    border:1px solid #d8e3ef;
                                    border-radius:9px;padding:13px 16px;">
                                        <div style="color:#566985;
                                        font-size:12px;margin-bottom:5px;">
                                        Username</div>
                                        <div style="color:#13234b;
                                        font-size:16px;font-weight:bold;
                                        word-break:break-all;">
                                        {$safeUsername}</div>
                                    </div>
                                </td>
                                <td width="50%" style="padding-left:7px;">
                                    <div style="background:#ffffff;
                                    border:1px solid #d8e3ef;
                                    border-radius:9px;padding:13px 16px;">
                                        <div style="color:#566985;
                                        font-size:12px;margin-bottom:5px;">
                                        Initial Password</div>
                                        <div style="color:#13234b;
                                        font-size:16px;font-weight:bold;
                                        word-break:break-all;">
                                        {$safePass}</div>
                                    </div>
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>
                <tr>
                    <td style="padding:7px 32px;">
                        <div style="background:#fff9ed;
                        border:1px solid #f1dba8;border-radius:10px;
                        padding:15px 20px;">
                            <div style="color:#db7900;font-size:14px;
                            font-weight:800;letter-spacing:1px;
                            margin-bottom:4px;">IMPORTANT</div>
                            <div style="color:#4d4c49;font-size:13px;
                            line-height:1.45;">
                            This is a temporary password provided for
                            your first login. You will be required to
                            change this password after signing in
                            for security purposes.</div>
                        </div>
                    </td>
                </tr>
                <tr>
                    <td align="center" style="padding:17px 32px 12px;">
                        <a href="{$safeLogin}"
                        style="display:inline-block;min-width:280px;
                        padding:15px 30px;border-radius:9px;
                        background:#176bea;color:#ffffff;
                        font-size:16px;font-weight:bold;
                        text-decoration:none;">
                        SIGN IN TO XEVERA &#8594;</a>
                    </td>
                </tr>
                <tr>
                    <td style="padding:0 32px 20px;color:#637899;
                    font-size:12px;line-height:1.55;">
                        For security, please do not share your username
                        or temporary password with anyone.<br>
                        If you did not expect this account to be
                        created, please contact your Xevera system
                        administrator immediately.
                    </td>
                </tr>
                <tr>
                    <td style="background:#f5f7fa;
                    border-top:1px solid #e2e7ed;
                    padding:17px 32px;">
                        <div style="color:#14244c;font-weight:800;
                        font-size:15px;letter-spacing:3px;">XEVERA</div>
                        <div style="color:#617493;font-size:12px;
                        margin-top:4px;">
                        This is an automated message.<br>
                        Please do not reply directly to this email.</div>
                    </td>
                </tr>
            </table>
        </td>
    </tr>
</table>
</body>
</html>
HTML;
}

/**
 * Plain-text fallback for the account-created email.
 */
function xevera_account_created_email_text(
    string $fullName,
    string $username,
    string $email,
    string $role,
    string $status,
    string $tempPassword,
    string $loginUrl
): string {
    $displayName = $fullName !== '' ? $fullName : 'Team Member';
    $isAdmin = strtolower($role) === 'admin' || strtolower($role) === 'administrator';
    $kindWord = $isAdmin ? 'administrator' : 'staff';

    return <<<TEXT
Your Xevera Account Has Been Created

Hello {$displayName},

Your {$kindWord} account has been created in the
Xevera Civic Reporting System by a
Super Administrator. You can now sign in
using the account credentials below.

Account Information
Name: {$displayName}
Username: {$username}
Email Address: {$email}
Role: {$role}
Account Status: {$status}

Your Temporary Login Credentials
Username: {$username}
Initial Password: {$tempPassword}

IMPORTANT: This is a temporary password provided
for your first login. You will be required to
change this password after signing in
for security purposes.

Sign in here: {$loginUrl}

For security, please do not share your username
or temporary password with anyone.
If you did not expect this account to be
created, please contact your Xevera system
administrator immediately.

Regards,
Xevera Civic Portal Team

---
This is an automated message from the Xevera Civic Portal.
Please do not reply directly to this email.
TEXT;
}
