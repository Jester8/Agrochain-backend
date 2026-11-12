import { AGROCHAIN_LOGO_DATA_URI } from './logo-base64';

// Same look as otp-email.template.ts so every AgroChain email feels like one family.
const GREEN = '#1b5e20';
const GREEN_ACCENT = '#2D6A4F';
const GREEN_LIGHT = '#E6F4EA';
const TEXT = '#1a1a1a';
const TEXT_MUTED = '#6B7280';
const BORDER = '#E8E8E8';

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export const naira = (n: number) => `₦${n.toLocaleString('en-NG')}`;

function layout(heading: string, body: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(heading)}</title>
</head>
<body style="margin:0; padding:0; background-color:#F3F6F3; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F3F6F3; padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="max-width:520px; width:100%;">
          <tr>
            <td align="center" style="padding-bottom:28px;">
              <img src="${AGROCHAIN_LOGO_DATA_URI}" alt="AgroChain - Secure farm records" width="220"
                style="display:block; width:220px; max-width:70%; height:auto; border:0;" />
            </td>
          </tr>
          <tr>
            <td style="background-color:#FFFFFF; border-radius:16px; border:1px solid ${BORDER}; padding:36px 32px; font-size:14px; line-height:22px; color:${TEXT};">
              <p style="margin:0 0 14px; font-size:20px; font-weight:700; color:${TEXT};">${escapeHtml(heading)}</p>
              ${body}
            </td>
          </tr>
          <tr>
            <td align="center" style="padding-top:24px;">
              <p style="margin:0 0 4px; font-size:12px; color:${TEXT_MUTED};">
                <span style="color:${GREEN_ACCENT}; font-weight:600;">AgroChain</span> &middot; Secure farm records
              </p>
              <p style="margin:0; font-size:11px; color:#B0B0B0;">agrochain.africa</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

const button = (href: string, label: string) => `
  <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0 4px;">
    <tr><td style="background-color:${GREEN}; border-radius:999px;">
      <a href="${href}" style="display:inline-block; padding:12px 24px; font-size:14px; font-weight:700; color:#FFFFFF; text-decoration:none;">${escapeHtml(label)}</a>
    </td></tr>
  </table>`;

const row = (label: string, value: string) =>
  `<tr><td style="padding:6px 0; color:${TEXT_MUTED}; width:40%;">${label}</td><td style="padding:6px 0; font-weight:600; color:${TEXT};">${value}</td></tr>`;

export interface OfferEmailInfo {
  listingTitle: string;
  listingUrl: string;
  unit: string;
  quantity: number;
  pricePerUnit: number;
  message: string;
  buyerName: string;
  buyerEmail: string;
  buyerPhone: string | null;
}

function offerTable(o: OfferEmailInfo, withBuyer: boolean) {
  const total = naira(o.quantity * o.pricePerUnit);
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${GREEN_LIGHT}; border-radius:12px; padding:14px 18px; margin:8px 0 4px;">
    ${row('Produce', escapeHtml(o.listingTitle))}
    ${row('Quantity', `${o.quantity.toLocaleString('en-NG')} &times; ${escapeHtml(o.unit)}`)}
    ${row('Price', `${naira(o.pricePerUnit)} / ${escapeHtml(o.unit)}`)}
    ${row('Total', `<span style="color:${GREEN};">${total}</span>`)}
    ${withBuyer ? row('Buyer', `${escapeHtml(o.buyerName)}<br>${escapeHtml(o.buyerPhone ?? '')} ${escapeHtml(o.buyerEmail)}`) : ''}
  </table>
  ${o.message ? `<p style="margin:16px 0 0; padding-left:12px; border-left:3px solid ${GREEN_ACCENT}; color:${TEXT_MUTED};"><em>&ldquo;${escapeHtml(o.message)}&rdquo;</em></p>` : ''}`;
}

export function offerToSellerEmail(o: OfferEmailInfo) {
  return {
    subject: `New offer: ${o.quantity} x ${o.unit} of ${o.listingTitle}`,
    html: layout(
      'You have a new offer',
      `<p style="margin:0 0 8px; color:${TEXT_MUTED};">A buyer on AgroChain wants to buy your produce.</p>
       ${offerTable(o, true)}
       ${button(o.listingUrl, 'View listing')}`,
    ),
    text: `New offer on ${o.listingTitle}: ${o.quantity} x ${o.unit} at ${naira(o.pricePerUnit)} each (total ${naira(o.quantity * o.pricePerUnit)}).\nBuyer: ${o.buyerName}, ${o.buyerPhone ?? ''} ${o.buyerEmail}\n${o.message ? `Message: ${o.message}\n` : ''}${o.listingUrl}`,
  };
}

export function offerReceiptEmail(o: OfferEmailInfo) {
  return {
    subject: `Your offer on ${o.listingTitle} was sent`,
    html: layout(
      'Your offer is on its way',
      `<p style="margin:0 0 8px; color:${TEXT_MUTED};">We've sent your offer to the seller. You'll hear back by email once they respond. No payment is taken until the seller accepts.</p>
       ${offerTable(o, false)}
       ${button(o.listingUrl, 'View listing')}`,
    ),
    text: `Your offer of ${o.quantity} x ${o.unit} at ${naira(o.pricePerUnit)} (total ${naira(o.quantity * o.pricePerUnit)}) for ${o.listingTitle} was sent. No payment is taken until the seller accepts.\n${o.listingUrl}`,
  };
}

export function waitlistWelcomeEmail(appUrl: string) {
  return {
    subject: "You're on the AgroChain list",
    html: layout(
      "You're on the list",
      `<p style="margin:0; color:${TEXT_MUTED};">Thank you for joining AgroChain. Once a month we'll send you market notes, farmer stories and launch news, and we'll let you know as soon as AgroChain opens in your area.</p>
       ${button(`${appUrl}/blog`, 'Read the journal')}`,
    ),
    text: `Thank you for joining AgroChain. We'll send market notes, farmer stories and launch news once a month.\n${appUrl}/blog`,
  };
}
