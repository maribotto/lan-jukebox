const request = require('supertest');
const fs = require('fs');
const path = require('path');

// Create test config without login requirement
const testConfig = {
  hostIp: '127.0.0.1',
  port: 3000,
  requireLogin: false,
  trustProxy: false
};

const configPath = path.join(__dirname, '..', 'config.json');

// Delete cache if exists
delete require.cache[require.resolve('../server.js')];

// Write config and require app
fs.writeFileSync(configPath, JSON.stringify(testConfig, null, 2));
const app = require('../server.js');

describe('Authentication Tests (Login Disabled)', () => {
  describe('POST /api/login', () => {
    it('should reject login attempts when login is disabled', async () => {
      const res = await request(app)
        .post('/api/login')
        .send({ username: 'testuser', password: 'admin' });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Login is not enabled');
    });
  });

  describe('GET /api/auth-status', () => {
    it('should return requireLogin false when login is disabled', async () => {
      const res = await request(app)
        .get('/api/auth-status');

      expect(res.statusCode).toBe(200);
      expect(res.body.requireLogin).toBe(false);
      // When login is disabled, session might not exist, so authenticated can be false or undefined
      expect(res.body.authenticated).toBeFalsy();
    });
  });

  describe('Protected Routes (Without Login)', () => {
    it('should allow access to /api/status without authentication', async () => {
      const res = await request(app)
        .get('/api/status');

      expect(res.statusCode).toBe(200);
      expect(res.body.isHost).toBeDefined();
    });

    it('should allow access to /api/queue without authentication', async () => {
      const res = await request(app)
        .get('/api/queue');

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('queue');
      expect(res.body).toHaveProperty('currentlyPlaying');
    });

    it('should allow access to /api/add without authentication', async () => {
      const res = await request(app)
        .post('/api/add')
        .send({ videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' });

      // Should not get 401 (might get other errors from YouTube validation)
      expect(res.statusCode).not.toBe(401);
    });
  });

  describe('POST /api/logout', () => {
    it('should handle logout gracefully when login is disabled', async () => {
      const res = await request(app)
        .post('/api/logout');

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});

// Cleanup
afterAll(() => {
  if (fs.existsSync(configPath)) {
    fs.unlinkSync(configPath);
  }
});
