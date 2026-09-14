import { AGROCHAIN_LOGO_DATA_URI } from './logo-base64';

const GREEN = '#1b5e20';
const GREEN_ACCENT = '#2D6A4F';
const GREEN_LIGHT = '#E6F4EA';
const TEXT = '#1a1a1a';
const TEXT_MUTED = '#6B7280';
const BORDER = '#E8E8E8';

interface OtpEmailOptions {
  code: string;
  purpose: 'signup' | 'password-reset';
}

export function buildOtpEmailHtml({ code, purpose }: OtpEmailOptions): string {
  const heading = purpose === 'signup' ? 'Verify your email' : 'Reset your password';
  const bodyText =
    purpose === 'signup'
      ? "Enter this code in the app to verify your email and finish creating your AgroChain account."
      : 'Enter this code in the app to continue resetting your AgroChain account password.';
  const codeDigits = code.split('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${heading}</title>
</head>
<body style="margin:0; padding:0; background-color:#F3F6F3; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F3F6F3; padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px; width:100%;">

          <!-- Logo -->
          <tr>
            <td align="center" style="padding-bottom:28px;">
              <img
                src="${AGROCHAIN_LOGO_DATA_URI}"
                alt="AgroChain - Secure farm records"
                width="220"
                style="display:block; width:220px; max-width:70%; height:auto; border:0;"
              />
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background-color:#FFFFFF; border-radius:16px; border:1px solid ${BORDER}; padding:40px 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding-bottom:12px;">
                    <p style="margin:0; font-size:20px; font-weight:700; color:${TEXT};">
                      ${heading}
                    </p>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-bottom:28px;">
                    <p style="margin:0; font-size:14px; line-height:22px; color:${TEXT_MUTED};">
                      ${bodyText}
                    </p>
                  </td>
                </tr>

                <!-- OTP code -->
                <tr>
                  <td align="center" style="padding-bottom:20px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" style="background-color:${GREEN_LIGHT}; border-radius:12px;">
                      <tr>
                        <td style="padding:18px 28px;">
                          <span style="font-size:32px; font-weight:700; letter-spacing:10px; color:${GREEN}; font-family:'Courier New',Courier,monospace;">
                            ${codeDigits.join('&nbsp;')}
                          </span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <tr>
                  <td align="center" style="padding-bottom:4px;">
                    <p style="margin:0; font-size:12px; color:${TEXT_MUTED};">
                      This code expires in 10 minutes.
                    </p>
                  </td>
                </tr>
                <tr>
                  <td align="center">
                    <p style="margin:0; font-size:12px; color:${TEXT_MUTED};">
                      Didn't request this? You can safely ignore this email.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding-top:24px;">
              <p style="margin:0 0 4px; font-size:12px; color:${TEXT_MUTED};">
                <span style="color:${GREEN_ACCENT}; font-weight:600;">AgroChain</span> &middot; Secure farm records
              </p>
              <p style="margin:0; font-size:11px; color:#B0B0B0;">
                agrochain.africa
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
