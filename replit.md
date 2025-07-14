# AIMHi - AI Application Framework

## Overview

AIMHi is a full-stack web application built with React and Express.js, featuring a modern tech stack with TypeScript, Tailwind CSS, and shadcn/ui components. The application appears to be an AI-focused platform with a clean, professional interface and comprehensive UI component library.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Styling**: Tailwind CSS with shadcn/ui component library
- **Build Tool**: Vite for fast development and optimized builds
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: TanStack Query (React Query) for server state management
- **UI Components**: Comprehensive shadcn/ui component library with Radix UI primitives

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Database Provider**: Neon Database (@neondatabase/serverless)
- **Session Management**: Built-in session handling with connect-pg-simple
- **API Design**: RESTful architecture with /api prefix

### Development Environment
- **Language**: TypeScript throughout the stack
- **Package Manager**: npm
- **Development Server**: tsx for TypeScript execution
- **Build Process**: Vite for frontend, esbuild for backend bundling

## Key Components

### Frontend Components
- **UI Library**: Complete shadcn/ui component set including buttons, cards, forms, dialogs, and navigation
- **Layout**: Responsive design with mobile-first approach
- **Theming**: CSS variables-based theming with light/dark mode support
- **Icons**: Lucide React icons throughout the interface

### Backend Components
- **Storage Interface**: Abstracted storage layer with in-memory implementation
- **Route Registration**: Centralized route management system
- **Error Handling**: Comprehensive error handling middleware
- **Development Tools**: Request logging and debugging utilities

### Database Schema
- **Users Table**: Basic user management with username/password authentication
- **Schema Validation**: Zod schemas for type-safe data validation
- **Migrations**: Drizzle-kit for database schema management

## Data Flow

### Client-Server Communication
1. Frontend makes API requests to `/api/*` endpoints
2. Express server processes requests through registered routes
3. Data validation using Zod schemas
4. Storage layer handles data persistence
5. Responses sent back as JSON

### State Management
- TanStack Query manages server state and caching
- React hooks for local component state
- Form state managed through react-hook-form integration

### Authentication Flow
- Session-based authentication using connect-pg-simple
- User credentials stored in PostgreSQL
- Session data persisted across requests

## External Dependencies

### UI and Styling
- **Radix UI**: Accessible component primitives
- **Tailwind CSS**: Utility-first CSS framework
- **class-variance-authority**: Component variant management
- **tailwind-merge**: Conditional class merging

### Backend Services
- **Neon Database**: Serverless PostgreSQL hosting
- **Drizzle ORM**: Type-safe database operations
- **Express.js**: Web application framework

### Development Tools
- **Vite**: Frontend build tool with HMR
- **tsx**: TypeScript execution for development
- **esbuild**: Fast JavaScript bundler for production

## Deployment Strategy

### Build Process
- Frontend: Vite builds optimized static assets to `dist/public`
- Backend: esbuild bundles server code to `dist/index.js`
- Database: Drizzle migrations handle schema updates

### Environment Configuration
- `NODE_ENV` determines development/production behavior
- `DATABASE_URL` required for PostgreSQL connection
- Replit-specific optimizations when `REPL_ID` is present

### Production Deployment
- Single Node.js process serves both API and static files
- Static files served from `dist/public`
- API endpoints prefixed with `/api`
- Session management with PostgreSQL persistence

### Development Features
- Hot module replacement via Vite
- TypeScript compilation checking
- Automatic server restart with tsx
- Request logging and error overlay
- Replit integration for cloud development

The architecture follows modern full-stack patterns with clear separation of concerns, type safety throughout, and a focus on developer experience and production readiness.