import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { 
  Phone, 
  Bot, 
  Briefcase, 
  Users, 
  Calendar, 
  BarChart3,
  ExternalLink,
  LogIn,
  Menu,
  X
} from "lucide-react";
// Logo temporarily removed - using text logo instead

const features = [
  {
    icon: Phone,
    title: "Automated Voice Calls to Schedule Interviews",
    description: "AI-powered calling system with Sarah assistant",
    details: [
      "Call any shortlisted candidate individually or in bulk",
      "Select a subset or entire set of shortlisted candidates for batch calling",
      "Intelligent call termination after 3 minutes to maintain efficiency",
      "AI assistant 'Sarah' greets candidates by name with accurate job details",
      "Professional Indian English accent for natural conversation flow",
      "Real-time audio streaming with WebSocket integration",
      "Automatic transcript generation and storage for each call",
      "Context-aware conversations with job-specific information",
      "Seamless integration with Twilio for reliable call delivery"
    ]
  },
  {
    icon: Bot,
    title: "AI-Powered Resume Matching & Analysis",
    description: "Intelligent candidate matching with detailed reasoning",
    details: [
      "Smart resume analysis from image uploads using OpenAI Vision API",
      "Multi-criteria matching algorithm with customizable weights",
      "Skills matching with technical depth assessment",
      "Experience level compatibility scoring",
      "Keyword relevance analysis for job-specific requirements",
      "Project domain experience evaluation",
      "Detailed reasoning explanations for each match",
      "Batch processing for multiple candidates simultaneously",
      "Real-time match percentage calculation with 50%+ threshold",
      "Consistent scoring across multiple runs"
    ]
  },
  {
    icon: Briefcase,
    title: "Comprehensive Job Management",
    description: "Complete job posting and tracking system",
    details: [
      "Easy job posting with detailed descriptions and requirements",
      "Experience level categorization (Entry, Mid, Senior, Executive)",
      "Job type classification (Full-time, Part-time, Contract, Internship)",
      "Dynamic keyword extraction and matching",
      "Job template system for recurring positions",
      "Real-time job analytics and performance tracking",
      "Multi-tenant job isolation and organization management",
      "Job status tracking (Active, Paused, Closed)"
    ]
  },
  {
    icon: Users,
    title: "Multi-Tenant User Management System",
    description: "Role-based access control and team collaboration",
    details: [
      "Super admin with global system oversight",
      "Organization-level administration and isolation",
      "Role-based access control (Super Admin, Org Admin, Manager, Team Lead, Recruiter)",
      "User invitation system with role-specific permissions",
      "Profile management with real-time synchronization",
      "Secure authentication with JWT tokens",
      "Settings management across multiple locations",
      "Team collaboration tools and user analytics"
    ]
  },
  {
    icon: Calendar,
    title: "Advanced Interview Scheduling & Management",
    description: "Streamlined interview coordination and tracking",
    details: [
      "Comprehensive interview scheduling with multiple types",
      "Video call integration with auto-generated meeting links",
      "Phone interview coordination with caller information",
      "In-person meeting location and logistics management",
      "Interviewer assignment with contact details",
      "Interview status tracking (Scheduled, Completed, Cancelled, Rescheduled)",
      "Calendar integration and reminder systems",
      "Interview feedback collection and storage",
      "Bulk interview scheduling for multiple candidates"
    ]
  },
  {
    icon: BarChart3,
    title: "Real-Time Analytics & Reporting Dashboard",
    description: "Comprehensive insights and performance metrics",
    details: [
      "Live statistics monitoring for hiring pipeline performance",
      "AI matching success rates and accuracy metrics",
      "Interview completion rates and scheduling analytics",
      "Candidate pipeline flow visualization",
      "Organization-specific data isolation and reporting",
      "Call success rates and conversation analytics",
      "Time-to-hire metrics and bottleneck identification",
      "Export capabilities for detailed reporting"
    ]
  }
];

