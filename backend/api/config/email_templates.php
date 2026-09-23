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
            'password_line' => 'Your password will only be changed <strong style="color:#1261f5;">after you enter this code.</strong>',
        ],
        'password_change' => [
            'title' => 'Password Change',
            'subtitle' => 'Verification Code',
            'message' => 'We received a request to change your Xevera Portal account password. Use the verification code below to confirm the change.',
            'subject' => 'Xevera Portal: Password Change Code',
            'action' => 'confirm your password change',
            'password_line' => 'Your password will only be changed <strong style="color:#1261f5;">after you enter this code.</strong>',
        ],
        'password_change_first_login' => [
            'title' => 'Set Your Password',
            'subtitle' => 'Verification Code',
            'message' => 'Set your new Xevera Portal password. Use the verification code below to confirm the change.',
            'subject' => 'Xevera Portal: Set your password',
            'action' => 'set your password',
            'password_line' => 'Your password will only be changed <strong style="color:#1261f5;">after you enter this code.</strong>',
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
    $message = $meta['message'];
    $action = $meta['action'];

    /*
     * Third info tile: the password reassurance for password purposes,
     * or a "never share this code" notice for every other purpose.
     */
    $info3 = !empty($meta['password_line'])
        ? $meta['password_line']
        : 'Never share this code with anyone. <strong style="color:#1261f5;">Xevera will never ask for it.</strong>';

    /*
     * Six OTP digit cells. Each cell is emitted on its own line so no line
     * exceeds the SMTP 998-character limit (a single glued line caused the
     * HTML to be wrapped/mangled in transit).
     */
    $cells = [];
    foreach (str_split($otp) as $digit) {
        $cells[] = '<td style="padding:0 7px;"><div style="width:70px;height:82px;line-height:82px;background:#ffffff;border-radius:8px;font-size:48px;font-weight:800;color:#1261f5;text-align:center;">'
            . htmlspecialchars($digit) . '</div></td>';
    }
    $otpCells = implode("\n" . '                                            ', $cells);

    return <<<HTML
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{$meta['title']}</title>
    <style>
        @media only screen and (max-width: 640px) {
            .xv-wrap { padding: 16px 8px !important; }
            .xv-pad { padding: 26px 22px !important; }
            .xv-otp { width: 40px !important; height: 52px !important; line-height: 52px !important; font-size: 26px !important; border-radius: 6px !important; }
            .xv-otp-td { padding: 0 3px !important; }
            .xv-stack { display: block !important; width: 100% !important; padding: 10px 0 !important; border-right: 0 !important; border-bottom: 1px solid #d8e3f0 !important; }
            .xv-greeting { font-size: 24px !important; }
        }
    </style>
</head>

<body style="margin:0;padding:0;background:#f3f7fc;font-family:Arial, Helvetica, sans-serif;color:#071B36;">

<table width="100%" cellpadding="0" cellspacing="0" border="0" class="xv-wrap" style="background:#f3f7fc; padding:30px 15px;">
    <tr>
        <td align="center">

            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:900px;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 8px 30px rgba(7,27,54,0.10);">

                <!-- Header -->
                <tr>
                    <td style="background:linear-gradient(135deg,#ffffff 0%,#eef6ff 48%,#1261f5 100%);padding:28px 55px;">
                        <table width="100%" cellpadding="0" cellspacing="0" border="0">
                            <tr>
                                <td width="60%" valign="middle">
                                    <table cellpadding="0" cellspacing="0" border="0">
                                        <tr>
                                            <td valign="middle" style="padding-right:15px;">
                                                <div style="width:70px;height:70px;border-radius:18px;background:linear-gradient(145deg,#1766f2,#0755df);text-align:center;">
                                                    <div style="font-size:38px;line-height:70px;color:#ffffff;font-weight:800;">&#10003;</div>
                                                </div>
                                            </td>
                                            <td valign="middle">
                                                <div style="font-size:42px;line-height:42px;font-weight:800;letter-spacing:3px;color:#071B36;">XEVERA</div>
                                                <div style="font-size:21px;letter-spacing:5px;color:#071B36;margin-top:3px;">CIVIC PORTAL</div>
                                                <div style="font-size:14px;color:#536b88;font-style:italic;margin-top:8px;">Sa Mas Maayos na Komunidad</div>
                                            </td>
                                        </tr>
                                    </table>
                                </td>
                                <td width="40%" align="right" valign="middle">
                                    <table cellpadding="0" cellspacing="0" border="0">
                                        <tr>
                                            <td style="border-left:2px solid rgba(18,97,245,0.45);padding-left:25px;">
                                                <div style="color:#ffffff;font-size:20px;line-height:1.5;letter-spacing:2px;font-weight:600;">SAFE<br>SECURE<br>TOGETHER</div>
                                            </td>
                                        </tr>
                                    </table>
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>

                <!-- Content -->
                <tr>
                    <td class="xv-pad" style="padding:45px 60px 20px 60px;">

                        <div class="xv-greeting" style="font-size:30px;font-weight:700;color:#071B36;margin-bottom:14px;">
                            Hello <span style="color:#071B36;">{$displayName}</span>,
                        </div>

                        <div style="font-size:17px;line-height:1.7;color:#344968;">
                            {$message}
                        </div>

                        <!-- OTP box -->
                        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:30px;background:#eef6ff;border-radius:14px;">
                            <tr>
                                <td align="center" style="padding:30px 20px;">
                                    <div style="font-size:16px;letter-spacing:5px;color:#1261f5;font-weight:600;margin-bottom:22px;">YOUR VERIFICATION CODE</div>

                                    <table cellpadding="0" cellspacing="0" border="0">
                                        <tr>
                                            {$otpCells}
                                        </tr>
                                    </table>

                                    <div style="margin-top:24px;font-size:17px;color:#536b88;">
                                        <span style="color:#1261f5;font-size:22px;">&#9683;</span>
                                        &nbsp; This code is valid for <strong style="color:#1261f5;">5 minutes.</strong>
                                    </div>
                                </td>
                            </tr>
                        </table>

                        <!-- Info row -->
                        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:28px;">
                            <tr>
                                <td width="33%" valign="top" class="xv-stack" style="padding:10px 20px 10px 0;border-right:1px solid #d8e3f0;">
                                    <table cellpadding="0" cellspacing="0">
                                        <tr>
                                            <td valign="top">
                                                <div style="width:58px;height:58px;line-height:58px;text-align:center;border-radius:50%;background:#eef6ff;color:#1261f5;font-size:28px;">&#128274;</div>
                                            </td>
                                            <td style="padding-left:15px;">
                                                <div style="font-size:15px;line-height:1.5;color:#536b88;">
                                                    Use this code to <strong style="color:#1261f5;">{$action}.</strong>
                                                </div>
                                            </td>
                                        </tr>
                                    </table>
                                </td>

                                <td width="33%" valign="top" class="xv-stack" style="padding:10px 20px;border-right:1px solid #d8e3f0;">
                                    <table cellpadding="0" cellspacing="0">
                                        <tr>
                                            <td valign="top">
                                                <div style="width:58px;height:58px;line-height:58px;text-align:center;border-radius:50%;background:#eef6ff;color:#1261f5;font-size:28px;">&#9683;</div>
                                            </td>
                                            <td style="padding-left:15px;">
                                                <div style="font-size:15px;line-height:1.5;color:#536b88;">
                                                    The code will expire in <strong style="color:#1261f5;">5 minutes.</strong>
                                                </div>
                                            </td>
                                        </tr>
                                    </table>
                                </td>

                                <td width="33%" valign="top" class="xv-stack" style="padding:10px 0 10px 20px;">
                                    <table cellpadding="0" cellspacing="0">
                                        <tr>
                                            <td valign="top">
                                                <div style="width:58px;height:58px;line-height:58px;text-align:center;border-radius:50%;background:#eef6ff;color:#1261f5;font-size:28px;">&#128737;</div>
                                            </td>
                                            <td style="padding-left:15px;">
                                                <div style="font-size:15px;line-height:1.5;color:#536b88;">
                                                    {$info3}
                                                </div>
                                            </td>
                                        </tr>
                                    </table>
                                </td>
                            </tr>
                        </table>

                        <!-- Security notice -->
                        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:25px;background:#eef6ff;border-radius:12px;">
                            <tr>
                                <td width="70" align="center" valign="middle" style="padding:20px 10px;">
                                    <div style="width:42px;height:42px;line-height:42px;border-radius:50%;background:#1261f5;color:#ffffff;font-size:25px;font-weight:bold;">i</div>
                                </td>
                                <td style="padding:18px 20px 18px 5px;font-size:15px;line-height:1.6;color:#344968;">
                                    <strong style="color:#1261f5;font-size:16px;">If you didn't request this change,</strong>
                                    <br>
                                    Please ignore this email. Your account is safe and no changes will be made.
                                </td>
                            </tr>
                        </table>

                        <div style="margin-top:28px;font-size:15px;line-height:1.7;color:#344968;">
                            This is an automated message from <strong style="color:#071B36;">Xevera Portal.</strong>
                            <br>
                            Please do not reply to this email.
                        </div>

                    </td>
                </tr>

                <!-- Footer -->
                <tr>
                    <td style="padding:10px 60px 30px 60px;">
                        <div style="height:1px;background:#d8e3f0;margin-bottom:25px;"></div>

                        <table width="100%" cellpadding="0" cellspacing="0" border="0">
                            <tr>
                                <td valign="middle">
                                    <div style="font-size:23px;font-weight:800;letter-spacing:3px;color:#1261f5;">
                                        XEVERA <span style="font-weight:400;color:#1261f5;">CIVIC</span> PORTAL
                                    </div>
                                    <div style="margin-top:7px;font-size:12px;letter-spacing:4px;color:#7891af;">SAFE &bull; SECURE &bull; TOGETHER</div>
                                </td>
                                <td align="right" valign="middle">
                                    <table cellpadding="0" cellspacing="0">
                                        <tr>
                                            <td style="padding-left:12px;"><div style="width:35px;height:35px;line-height:35px;text-align:center;border-radius:50%;background:#1261f5;color:#ffffff;font-weight:bold;">f</div></td>
                                            <td style="padding-left:12px;"><div style="width:35px;height:35px;line-height:35px;text-align:center;border-radius:50%;background:#1261f5;color:#ffffff;">&#9678;</div></td>
                                            <td style="padding-left:12px;"><div style="width:35px;height:35px;line-height:35px;text-align:center;border-radius:50%;background:#1261f5;color:#ffffff;">&#9993;</div></td>
                                        </tr>
                                    </table>
                                    <div style="margin-top:8px;font-size:12px;font-style:italic;color:#7891af;">Building a Better Xevera, Together.</div>
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>

                <!-- Bottom border -->
                <tr>
                    <td style="height:7px;background:#1261f5;font-size:0;line-height:0;">&nbsp;</td>
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
This is an automated message from Xevera Portal.
Please do not reply to this email.

XEVERA CIVIC PORTAL
SAFE \u2022 SECURE \u2022 TOGETHER

\u00a9 {$year} {$appName}. All rights reserved.
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
