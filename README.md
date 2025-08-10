# AIM Hi System - AI Managed Hiring System

> Streamline your recruitment process with intelligent AI-powered candidate matching and automated interview scheduling.

![AIM Hi System](./generated-icon.png)

## 🚀 Overview

AIM Hi System is a comprehensive AI-powered recruitment platform that revolutionizes the hiring process through intelligent candidate matching, automated voice calling, and seamless interview scheduling. Built with modern web technologies and OpenAI integration, it helps organizations find the perfect candidates while saving time and resources.

## ✨ Key Features

### 📞 Automated Voice Calls to Schedule Interviews
- Call any shortlisted candidate individually or in bulk
- Select a subset or entire set of shortlisted candidates for batch calling
- Intelligent call termination after 3 minutes to maintain efficiency
- AI assistant "Sarah" greets candidates by name with accurate job details
- Professional Indian English accent for natural conversation flow
- Real-time audio streaming with WebSocket integration
- Automatic transcript generation and storage for each call
- Context-aware conversations with job-specific information
- Seamless integration with Twilio for reliable call delivery

### 🤖 AI-Powered Resume Matching & Analysis
- Smart resume analysis from image uploads using OpenAI Vision API
- Multi-criteria matching algorithm with customizable weights
- Skills matching with technical depth assessment
- Experience level compatibility scoring
- Keyword relevance analysis for job-specific requirements
- Project domain experience evaluation
- Detailed reasoning explanations for each match
- Batch processing for multiple candidates simultaneously
- Real-time match percentage calculation with 50%+ threshold
- Consistent scoring across multiple runs

### 💼 Comprehensive Job Management
- Easy job posting with detailed descriptions and requirements
- Experience level categorization (Entry, Mid, Senior, Executive)
- Job type classification (Full-time, Part-time, Contract, Internship)
- Dynamic keyword extraction and matching
- Job template system for recurring positions
- Real-time job analytics and performance tracking
- Multi-tenant job isolation and organization management
- Job status tracking (Active, Paused, Closed)

### 👥 Multi-Tenant User Management System
- Super admin with global system oversight
- Organization-level administration and isolation
- Role-based access control (Super Admin, Org Admin, Manager, Team Lead, Recruiter)
- User invitation system with role-specific permissions
- Profile management with real-time synchronization
- Secure authentication with JWT tokens
- Settings management across multiple locations
- Team collaboration tools and user analytics

### 📅 Advanced Interview Scheduling & Management
- Comprehensive interview scheduling with multiple types
- Video call integration with auto-generated meeting links
- Phone interview coordination with caller information
- In-person meeting location and logistics management
- Interviewer assignment with contact details
- Interview status tracking (Scheduled, Completed, Cancelled, Rescheduled)
- Calendar integration and reminder systems
- Interview feedback collection and storage
- Bulk interview scheduling for multiple candidates

### 📊 Real-Time Analytics & Reporting Dashboard
- Live statistics monitoring for hiring pipeline performance
- AI matching success rates and accuracy metrics
- Interview completion rates and scheduling analytics
- Candidate pipeline flow visualization
- Organization-specific data isolation and reporting
- Call success rates and conversation analytics
- Time-to-hire metrics and bottleneck identification
- Export capabilities for detailed reporting

## 🛠️ Technology Stack

### Frontend
- **React 18** with TypeScript for modern component development
- **Tailwind CSS** with shadcn/ui for consistent design system
- **Radix UI** components for accessibility and user experience
- **TanStack Query** for efficient data fetching and caching
- **Wouter** for lightweight client-side routing
- **Framer Motion** for smooth animations and transitions

### Backend
- **Node.js** with Express for scalable server architecture
- **TypeScript** for type safety and developer experience
- **PostgreSQL** with Drizzle ORM for robust data persistence
- **OpenAI GPT-4o** for advanced AI processing and vision capabilities
- **Twilio** for reliable voice calling infrastructure
- **WebSocket** integration for real-time audio streaming

### AI & Communication
- **OpenAI Realtime API** for live voice conversations
- **ngrok** tunneling for secure webhook delivery
- **JWT authentication** for secure user sessions
- **Multi-tenant architecture** for organization isolation

