import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Brain, Rocket, Play, Settings, Code, Smartphone, Twitter, Github, Linkedin, Menu } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-slate-200">
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <div className="flex-shrink-0 flex items-center">
                <Brain className="h-8 w-8 text-primary mr-2" />
                <span className="text-xl font-bold text-secondary">AIMHi</span>
              </div>
            </div>
            
            <div className="hidden md:block">
              <div className="ml-10 flex items-baseline space-x-8">
                <a href="#" className="text-slate-600 hover:text-primary px-3 py-2 text-sm font-medium transition-colors">Home</a>
                <a href="#" className="text-slate-600 hover:text-primary px-3 py-2 text-sm font-medium transition-colors">Features</a>
                <a href="#" className="text-slate-600 hover:text-primary px-3 py-2 text-sm font-medium transition-colors">Documentation</a>
                <a href="#" className="text-slate-600 hover:text-primary px-3 py-2 text-sm font-medium transition-colors">About</a>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <Button variant="ghost" className="text-slate-600 hover:text-primary text-sm font-medium">
                Sign In
              </Button>
              <Button className="bg-primary text-white px-4 py-2 text-sm font-medium hover:bg-blue-600">
                Get Started
              </Button>
            </div>

            {/* Mobile menu button */}
            <div className="md:hidden">
              <Button variant="ghost" size="icon" className="text-slate-600 hover:text-primary">
                <Menu className="h-6 w-6" />
              </Button>
            </div>
          </div>
        </nav>
      </header>

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-slate-50 to-blue-50 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl md:text-6xl font-bold text-secondary mb-6">
              Welcome to <span className="text-primary">AIMHi</span>
            </h1>
            <p className="text-xl text-slate-600 mb-8 max-w-3xl mx-auto">
              A powerful AI application platform ready for your innovation. Build, deploy, and scale your AI solutions with ease.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button className="bg-primary text-white px-8 py-3 text-lg font-medium hover:bg-blue-600">
                <Rocket className="mr-2 h-5 w-5" />
                Start Building
              </Button>
              <Button variant="outline" className="border-slate-300 text-slate-600 px-8 py-3 text-lg font-medium hover:bg-slate-50">
                <Play className="mr-2 h-5 w-5" />
                View Demo
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-secondary mb-4">
              Ready for Your Content
            </h2>
            <p className="text-xl text-slate-600 max-w-2xl mx-auto">
              This is your blank canvas. Replace these sections with your actual application features and content.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <Card className="bg-slate-50 hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center mb-4">
                  <Settings className="h-6 w-6 text-white" />
                </div>
                <h3 className="text-xl font-semibold text-secondary mb-2">Flexible Structure</h3>
                <p className="text-slate-600">
                  Organized file structure ready for your application components and modules.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-slate-50 hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="w-12 h-12 bg-accent rounded-lg flex items-center justify-center mb-4">
                  <Code className="h-6 w-6 text-white" />
                </div>
                <h3 className="text-xl font-semibold text-secondary mb-2">Developer Ready</h3>
                <p className="text-slate-600">
                  Clean, semantic HTML structure that maps perfectly to React components.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-slate-50 hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="w-12 h-12 bg-emerald-500 rounded-lg flex items-center justify-center mb-4">
                  <Smartphone className="h-6 w-6 text-white" />
                </div>
                <h3 className="text-xl font-semibold text-secondary mb-2">Responsive Design</h3>
                <p className="text-slate-600">
                  Mobile-first design that looks great on all devices and screen sizes.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Quick Start Section */}
      <section className="py-20 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold text-secondary mb-6">
              Quick Start Guide
            </h2>
            <p className="text-xl text-slate-600 mb-10">
              Get your AIMHi application up and running in minutes
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-left">
              <Card className="bg-white shadow-sm">
                <CardContent className="p-6">
                  <div className="w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center text-sm font-bold mb-4">1</div>
                  <h3 className="text-lg font-semibold text-secondary mb-2">Copy Your Files</h3>
                  <p className="text-slate-600">
                    Copy your application files from local storage to replace the placeholder content.
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-white shadow-sm">
                <CardContent className="p-6">
                  <div className="w-8 h-8 bg-accent text-white rounded-full flex items-center justify-center text-sm font-bold mb-4">2</div>
                  <h3 className="text-lg font-semibold text-secondary mb-2">Customize Structure</h3>
                  <p className="text-slate-600">
                    Modify the layout, colors, and components to match your application's needs.
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-white shadow-sm">
                <CardContent className="p-6">
                  <div className="w-8 h-8 bg-emerald-500 text-white rounded-full flex items-center justify-center text-sm font-bold mb-4">3</div>
                  <h3 className="text-lg font-semibold text-secondary mb-2">Deploy & Scale</h3>
                  <p className="text-slate-600">
                    Launch your application with confidence using this solid foundation.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-secondary text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="col-span-1 md:col-span-2">
              <div className="flex items-center mb-4">
                <Brain className="h-8 w-8 text-primary mr-2" />
                <span className="text-xl font-bold">AIMHi</span>
              </div>
              <p className="text-slate-400 mb-4">
                Your AI application platform foundation. Replace this footer content with your actual company information and links.
              </p>
              <div className="flex space-x-4">
                <a href="#" className="text-slate-400 hover:text-primary transition-colors">
                  <Twitter className="h-5 w-5" />
                </a>
                <a href="#" className="text-slate-400 hover:text-primary transition-colors">
                  <Github className="h-5 w-5" />
                </a>
                <a href="#" className="text-slate-400 hover:text-primary transition-colors">
                  <Linkedin className="h-5 w-5" />
                </a>
              </div>
            </div>

            <div>
              <h4 className="text-lg font-semibold mb-4">Resources</h4>
              <ul className="space-y-2">
                <li><a href="#" className="text-slate-400 hover:text-primary transition-colors">Documentation</a></li>
                <li><a href="#" className="text-slate-400 hover:text-primary transition-colors">API Reference</a></li>
                <li><a href="#" className="text-slate-400 hover:text-primary transition-colors">Examples</a></li>
                <li><a href="#" className="text-slate-400 hover:text-primary transition-colors">Community</a></li>
              </ul>
            </div>

            <div>
              <h4 className="text-lg font-semibold mb-4">Support</h4>
              <ul className="space-y-2">
                <li><a href="#" className="text-slate-400 hover:text-primary transition-colors">Help Center</a></li>
                <li><a href="#" className="text-slate-400 hover:text-primary transition-colors">Contact Us</a></li>
                <li><a href="#" className="text-slate-400 hover:text-primary transition-colors">Bug Reports</a></li>
                <li><a href="#" className="text-slate-400 hover:text-primary transition-colors">Status</a></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-slate-700 mt-8 pt-8 text-center">
            <p className="text-slate-400">
              © 2024 AIMHi. All rights reserved. This is placeholder text - replace with your actual copyright information.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
