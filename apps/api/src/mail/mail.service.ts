import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, type Transporter } from 'nodemailer';

export type MailMessage = {
  to: string;
  subject: string;
  text: string;
};

// Sends email over SMTP. In dev, MAIL_HOST/PORT point at Mailpit
// (docker compose), which catches everything at http://localhost:8025.
// In production, point the same MAIL_* variables at a real provider.
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter;
  private readonly from: string;

  constructor(config: ConfigService) {
    const port = Number(config.getOrThrow<string>('MAIL_PORT'));
    const user = config.get<string>('MAIL_USER');

    this.from = config.getOrThrow<string>('MAIL_FROM');
    this.transporter = createTransport({
      host: config.getOrThrow<string>('MAIL_HOST'),
      port,
      // 465 = TLS from the start; other ports (587, Mailpit's 1025) use
      // plain SMTP, upgraded with STARTTLS when the server offers it.
      secure: port === 465,
      // Only authenticate when credentials are configured.
      auth: user ? { user, pass: config.get<string>('MAIL_PASSWORD') } : undefined,
    });
  }

  async send(message: MailMessage) {
    await this.transporter.sendMail({ from: this.from, ...message });
    // Never log the body: it carries one-time codes.
    this.logger.log(`Sent "${message.subject}" to ${message.to}`);
  }
}
