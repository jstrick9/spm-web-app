/**
 * Email (SMTP) provider — the first concrete integration.
 *
 * Why SMTP not "Postmark/SendGrid/etc"?
 *   - Universal: every email provider exposes SMTP. Admins can plug in
 *     Gmail SMTP, SendGrid SMTP, Postmark SMTP, their corporate Exchange,
 *     or a self-hosted Postfix.
 *   - Self-hosted-friendly: no required cloud vendor.
 *   - Future: we can add provider-specific implementations (e.g. Postmark
 *     for nicer error reporting) by adding them as separate providers.
 *
 * Config (non-secret):
 *   - host, port, secure (TLS), fromAddress, fromName, replyTo
 *
 * Secrets:
 *   - username, password
 *
 * Actions:
 *   - sendEmail({ to, subject, html, text, headers? })
 */
import nodemailer from 'nodemailer';
import { z } from 'zod';
const configSchema = z.object({
    host: z.string().min(1, 'SMTP host required'),
    port: z.number().int().min(1).max(65535).default(587),
    secure: z.boolean().default(false), // true for port 465; false for STARTTLS on 587
    fromAddress: z.string().email('Valid sender email required'),
    fromName: z.string().max(120).optional(),
    replyTo: z.string().email().optional(),
});
const secretSchema = z.object({
    username: z.string().min(1),
    password: z.string().min(1),
});
const sendEmailInput = z.object({
    to: z.union([z.string().email(), z.array(z.string().email()).min(1)]),
    subject: z.string().min(1).max(998), // RFC 2822 limit
    html: z.string().optional(),
    text: z.string().optional(),
    headers: z.record(z.string()).optional(),
}).refine((d) => !!d.html || !!d.text, { message: 'Either html or text is required' });
function buildTransporter(ctx) {
    const cfg = configSchema.parse(ctx.config);
    const secrets = secretSchema.parse(ctx.secrets);
    return nodemailer.createTransport({
        host: cfg.host,
        port: cfg.port,
        secure: cfg.secure,
        auth: { user: secrets.username, pass: secrets.password },
    });
}
function fromHeader(ctx) {
    const cfg = configSchema.parse(ctx.config);
    return cfg.fromName ? `"${cfg.fromName}" <${cfg.fromAddress}>` : cfg.fromAddress;
}
const sendEmail = {
    id: 'sendEmail',
    label: 'Send email',
    inputSchema: sendEmailInput,
    async run(ctx, input) {
        const cfg = configSchema.parse(ctx.config);
        const transporter = buildTransporter(ctx);
        const info = await transporter.sendMail({
            from: fromHeader(ctx),
            to: input.to,
            subject: input.subject,
            html: input.html,
            text: input.text,
            replyTo: cfg.replyTo,
            headers: input.headers,
        });
        return {
            messageId: info.messageId ?? '',
            accepted: (info.accepted ?? []).map(String),
            rejected: (info.rejected ?? []).map(String),
        };
    },
};
export const emailSmtpProvider = {
    id: 'email_smtp',
    name: 'Email (SMTP)',
    category: 'email',
    description: 'Send transactional email — RSVP confirmations, magic-link guest invitations, ' +
        'staff notifications — through any SMTP server (Gmail, SendGrid SMTP, Postmark, ' +
        'your own mail relay, etc.).',
    iconKey: 'mail',
    docsUrl: 'https://nodemailer.com/smtp/',
    kind: 'smtp',
    capabilities: ['send_email'],
    configSchema,
    secretSchema,
    actions: [sendEmail],
    async verify(ctx) {
        const transporter = buildTransporter(ctx);
        try {
            const ok = await transporter.verify();
            if (!ok)
                throw new Error('SMTP server did not accept the credentials.');
        }
        catch (e) {
            const msg = e.message;
            throw new Error(`SMTP verification failed: ${msg}`);
        }
    },
};
//# sourceMappingURL=email_smtp.js.map