# RevUp Backend

A production-grade Express.js backend API for the RevUp-Bolt application.

## Features

- 🔐 **Authentication System**: Complete JWT-based authentication with refresh tokens
- 🏢 **Enterprise Management**: Multi-tenant architecture with enterprise isolation
- 🛡️ **Security**: Helmet, CORS, rate limiting, input validation
- 📝 **Logging**: Morgan HTTP request logging
- 🏗️ **Architecture**: MVC pattern with services layer
- ✅ **Validation**: Express-validator for request validation
- 🚀 **Production Ready**: Compression, error handling, health checks
- 🗄️ **Database**: Supabase PostgreSQL integration with proper schema
- 📧 **Email Notifications**: Beautiful EJS templates with Nodemailer integration

## Project Structure

```
src/
├── app.js                 # Main application file
├── config/               # Configuration files
│   └── supabase.js
├── controllers/           # Route controllers
│   ├── authController.js
│   ├── enterpriseController.js
│   └── notificationController.js
├── middleware/           # Custom middleware
│   ├── auth.js
│   ├── errorHandler.js
│   └── notFound.js
├── routes/              # API routes
│   ├── auth.js
│   ├── enterprise.js
│   └── notifications.js
├── services/           # Business logic
│   ├── authService.js
│   └── emailService.js
└── templates/          # Email templates
    └── emails/
        ├── account-invite.ejs
        ├── password-reset.ejs
        └── welcome.ejs
```

## Quick Start

### Prerequisites

- Node.js >= 18.0.0
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd revup-backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp env.example .env
   ```
   
   Edit `.env` file with your configuration:
   ```env
   NODE_ENV=development
   PORT=5000
   JWT_SECRET=your-super-secret-jwt-key
   JWT_REFRESH_SECRET=your-super-secret-refresh-jwt-key
   FRONTEND_URL=http://localhost:3000
   SUPABASE_URL=https://tbatmlurlytcijbykxat.supabase.co
   SUPABASE_SERVICE_KEY=your-supabase-service-key
   SUPABASE_ANON_KEY=your-supabase-anon-key
   ```

4. **Start the development server**
   ```bash
   npm run dev
   ```

   The server will start on `http://localhost:5000`

## Available Scripts

- `npm start` - Start production server
- `npm run dev` - Start development server with nodemon
- `npm test` - Run tests
- `npm run test:watch` - Run tests in watch mode
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint errors

## API Endpoints

### Authentication

#### Register User
```http
POST /api/auth/register
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "SecurePass123",
  "enterpriseId": "uuid-of-enterprise"
}
```

#### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "SecurePass123"
}
```

#### Logout
```http
POST /api/auth/logout
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "refreshToken": "<refresh_token>"
}
```

#### Refresh Token
```http
POST /api/auth/refresh-token
Content-Type: application/json

{
  "refreshToken": "<refresh_token>"
}
```

#### Forgot Password
```http
POST /api/auth/forgot-password
Content-Type: application/json

{
  "email": "john@example.com"
}
```

#### Reset Password
```http
POST /api/auth/reset-password/:token
Content-Type: application/json

{
  "password": "NewSecurePass123"
}
```

#### Change Password
```http
PUT /api/auth/change-password
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "currentPassword": "OldSecurePass123",
  "newPassword": "NewSecurePass123"
}
```

#### Get Profile
```http
GET /api/auth/me
Authorization: Bearer <access_token>
```

#### Update Profile
```http
PUT /api/auth/me
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "name": "John Updated",
  "email": "john.updated@example.com"
}
```

#### Delete Account
```http
DELETE /api/auth/me
Authorization: Bearer <access_token>
```

### Enterprise Management

#### Create Enterprise
```http
POST /api/enterprise/create
Content-Type: application/json

