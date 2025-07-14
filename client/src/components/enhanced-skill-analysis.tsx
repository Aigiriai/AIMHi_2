import React from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { CheckCircle, XCircle, User, Briefcase, Target, Award, Building } from "lucide-react";

interface SkillAnalysis {
  skillsHas: string[];
  skillsMissing: string[];
  criteriaExplanation: string;
}

interface CriteriaScore {
  name: string;
  score: number;
  weight: number;
  points: number;
  icon: React.ReactNode;
  color: string;
}

interface EnhancedSkillAnalysisProps {
  candidateName: string;
  matchPercentage: number;
  criteriaScores: {
    skillsMatch: number;
    experienceLevel: number;
    keywordRelevance: number;
    professionalDepth: number;
    domainExperience: number;
  };
  weightedScores: {
    skillsMatch: number;
    experienceLevel: number;
    keywordRelevance: number;
    professionalDepth: number;
    domainExperience: number;
  };
  skillAnalysis?: {
    skillsMatch: SkillAnalysis;
    experienceLevel: SkillAnalysis;
    keywordRelevance: SkillAnalysis;
    professionalDepth: SkillAnalysis;
    domainExperience: SkillAnalysis;
  };
}

export default function EnhancedSkillAnalysis({ 
  candidateName, 
  matchPercentage, 
  criteriaScores, 
  weightedScores,
  skillAnalysis 
}: EnhancedSkillAnalysisProps) {
  const weights = {
    skills: 25,
    experience: 15,
    keywords: 25,
    professionalDepth: 15,
    domainExperience: 20,
  };

  const criteriaData: CriteriaScore[] = [
    {
      name: "Skills Match",
      score: criteriaScores.skillsMatch,
      weight: weights.skills,
      points: weightedScores.skillsMatch,
      icon: <Target className="h-4 w-4" />,
      color: "bg-blue-500",
    },
    {
      name: "Experience Level",
      score: criteriaScores.experienceLevel,
      weight: weights.experience,
      points: weightedScores.experienceLevel,
      icon: <Briefcase className="h-4 w-4" />,
      color: "bg-green-500",
    },
    {
      name: "Keyword Relevance",
      score: criteriaScores.keywordRelevance,
      weight: weights.keywords,
      points: weightedScores.keywordRelevance,
      icon: <Award className="h-4 w-4" />,
      color: "bg-purple-500",
    },
    {
      name: "Professional Depth",
      score: criteriaScores.professionalDepth,
      weight: weights.professionalDepth,
      points: weightedScores.professionalDepth,
      icon: <User className="h-4 w-4" />,
      color: "bg-orange-500",
    },
    {
      name: "Domain Experience",
      score: criteriaScores.domainExperience,
      weight: weights.domainExperience,
      points: weightedScores.domainExperience,
      icon: <Building className="h-4 w-4" />,
      color: "bg-indigo-500",
    },
  ];

  const getSkillAnalysisForCriteria = (criteriaName: string): SkillAnalysis => {
    if (!skillAnalysis) return { skillsHas: [], skillsMissing: [], criteriaExplanation: 'Analysis not available' };
    
    const key = criteriaName.toLowerCase().replace(/\s+/g, '');
    switch (key) {
      case 'skillsmatch':
        return skillAnalysis.skillsMatch;
      case 'experiencelevel':
        return skillAnalysis.experienceLevel;
      case 'keywordrelevance':
        return skillAnalysis.keywordRelevance;
      case 'professionaldepth':
        return skillAnalysis.professionalDepth;
      case 'domainexperience':
        return skillAnalysis.domainExperience;
      default:
        return { skillsHas: [], skillsMissing: [], criteriaExplanation: 'Analysis not available' };
    }
  };

  const getScoreColor = (score: number): string => {
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-yellow-600";
    return "text-red-600";
  };

  const getProgressColor = (score: number): string => {
    if (score >= 80) return "bg-green-500";
    if (score >= 60) return "bg-yellow-500";
    return "bg-red-500";
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-gray-900">
          AI Matching Analysis for {candidateName}
        </h2>
        <div className="flex items-center justify-center space-x-4">
          <div className="text-4xl font-bold text-blue-600">
            {matchPercentage}%
          </div>
          <div className="text-sm text-gray-500">
            Overall Match Score
          </div>
        </div>
      </div>

      {/* Criteria Analysis Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {criteriaData.map((criteria, index) => {
          const analysis = getSkillAnalysisForCriteria(criteria.name);
          
          return (
            <Card key={index} className="border-2 hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className={`p-2 rounded-full ${criteria.color} text-white`}>
                      {criteria.icon}
                    </div>
                    <CardTitle className="text-lg">{criteria.name}</CardTitle>
                  </div>
                  <div className="text-right">
                    <div className={`text-2xl font-bold ${getScoreColor(criteria.score)}`}>
                      {criteria.score}%
                    </div>
                    <div className="text-xs text-gray-500">
                      Weight: {criteria.weight}%
                    </div>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-4">
                {/* Progress Bar */}
                <div className="space-y-2">
                  <Progress 
                    value={criteria.score} 
                    className="h-2"
                    style={{
                      backgroundColor: '#f3f4f6',
                    }}
                  />
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Score: {criteria.score}%</span>
                    <span>Points: {criteria.points.toFixed(1)}</span>
                  </div>
                </div>

                <Separator />

                {/* Skills Analysis */}
                <div className="space-y-3">
                  {/* Skills Has */}
                  {analysis.skillsHas.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <span className="text-sm font-medium text-green-700">HAS</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {analysis.skillsHas.map((skill, i) => (
                          <Badge key={i} variant="secondary" className="text-xs bg-green-50 text-green-700 border-green-200">
                            {skill}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Skills Missing */}
                  {analysis.skillsMissing.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <XCircle className="h-4 w-4 text-red-500" />
                        <span className="text-sm font-medium text-red-700">MISSING</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {analysis.skillsMissing.map((skill, i) => (
                          <Badge key={i} variant="secondary" className="text-xs bg-red-50 text-red-700 border-red-200">
                            {skill}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Explanation */}
                  {analysis.criteriaExplanation && (
                    <div className="space-y-2">
                      <div className="text-sm font-medium text-gray-700">Analysis:</div>
                      <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded">
                        {analysis.criteriaExplanation}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Summary Card */}
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
        <CardHeader>
          <CardTitle className="text-lg text-blue-900">Match Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
            {criteriaData.map((criteria, index) => (
              <div key={index} className="space-y-1">
                <div className="text-sm font-medium text-gray-700">{criteria.name}</div>
                <div className={`text-lg font-bold ${getScoreColor(criteria.score)}`}>
                  {criteria.score}%
                </div>
                <div className="text-xs text-gray-500">
                  {criteria.points.toFixed(1)} pts
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}