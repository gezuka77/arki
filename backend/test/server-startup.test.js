const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const net = require('node:net');

for (const built of [false, true]) {
  test(`server startup and fallback with built frontend=${built}`, async (t) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'arki-server-'));
    const backend = path.resolve(__dirname, '..');
    for (const name of fs.readdirSync(backend)) {
      if (name.endsWith('.js') || name.endsWith('.json')) fs.copyFileSync(path.join(backend, name), path.join(dir, name));
    }
    fs.cpSync(path.join(backend, 'routes'), path.join(dir, 'routes'), { recursive: true });
    fs.symlinkSync(path.join(backend, 'node_modules'), path.join(dir, 'node_modules'), 'dir');
    if (built) {
      fs.mkdirSync(path.join(dir, 'public'));
      fs.writeFileSync(path.join(dir, 'public/index.html'), '<html>Arki test frontend</html>');
    }
    const socket = net.createServer();
    await new Promise((resolve) => socket.listen(0, '127.0.0.1', resolve));
    const port = socket.address().port;
    await new Promise((resolve) => socket.close(resolve));
    const child = spawn(process.execPath, [path.join(dir, 'server.js')], {
      env: { ...process.env, PORT: String(port), DB_PATH: path.join(dir, 'test.db'),
        PLACES_DB_PATH: path.join(dir, 'places.db'), PLACES_REFRESH_DISABLED: '1',
        JWT_SECRET: 'test-only-secret-'.repeat(4), SETUP_TOKEN: 'test-only-setup-'.repeat(4) },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    child.stdout.on('data', (data) => { output += data; });
    child.stderr.on('data', (data) => { output += data; });
    t.after(async () => {
      if (child.exitCode === null) {
        child.kill();
        await new Promise((resolve) => child.once('exit', resolve));
      }
      fs.rmSync(dir, { recursive: true, force: true });
    });
    const base = `http://127.0.0.1:${port}`;
    let ready = false;
    for (let i = 0; i < 100; i++) {
      assert.equal(child.exitCode, null, output);
      try { ready = (await fetch(base + '/health')).ok; } catch {}
      if (ready) break;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    assert.ok(ready, output);
    for (const route of ['/', '/receipts/history']) {
      const response = await fetch(base + route);
      assert.equal(response.status, 200);
      if (built) assert.match(await response.text(), /Arki test frontend/);
      else assert.match((await response.json()).message, /Frontend not built/);
    }
    assert.equal((await fetch(base + '/api/does-not-exist')).status, 404);
    if (built) assert.equal((await fetch(base + '/assets/missing.js')).status, 404);
  });
}
