# Virtual Lab IRK Backend

Backend API server for the Virtual Lab IRK application built with Node.js, Express, MongoDB, and TypeScript.

## Features

- **Authentication**: Clerk integration with role-based access control
- **Database**: MongoDB with Mongoose ODM
- **Validation**: Zod schema validation
- **TypeScript**: Full type safety throughout the application

## Prerequisites

- Node.js (v18 or higher)
- MongoDB Atlas account or local MongoDB instance
- Clerk account for authentication

## Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy environment variables:
   ```bash
   cp .env.example .env
   ```

4. Update the `.env` file with your credentials

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

## API Endpoints

### Public Routes
- `GET /api/home` - Get home page data (courses, highlights, assistants)
- `GET /api/events` - Get calendar events (supports ?course= filter)

### Protected Routes (Assistant Only)
- `GET /api/tasks` - Get all tasks
- `POST /api/tasks` - Create new task
- `PUT /api/tasks/:id` - Update task
- `DELETE /api/tasks/:id` - Delete task
- `POST /api/events` - Create new event
- `PUT /api/events/:id` - Update event
- `DELETE /api/events/:id` - Delete event

## Project Structure

```
src/
├── models/           # Mongoose schemas
├── routes/           # API route handlers
├── middleware/       # Express middleware
└── server.ts         # Main server file
```