### Infrastructure & Deployment
- **Vite** for fast development and optimized builds
- **Replit** for cloud hosting and deployment
- **Production domains**: skillbridge.aigiri.ai and aimhi.aigiri.ai

## 📋 Prerequisites

Before you begin, ensure you have:

- Node.js 18+ installed
- PostgreSQL database access
- OpenAI API key for AI features and voice calling
- Twilio account with API credentials for voice calling
- ngrok for secure webhook tunneling
- (Optional) LinkedIn and Indeed API credentials for job board integration

## 🚀 Quick Start

### 1. Clone the Repository
```bash
git clone https://github.com/yourusername/aim-hi-system.git
cd aim-hi-system
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Setup
Create a `.replit` file or set environment variables:
```bash
DATABASE_URL=your_postgresql_connection_string
OPENAI_API_KEY=your_openai_api_key
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
PHONE_NUMBER_FROM=your_twilio_phone_number
NGROK_AUTHTOKEN=your_ngrok_auth_token
NGROK_DOMAIN=your_ngrok_domain
LINKEDIN_CLIENT_ID=your_linkedin_client_id
LINKEDIN_CLIENT_SECRET=your_linkedin_client_secret
INDEED_PUBLISHER_ID=your_indeed_publisher_id
```

### 4. Database Setup & Schema Validation

**✨ NEW: Automatic Startup Schema Validation**

AIM Hi System now includes **startup-only schema validation** that ensures perfect database compatibility before serving any requests:

- **🎯 Zero Runtime Overhead**: Schema validation happens only during startup
- **🔧 Automatic Migration**: Missing tables/columns are added automatically  
- **💾 Safety Backups**: Database backups before any schema changes
- **📊 Detailed Logging**: Step-by-step validation progress with timing
- **⚡ Maximum Performance**: No query wrapping or runtime monitoring

```bash
# The database will be automatically validated and migrated on startup
npm run db:push
```

### 5. Start Development Server
```bash
npm run dev
```

Visit `http://localhost:5000` to access the application.

## � Available Scripts

```bash
# Development
npm run dev                    # Start development server with automatic schema validation
npm run build                  # Build for production
npm run preview                # Preview production build

# Database Management (with Startup Validation)
npm run migrate                # Run database migrations manually
npm run db:health              # Database health check
npm run db:stats               # Show database statistics and schema status
npm run db:studio              # Open Drizzle Studio
npm run fix-login              # Quick fix for login issues (restarts with validation)
npm run test-startup           # Test the startup validation system

# Deployment
npm run deploy                 # Full production deployment with automatic migration
```

**🛡️ About Startup Schema Validation:**
- Every `npm run dev` automatically validates and fixes database schema
- Missing tables/columns are detected and added during startup
- Safety backups are created before any schema modifications
- Zero runtime overhead - validation happens only once at startup
- Detailed logging shows exactly what's being validated and fixed

## �📖 Usage Guide

### Setting Up Voice Calling
1. Configure Twilio credentials in environment variables
2. Set up ngrok tunnel for webhook delivery
3. Test voice calling functionality with sample candidates
4. Customize AI assistant "Sarah" conversation templates

### Making Automated Calls
1. Navigate to "AI Matching" and select matched candidates
2. Choose individual candidates or bulk selection
3. Click "Start AI Calling" to initiate automated calls
4. Monitor real-time call progress and transcripts
5. Review call outcomes and candidate responses

### Adding Jobs
1. Click "Add Job" on the dashboard
2. Fill in job details including title, description, and requirements
3. Set experience level and keywords for AI matching
4. Configure job templates for recurring positions
5. Submit to create the job posting

### Managing Candidates
1. Click "Add Resume" to upload candidate information
2. Upload resume as image or manually enter details
3. AI automatically extracts and analyzes candidate data
4. View all candidates with detailed profiles and match scores
5. Export candidate data for external processing

### AI Matching Process
1. Navigate to "AI Matching" tab
2. Select a job position from active listings
3. Set minimum match percentage (default: 50%)
4. Configure matching weights for different criteria
5. Run AI analysis to get candidate matches
6. Review detailed match reasoning and multi-criteria scores
7. Save high-quality matches for interview scheduling

