<?php
/**
 * Xevera Portal - OTP Email HTML Template
 * 
 * Usage:
 *   $html = xevera_otp_email_html($otp, 'password_reset');
 *   $html = xevera_otp_email_html($otp, 'registration');
 *   $html = xevera_otp_email_html($otp, 'login_2fa');
 *   $html = xevera_otp_email_html($otp, 'email_change');
 *   $html = xevera_otp_email_html($otp, 'password_change', 'Hanz');
 */

function xevera_otp_email_html(string $otp, string $purpose = 'password_reset', string $userName = ''): string {
    $appName = getenv('APP_NAME') ?: 'Xevera Portal';
    $year = date('Y');
    $displayName = $userName ?: 'there';

    $titles = [
        'password_reset'   => 'Password Reset Request',
        'registration'     => 'Verify Your Email',
        'login_2fa'        => 'Login Verification',
        'email_change'     => 'Email Change Request',
        'password_change'  => 'Password Change Request',
    ];
    $subtitles = [
        'password_reset'   => 'Verification Code',
        'registration'     => 'Verification Code',
        'login_2fa'        => 'Verification Code',
        'email_change'     => 'Verification Code',
        'password_change'  => 'Verification Code',
    ];
    $messages = [
        'password_reset'   => 'We received a request to reset your Xevera Portal account password. Use the code below to complete your password reset.',
        'registration'     => 'Thank you for registering with Xevera Portal. Use the code below to verify your email address.',
        'login_2fa'        => 'A login attempt was made on your account. Use the code below to verify your identity.',
        'email_change'     => 'You requested to change your email address. Use the code below to confirm the change.',
        'password_change'  => 'We received a request to change your Xevera Portal account password.',
    ];

    $title = $titles[$purpose] ?? 'Verification Code';
    $subtitle = $subtitles[$purpose] ?? 'Verification Code';
    $message = $messages[$purpose] ?? 'Use the code below to complete your action on Xevera Portal.';

    $otpDigits = str_split($otp);
    $otpBoxes = '';
    foreach ($otpDigits as $i => $digit) {
        $borderColor = '#D0E2F7';
        $otpBoxes .= '<td style="background-color:#ffffff;border:2px solid ' . $borderColor . ';border-radius:10px;width:52px;height:62px;text-align:center;vertical-align:middle;font-size:30px;font-weight:800;color:#0B2557;font-family:\'Segoe UI\',Tahoma,Geneva,Verdana,sans-serif;">' . htmlspecialchars($digit) . '</td>';
    }

    return <<<HTML
<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <title>{$title}</title>
    <!--[if mso]>
    <noscript>
        <xml>
            <o:OfficeDocumentSettings>
                <o:PixelsPerInch>96</o:PixelsPerInch>
            </o:OfficeDocumentSettings>
        </xml>
    </noscript>
    <![endif]-->
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        body { margin: 0; padding: 0; background-color: #F0F4FA; font-family: 'Inter', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; -webkit-font-smoothing: antialiased; -ms-text-size-adjust: 100%; }
        table { border-collapse: collapse; }
        img { border: 0; outline: none; text-decoration: none; -ms-interpolation-mode: bicubic; }
        @media only screen and (max-width: 600px) {
            .email-container { width: 100% !important; max-width: 100% !important; }
            .otp-table td { width: 44px !important; height: 52px !important; font-size: 24px !important; }
            .email-padding { padding: 28px 24px !important; }
            .header-padding { padding: 24px 24px 20px !important; }
            .footer-padding { padding: 20px 24px 24px !important; }
        }
    </style>
</head>
<body style="margin:0;padding:0;background-color:#F0F4FA;font-family:'Inter','Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
    <!-- Preheader -->
    <div style="display:none;font-size:1px;color:#F0F4FA;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">
        {$subtitle}: {$otp} &mdash; Valid for 5 minutes.
    </div>

    <!-- Full wrapper -->
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:#F0F4FA;">
        <tr>
            <td align="center" style="padding:32px 16px 40px;">

                <!-- Email Container -->
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" class="email-container" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 2px 12px rgba(11,37,87,0.06);">

                    <!-- ===== HEADER ===== -->
                    <tr>
                        <td style="background:linear-gradient(135deg,#0B5ED7 0%,#1565C0 100%);padding:24px 32px;">
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                <tr>
                                    <td align="left" style="width:50%;vertical-align:middle;">
                                        <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                                            <tr>
                                                <td style="padding-right:10px;vertical-align:middle;">
                                                    <!-- Shield + Check Icon -->
                                                    <svg width="36" height="36" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:block;">
                                                        <rect width="40" height="40" rx="10" fill="rgba(255,255,255,0.13)"/>
                                                        <path d="M20 7L10 12V22C10 27.5 14.2 32.6 20 35C25.8 32.6 30 27.5 30 22V12L20 7Z" stroke="white" stroke-width="1.8" fill="none"/>
                                                        <path d="m15.5 20 3 3 5.5-5.5" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                                                    </svg>
                                                </td>
                                                <td style="vertical-align:middle;">
                                                    <div style="font-size:17px;font-weight:800;color:#ffffff;letter-spacing:3px;line-height:1;">XEVERA</div>
                                                    <div style="font-size:8px;font-weight:600;color:rgba(255,255,255,0.7);letter-spacing:3px;margin-top:2px;">CIVIC PORTAL</div>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                    <td align="right" style="width:50%;vertical-align:middle;">
                                        <div style="font-size:9px;font-weight:600;color:rgba(255,255,255,0.75);letter-spacing:0.5px;text-align:right;line-height:1.3;">
                                            Sa Mas Maayos na Komunidad
                                        </div>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- ===== LIGHT BLUE SECTION ===== -->
                    <tr>
                        <td class="header-padding" style="background-color:#EBF4FF;padding:28px 32px 24px;text-align:center;border-bottom:1px solid #D8E6F8;">
                            <!-- Envelope Icon -->
                            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:block;margin:0 auto 14px;">
                                <rect x="2" y="4" width="20" height="16" rx="2.5" stroke="#0B5ED7" stroke-width="1.6" fill="none"/>
                                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" stroke="#0B5ED7" stroke-width="1.6" fill="none"/>
                                <circle cx="17.5" cy="14.5" r="3.5" fill="#EBF4FF" stroke="#0B5ED7" stroke-width="1.3"/>
                                <path d="M16 14.5l1 1 2-2" stroke="#0B5ED7" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                            <div style="font-size:18px;font-weight:800;color:#0B2557;letter-spacing:-0.2px;margin-bottom:3px;">{$title}</div>
                            <div style="font-size:12px;font-weight:700;color:#0B5ED7;letter-spacing:1.5px;text-transform:uppercase;">{$subtitle}</div>
                            <div style="font-size:13px;color:#5A7BA5;margin-top:10px;line-height:1.6;max-width:380px;margin-left:auto;margin-right:auto;">{$message}</div>
                        </td>
                    </tr>

                    <!-- ===== MAIN CONTENT ===== -->
                    <tr>
                        <td class="email-padding" style="padding:32px 36px 28px;">

                            <!-- Greeting -->
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                <tr>
                                    <td style="padding-bottom:22px;font-size:14px;color:#374B6A;line-height:1.6;">
                                        Hello <strong style="color:#0B2557;">{$displayName}</strong>,
                                    </td>
                                </tr>
                            </table>

                            <!-- ===== OTP BOX ===== -->
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                <tr>
                                    <td style="padding-bottom:22px;">
                                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#F5F9FF;border-radius:14px;border:1px solid #E0EBF8;">
                                            <tr>
                                                <td style="padding:24px 20px;text-align:center;">
                                                    <div style="font-size:11px;font-weight:700;color:#5A7BA5;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:14px;">Your verification code</div>
                                                    <table role="presentation" cellspacing="8" cellpadding="0" border="0" align="center" class="otp-table">
                                                        <tr>
                                                            {$otpBoxes}
                                                        </tr>
                                                    </table>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>

                            <!-- ===== EXPIRY + INFO ===== -->
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                <tr>
                                    <td style="padding:10px 0;">
                                        <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                                            <tr>
                                                <td style="vertical-align:top;padding-right:10px;">
                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0B5ED7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block;margin-top:1px;">
                                                        <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
                                                    </svg>
                                                </td>
                                                <td style="font-size:13px;color:#374B6A;line-height:1.5;">
                                                    This code expires in <strong style="color:#0B5ED7;">5 minutes</strong>.
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding:10px 0;">
                                        <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                                            <tr>
                                                <td style="vertical-align:top;padding-right:10px;">
                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0B5ED7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block;margin-top:1px;">
                                                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                                                    </svg>
                                                </td>
                                                <td style="font-size:13px;color:#374B6A;line-height:1.5;">
                                                    Your password will only be changed <strong>after you enter this code</strong>.
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>

                            <!-- ===== GREEN SECURITY BOX ===== -->
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                <tr>
                                    <td style="padding:12px 0 0;">
                                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:#ECFDF5;border-radius:10px;border:1px solid #A7F3D0;">
                                            <tr>
                                                <td style="padding:14px 18px;">
                                                    <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                                                        <tr>
                                                            <td style="vertical-align:top;padding-right:10px;">
                                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block;margin-top:1px;">
                                                                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                                                                    <path d="m9 12 2 2 4-4"/>
                                                                </svg>
                                                            </td>
                                                            <td>
                                                                <div style="font-size:12px;font-weight:700;color:#065F46;margin-bottom:3px;">If you didn't request this change</div>
                                                                <div style="font-size:11.5px;color:#047857;line-height:1.5;">Please ignore this email. Your account is safe and no changes will be made.</div>
                                                            </td>
                                                        </tr>
                                                    </table>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>

                        </td>
                    </tr>

                    <!-- ===== FOOTER ===== -->
                    <tr>
                        <td style="background-color:#F8FAFD;border-top:1px solid #EDF2F9;padding:22px 36px 26px;">
                            <!-- Divider -->
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                <tr>
                                    <td style="padding-bottom:16px;">
                                        <div style="width:100%;height:1px;background:linear-gradient(90deg,transparent,#D0DFF0,transparent);"></div>
                                    </td>
                                </tr>
                            </table>
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                <tr>
                                    <td style="text-align:center;">
                                        <div style="font-size:11px;color:#7A8FAA;line-height:1.7;">
                                            This is an automated message from <strong style="color:#5A7BA5;">Xevera Portal</strong>.<br>
                                            Please do not reply to this email.
                                        </div>
                                        <div style="margin-top:12px;">
                                            <span style="font-size:11px;font-weight:800;color:#0B5ED7;letter-spacing:2px;">XEVERA CIVIC PORTAL</span>
                                        </div>
                                        <div style="margin-top:5px;">
                                            <span style="font-size:8px;font-weight:600;color:#9AAFC8;letter-spacing:3px;">SAFE &bull; SECURE &bull; TOGETHER</span>
                                        </div>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                </table>
                <!-- / Email Container -->

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
function xevera_otp_email_text(string $otp, string $purpose = 'password_reset', string $userName = ''): string {
    $titles = [
        'password_reset'   => 'Password Reset Request',
        'registration'     => 'Verify Your Email',
        'login_2fa'        => 'Login Verification',
        'email_change'     => 'Email Change Request',
        'password_change'  => 'Password Change Request',
    ];
    $messages = [
        'password_reset'   => 'We received a request to reset your Xevera Portal account password.',
        'registration'     => 'Thank you for registering with Xevera Portal. Use the code below to verify your email.',
        'login_2fa'        => 'A login attempt was made on your account. Use the code below to verify your identity.',
        'email_change'     => 'You requested to change your email address. Use the code below to confirm.',
        'password_change'  => 'We received a request to change your Xevera Portal account password.',
    ];

    $year = date('Y');
    $appName = getenv('APP_NAME') ?: 'Xevera Portal';
    $displayName = $userName ?: 'there';
    $title = $titles[$purpose] ?? 'Verification Code';
    $message = $messages[$purpose] ?? 'Use the code below to complete your action on Xevera Portal.';

    return <<<TEXT
{$title} - Verification Code

Hello {$displayName},

{$message}

Your verification code: {$otp}

This code expires in 5 minutes. Your password will only be changed after you enter this code.

If you didn't request this change, please ignore this email. Your account is safe and no changes will be made.

---
This is an automated message from Xevera Portal.
Please do not reply to this email.

XEVERA CIVIC PORTAL
SAFE \u2022 SECURE \u2022 TOGETHER

\u00a9 {$year} {$appName}. All rights reserved.
TEXT;
}
