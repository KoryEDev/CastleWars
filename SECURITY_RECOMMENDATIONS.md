# Security Recommendations for Castle Wars

## Current Security Implementations

### 1. **CORS Protection**
- Restricts connections to specific domains in production
- Allows localhost for development
- Prevents unauthorized websites from accessing your API

### 2. **Rate Limiting**
- HTTP requests: 100 per 15 minutes per IP
- Auth attempts: 5 per 15 minutes per IP
- Socket connections: 10 per minute per IP
- Individual socket events have specific rate limits

### 3. **Input Validation**
- Chat messages are sanitized (HTML tags removed)
- Message length limits enforced
- Spam pattern detection

### 4. **Ban System**
- IP-based banning
- Persistent ban list
- Real-time ban enforcement

## Additional Recommended Security Measures

### 1. **Use HTTPS/WSS in Production**
```nginx
# Nginx configuration for SSL
server {
    listen 443 ssl http2;
    server_name game.koryenders.com;
    
    ssl_certificate /path/to/certificate.crt;
    ssl_certificate_key /path/to/private.key;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 2. **Environment Variables for Sensitive Data**
Create a `.env` file:
```env
NODE_ENV=production
MONGODB_URI=mongodb://localhost:27017/castlewars
SESSION_SECRET=your-secret-key-here
ALLOWED_ORIGINS=https://game.koryenders.com,https://www.game.koryenders.com
PORT=3000
```

### 3. **Add Helmet.js for Security Headers**
```bash
npm install helmet
```

```javascript
const helmet = require('helmet');
app.use(helmet());
```

### 4. **Implement JWT or Session Tokens**
Instead of just username-based auth, use tokens:
```javascript
const jwt = require('jsonwebtoken');

// On login
const token = jwt.sign({ 
  username: user.username, 
  role: user.role 
}, process.env.JWT_SECRET, { 
  expiresIn: '24h' 
});

// Verify on connection
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.username;
    next();
  } catch (err) {
    next(new Error('Authentication error'));
  }
});
```

### 5. **Database Security**
- Use MongoDB connection with authentication
- Regular backups (already implemented)
- Encrypt sensitive data

### 6. **DDoS Protection**
Consider using:
- Cloudflare or similar CDN/DDoS protection
- Fail2ban on the server
- Resource limits (CPU, memory) per process

### 7. **Monitoring and Logging**
```javascript
// Log suspicious activities
const winston = require('winston');
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});
```

### 8. **Regular Security Updates**
```bash
# Check for vulnerabilities
npm audit

# Fix vulnerabilities
npm audit fix

# Update dependencies regularly
npm update
```

## Testing Security

1. **Use the connection test page** to verify CORS is working
2. **Test rate limits** by making rapid requests
3. **Monitor logs** for suspicious patterns
4. **Regular penetration testing** if possible

## Emergency Response

If you detect an attack:
1. Enable stricter rate limits temporarily
2. Block suspicious IPs at firewall level
3. Check logs for attack patterns
4. Consider temporarily restricting to known good IPs
5. Have a backup server ready to switch to