// ===== Email Service (nodemailer) =====
// Ek hi jagah se saari transactional emails jati hain.
//
// .env me chahiye:
//   EMAIL_SERVICE=gmail
//   EMAIL_USER=yourstore@gmail.com
//   EMAIL_PASS=xxxx xxxx xxxx xxxx   (Gmail App Password, normal password nahi)
//   EMAIL_FROM=yourstore@gmail.com
//   STORE_URL=http://localhost:5173
//   PUBLIC_API_URL=http://localhost:5000
//   SUPPORT_EMAIL=support@antiqor.com

const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');

// ---------- Brand config ----------
const BRAND = {
    name: process.env.STORE_NAME || 'ANTIQOR',
    tagline: 'FURNITURE',
    navy: '#12324f',
    navyDark: '#0b2239',
    ice: '#8ecae6',
    iceLight: '#cfe8f5',
    cream: '#eaf2fa',
    ink: '#0f2233',
    muted: '#4a6274'
};

const STORE_URL = (process.env.STORE_URL || 'http://localhost:5173').replace(/\/+$/, '');
const API_URL = (process.env.PUBLIC_API_URL || 'http://localhost:5000').replace(/\/+$/, '');
const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || process.env.EMAIL_FROM || process.env.EMAIL_USER || '';

// Logo disk se attach hota hai (cid: se HTML me lagta hai).
// Isse email client me logo bina kisi public hosting ke dikhta hai.
const LOGO_PATH = path.join(__dirname, '..', 'assets', 'antiqor-logo.png');
const LOGO_CID = 'antiqor-logo';

// ---------- Transporter ----------
// EMAIL_USER missing ho to EMAIL_FROM se login karo - ye exact galti
// pehle email ko chup-chaap band kar deti thi.
const smtpUser = () => process.env.EMAIL_USER || process.env.EMAIL_FROM;

const isEmailConfigured = () =>
    Boolean(smtpUser() && process.env.EMAIL_PASS);

const transporter = nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE || 'gmail',
    auth: {
        user: smtpUser(),
        pass: process.env.EMAIL_PASS
    },
    // Order request ko email ke liye zyada der block na karna pade
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 20000
});

// Server start par ek dafa check: SMTP credentials sahi hain ya nahi
const verifyEmailConnection = async () => {
    if (!isEmailConfigured()) {
        console.warn('⚠️  Email disabled: .env me EMAIL_PASS aur EMAIL_USER/EMAIL_FROM missing hain');
        return { success: false, error: 'EMAIL_USER / EMAIL_PASS not configured' };
    }
    try {
        await transporter.verify();
        console.log('✅ Email server ready:', smtpUser());
        return { success: true };
    } catch (error) {
        console.error('❌ Email server verification failed:', error.message);
        return { success: false, error: error.message };
    }
};

// ---------- Helpers ----------
const escapeHtml = (value) =>
    String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

const formatMoney = (value) => {
    const number = Number(value) || 0;
    return `Rs ${number.toLocaleString('en-PK', { maximumFractionDigits: 0 })}`;
};

const formatDate = (value) => {
    const date = value ? new Date(value) : new Date();
    return date.toLocaleDateString('en-PK', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });
};

