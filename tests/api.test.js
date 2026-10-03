const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const Product = require('../models/ProductModel');
const { UPLOAD_DIR } = require('../utils/fileHelper');
const app = require('../app');

test('Product CRUD, static images, replacement and failed upload cleanup', async () => {
    // Exercise real HTTP/middleware and Mongoose validation without a running database.
    const records = new Map();
    Product.create = async (fields) => {
        const product = new Product(fields);
        await product.validate();
        product.save = async () => { await product.validate(); records.set(String(product._id), product.toObject()); return product; };
        await product.save();
        return product;
    };
    Product.find = () => ({ sort: async () => [...records.values()] });
    Product.findById = async (id) => {
        if (!records.has(id)) return null;
        const product = new Product(records.get(id));
        product.save = async () => { await product.validate(); records.set(id, product.toObject()); return product; };
        return product;
    };
    Product.findByIdAndDelete = async (id) => { const product = records.get(id); records.delete(id); return product || null; };
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    const initialFiles = new Set(fs.readdirSync(UPLOAD_DIR));
    const form = (price = '100', filename = 'test.png', type = 'image/png') => {
        const body = new FormData();
        body.set('name', 'Laptop');
        body.set('price', price);
        body.set('category', '000000000000000000000001');
        body.set('image', new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64')], { type }), filename);
        return body;
    };
    try {
        let response = await fetch(base + '/api/products', { method: 'POST', body: form() });
        assert.equal(response.status, 201);
        const created = (await response.json()).product;
        const url = base + '/api/products/' + created._id;
        assert.equal((await fetch(base + '/' + created.image)).status, 200);
        assert.equal((await (await fetch(base + '/api/products')).json()).total, 1);
        assert.equal((await fetch(url)).status, 200);
        response = await fetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stock: 3 }) });
        assert.equal(response.status, 200);
        assert.equal((await response.json()).product.image, created.image);
        response = await fetch(url, { method: 'PUT', body: form('-1') });
        assert.equal(response.status, 400);
        assert.equal((await fetch(base + '/' + created.image)).status, 200);
        response = await fetch(url, { method: 'PUT', body: form('200', 'new.JPG', 'image/jpeg') });
        assert.equal(response.status, 200);
        const updated = (await response.json()).product;
        assert.notEqual(updated.image, created.image);
        assert.equal((await fetch(base + '/' + created.image)).status, 404);
        assert.equal((await fetch(base + '/' + updated.image)).status, 200);
        assert.equal((await fetch(base + '/api/products', { method: 'POST', body: form('10', 'bad.png.exe') })).status, 400);
        assert.equal((await fetch(base + '/api/products', { method: 'POST', body: form('-1') })).status, 400);
        assert.equal((await fetch(base + '/api/products/000000000000000000000000', { method: 'PUT', body: form() })).status, 404);
        assert.equal((await fetch(base + '/api/products/invalid')).status, 400);
        assert.equal((await fetch(url, { method: 'DELETE' })).status, 200);
        assert.equal((await fetch(url)).status, 404);
        assert.equal((await fetch(base + '/' + updated.image)).status, 404);
        assert.deepEqual(fs.readdirSync(UPLOAD_DIR).sort(), [...initialFiles].sort());
    } finally {
        await new Promise(resolve => server.close(resolve));
        for (const file of fs.readdirSync(UPLOAD_DIR)) {
            if (!initialFiles.has(file)) fs.unlinkSync(require('path').join(UPLOAD_DIR, file));
        }
    }
});

