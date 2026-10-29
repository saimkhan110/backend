// Order confirmation email template ke tests
// Run: node --test tests/email.test.js
const test = require('node:test');
const assert = require('node:assert');
const {
    orderConfirmationTemplate,
    orderConfirmationText,
    orderStatusTemplate,
    orderStatusText,
    sendOrderStatusEmail
} = require('../services/emailService');

const sample = {
    orderNumber: 'ORD-20261029-AB12CD',
    customerName: 'Saim Khan',
    customerEmail: 'saim@example.com',
    items: [
        { name: 'Nordic Oak Chair', price: 12500, quantity: 2, image: '/uploads/chair.jpg' },
        { name: 'Frost Pendant Lamp', price: 4800, quantity: 1 }
    ],
    total: 29800,
    shippingAddress: {
        fullName: 'Saim Khan',
        phone: '0300-1234567',
        address: 'House 12, Street 4',
        city: 'Lahore',
        postalCode: '54000'
    },
    paymentMethod: 'COD',
    paymentStatus: 'Pending'
};

test('template me order ka saara data aata hai', () => {
    const html = orderConfirmationTemplate(sample);

    assert.match(html, /ORD-20261029-AB12CD/);
    assert.match(html, /Saim Khan/);
    assert.match(html, /Nordic Oak Chair/);
    assert.match(html, /Frost Pendant Lamp/);
    assert.match(html, /Rs 29,800/);
    assert.match(html, /Cash on Delivery/);
    assert.match(html, /Lahore/);
    assert.match(html, /cid:antiqor-logo/);
    assert.match(html, /<!DOCTYPE html>/);
    assert.doesNotMatch(html, /undefined/);
});

test('shipping free hone par "Complimentary" dikhta hai', () => {
    const html = orderConfirmationTemplate({ ...sample, total: 29800 });
    assert.match(html, /Complimentary/);
});

test('user ka input HTML escape hota hai (XSS nahi)', () => {
    const html = orderConfirmationTemplate({
        ...sample,
        customerName: '<script>alert(1)</script>',
        items: [{ name: '<img src=x onerror=alert(1)>', price: 100, quantity: 1 }]
    });
    assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/);
    assert.doesNotMatch(html, /<img src=x onerror/);
    assert.match(html, /&lt;script&gt;/);
});

test('khaali data par bhi template crash nahi hota', () => {
    const html = orderConfirmationTemplate({});
    assert.match(html, /<!DOCTYPE html>/);
    assert.doesNotMatch(html, /undefined/);
    assert.match(html, /Rs 0/);
});

test('plain text version me items aur total hain', () => {
    const text = orderConfirmationText(sample);
    assert.match(text, /Nordic Oak Chair x2/);
    assert.match(text, /Total: Rs 29,800/);
    assert.match(text, /ORD-20261029-AB12CD/);
});

test('Delivered email me delivered ka content aata hai', () => {
    const html = orderStatusTemplate({ ...sample, status: 'Delivered' });

    assert.match(html, /DELIVERED/);
    assert.match(html, /Delivered\. Enjoy your home\./);
    assert.match(html, /ORD-20261029-AB12CD/);
    assert.match(html, /Nordic Oak Chair/);
    assert.match(html, /Rs 29,800/);
    assert.match(html, /cid:antiqor-logo/);
    assert.doesNotMatch(html, /undefined/);
});

test('Shipped email me transit messaging aati hai', () => {
    const html = orderStatusTemplate({ ...sample, status: 'Shipped' });
    assert.match(html, /IN TRANSIT/);
    assert.match(html, /Your order is on its way\./);
});

test('Cancelled email me refund note aata hai', () => {
    const html = orderStatusTemplate({ ...sample, status: 'Cancelled' });
    assert.match(html, /CANCELLED/);
    assert.match(html, /No payment will be taken\./);
    assert.match(html, /5–7 business days/);
});

test('status email me bhi input escape hota hai', () => {
    const html = orderStatusTemplate({
        ...sample,
        status: 'Delivered',
        customerName: '<b>hack</b>',
        shippingAddress: { ...sample.shippingAddress, city: '<script>x</script>' }
    });
    assert.doesNotMatch(html, /<b>hack<\/b>/);
    assert.doesNotMatch(html, /<script>x<\/script>/);
});

test('status text version sahi hota hai', () => {
    const text = orderStatusText({ ...sample, status: 'Shipped' });
    assert.match(text, /Status: Shipped/);
    assert.match(text, /Order number: ORD-20261029-AB12CD/);
});

test('email na ho to status email safely fail hoti hai', async () => {
    const result = await sendOrderStatusEmail({ order: { status: 'Delivered' }, customerEmail: '' });
    assert.equal(result.success, false);
    assert.match(result.error, /email/i);
});