{
  "name": "Acme Corporation",
  "domain": "acme.com",
  "industry": "Technology",
  "company_size": "100-500",
  "subscription_plan": "pro"
}
```

#### Get Enterprise
```http
GET /api/enterprise/:id
Authorization: Bearer <access_token>
```

#### Update Enterprise
```http
PUT /api/enterprise/:id
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "name": "Updated Acme Corporation",
  "subscription_plan": "enterprise"
}
```

#### Get Enterprise Configuration
```http
GET /api/enterprise/:id/config?configType=lead_fields
Authorization: Bearer <access_token>
```

#### Update Enterprise Configuration
```http
PUT /api/enterprise/:id/config
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "configType": "lead_fields",
  "configData": {
    "custom_fields": [
      {"name": "budget", "type": "select", "options": ["$0-$10k", "$10k-$50k", "$50k-$100k", "$100k+"]}
    ]
  }
}
```

### Team Management

#### Get Enterprise Users
```http
GET /api/enterprise/:enterpriseId/users?page=1&limit=20&search=john&role=AE&status=active
Authorization: Bearer <access_token>
```

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20)
- `search` (optional): Search by name or email
- `role` (optional): Filter by role name
- `status` (optional): Filter by status (active/inactive)

**Response:**
```json
{
  "success": true,
  "data": {
    "users": [
      {
        "id": "user-uuid",
        "name": "John Doe",
        "email": "john@example.com",
        "avatar": "https://example.com/avatar.jpg",
        "phone": "+1234567890",
        "timezone": "UTC",
        "isActive": true,
        "emailVerified": false,
        "lastLogin": "2025-07-25T10:00:00Z",
        "createdAt": "2025-07-25T09:00:00Z",
        "updatedAt": "2025-07-25T10:00:00Z",
        "role": {
          "id": 5,
          "name": "AE",
          "description": "Account Executive - Lead generation and sales",
          "isSystemRole": false
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 25,
      "totalPages": 2
    },
    "statistics": {
      "totalUsers": 25,
      "activeUsers": 23,
      "roleDistribution": {
        "AE": 15,
        "Manager": 5,
        "CS": 5
      }
    },
    "enterprise": {
      "id": "enterprise-uuid",
      "name": "Test Enterprise",
      "domain": "test.com"
    }
  }
}
```

#### Get Enterprise User Details
```http
GET /api/enterprise/:enterpriseId/users/:userId
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "user-uuid",
    "name": "John Doe",
    "email": "john@example.com",
    "avatar": "https://example.com/avatar.jpg",
    "phone": "+1234567890",
    "timezone": "UTC",
    "isActive": true,
    "emailVerified": false,
    "lastLogin": "2025-07-25T10:00:00Z",
    "createdAt": "2025-07-25T09:00:00Z",
    "updatedAt": "2025-07-25T10:00:00Z",
    "role": {
      "id": 5,
      "name": "AE",
      "description": "Account Executive - Lead generation and sales",
      "isSystemRole": false
    }
  }
}
```

### Notifications

#### Send Account Invite
```http
POST /api/notifications/account-invite
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "email": "john@example.com",
  "name": "John Doe",
  "roleId": 2,
  "enterpriseId": "uuid-of-enterprise",
  "invitedBy": "Manager Name"
}
```

#### Send Welcome Email
```http
POST /api/notifications/welcome-email/:userId
Authorization: Bearer <access_token>
```

#### Send Password Reset Email
```http
POST /api/notifications/password-reset
Content-Type: application/json

{
  "email": "john@example.com"
}
```

#### Send Meeting Invite
```http
POST /api/notifications/meeting-invite
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "meetingId": "uuid-of-meeting",
  "attendeeIds": ["uuid1", "uuid2"]
}
```

#### Send Lead Assignment Notification
```http
POST /api/notifications/lead-assignment
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "leadId": "uuid-of-lead",
  "assignedToId": "uuid-of-user"
}
```

#### Send Task Reminder
```http
POST /api/notifications/task-reminder/:taskId
Authorization: Bearer <access_token>
```

#### Get User Notifications
```http
GET /api/notifications/user?page=1&limit=20&unreadOnly=false
Authorization: Bearer <access_token>
```

#### Mark Notification as Read
```http
PUT /api/notifications/:notificationId/read
Authorization: Bearer <access_token>
```

#### Mark All Notifications as Read
```http
PUT /api/notifications/mark-all-read
Authorization: Bearer <access_token>
```

#### Test Email (Development Only)
```http
POST /api/notifications/test-email
Content-Type: application/json

{
  "to": "test@example.com",
  "subject": "Test Email",
  "template": "account-invite"
}
```

Available templates: `account-invite`, `password-reset`, `welcome`

### Health Check
```http
GET /health
```

## Response Format

All API responses follow a consistent format:

### Success Response
```json
{
  "success": true,
  "message": "Operation successful",
  "data": {
    // Response data
  }
}
```

### Error Response
```json
{
  "success": false,
  "message": "Error description",
  "errors": [
    // Validation errors (if any)
  ]
}
```

## Security Features

- **JWT Authentication**: Secure token-based authentication
- **Password Hashing**: bcryptjs for password security
- **Rate Limiting**: Prevents abuse with request limits
- **CORS Protection**: Configurable cross-origin requests
- **Helmet**: Security headers
- **Input Validation**: Request data validation
- **Error Handling**: Comprehensive error management

## Development

### Adding New Routes

1. Create a new route file in `src/routes/`
2. Create corresponding controller in `src/controllers/`
3. Create service layer in `src/services/` if needed
4. Add route to `src/app.js`

### Database Integration

Currently using in-memory storage for demo purposes. To integrate with a real database:

1. Install database driver (MongoDB, PostgreSQL, etc.)
2. Update `authService.js` to use database operations
3. Add database connection in `app.js`
4. Update environment variables

### Email Integration

To enable email functionality:

1. Install email library (nodemailer, sendgrid, etc.)
2. Create email service in `src/services/`
3. Update environment variables
4. Uncomment email sending in auth controller

## Production Deployment

### Environment Variables
- Set `NODE_ENV=production`
- Use strong, unique JWT secrets
- Configure proper CORS origins
- Set up database connections
- Configure email services

### Security Checklist
- [ ] Change default JWT secrets
- [ ] Configure proper CORS origins
- [ ] Set up HTTPS
- [ ] Configure rate limiting
- [ ] Set up monitoring and logging
- [ ] Use environment variables for all secrets

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

ISC License # revup-backend
