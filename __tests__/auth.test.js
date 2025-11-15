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

    it('should handle logout when not logged in', async () => {
      const res = await request(app)
        .post('/api/logout');

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      // Session middleware creates a session even if not authenticated
      // So the message will be "Logged out successfully" not "Already logged out"
      expect(res.body.message).toBeDefined();
    });
  });

  describe('Session Management', () => {
    it('should store username in session after login', async () => {
      const agent = request.agent(app);

      await agent
        .post('/api/login')
        .send({ username: 'testuser', password: 'admin' });

      // Make a request that requires authentication to verify session persists
      const res1 = await agent.get('/api/status');
      expect(res1.statusCode).toBe(200);

      // Make another request to verify session is still valid
      const res2 = await agent.get('/api/queue');
      expect(res2.statusCode).toBe(200);
    });

    it('should maintain authentication across multiple requests', async () => {
      const agent = request.agent(app);

      // Login
      await agent
        .post('/api/login')
        .send({ username: 'testuser', password: 'admin' });

      // Make several requests
      for (let i = 0; i < 5; i++) {
        const res = await agent.get('/api/status');
        expect(res.statusCode).toBe(200);
        expect(res.body.isHost).toBeDefined();
      }
    });
  });

  describe('Security Tests', () => {
    it('should reject SQL injection attempts in username', async () => {
      const res = await request(app)
        .post('/api/login')
        .send({ username: "admin' OR '1'='1", password: 'admin' });

      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Invalid credentials');
    });

    it('should reject SQL injection attempts in password', async () => {
      const res = await request(app)
        .post('/api/login')
        .send({ username: 'testuser', password: "' OR '1'='1" });

      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should handle very long usernames', async () => {
      const longUsername = 'a'.repeat(10000);
      const res = await request(app)
        .post('/api/login')
        .send({ username: longUsername, password: 'admin' });

      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should handle very long passwords', async () => {
      const longPassword = 'a'.repeat(10000);
      const res = await request(app)
        .post('/api/login')
        .send({ username: 'testuser', password: longPassword });

      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should handle empty strings for username and password', async () => {
      const res = await request(app)
        .post('/api/login')
        .send({ username: '', password: '' });

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toBe('Username and password required');
    });

    it('should handle whitespace-only username and password', async () => {
      const res = await request(app)
        .post('/api/login')
        .send({ username: '   ', password: '   ' });

      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should be case-sensitive for username', async () => {
      const res = await request(app)
        .post('/api/login')
        .send({ username: 'TESTUSER', password: 'admin' });

      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Invalid credentials');
    });

    it('should handle special characters in credentials', async () => {
      const res = await request(app)
        .post('/api/login')
        .send({ username: '<script>alert("xss")</script>', password: 'admin' });

      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });
});

// Cleanup
afterAll(() => {
  if (fs.existsSync(configPath)) {
    fs.unlinkSync(configPath);
  }
});