export default function WelcomePage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50">
      {/* Navigation Header */}
      <nav className="bg-white/80 backdrop-blur-md border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex items-center space-x-3">
              <div className="flex items-center">
                <Bot className="h-8 w-8 text-blue-600 mr-2" />
                <span className="text-xl font-bold text-gray-900">AIM Hi</span>
              </div>
              <span className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
                AIM Hi
              </span>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-6">
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="ghost" className="text-gray-700 hover:text-blue-600">
                    Features
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="text-2xl font-bold text-center mb-4">
                      AIM Hi System Features
                    </DialogTitle>
                    <DialogDescription className="text-center text-gray-600 mb-6">
                      Discover the comprehensive capabilities of our AI-powered recruitment platform
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-6">
                    {features.map((feature, index) => (
                      <Card key={index} className="border-l-4 border-l-blue-500">
                        <CardHeader>
                          <CardTitle className="flex items-center space-x-3">
                            <feature.icon className="w-6 h-6 text-blue-600" />
                            <span>{feature.title}</span>
                          </CardTitle>
                          <CardDescription>{feature.description}</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="grid gap-2">
                            {feature.details.map((detail, idx) => (
                              <div key={idx} className="flex items-start space-x-2">
                                <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0" />
                                <span className="text-sm text-gray-700">{detail}</span>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </DialogContent>
              </Dialog>
              
              <Button 
                variant="ghost" 
                className="text-gray-700 hover:text-blue-600"
                onClick={() => window.open('https://aigiri.ai', '_blank')}
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                About
              </Button>
              
              <Link href="/login">
                <Button className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white">
                  <LogIn className="w-4 h-4 mr-2" />
                  Login
                </Button>
              </Link>
            </div>

            {/* Mobile menu button */}
            <div className="md:hidden">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              >
                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </Button>
            </div>
          </div>

          {/* Mobile Navigation */}
          {mobileMenuOpen && (
            <div className="md:hidden py-4 border-t border-gray-200">
              <div className="flex flex-col space-y-3">
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="ghost" className="text-left justify-start">
                      Features
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle className="text-2xl font-bold text-center mb-4">
                        AIM Hi System Features
                      </DialogTitle>
                      <DialogDescription className="text-center text-gray-600 mb-6">
                        Discover the comprehensive capabilities of our AI-powered recruitment platform
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-6">
                      {features.map((feature, index) => (
                        <Card key={index} className="border-l-4 border-l-blue-500">
                          <CardHeader>
                            <CardTitle className="flex items-center space-x-3">
                              <feature.icon className="w-6 h-6 text-blue-600" />
                              <span>{feature.title}</span>
                            </CardTitle>
                            <CardDescription>{feature.description}</CardDescription>
                          </CardHeader>
                          <CardContent>
                            <div className="grid gap-2">
                              {feature.details.map((detail, idx) => (
                                <div key={idx} className="flex items-start space-x-2">
                                  <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0" />
                                  <span className="text-sm text-gray-700">{detail}</span>
                                </div>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </DialogContent>
                </Dialog>
                
                <Button 
                  variant="ghost" 
                  className="text-left justify-start"
                  onClick={() => window.open('https://aigiri.ai', '_blank')}
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  About
                </Button>
                
                <Link href="/login">
                  <Button className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white">
                    <LogIn className="w-4 h-4 mr-2" />
                    Login
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <div className="mb-8">
            <div className="flex items-center justify-center mb-6">
              <Bot className="h-20 w-20 text-blue-600 mr-3" />
              <span className="text-4xl font-bold text-gray-900">AIM Hi</span>
            </div>
            <h1 className="text-5xl md:text-6xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-cyan-600 bg-clip-text text-transparent mb-6">
              AIM Hi System
            </h1>
            <p className="text-xl md:text-2xl text-gray-600 mb-8 max-w-3xl mx-auto">
              AI Managed Hiring System - Revolutionizing finding perfect colleagues through intelligent automation
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Link href="/login">
                <Button size="lg" className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white px-8 py-3 text-lg">
                  <LogIn className="w-5 h-5 mr-2" />
                  Get Started
                </Button>
              </Link>
              <Dialog>
                <DialogTrigger asChild>
                  <Button size="lg" variant="outline" className="px-8 py-3 text-lg border-blue-600 text-blue-600 hover:bg-blue-50">
                    Explore Features
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="text-2xl font-bold text-center mb-4">
                      AIM Hi System Features
                    </DialogTitle>
                    <DialogDescription className="text-center text-gray-600 mb-6">
                      Discover the comprehensive capabilities of our AI-powered recruitment platform
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-6">
                    {features.map((feature, index) => (
                      <Card key={index} className="border-l-4 border-l-blue-500">
                        <CardHeader>
                          <CardTitle className="flex items-center space-x-3">
                            <feature.icon className="w-6 h-6 text-blue-600" />
                            <span>{feature.title}</span>
                          </CardTitle>
                          <CardDescription>{feature.description}</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="grid gap-2">
                            {feature.details.map((detail, idx) => (
                              <div key={idx} className="flex items-start space-x-2">
                                <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0" />
                                <span className="text-sm text-gray-700">{detail}</span>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>

        {/* Feature Highlights */}
        <div className="grid md:grid-cols-3 gap-8 mb-16">
          <Card className="text-center p-6 hover:shadow-lg transition-shadow border-0 bg-white/60 backdrop-blur-sm">
            <Phone className="w-12 h-12 text-blue-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">AI Voice Calling</h3>
            <p className="text-gray-600">Automated interview scheduling with intelligent conversation flows</p>
          </Card>
          
          <Card className="text-center p-6 hover:shadow-lg transition-shadow border-0 bg-white/60 backdrop-blur-sm">
            <Bot className="w-12 h-12 text-blue-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">Smart Matching</h3>
            <p className="text-gray-600">AI-powered resume analysis with detailed candidate matching</p>
          </Card>
          
          <Card className="text-center p-6 hover:shadow-lg transition-shadow border-0 bg-white/60 backdrop-blur-sm">
            <BarChart3 className="w-12 h-12 text-blue-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">Real-time Analytics</h3>
            <p className="text-gray-600">Comprehensive insights and performance tracking</p>
          </Card>
        </div>

        {/* Technology Badges */}
        <div className="text-center">
          <h2 className="text-2xl font-semibold mb-6 text-gray-800">Powered by Advanced Technology</h2>
          <div className="flex flex-wrap justify-center gap-3">
            <Badge variant="secondary" className="px-4 py-2 text-sm">OpenAI GPT-4o</Badge>
            <Badge variant="secondary" className="px-4 py-2 text-sm">React TypeScript</Badge>
            <Badge variant="secondary" className="px-4 py-2 text-sm">Twilio Voice</Badge>
            <Badge variant="secondary" className="px-4 py-2 text-sm">Real-time WebSocket</Badge>
            <Badge variant="secondary" className="px-4 py-2 text-sm">Multi-tenant Architecture</Badge>
            <Badge variant="secondary" className="px-4 py-2 text-sm">PostgreSQL</Badge>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white/80 backdrop-blur-md border-t border-gray-200 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="flex items-center justify-center space-x-3 mb-4">
            <div className="flex items-center">
              <Bot className="h-6 w-6 text-blue-600 mr-2" />
              <span className="text-lg font-bold text-gray-900">AIM Hi</span>
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
              AIM Hi System
            </span>
          </div>
          <p className="text-gray-600 mb-4">
            AI Managed Hiring System - Finding Perfect Colleagues
          </p>
          <div className="flex justify-center space-x-6">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => window.open('https://aigiri.ai', '_blank')}
            >
              About Aigiri
            </Button>
            <Link href="/login">
              <Button variant="ghost" size="sm">
                Login
              </Button>
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}