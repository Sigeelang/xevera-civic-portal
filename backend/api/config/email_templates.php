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
            'subject' => 'Xevera Portal: Password reset code',
            'action' => 'reset your password',
            'password_line' => 'Your password will only be changed <strong style="color:#1261f5;">after you enter this code.</strong>',
        ],
        'password_change' => [
            'title' => 'Password Change',
            'subtitle' => 'Verification Code',
            'message' => 'We received a request to change your Xevera Portal account password. Use the verification code below to confirm the change.',
            'subject' => 'Xevera Portal: Confirm your password change',
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

    /* Six OTP digit cells. */
    $otpCells = '';
    foreach (str_split($otp) as $digit) {
        $otpCells .= '<td style="padding:0 7px;"><div style="width:70px;height:82px;line-height:82px;background:#ffffff;border-radius:8px;font-size:48px;font-weight:800;color:#1261f5;text-align:center;">'
            . htmlspecialchars($digit) . '</div></td>';
    }

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
                                                <div style="width:70px;height:70px;position:relative;">
                                                    <div style="position:absolute;width:25px;height:65px;background:#1261f5;transform:rotate(45deg);left:23px;top:3px;"></div>
                                                    <div style="position:absolute;width:25px;height:65px;background:#0b4fc4;transform:rotate(-45deg);left:23px;top:3px;"></div>
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
