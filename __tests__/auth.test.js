const request = require('supertest');
const fs = require('fs');
const path = require('path');

// Create test config before requiring the app
const testConfig = {
  hostIp: '127.0.0.1',
  port: 3000,
  requireLogin: true,
  username: 'testuser',
  passwordHash: '$2b$10$bhg56hGf.opYm0Uhtk1pA.5FTM5T4lG.SeY400w.PXVLoh.gEyxqi', // hash for "admin"
  sessionSecret: 'test-secret-key-for-testing-only',
  trustProxy: false // No reverse proxy in tests
};

const configPath = path.join(__dirname, '..', 'config.json');

// Delete cache if exists
delete require.cache[require.resolve('../server.js')];

// Write config and require app
fs.writeFileSync(configPath, JSON.stringify(testConfig, null, 2));
const app = require('../server.js');

describe('Authentication Tests', () => {
  describe('POST /api/login', () => {
    it('should reject login with invalid username', async () => {
      const res = await request(app)
        .post('/api/login')
        .send({ username: 'wronguser', password: 'admin' });

      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Invalid credentials');
    });

    it('should reject login with invalid password', async () => {
      const res = await request(app)
        .post('/api/login')
        .send({ username: 'testuser', password: 'wrongpassword' });

      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Invalid credentials');
    });

    it('should accept login with correct credentials', async () => {
      const res = await request(app)
        .post('/api/login')
        .send({ username: 'testuser', password: 'admin' });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Login successful');
      expect(res.headers['set-cookie']).toBeDefined();
    });

    it('should require username and password', async () => {
      const res = await request(app)
        .post('/api/login')
        .send({});

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toBe('Username and password required');
    });
  });

  describe('GET /api/auth-status', () => {
    it('should return requireLogin true and authenticated false when not logged in', async () => {
      const res = await request(app)
        .get('/api/auth-status');

      expect(res.statusCode).toBe(200);
      expect(res.body.requireLogin).toBe(true);
      expect(res.body.authenticated).toBe(false);
    });

    it('should return authenticated true after login', async () => {
      const agent = request.agent(app);

      await agent
        .post('/api/login')
        .send({ username: 'testuser', password: 'admin' });

      const res = await agent.get('/api/auth-status');

      expect(res.statusCode).toBe(200);
      expect(res.body.requireLogin).toBe(true);
      expect(res.body.authenticated).toBe(true);
    });
  });

  describe('Protected Routes', () => {
    it('should block access to /api/status without authentication', async () => {
      const res = await request(app)
        .get('/api/status');

      expect(res.statusCode).toBe(401);
      expect(res.body.message).toBe('Authentication required');
    });

    it('should allow access to /api/status after authentication', async () => {
      const agent = request.agent(app);

      await agent
        .post('/api/login')
        .send({ username: 'testuser', password: 'admin' });

      const res = await agent.get('/api/status');

      expect(res.statusCode).toBe(200);
      expect(res.body.isHost).toBeDefined();
    });

    it('should block access to /api/queue without authentication', async () => {
      const res = await request(app)
        .get('/api/queue');

      expect(res.statusCode).toBe(401);
      expect(res.body.message).toBe('Authentication required');
    });
  });

  describe('POST /api/logout', () => {
    it('should logout successfully', async () => {
      const agent = request.agent(app);

      // Login first
      await agent
        .post('/api/login')
        .send({ username: 'testuser', password: 'admin' });

      // Then logout
      const logoutRes = await agent.post('/api/logout');

      expect(logoutRes.statusCode).toBe(200);
      expect(logoutRes.body.success).toBe(true);

      // Verify we can't access protected routes anymore
      const statusRes = await agent.get('/api/status');
      expect(statusRes.statusCode).toBe(401);
    });
  });
});

// Cleanup
afterAll(() => {
  if (fs.existsSync(configPath)) {
    fs.unlinkSync(configPath);
  }
});
