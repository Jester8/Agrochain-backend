import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { buildOtpEmailHtml } from './otp-email.template';

const BREVO_API = 'https://api.brevo.com/v3';

interface Recipient {
  email: string;
  name?: string;
}

export interface SendEmailOptions {
  to: Recipient;
  subject: string;
  html: string;
  text?: string;
  tags?: string[];
}

/** Sends transactional email and manages newsletter contacts through Brevo. */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly apiKey: string;
  private readonly sender: { email: string; name?: string };
  private readonly waitlistListId?: number;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('mail.brevoApiKey') ?? '';
    this.sender = parseFrom(this.configService.get<string>('mail.from')!);
    this.waitlistListId = this.configService.get<number>('mail.waitlistListId');
  }

  async sendOtp(email: string, code: string, purpose: 'signup' | 'password-reset') {
    const subject =
      purpose === 'signup' ? 'Verify your AgroChain account' : 'Reset your AgroChain password';

    if (!this.apiKey) {
      // No BREVO_API_KEY configured (default for local dev) - print instead of sending,
      // so signup/login/reset can be tested end-to-end without setting up email.
      this.logger.warn(`[DEV MODE - no BREVO_API_KEY] OTP for ${email} (${purpose}): ${code}`);
      return;
    }

    await this.send({ to: { email }, subject, html: buildOtpEmailHtml({ code, purpose }), tags: [`otp-${purpose}`] });
  }

  async send(options: SendEmailOptions) {
    if (!this.apiKey) {
      this.logger.warn(`[DEV MODE - no BREVO_API_KEY] Email to ${options.to.email}: "${options.subject}"`);
      return;
    }

    const res = await fetch(`${BREVO_API}/smtp/email`, {
      method: 'POST',
      headers: { 'api-key': this.apiKey, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        sender: this.sender,
        to: [options.to],
        subject: options.subject,
        htmlContent: options.html,
        textContent: options.text,
        tags: options.tags,
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      throw new Error(`Brevo send failed (${res.status}): ${await res.text()}`);
    }
  }

  /** Adds (or updates) a newsletter contact. Never throws: a Brevo hiccup must not fail a sign-up. */
  async addContact(email: string, attributes: Record<string, string> = {}) {
    if (!this.apiKey) return;
    try {
      const res = await fetch(`${BREVO_API}/contacts`, {
        method: 'POST',
        headers: { 'api-key': this.apiKey, 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({
          email,
          attributes,
          listIds: this.waitlistListId ? [this.waitlistListId] : undefined,
          updateEnabled: true,
        }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok && res.status !== 204) {
        this.logger.warn(`Brevo contact upsert failed (${res.status}): ${await res.text()}`);
      }
    } catch (error) {
      this.logger.warn(`Brevo contact upsert error: ${String(error)}`);
    }
  }
}

/** "AgroChain <hello@agrochain.africa>" -> { name, email }; a bare address -> { email }. */
function parseFrom(from: string): { email: string; name?: string } {
  const match = from.match(/^\s*(.*?)\s*<\s*([^>]+)\s*>\s*$/);
  if (!match) return { email: from.trim() };
  return match[1] ? { name: match[1].replace(/^"|"$/g, ''), email: match[2] } : { email: match[2] };
}
