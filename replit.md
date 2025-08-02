# AIM Hi System - AI Managed Hiring Platform

## Overview
AIM Hi System is a comprehensive AI-powered recruitment platform that streamlines the hiring process through intelligent candidate matching, automated voice calling, and seamless interview scheduling. The system features a modern React frontend with a Node.js backend, utilizing cost-optimized AI services and SQLite database storage, designed for multi-tenant organizations. Its ambition is to revolutionize recruitment by providing efficient, AI-driven tools that reduce hiring costs and time.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Styling**: Tailwind CSS with shadcn/ui components
- **State Management**: TanStack Query
- **Build Tool**: Vite

### Backend Architecture
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript
- **API Design**: RESTful endpoints
- **File Processing**: Native JavaScript with mammoth.js for DOCX
- **Authentication**: JWT-based with role-based access control

### Data Storage
- **Primary Database**: SQLite
- **File Storage**: Local filesystem in `./uploads` directory
- **Schema Management**: Drizzle ORM
- **Migrations**: Manual table creation for initial setup

### Key Components

#### AI Processing Engine
- **OpenAI Integration**: Cost-optimized model selection (GPT-3.5-turbo, GPT-4o-mini, GPT-4o) for job processing, resume analysis, and matching.
- **Image Processing**: GPT-4o-mini Vision API for resume images.
- **Context Optimization**: Intelligent preprocessing reduces AI token usage by 80-90%.

#### Multi-Tenant System
- **Organization Management**: Complete isolation between tenants.
- **Role-Based Access**: Super Admin, Org Admin, Manager, Team Lead, Recruiter with hierarchical access controls for AI matches and candidate visibility.
- **User Management**: Invitation system with temporary passwords.

#### Voice Calling System
- **Twilio Integration**: Automated outbound calling with an AI assistant ("Sarah").
- **Real-time Processing**: WebSocket-based audio streaming.
- **Transcript Generation**: Automatic call recording and analysis.

#### Document Processing
- **Multi-format Support**: PDF, DOCX, images via OpenAI Vision.
- **Cost Optimization**: Native processing without external Python dependencies.
- **Resume Preprocessing**: Local extraction before AI analysis.

#### ATS Pipeline Management
- Comprehensive ATS lifecycle management with Job Pipeline and Application Pipeline.
- Drag-and-drop workflow stages with real-time statistics updates.
- UI/UX improvements for navigation and card layouts.

#### Customizable Reporting System
- UI-first reporting system with drag-drop interface and visual analytics.
- Supports 3 chart types with multiple variants and real-time previews.
- Template management system with pre-built recruitment report templates.

#### Job Assignment System
- Granular role-based permissions (owner, assigned, viewer).
- Backend API endpoints for assignment management and secure validation.

#### Data Protection System
- **Object Storage Integration**: Complete database persistence using Replit Object Storage for deployments.
- **Automatic Cloud Backups**: Real-time backup creation to Object Storage after critical operations (job creation, candidate addition, user creation).
- **Smart Restoration**: Automatic database restoration from Object Storage when missing in production deployments.
- **Deployment Persistence**: Solves the critical data loss issue where Replit deployments reset filesystem between updates.
- **Production Environment Protection**: Enhanced data persistence manager with cloud-based backup storage.

## External Dependencies

### Core Services
- **OpenAI API**: AI processing.
- **Twilio**: Voice calling and SMS.
- **Pinggy**: Development tunneling for webhook testing (replaces Ngrok).

### NPM Packages
- **Database**: `better-sqlite3`, `drizzle-orm`
- **AI**: `openai`, `twilio`
- **File Processing**: `mammoth`, `multer`
- **Authentication**: `bcrypt`, `jsonwebtoken`
- **UI**: `@radix-ui/components`, `tailwindcss`, `recharts`, `react-beautiful-dnd`