// '/uploads/a.jpg' -> apiUrl + '/uploads/a.jpg'
const absoluteImage = (src) => {
    if (!src || src === 'null') return '';
    if (/^https?:\/\//i.test(src)) return src;
    if (src.startsWith('/')) return `${API_URL}${src}`;
    return '';
};

const logoAttachment = () =>
    fs.existsSync(LOGO_PATH)
        ? [{ filename: 'antiqor-logo.png', path: LOGO_PATH, cid: LOGO_CID }]
        : [];

// Controller ke manual send ke liye bhi same attachment chahiye
const getEmailAttachments = () => logoAttachment();

// ---------- 2. General email sender ----------
// to: customer ka email | subject | html | text | attachments
const sendEmail = async ({ to, subject, html, text, attachments = [], replyTo }) => {
    if (!isEmailConfigured()) {
        const error = 'EMAIL_USER / EMAIL_PASS not configured in .env';
        console.error('❌ Email not sent:', error);
        return { success: false, error };
    }

    try {
        const info = await transporter.sendMail({
            from: `"${BRAND.name} ${BRAND.tagline}" <${process.env.EMAIL_FROM || smtpUser()}>`,
            to,
            subject,
            text,
            html,
            replyTo: replyTo || process.env.EMAIL_FROM || smtpUser(),
            attachments
        });
        console.log(`✅ Email sent to ${to}:`, info.messageId);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error(`❌ Email failed for ${to}:`, error.message);
        return { success: false, error: error.message };
    }
};

// ---------- 3. VIP Order Confirmation Template ----------
// Email clients (Gmail/Outlook) <style>/flex/grid support nahi karte,
// isliye sab kuch table-based + inline styles me hai.
const orderConfirmationTemplate = ({
    orderNumber,
    customerName,
    customerEmail,
    items = [],
    total = 0,
    shippingAddress = {},
    paymentMethod = 'COD',
    paymentStatus,
    orderDate,
    orderUrl
}) => {
    const safeItems = Array.isArray(items) ? items : [];
    const subtotal = safeItems.reduce(
        (sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 0),
        0
    );
    const grandTotal = Number(total) || subtotal;
    const shipping = Math.max(grandTotal - subtotal, 0);

    // Har item ka row: thumbnail + name + qty/price + amount
    const itemsHtml = safeItems
        .map((item) => {
            const image = absoluteImage(item.image);
            const qty = Number(item.quantity) || 1;
            const price = Number(item.price) || 0;

            const thumb = image
                ? `<img src="${escapeHtml(image)}" width="56" height="56" alt="${escapeHtml(item.name)}"
                        style="display:block;width:56px;height:56px;border-radius:10px;object-fit:cover;border:1px solid #dbe9f4;" />`
                : `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:56px;height:56px;background:${BRAND.cream};border-radius:10px;">
                        <tr><td align="center" valign="middle" style="font:700 20px Georgia,serif;color:${BRAND.navy};">${escapeHtml(
                            (item.name || '?').trim().charAt(0).toUpperCase()
                        )}</td></tr>
                   </table>`;

            return `
            <tr>
                <td style="padding:16px 0;border-bottom:1px solid #e6eef6;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                        <tr>
                            <td width="56" valign="top" style="padding-right:14px;">${thumb}</td>
                            <td valign="middle">
                                <p style="margin:0 0 4px;font:600 14px/1.45 Arial,sans-serif;color:${BRAND.ink};">${escapeHtml(
                                    item.name || 'Product'
                                )}</p>
                                <p style="margin:0;font:400 12px/1.5 Arial,sans-serif;color:${BRAND.muted};">
                                    Qty ${qty} &nbsp;&middot;&nbsp; ${formatMoney(price)} each
                                </p>
                            </td>
                            <td align="right" valign="middle" style="white-space:nowrap;">
                                <span style="font:600 14px Arial,sans-serif;color:${BRAND.navy};">${formatMoney(
                                    price * qty
                                )}</span>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>`;
        })
        .join('');

    const isPaid = (paymentStatus || (paymentMethod === 'Card' ? 'Paid' : 'Pending')) === 'Paid';
    const paymentLabel = paymentMethod === 'Card' ? 'Card' : 'Cash on Delivery';
    const statusLabel = isPaid ? 'PAID' : 'PAYMENT ON DELIVERY';
    const statusColor = isPaid ? '#1a7f5a' : BRAND.navy;
    const statusBg = isPaid ? '#e6f6ef' : BRAND.cream;

    const metaCell = (label, value) => `
        <td width="50%" valign="top" style="padding:0 6px 12px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
                   style="background:#f6fafd;border:1px solid #e2edf6;border-radius:10px;">
                <tr>
                    <td style="padding:12px 14px;">
                        <p style="margin:0 0 3px;font:600 10px/1.4 Arial,sans-serif;letter-spacing:1.4px;color:${BRAND.muted};text-transform:uppercase;">${label}</p>
                        <p style="margin:0;font:600 14px/1.4 Arial,sans-serif;color:${BRAND.navy};">${escapeHtml(
                            value
                        )}</p>
                    </td>
                </tr>
            </table>
        </td>`;

    const addressLines = [
        shippingAddress.fullName,
        shippingAddress.address,
        [shippingAddress.city, shippingAddress.postalCode].filter(Boolean).join(', '),
        shippingAddress.phone ? `Phone: ${shippingAddress.phone}` : ''
    ]
        .filter(Boolean)
        .map(line => escapeHtml(line))
        .join('<br>');

    const viewUrl = orderUrl || `${STORE_URL}/orders`;

    const step = (number, title, note, active) => `
        <td width="33.33%" valign="top" align="center" style="padding:0 6px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                    <td align="center" valign="middle"
                        style="width:30px;height:30px;border-radius:15px;background:${active ? BRAND.navy : '#eef5fb'};
                               border:1px solid ${active ? BRAND.navy : '#d9e7f2'};
                               font:700 13px Arial,sans-serif;color:${active ? BRAND.ice : BRAND.muted};">
                        ${number}
                    </td>
                </tr>
            </table>
            <p style="margin:8px 0 2px;font:600 12px/1.4 Arial,sans-serif;color:${active ? BRAND.navy : BRAND.muted};">${title}</p>
            <p style="margin:0;font:400 11px/1.5 Arial,sans-serif;color:#7c93a6;">${note}</p>
        </td>`;

    return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="x-apple-disable-message-reformatting">
    <meta name="color-scheme" content="light only">
    <title>Order ${escapeHtml(orderNumber)} confirmed</title>
    <!--[if mso]>
    <style type="text/css">
        body, table, td, p, a { font-family: Arial, Helvetica, sans-serif !important; }
    </style>
    <![endif]-->
</head>
<body style="margin:0;padding:0;background:${BRAND.cream};-webkit-font-smoothing:antialiased;">

    <!-- Preheader (inbox preview line) -->
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;font-size:1px;line-height:1px;">
        Your ${BRAND.name} order ${escapeHtml(orderNumber)} is confirmed. ${safeItems.length} item(s) &middot; ${formatMoney(
            grandTotal
        )}. We are preparing it with care.
    </div>

    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${BRAND.cream};">
        <tr>
            <td align="center" style="padding:28px 12px;">

                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="620" style="width:620px;max-width:620px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 18px 45px -22px rgba(18,50,79,.45);">

                    <!-- ===== Top accent line ===== -->
                    <tr>
                        <td style="padding:0;">
                            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                                <tr>
                                    <td width="55%" height="5" style="background:${BRAND.ice};font-size:0;line-height:0;">&nbsp;</td>
                                    <td width="45%" height="5" style="background:${BRAND.navy};font-size:0;line-height:0;">&nbsp;</td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- ===== Header ===== -->
                    <tr>
                        <td align="center" style="background:${BRAND.navy};padding:30px 24px 26px;">
                            <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center">
                                <tr>
                                    <td align="center" valign="middle" style="padding-right:12px;">
                                        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border-radius:50%;">
                                            <tr>
                                                <td align="center" valign="middle" style="padding:7px;">
                                                    <img src="cid:${LOGO_CID}" width="52" height="52" alt="${BRAND.name}"
                                                         style="display:block;width:52px;height:52px;border-radius:50%;" />
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                    <td align="left" valign="middle">
                                        <p style="margin:0;font:700 25px/1.1 Georgia,'Times New Roman',serif;letter-spacing:5px;color:#ffffff;">${BRAND.name}</p>
                                        <p style="margin:5px 0 0;font:600 9px/1 Arial,sans-serif;letter-spacing:6px;color:${BRAND.ice};">${BRAND.tagline}</p>
                                    </td>
                                </tr>
                            </table>

                            <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin-top:20px;">
                                <tr>
                                    <td width="34" height="1" style="background:#2d5a80;font-size:0;line-height:0;">&nbsp;</td>
                                    <td style="padding:0 10px;font:400 9px Arial,sans-serif;color:${BRAND.ice};letter-spacing:2px;">&#9670;</td>
                                    <td width="34" height="1" style="background:#2d5a80;font-size:0;line-height:0;">&nbsp;</td>
                                </tr>
                            </table>

                            <p style="margin:14px 0 0;font:600 11px/1.4 Arial,sans-serif;letter-spacing:3px;color:${BRAND.iceLight};text-transform:uppercase;">Order Confirmed</p>
                        </td>
                    </tr>

                    <!-- ===== Greeting ===== -->
                    <tr>
                        <td style="padding:34px 40px 0;">
                            <p style="margin:0 0 10px;font:700 24px/1.35 Georgia,'Times New Roman',serif;color:${BRAND.navy};">
                                Thank you, ${escapeHtml(customerName || 'Valued Customer')}.
                            </p>
                            <p style="margin:0;font:400 14px/1.75 Arial,sans-serif;color:${BRAND.muted};">
                                Your order is confirmed and our team has started preparing it with care.
                                Every piece is inspected before it leaves our studio.
                            </p>
                        </td>
                    </tr>

                    <!-- ===== Status + order meta ===== -->
                    <tr>
                        <td style="padding:22px 40px 0;">
                            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                                <tr>
                                    <td align="left" style="padding-bottom:16px;">
                                        <span style="display:inline-block;padding:7px 14px;border-radius:100px;background:${statusBg};
                                                     font:700 10px/1 Arial,sans-serif;letter-spacing:1.6px;color:${statusColor};text-transform:uppercase;">
                                            &#10003;&nbsp; ${statusLabel}
                                        </span>
                                    </td>
                                    <td align="right" style="padding-bottom:16px;">
                                        <span style="font:400 12px Arial,sans-serif;color:${BRAND.muted};">${formatDate(
                                            orderDate
                                        )}</span>
                                    </td>
                                </tr>
                            </table>

                            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 -6px;">
                                <tr>
                                    ${metaCell('Order Number', orderNumber || '-')}
                                    ${metaCell('Payment Method', paymentLabel)}
                                </tr>
                                <tr>
                                    ${metaCell('Order Total', formatMoney(grandTotal))}
                                    ${metaCell('Items', String(safeItems.length))}
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- ===== Items ===== -->
                    <tr>
                        <td style="padding:14px 40px 0;">
                            <p style="margin:0 0 2px;font:600 10px/1.4 Arial,sans-serif;letter-spacing:2px;color:${BRAND.ice};text-transform:uppercase;">Your Selection</p>
                            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                                ${itemsHtml || `<tr><td style="padding:18px 0;font:400 13px Arial,sans-serif;color:${BRAND.muted};">No items found.</td></tr>`}
                            </table>
                        </td>
                    </tr>

                    <!-- ===== Totals ===== -->
                    <tr>
                        <td style="padding:6px 40px 0;">
                            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                                <tr>
                                    <td align="left" style="padding:8px 0;font:400 13px Arial,sans-serif;color:${BRAND.muted};">Subtotal</td>
                                    <td align="right" style="padding:8px 0;font:400 13px Arial,sans-serif;color:${BRAND.ink};">${formatMoney(
                                        subtotal
                                    )}</td>
                                </tr>
                                <tr>
                                    <td align="left" style="padding:0 0 12px;font:400 13px Arial,sans-serif;color:${BRAND.muted};">Shipping</td>
                                    <td align="right" style="padding:0 0 12px;font:600 13px Arial,sans-serif;color:${
                                        shipping === 0 ? '#1a7f5a' : BRAND.ink
                                    };">${shipping === 0 ? 'Complimentary' : formatMoney(shipping)}</td>
                                </tr>
                            </table>

                            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
                                   style="background:${BRAND.navy};border-radius:12px;">
                                <tr>
                                    <td align="left" style="padding:16px 18px;font:700 12px/1.4 Arial,sans-serif;letter-spacing:1.6px;color:${BRAND.iceLight};text-transform:uppercase;">
                                        Grand Total
                                    </td>
                                    <td align="right" style="padding:16px 18px;font:700 20px/1.2 Georgia,serif;color:#ffffff;">
                                        ${formatMoney(grandTotal)}
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- ===== Shipping address ===== -->
                    <tr>
                        <td style="padding:26px 40px 0;">
                            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
                                   style="border:1px solid #e2edf6;border-radius:12px;">
                                <tr>
                                    <td width="4" style="background:${BRAND.ice};border-radius:12px 0 0 12px;font-size:0;line-height:0;">&nbsp;</td>
                                    <td style="padding:16px 18px;">
                                        <p style="margin:0 0 7px;font:600 10px/1.4 Arial,sans-serif;letter-spacing:1.6px;color:${BRAND.muted};text-transform:uppercase;">Delivering To</p>
                                        <p style="margin:0;font:400 13px/1.7 Arial,sans-serif;color:${BRAND.ink};">
                                            ${addressLines || 'Address not provided'}
                                        </p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- ===== CTA ===== -->
                    <tr>
                        <td align="center" style="padding:26px 40px 4px;">
                            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                                <tr>
                                    <td align="center" bgcolor="${BRAND.navy}" style="border-radius:10px;">
                                        <a href="${escapeHtml(viewUrl)}"
                                           style="display:inline-block;padding:15px 34px;font:700 12px/1 Arial,sans-serif;letter-spacing:1.6px;color:${BRAND.iceLight};text-decoration:none;text-transform:uppercase;border-radius:10px;">
                                            View My Order
                                        </a>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- ===== Next steps ===== -->
                    <tr>
                        <td style="padding:30px 40px 0;">
                            <p style="margin:0 0 18px;text-align:center;font:600 10px/1.4 Arial,sans-serif;letter-spacing:2px;color:${BRAND.ice};text-transform:uppercase;">What happens next</p>
                            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                                <tr>
                                    ${step('1', 'Confirmed', 'We received your order', true)}
                                    ${step('2', 'Prepared', 'Quality checked &amp; packed', false)}
                                    ${step('3', 'Delivered', 'At your doorstep', false)}
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- ===== Support ===== -->
                    <tr>
                        <td style="padding:30px 40px 0;">
                            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
                                   style="background:#f6fafd;border:1px solid #e2edf6;border-radius:12px;">
                                <tr>
                                    <td style="padding:18px 20px;">
                                        <p style="margin:0 0 4px;font:600 13px/1.5 Arial,sans-serif;color:${BRAND.navy};">A question about your order?</p>
                                        <p style="margin:0;font:400 12px/1.7 Arial,sans-serif;color:${BRAND.muted};">
                                            Reply to this email or write to
                                            <a href="mailto:${escapeHtml(SUPPORT_EMAIL)}" style="color:${BRAND.navy};text-decoration:underline;">${escapeHtml(
                                                SUPPORT_EMAIL || 'our support team'
                                            )}</a>
                                            and quote <strong style="color:${BRAND.navy};">${escapeHtml(orderNumber || '')}</strong>.
                                        </p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- ===== Footer ===== -->
                    <tr>
                        <td style="padding:30px 0 0;">
                            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${BRAND.navyDark};">
                                <tr>
                                    <td align="center" style="padding:24px 30px 26px;">
                                        <p style="margin:0 0 6px;font:700 15px/1.2 Georgia,serif;letter-spacing:4px;color:#ffffff;">${BRAND.name}</p>
                                        <p style="margin:0 0 12px;font:600 8px/1 Arial,sans-serif;letter-spacing:4px;color:${BRAND.ice};">${BRAND.tagline}</p>
                                        <p style="margin:0 0 10px;font:400 11px/1.7 Arial,sans-serif;color:#9fb6c8;">
                                            Crafted interiors, delivered with care.
                                        </p>
                                        <p style="margin:0;font:400 10px/1.7 Arial,sans-serif;color:#7d97ab;">
                                            This email was sent to ${escapeHtml(customerEmail || 'you')} because an order was placed at
                                            <a href="${escapeHtml(STORE_URL)}" style="color:${BRAND.ice};text-decoration:none;">${escapeHtml(
                                                STORE_URL.replace(/^https?:\/\//, '')
                                            )}</a>.<br>
                                            &copy; ${new Date().getFullYear()} ${BRAND.name} ${BRAND.tagline}. All rights reserved.
                                        </p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                </table>

                <p style="margin:14px 0 0;font:400 10px/1.5 Arial,sans-serif;color:#7c93a6;">
                    This is an automated order confirmation from ${BRAND.name} ${BRAND.tagline}.
                </p>
            </td>
        </tr>
    </table>
</body>
</html>`;
};

// Plain-text fallback (spam filters aur text-only clients ke liye)
const orderConfirmationText = ({
    orderNumber,
    customerName,
    items = [],
    total,
    shippingAddress = {},
    paymentMethod = 'COD'
}) => {
    const lines = (items || []).map(
        (item) => `- ${item.name} x${item.quantity} = ${formatMoney((Number(item.price) || 0) * (Number(item.quantity) || 1))}`
    );
    return [
        `${BRAND.name} ${BRAND.tagline}`,
        '',
        `Thank you, ${customerName || 'Valued Customer'}. Your order is confirmed.`,
        `Order number: ${orderNumber}`,
        `Payment: ${paymentMethod === 'Card' ? 'Card' : 'Cash on Delivery'}`,
        '',
        'Items:',
        ...lines,
        '',
        `Total: ${formatMoney(total)}`,
        '',
        'Delivering to:',
        shippingAddress.fullName || '',
        shippingAddress.address || '',
        [shippingAddress.city, shippingAddress.postalCode].filter(Boolean).join(', '),
        shippingAddress.phone ? `Phone: ${shippingAddress.phone}` : '',
        '',
        `View your order: ${STORE_URL}/orders`,
        '',
        'This is an automated order confirmation.'
    ]
        .filter((line) => line !== undefined)
        .join('\n');
};

// ---------- 4. Order document -> email bhejna ----------
// orderController ise call karta hai. Email fail ho jaye to order fail nahi hota.
const sendOrderConfirmationEmail = async ({ order, customerEmail, customerName }) => {
    const to = customerEmail;
    if (!to) {
        return { success: false, error: 'Customer email not available' };
    }

    const data = {
        orderNumber: order.orderNumber,
        customerName: customerName || order.shippingAddress?.fullName || 'Valued Customer',
        customerEmail: to,
        items: (order.items || []).map((item) => ({
            name: item.name,
            price: item.price,
            quantity: item.quantity,
            image: item.image
        })),
        total: order.totalPrice,
        shippingAddress: order.shippingAddress || {},
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus,
        orderDate: order.createdAt,
        orderUrl: `${STORE_URL}/order/${order._id}`
    };

    return sendEmail({
        to,
        subject: `Order Confirmed · ${order.orderNumber} · ${BRAND.name}`,
        html: orderConfirmationTemplate(data),
        text: orderConfirmationText(data),
        attachments: logoAttachment()
    });
};

// ---------- 5. Order status email (Shipped / Delivered / Cancelled) ----------
const STATUS_CONTENT = {
    Shipped: {
        eyebrow: 'Order Shipped',
        title: 'Your order is on its way.',
        message:
            'Good news — your order has left our studio and is heading to your address. Please keep your phone nearby for the delivery call.',
        pill: 'IN TRANSIT',
        pillColor: '#12324f',
        pillBg: '#eaf2fa',
        activeStep: 2,
        note: 'You can follow the latest status from your order page.'
    },
    Delivered: {
        eyebrow: 'Order Delivered',
        title: 'Delivered. Enjoy your home.',
        message:
            'Your order has been delivered successfully. We hope every piece feels right at home — thank you for choosing us.',
        pill: 'DELIVERED',
        pillColor: '#1a7f5a',
        pillBg: '#e6f6ef',
        activeStep: 3,
        note: 'Something not right? Contact us within 7 days and we will make it right.'
    },
    Cancelled: {
        eyebrow: 'Order Cancelled',
        title: 'Your order has been cancelled.',
        message:
            'Your order has been cancelled. If the payment was already made, the refund will go back to your original payment method.',
        pill: 'CANCELLED',
        pillColor: '#9b2c2c',
        pillBg: '#fdecec',
        activeStep: 0,
        note: 'Refunds usually appear within 5–7 business days.'
    }
};

const statusStep = (number, title, active) => `
    <td width="33.33%" valign="top" align="center" style="padding:0 6px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0">
            <tr>
                <td align="center" valign="middle"
                    style="width:30px;height:30px;border-radius:15px;background:${active ? BRAND.navy : '#eef5fb'};
                           border:1px solid ${active ? BRAND.navy : '#d9e7f2'};
                           font:700 13px Arial,sans-serif;color:${active ? BRAND.ice : BRAND.muted};">
                    ${active ? '&#10003;' : number}
                </td>
            </tr>
        </table>
        <p style="margin:8px 0 0;font:600 12px/1.4 Arial,sans-serif;color:${active ? BRAND.navy : BRAND.muted};">${title}</p>
    </td>`;

const orderStatusTemplate = ({
    status,
    orderNumber,
    customerName,
    customerEmail,
    items = [],
    total = 0,
    shippingAddress = {},
    paymentMethod = 'COD',
    orderDate,
    orderUrl
}) => {
    const meta = STATUS_CONTENT[status] || STATUS_CONTENT.Shipped;
    const safeItems = Array.isArray(items) ? items : [];
    const subtotal = safeItems.reduce(
        (sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 0),
        0
    );
    const grandTotal = Number(total) || subtotal;
    const isCancelled = status === 'Cancelled';

    const itemsHtml = safeItems
        .map((item) => {
            const image = absoluteImage(item.image);
            const qty = Number(item.quantity) || 1;
            const price = Number(item.price) || 0;
            const thumb = image
                ? `<img src="${escapeHtml(image)}" width="48" height="48" alt="${escapeHtml(item.name)}"
                        style="display:block;width:48px;height:48px;border-radius:8px;object-fit:cover;border:1px solid #dbe9f4;" />`
                : `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:48px;height:48px;background:${BRAND.cream};border-radius:8px;">
                        <tr><td align="center" valign="middle" style="font:700 17px Georgia,serif;color:${BRAND.navy};">${escapeHtml(
                            (item.name || '?').trim().charAt(0).toUpperCase()
                        )}</td></tr>
                   </table>`;

            return `
            <tr>
                <td style="padding:13px 0;border-bottom:1px solid #e6eef6;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                        <tr>
                            <td width="48" valign="middle" style="padding-right:12px;">${thumb}</td>
                            <td valign="middle">
                                <p style="margin:0 0 3px;font:600 13px/1.45 Arial,sans-serif;color:${BRAND.ink};">${escapeHtml(
                                    item.name || 'Product'
                                )}</p>
                                <p style="margin:0;font:400 12px/1.4 Arial,sans-serif;color:${BRAND.muted};">Qty ${qty}</p>
                            </td>
                            <td align="right" valign="middle" style="white-space:nowrap;">
                                <span style="font:600 13px Arial,sans-serif;color:${BRAND.navy};">${formatMoney(
                                    price * qty
                                )}</span>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>`;
        })
        .join('');

    const addressLines = [
        shippingAddress.fullName,
        shippingAddress.address,
        [shippingAddress.city, shippingAddress.postalCode].filter(Boolean).join(', '),
        shippingAddress.phone ? `Phone: ${shippingAddress.phone}` : ''
    ]
        .filter(Boolean)
        .map((line) => escapeHtml(line))
        .join('<br>');

    const viewUrl = orderUrl || `${STORE_URL}/orders`;
    const activeStep = meta.activeStep;

    return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="x-apple-disable-message-reformatting">
    <meta name="color-scheme" content="light only">
    <title>${escapeHtml(meta.eyebrow)} · ${escapeHtml(orderNumber || '')}</title>
    <!--[if mso]>
    <style type="text/css">
        body, table, td, p, a { font-family: Arial, Helvetica, sans-serif !important; }
    </style>
    <![endif]-->
</head>
<body style="margin:0;padding:0;background:${BRAND.cream};-webkit-font-smoothing:antialiased;">

    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;font-size:1px;line-height:1px;">
        ${escapeHtml(meta.eyebrow)} — order ${escapeHtml(orderNumber || '')}. ${escapeHtml(meta.message)}
    </div>

    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${BRAND.cream};">
        <tr>
            <td align="center" style="padding:28px 12px;">

                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="620" style="width:620px;max-width:620px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 18px 45px -22px rgba(18,50,79,.45);">

                    <tr>
                        <td style="padding:0;">
                            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                                <tr>
                                    <td width="55%" height="5" style="background:${meta.pillColor};font-size:0;line-height:0;">&nbsp;</td>
                                    <td width="45%" height="5" style="background:${BRAND.navy};font-size:0;line-height:0;">&nbsp;</td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- ===== Header ===== -->
                    <tr>
                        <td align="center" style="background:${BRAND.navy};padding:30px 24px 26px;">
                            <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center">
                                <tr>
                                    <td align="center" valign="middle" style="padding-right:12px;">
                                        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border-radius:50%;">
                                            <tr>
                                                <td align="center" valign="middle" style="padding:7px;">
                                                    <img src="cid:${LOGO_CID}" width="52" height="52" alt="${BRAND.name}"
                                                         style="display:block;width:52px;height:52px;border-radius:50%;" />
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                    <td align="left" valign="middle">
                                        <p style="margin:0;font:700 25px/1.1 Georgia,'Times New Roman',serif;letter-spacing:5px;color:#ffffff;">${BRAND.name}</p>
                                        <p style="margin:5px 0 0;font:600 9px/1 Arial,sans-serif;letter-spacing:6px;color:${BRAND.ice};">${BRAND.tagline}</p>
                                    </td>
                                </tr>
                            </table>

                            <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin-top:20px;">
                                <tr>
                                    <td width="34" height="1" style="background:#2d5a80;font-size:0;line-height:0;">&nbsp;</td>
                                    <td style="padding:0 10px;font:400 9px Arial,sans-serif;color:${BRAND.ice};letter-spacing:2px;">&#9670;</td>
                                    <td width="34" height="1" style="background:#2d5a80;font-size:0;line-height:0;">&nbsp;</td>
                                </tr>
                            </table>

                            <p style="margin:14px 0 0;font:600 11px/1.4 Arial,sans-serif;letter-spacing:3px;color:${BRAND.iceLight};text-transform:uppercase;">${escapeHtml(
                                meta.eyebrow
                            )}</p>
                        </td>
                    </tr>

                    <!-- ===== Status hero ===== -->
                    <tr>
                        <td style="padding:34px 40px 0;">
                            <span style="display:inline-block;padding:7px 14px;border-radius:100px;background:${meta.pillBg};
                                         font:700 10px/1 Arial,sans-serif;letter-spacing:1.6px;color:${meta.pillColor};text-transform:uppercase;">
                                &#9679;&nbsp; ${escapeHtml(meta.pill)}
                            </span>
                            <p style="margin:16px 0 10px;font:700 25px/1.35 Georgia,'Times New Roman',serif;color:${BRAND.navy};">
                                ${escapeHtml(meta.title)}
                            </p>
                            <p style="margin:0;font:400 14px/1.75 Arial,sans-serif;color:${BRAND.muted};">
                                ${escapeHtml(meta.message)}
                            </p>
                        </td>
                    </tr>

                    <!-- ===== Progress ===== -->
                    <tr>
                        <td style="padding:26px 40px 0;">
                            ${
                                isCancelled
                                    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${meta.pillBg};border:1px solid #f3d4d4;border-radius:12px;">
                                            <tr>
                                                <td style="padding:16px 18px;font:400 12px/1.7 Arial,sans-serif;color:#7a2b2b;">
                                                    <strong style="font-weight:700;">No payment will be taken.</strong> ${escapeHtml(
                                                        meta.note
                                                    )}
                                                </td>
                                            </tr>
                                       </table>`
                                    : `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                                            <tr>
                                                ${statusStep(1, 'Confirmed', activeStep >= 1)}
                                                ${statusStep(2, 'Shipped', activeStep >= 2)}
                                                ${statusStep(3, 'Delivered', activeStep >= 3)}
                                            </tr>
                                       </table>`
                            }
                        </td>
                    </tr>

                    <!-- ===== Order summary ===== -->
                    <tr>
                        <td style="padding:28px 40px 0;">
                            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
                                   style="background:#f6fafd;border:1px solid #e2edf6;border-radius:12px;">
                                <tr>
                                    <td style="padding:16px 18px;">
                                        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                                            <tr>
                                                <td align="left" style="font:600 10px/1.4 Arial,sans-serif;letter-spacing:1.4px;color:${BRAND.muted};text-transform:uppercase;">Order Number</td>
                                                <td align="right" style="font:600 13px/1.4 Arial,sans-serif;color:${BRAND.navy};">${escapeHtml(
                                                    orderNumber || '-'
                                                )}</td>
                                            </tr>
                                            <tr>
                                                <td align="left" style="padding-top:8px;font:600 10px/1.4 Arial,sans-serif;letter-spacing:1.4px;color:${BRAND.muted};text-transform:uppercase;">Order Total</td>
                                                <td align="right" style="padding-top:8px;font:700 15px/1.4 Georgia,serif;color:${BRAND.navy};">${formatMoney(
                                                    grandTotal
                                                )}</td>
                                            </tr>
                                            <tr>
                                                <td align="left" style="padding-top:8px;font:600 10px/1.4 Arial,sans-serif;letter-spacing:1.4px;color:${BRAND.muted};text-transform:uppercase;">Payment</td>
                                                <td align="right" style="padding-top:8px;font:400 12px/1.4 Arial,sans-serif;color:${BRAND.ink};">${escapeHtml(
                                                    paymentMethod === 'Card' ? 'Card' : 'Cash on Delivery'
                                                )}</td>
                                            </tr>
                                            <tr>
                                                <td align="left" style="padding-top:8px;font:600 10px/1.4 Arial,sans-serif;letter-spacing:1.4px;color:${BRAND.muted};text-transform:uppercase;">Date</td>
                                                <td align="right" style="padding-top:8px;font:400 12px/1.4 Arial,sans-serif;color:${BRAND.ink};">${formatDate(
                                                    orderDate
                                                )}</td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- ===== Items ===== -->
                    <tr>
                        <td style="padding:22px 40px 0;">
                            <p style="margin:0 0 2px;font:600 10px/1.4 Arial,sans-serif;letter-spacing:2px;color:${BRAND.ice};text-transform:uppercase;">Order Items</p>
                            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                                ${itemsHtml || `<tr><td style="padding:16px 0;font:400 13px Arial,sans-serif;color:${BRAND.muted};">No items found.</td></tr>`}
                            </table>
                        </td>
                    </tr>

                    <!-- ===== Address ===== -->
                    <tr>
                        <td style="padding:24px 40px 0;">
                            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
                                   style="border:1px solid #e2edf6;border-radius:12px;">
                                <tr>
                                    <td width="4" style="background:${meta.pillColor};border-radius:12px 0 0 12px;font-size:0;line-height:0;">&nbsp;</td>
                                    <td style="padding:16px 18px;">
                                        <p style="margin:0 0 7px;font:600 10px/1.4 Arial,sans-serif;letter-spacing:1.6px;color:${BRAND.muted};text-transform:uppercase;">${
                                            isCancelled ? 'Order Address' : 'Delivering To'
                                        }</p>
                                        <p style="margin:0;font:400 13px/1.7 Arial,sans-serif;color:${BRAND.ink};">
                                            ${addressLines || 'Address not provided'}
                                        </p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- ===== CTA + note ===== -->
                    <tr>
                        <td align="center" style="padding:26px 40px 0;">
                            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                                <tr>
                                    <td align="center" bgcolor="${BRAND.navy}" style="border-radius:10px;">
                                        <a href="${escapeHtml(viewUrl)}"
                                           style="display:inline-block;padding:15px 34px;font:700 12px/1 Arial,sans-serif;letter-spacing:1.6px;color:${BRAND.iceLight};text-decoration:none;text-transform:uppercase;border-radius:10px;">
                                            View My Order
                                        </a>
                                    </td>
                                </tr>
                            </table>
                            <p style="margin:14px 0 0;font:400 12px/1.7 Arial,sans-serif;color:${BRAND.muted};">
                                ${escapeHtml(meta.note)}
                            </p>
                        </td>
                    </tr>

                    <!-- ===== Support ===== -->
                    <tr>
                        <td style="padding:24px 40px 0;">
                            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
                                   style="background:#f6fafd;border:1px solid #e2edf6;border-radius:12px;">
                                <tr>
                                    <td style="padding:18px 20px;">
                                        <p style="margin:0 0 4px;font:600 13px/1.5 Arial,sans-serif;color:${BRAND.navy};">Need help with this order?</p>
                                        <p style="margin:0;font:400 12px/1.7 Arial,sans-serif;color:${BRAND.muted};">
                                            Write to
                                            <a href="mailto:${escapeHtml(SUPPORT_EMAIL)}" style="color:${BRAND.navy};text-decoration:underline;">${escapeHtml(
                                                SUPPORT_EMAIL || 'our support team'
                                            )}</a>
                                            and quote <strong style="color:${BRAND.navy};">${escapeHtml(orderNumber || '')}</strong>.
                                        </p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- ===== Footer ===== -->
                    <tr>
                        <td style="padding:30px 0 0;">
                            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${BRAND.navyDark};">
                                <tr>
                                    <td align="center" style="padding:24px 30px 26px;">
                                        <p style="margin:0 0 6px;font:700 15px/1.2 Georgia,serif;letter-spacing:4px;color:#ffffff;">${BRAND.name}</p>
                                        <p style="margin:0 0 12px;font:600 8px/1 Arial,sans-serif;letter-spacing:4px;color:${BRAND.ice};">${BRAND.tagline}</p>
                                        <p style="margin:0 0 10px;font:400 11px/1.7 Arial,sans-serif;color:#9fb6c8;">Crafted interiors, delivered with care.</p>
                                        <p style="margin:0;font:400 10px/1.7 Arial,sans-serif;color:#7d97ab;">
                                            This email was sent to ${escapeHtml(customerEmail || 'you')} because an order was placed at
                                            <a href="${escapeHtml(STORE_URL)}" style="color:${BRAND.ice};text-decoration:none;">${escapeHtml(
                                                STORE_URL.replace(/^https?:\/\//, '')
                                            )}</a>.<br>
                                            &copy; ${new Date().getFullYear()} ${BRAND.name} ${BRAND.tagline}. All rights reserved.
                                        </p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                </table>

                <p style="margin:14px 0 0;font:400 10px/1.5 Arial,sans-serif;color:#7c93a6;">
                    This is an automated order update from ${BRAND.name} ${BRAND.tagline}.
                </p>
            </td>
        </tr>
    </table>
</body>
</html>`;
};

const orderStatusText = ({
    status,
    orderNumber,
    customerName,
    items = [],
    total,
    shippingAddress = {},
    paymentMethod = 'COD'
}) => {
    const meta = STATUS_CONTENT[status] || STATUS_CONTENT.Shipped;
    const lines = (items || []).map(
        (item) => `- ${item.name} x${item.quantity} = ${formatMoney((Number(item.price) || 0) * (Number(item.quantity) || 1))}`
    );
    return [
        `${BRAND.name} ${BRAND.tagline}`,
        '',
        `${meta.eyebrow}: ${meta.title}`,
        meta.message,
        '',
        `Order number: ${orderNumber}`,
        `Status: ${status}`,
        `Payment: ${paymentMethod === 'Card' ? 'Card' : 'Cash on Delivery'}`,
        '',
        'Items:',
        ...lines,
        '',
        `Total: ${formatMoney(total)}`,
        '',
        'Address:',
        shippingAddress.fullName || '',
        shippingAddress.address || '',
        [shippingAddress.city, shippingAddress.postalCode].filter(Boolean).join(', '),
        shippingAddress.phone ? `Phone: ${shippingAddress.phone}` : '',
        '',
        `View your order: ${STORE_URL}/orders`,
        '',
        meta.note
    ]
        .filter((line) => line !== undefined)
        .join('\n');
};

// Order status badla to customer ko update bhejo (Shipped/Delivered/Cancelled)
const sendOrderStatusEmail = async ({ order, customerEmail, customerName }) => {
    const to = customerEmail;
    if (!to) {
        return { success: false, error: 'Customer email not available' };
    }

    const meta = STATUS_CONTENT[order.status];
    if (!meta) {
        return { success: false, error: `No status email template for "${order.status}"` };
    }

    const data = {
        status: order.status,
        orderNumber: order.orderNumber,
        customerName: customerName || order.shippingAddress?.fullName || 'Valued Customer',
        customerEmail: to,
        items: (order.items || []).map((item) => ({
            name: item.name,
            price: item.price,
            quantity: item.quantity,
            image: item.image
        })),
        total: order.totalPrice,
        shippingAddress: order.shippingAddress || {},
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus,
        orderDate: order.updatedAt || order.createdAt,
        orderUrl: `${STORE_URL}/order/${order._id}`
    };

    const subjects = {
        Shipped: `Your ${BRAND.name} order has shipped · ${order.orderNumber}`,
        Delivered: `Delivered · ${order.orderNumber} · ${BRAND.name}`,
        Cancelled: `Order cancelled · ${order.orderNumber} · ${BRAND.name}`
    };

    return sendEmail({
        to,
        subject: subjects[order.status] || `${meta.eyebrow} · ${order.orderNumber}`,
        html: orderStatusTemplate(data),
        text: orderStatusText(data),
        attachments: logoAttachment()
    });
};

module.exports = {
    sendEmail,
    sendOrderConfirmationEmail,
    sendOrderStatusEmail,
    verifyEmailConnection,
    isEmailConfigured,
    getEmailAttachments,
    orderConfirmationTemplate,
    orderConfirmationText,
    orderStatusTemplate,
    orderStatusText
};
