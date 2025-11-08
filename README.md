# Virtual Lab IRK Backend

Backend API server for the Virtual Lab IRK application built with Node.js, Express, MongoDB, and TypeScript.

## Features

- **Authentication**: Clerk integration with role-based access control
- **Database**: MongoDB with Mongoose ODM
- **Validation**: Zod schema validation
- **TypeScript**: Full type safety throughout the application
- **File Upload**: Support for large file uploads (up to 50MB)
- **Security**: Helmet and CORS protection

## Prerequisites

- Node.js (v20 or higher)
- MongoDB Atlas account or local MongoDB instance
- Clerk account for authentication

## Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   Create a `.env` file in the root directory with the following variables:
   ```env
   PORT=8000
   MONGO_URI=your_mongodb_connection_string
   CLERK_SECRET_KEY=your_clerk_secret_key
   CORS_ORIGIN=http://localhost:8080
   NODE_ENV=development
   ```

## Development

Start the development server:
```bash
npm run dev
```

Build for production:
```bash
npm run build
npm start
```

## Docker Deployment

Build and run with Docker:
```bash
# Build the image
docker build -t virtual-lab-irk-be .

# Run the container
docker run -p 8000:8000 --env-file .env virtual-lab-irk-be
```

## API Endpoints

### Health & System Routes
- `GET /` - API information and available endpoints
- `GET /health` - Health check with database status and system information

### Public Routes
- `GET /api/assistants` - Get assistants list (supports ?active=true filter)
- `GET /api/events` - Get calendar events

### Protected Routes (Authentication Required)

#### Task Management
- `GET /api/tasks` - Get all tasks
- `POST /api/tasks` - Create new task
- `PUT /api/tasks/:id` - Update task
- `DELETE /api/tasks/:id` - Delete task

#### Event Management
- `POST /api/events` - Create new event
- `PUT /api/events/:id` - Update event
- `DELETE /api/events/:id` - Delete event

#### Assistant Management
- `POST /api/assistants` - Create new assistant (Admin only)
- `PUT /api/assistants/:id` - Update assistant information
- `DELETE /api/assistants/:id` - Delete assistant (Admin only)

#### User Management
- `GET /api/users` - Get user information
- `PUT /api/users/:id` - Update user profile

#### Admin Routes
- `GET /api/admin` - Admin dashboard data
- Various admin management endpoints

#### Webhooks
- `POST /api/webhooks` - Clerk webhook handler for user events

## Project Structure

```
src/
├── models/           # Mongoose schemas and TypeScript interfaces
│   ├── assistant.ts  # Assistant model and schema
│   ├── event.ts      # Event model and schema  
│   ├── task.ts       # Task model and schema
│   ├── user.ts       # User model and schema
│   └── index.ts      # Model exports
├── routes/           # API route handlers
│   ├── admin.ts      # Admin management routes
│   ├── assistants.ts # Assistant CRUD operations
│   ├── events.ts     # Event management routes
│   ├── tasks.ts      # Task management routes
│   ├── users.ts      # User management routes
│   ├── webhooks.ts   # Clerk webhook handlers
│   └── index.ts      # Route exports
├── middleware/       # Express middleware
│   └── auth.ts       # Authentication and authorization middleware
└── server.ts         # Main server file with Express configuration
```

## Tech Stack

- **Runtime**: Node.js 20
- **Framework**: Express.js 5
- **Language**: TypeScript 5
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: Clerk
- **Validation**: Zod
- **Security**: Helmet, CORS
- **Development**: Nodemon, ts-node
- **Containerization**: Docker (multi-stage build)
- **Real-time**: Socket.io
- **File Upload**: Multer
- **Logging**: Morgan

## Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `PORT` | Server port | `8000` |
| `MONGO_URI` | MongoDB connection string | `mongodb+srv://...` |
| `CLERK_SECRET_KEY` | Clerk authentication secret | `sk_...` |
| `CORS_ORIGIN` | Allowed CORS origin | `http://localhost:8080` |
| `NODE_ENV` | Environment mode | `development` or `production` |