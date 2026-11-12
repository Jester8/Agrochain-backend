import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { buildOtpEmailHtml } from './otp-email.template';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly resend: Resend | null;
  private readonly from: string;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('mail.resendApiKey');
    this.resend = apiKey ? new Resend(apiKey) : null;
    this.from = this.configService.get<string>('mail.from')!;
  }

  async sendOtp(email: string, code: string, purpose: 'signup' | 'password-reset') {
    const subject =
      purpose === 'signup' ? 'Verify your AgroChain account' : 'Reset your AgroChain password';
    const html = buildOtpEmailHtml({ code, purpose });

    if (!this.resend) {
      // No RESEND_API_KEY configured (default for local dev) - print instead of sending,
      // so signup/login/reset can be tested end-to-end without setting up email.
      this.logger.warn(`[DEV MODE - no RESEND_API_KEY] OTP for ${email} (${purpose}): ${code}`);
      return;
    }

    await this.resend.emails.send({
      from: this.from,
      to: email,
      subject,
      html,
    });
  }
}