### Scheduling Interviews
1. Go to "Interviews" tab
2. Click "Schedule Interview" for matched candidates
3. Select job position and candidate from dropdowns
4. Choose interview type (video, phone, in-person)
5. Set date, time, duration, and location details
6. Assign interviewer with contact information
7. Generate meeting links automatically for video calls
8. Send interview confirmations and reminders

### Multi-Tenant Administration
1. Super admins can create and manage organizations
2. Organization admins manage their teams and settings
3. Role-based permissions control access to features
4. User invitation system with email-based onboarding
5. Settings synchronization across all interface locations

## 🔧 API Endpoints

### Authentication & User Management
- `POST /api/auth/login` - User authentication
- `GET /api/auth/me` - Get current user profile
- `PUT /api/auth/profile` - Update user profile
- `POST /api/auth/organizations` - Create organization (Super Admin)
- `GET /api/auth/organizations` - List organizations
- `POST /api/auth/invite-user` - Invite team members

### Jobs Management
- `GET /api/jobs` - List organization jobs
- `POST /api/jobs` - Create new job posting
- `GET /api/jobs/:id` - Get specific job details
- `PUT /api/jobs/:id` - Update job information
- `DELETE /api/jobs/:id` - Remove job posting

### Candidates Management
- `GET /api/candidates` - List all candidates
- `POST /api/candidates` - Add new candidate with resume
- `GET /api/candidates/:id` - Get candidate details
- `GET /api/candidates/:id/resume` - Download resume file
- `PUT /api/candidates/:id` - Update candidate information

### AI Matching Engine
- `POST /api/matches/run` - Execute AI matching algorithm
- `GET /api/matches` - Get match results with filtering
- `DELETE /api/matches` - Clear existing matches
- `POST /api/matches/batch` - Batch process multiple candidates

### Voice Calling System
- `POST /api/call` - Initiate AI voice call to candidate
- `POST /api/incoming-call` - Handle incoming Twilio webhooks
- `GET /api/call-transcripts` - Retrieve call transcripts
- `WebSocket /ws` - Real-time audio streaming for calls

### Interview Scheduling
- `GET /api/interviews` - List scheduled interviews
- `POST /api/interviews` - Schedule new interview
- `PUT /api/interviews/:id` - Update interview details
- `DELETE /api/interviews/:id` - Cancel interview
- `PATCH /api/interviews/:id/status` - Update interview status

### Analytics & Reporting
- `GET /api/stats` - Get dashboard statistics
- `GET /api/analytics/matches` - AI matching performance metrics
- `GET /api/analytics/calls` - Voice calling success rates
- `GET /api/analytics/interviews` - Interview scheduling analytics

## 🎨 Customization

### Theming
The application supports light/dark mode themes. Customize colors in `client/src/index.css`:

```css
:root {
  --background: 210 11% 98%;
  --foreground: 210 11% 15%;
  /* Add your custom colors */
}
```

### AI Matching Algorithm
Modify matching logic in `server/ai-matching.ts` to adjust:
- Matching criteria
- Scoring weights
- Reasoning format

## 🚀 Deployment

### Replit Deployment (Recommended)
1. Push your code to GitHub
2. Import into Replit
3. Set environment variables in Replit Secrets
4. Click "Deploy" to publish

### Manual Deployment
```bash
npm run build
npm start
```

## 🤝 Contributing

We welcome contributions! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines
- Follow TypeScript best practices
- Use existing UI components from the design system
- Add proper error handling
- Write descriptive commit messages

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [OpenAI](https://openai.com/) for powerful AI capabilities
- [Radix UI](https://www.radix-ui.com/) for accessible components
- [Tailwind CSS](https://tailwindcss.com/) for utility-first styling
- [Drizzle ORM](https://orm.drizzle.team/) for type-safe database operations

## 📞 Support

For support and questions:

- 📧 Email: support@aimhi-system.com
- 💬 Issues: [GitHub Issues](https://github.com/yourusername/aim-hi-system/issues)
- 📖 Documentation: [Wiki](https://github.com/yourusername/aim-hi-system/wiki)

## 🔮 Roadmap

- [ ] Video interview integration
- [ ] Advanced analytics dashboard
- [ ] Mobile application
- [ ] Multi-language support
- [ ] API rate limiting and caching
- [ ] Advanced AI training capabilities

---

**Made with ❤️ by the AIM Hi Team**

⭐ If you find this project helpful, please give it a star on GitHub!