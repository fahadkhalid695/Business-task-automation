import { 
  ResumeScreeningRequest, 
  ResumeScreeningResult,
  ResumeData,
  JobRequirements,
  ScreenedCandidate,
  CandidateRanking,
  ScreeningSummary,
  SkillMatch,
  ExperienceMatch,
  EducationMatch,
  RecommendationType,
  ExtractedResumeInfo,
  SkillLevel,
  ExperienceLevel,
  EducationLevel,
  ExternalIntegration
} from './types/FinanceHRTypes';
import { logger } from '../shared/utils/logger';
import { InferenceEngine } from '../ai-ml-engine/InferenceEngine';

/**
 * ResumeScreener - Handles resume screening, candidate ranking, and job requirement matching
 */
export class ResumeScreener {
  private inferenceEngine: InferenceEngine;
  private integrations: Map<string, ExternalIntegration>;

  constructor() {
    this.inferenceEngine = new InferenceEngine();
    this.integrations = new Map();
  }

  /**
   * Screen resumes against job requirements and rank candidates
   */
  async screenResumes(request: ResumeScreeningRequest): Promise<ResumeScreeningResult> {
    logger.info(`Screening ${request.resumes.length} resumes for position: ${request.jobRequirements.jobTitle}`);

    const screenedCandidates: ScreenedCandidate[] = [];

    // Process each resume
    for (const resume of request.resumes) {
      try {
        const extractedInfo = await this.extractResumeInfo(resume);
        const screenedCandidate = await this.screenCandidate(resume, extractedInfo, request.jobRequirements, request.screeningCriteria);
        screenedCandidates.push(screenedCandidate);
      } catch (error) {
        logger.error(`Failed to screen resume ${resume.id}`, { error: error.message });
        
        // Create a failed screening entry
        const failedCandidate: ScreenedCandidate = {
          resumeId: resume.id,
          candidateName: resume.candidateName,
          email: resume.email,
          overallScore: 0,
          skillMatches: [],
          experienceMatch: { yearsExperience: 0, relevantExperience: 0, levelMatch: false, score: 0 },
          educationMatch: { highestDegree: EducationLevel.HIGH_SCHOOL, relevantField: false, meetsRequirement: false, score: 0 },
          strengths: [],
          weaknesses: ['Failed to process resume'],
          recommendation: RecommendationType.NO_MATCH,
          extractedInfo: {
            personalInfo: { name: resume.candidateName, email: resume.email },
            workExperience: [],
            education: [],
            skills: [],
            certifications: [],
            languages: [],
            summary: 'Resume processing failed'
          }
        };
        
        screenedCandidates.push(failedCandidate);
      }
    }

    // Rank candidates
    const rankings = this.rankCandidates(screenedCandidates);
    
    // Generate summary
    const summary = this.generateScreeningSummary(screenedCandidates, request.jobRequirements);

    return {
      screenedCandidates,
      rankings,
      summary
    };
  }

  /**
   * Extract information from resume using AI/NLP
   */
  private async extractResumeInfo(resume: ResumeData): Promise<ExtractedResumeInfo> {
    logger.debug(`Extracting information from resume ${resume.id}`);

    try {
      // Use AI/ML engine for resume parsing
      const extractionResult = await this.inferenceEngine.processText({
        text: resume.resumeText || '',
        task: 'resume_extraction',
        parameters: {
          extractFields: ['personal_info', 'work_experience', 'education', 'skills', 'certifications', 'languages', 'summary'],
          language: 'en'
        }
      });

      const extractedInfo: ExtractedResumeInfo = {
        personalInfo: {
          name: extractionResult.data.personal_info?.name || resume.candidateName,
          email: extractionResult.data.personal_info?.email || resume.email,
          phone: extractionResult.data.personal_info?.phone || resume.phone,
          location: extractionResult.data.personal_info?.location,
          linkedIn: extractionResult.data.personal_info?.linkedin,
          website: extractionResult.data.personal_info?.website
        },
        workExperience: this.parseWorkExperience(extractionResult.data.work_experience || []),
        education: this.parseEducation(extractionResult.data.education || []),
        skills: extractionResult.data.skills || [],
        certifications: extractionResult.data.certifications || [],
        languages: extractionResult.data.languages || [],
        summary: extractionResult.data.summary || ''
      };

      logger.debug(`Resume extraction completed`, { 
        resumeId: resume.id,
        skillsFound: extractedInfo.skills.length,
        experienceEntries: extractedInfo.workExperience.length,
        educationEntries: extractedInfo.education.length
      });

      return extractedInfo;
    } catch (error) {
      logger.error(`Resume extraction failed for ${resume.id}`, { error: error.message });
      
      // Return minimal extracted info if extraction fails
      return {
        personalInfo: {
          name: resume.candidateName,
          email: resume.email,
          phone: resume.phone
        },
        workExperience: [],
        education: [],
        skills: [],
        certifications: [],
        languages: [],
        summary: 'Resume extraction failed'
      };
    }
  }

  /**
   * Screen individual candidate against job requirements
   */
  private async screenCandidate(resume: ResumeData, extractedInfo: ExtractedResumeInfo, jobRequirements: JobRequirements, screeningCriteria: any): Promise<ScreenedCandidate> {
    // Evaluate skills
    const skillMatches = await this.evaluateSkills(extractedInfo.skills, jobRequirements.requiredSkills.concat(jobRequirements.preferredSkills));
    
    // Evaluate experience
    const experienceMatch = this.evaluateExperience(extractedInfo.workExperience, jobRequirements.experienceLevel);
    
    // Evaluate education
    const educationMatch = this.evaluateEducation(extractedInfo.education, jobRequirements.education);
    
    // Calculate overall score
    const overallScore = this.calculateOverallScore(skillMatches, experienceMatch, educationMatch, screeningCriteria);
    
    // Identify strengths and weaknesses
    const { strengths, weaknesses } = this.identifyStrengthsWeaknesses(skillMatches, experienceMatch, educationMatch, jobRequirements);
    
    // Determine recommendation
    const recommendation = this.determineRecommendation(overallScore, screeningCriteria.minimumScore);

    return {
      resumeId: resume.id,
      candidateName: resume.candidateName,
      email: resume.email,
      overallScore,
      skillMatches,
      experienceMatch,
      educationMatch,
      strengths,
      weaknesses,
      recommendation,
      extractedInfo
    };
  }

  /**
   * Evaluate candidate skills against job requirements
   */
  private async evaluateSkills(candidateSkills: string[], requiredSkills: any[]): Promise<SkillMatch[]> {
    const skillMatches: SkillMatch[] = [];

    for (const requiredSkill of requiredSkills) {
      const skillName = requiredSkill.name.toLowerCase();
      const found = candidateSkills.some(skill => 
        skill.toLowerCase().includes(skillName) || 
        this.calculateSimilarity(skill.toLowerCase(), skillName) > 0.8
      );

      // Use AI to determine skill level if found
      let level = SkillLevel.BEGINNER;
      let confidence = 0.5;

      if (found) {
        try {
          const levelResult = await this.inferenceEngine.classify({
            text: candidateSkills.join(' '),
            categories: Object.values(SkillLevel),
            task: 'skill_level_assessment',
            context: `Assess ${skillName} skill level`
          });
          
          level = levelResult.category as SkillLevel;
          confidence = levelResult.confidence;
        } catch (error) {
          logger.warn(`Failed to assess skill level for ${skillName}`, { error: error.message });
        }
      }

      const score = this.calculateSkillScore(found, level, requiredSkill.level, requiredSkill.weight);

      skillMatches.push({
        skillName: requiredSkill.name,
        required: requiredSkill.isRequired,
        found,
        level,
        confidence,
        score
      });
    }

    return skillMatches;
  }

  /**
   * Evaluate candidate experience against job requirements
   */
  private evaluateExperience(workExperience: any[], requiredLevel: ExperienceLevel): ExperienceMatch {
    const totalYears = this.calculateTotalExperience(workExperience);
    const relevantYears = this.calculateRelevantExperience(workExperience);
    const levelMatch = this.checkExperienceLevelMatch(totalYears, requiredLevel);
    
    const score = this.calculateExperienceScore(totalYears, relevantYears, levelMatch);

    return {
      yearsExperience: totalYears,
      relevantExperience: relevantYears,
      levelMatch,
      score
    };
  }

  /**
   * Evaluate candidate education against job requirements
   */
  private evaluateEducation(education: any[], requirements: any[]): EducationMatch {
    const highestDegree = this.getHighestDegree(education);
    const relevantField = this.checkRelevantField(education, requirements);
    const meetsRequirement = this.checkEducationRequirement(highestDegree, requirements);
    
    const score = this.calculateEducationScore(highestDegree, relevantField, meetsRequirement);

    return {
      highestDegree,
      relevantField,
      meetsRequirement,
      score
    };
  }

  /**
   * Calculate overall candidate score
   */
  private calculateOverallScore(skillMatches: SkillMatch[], experienceMatch: ExperienceMatch, educationMatch: EducationMatch, criteria: any): number {
    const skillScore = skillMatches.reduce((sum, match) => sum + match.score, 0) / skillMatches.length;
    const experienceScore = experienceMatch.score;
    const educationScore = educationMatch.score;

    const skillWeight = criteria.skillWeights ? Object.values(criteria.skillWeights).reduce((sum: number, weight: any) => sum + weight, 0) / Object.keys(criteria.skillWeights).length : 0.5;
    const experienceWeight = criteria.experienceWeight || 0.3;
    const educationWeight = criteria.educationWeight || 0.2;

    const totalWeight = skillWeight + experienceWeight + educationWeight;
    const normalizedSkillWeight = skillWeight / totalWeight;
    const normalizedExperienceWeight = experienceWeight / totalWeight;
    const normalizedEducationWeight = educationWeight / totalWeight;

    return Math.round((skillScore * normalizedSkillWeight + experienceScore * normalizedExperienceWeight + educationScore * normalizedEducationWeight) * 100);
  }

  /**
   * Rank candidates by overall score
   */
  private rankCandidates(candidates: ScreenedCandidate[]): CandidateRanking[] {
    const sortedCandidates = candidates.sort((a, b) => b.overallScore - a.overallScore);
    
    return sortedCandidates.map((candidate, index) => ({
      resumeId: candidate.resumeId,
      candidateName: candidate.candidateName,
      rank: index + 1,
      score: candidate.overallScore,
      category: candidate.recommendation
    }));
  }

  /**
   * Generate screening summary
   */
  private generateScreeningSummary(candidates: ScreenedCandidate[], jobRequirements: JobRequirements): ScreeningSummary {
    const totalCandidates = candidates.length;
    const qualifiedCandidates = candidates.filter(c => c.recommendation !== RecommendationType.NO_MATCH).length;
    const averageScore = candidates.reduce((sum, c) => sum + c.overallScore, 0) / totalCandidates;
    
    // Find most common skills
    const allSkills = candidates.flatMap(c => c.extractedInfo.skills);
    const skillCounts = new Map<string, number>();
    allSkills.forEach(skill => {
      const count = skillCounts.get(skill) || 0;
      skillCounts.set(skill, count + 1);
    });
    const topSkillsFound = Array.from(skillCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([skill]) => skill);

    // Find common weaknesses
    const allWeaknesses = candidates.flatMap(c => c.weaknesses);
    const weaknessCounts = new Map<string, number>();
    allWeaknesses.forEach(weakness => {
      const count = weaknessCounts.get(weakness) || 0;
      weaknessCounts.set(weakness, count + 1);
    });
    const commonWeaknesses = Array.from(weaknessCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([weakness]) => weakness);

    const recommendedInterviews = candidates.filter(c => 
      c.recommendation === RecommendationType.STRONG_MATCH || 
      c.recommendation === RecommendationType.GOOD_MATCH
    ).length;

    return {
      totalCandidates,
      qualifiedCandidates,
      averageScore: Math.round(averageScore),
      topSkillsFound,
      commonWeaknesses,
      recommendedInterviews
    };
  }

  // Helper methods
  private parseWorkExperience(rawExperience: any[]): any[] {
    return rawExperience.map(exp => ({
      company: exp.company || '',
      position: exp.position || '',
      startDate: new Date(exp.startDate || Date.now()),
      endDate: exp.endDate ? new Date(exp.endDate) : undefined,
      isCurrent: exp.isCurrent || false,
      description: exp.description || '',
      achievements: exp.achievements || [],
      technologies: exp.technologies || []
    }));
  }

  private parseEducation(rawEducation: any[]): any[] {
    return rawEducation.map(edu => ({
      institution: edu.institution || '',
      degree: edu.degree || '',
      field: edu.field || '',
      graduationDate: edu.graduationDate ? new Date(edu.graduationDate) : undefined,
      gpa: edu.gpa
    }));
  }

  private calculateSimilarity(str1: string, str2: string): number {
    // Simple similarity calculation - could be enhanced with more sophisticated algorithms
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
    
    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
    
    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + indicator
        );
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  private calculateSkillScore(found: boolean, candidateLevel: SkillLevel, requiredLevel: SkillLevel, weight: number): number {
    if (!found) return 0;
    
    const levelScores = {
      [SkillLevel.BEGINNER]: 1,
      [SkillLevel.INTERMEDIATE]: 2,
      [SkillLevel.ADVANCED]: 3,
      [SkillLevel.EXPERT]: 4
    };
    
    const candidateScore = levelScores[candidateLevel];
    const requiredScore = levelScores[requiredLevel];
    
    const levelMatch = candidateScore >= requiredScore ? 1 : candidateScore / requiredScore;
    return Math.min(levelMatch * weight, 1);
  }

  private calculateTotalExperience(workExperience: any[]): number {
    let totalMonths = 0;
    
    for (const exp of workExperience) {
      const startDate = new Date(exp.startDate);
      const endDate = exp.endDate ? new Date(exp.endDate) : new Date();
      const months = (endDate.getFullYear() - startDate.getFullYear()) * 12 + (endDate.getMonth() - startDate.getMonth());
      totalMonths += Math.max(months, 0);
    }
    
    return Math.round(totalMonths / 12 * 10) / 10; // Round to 1 decimal place
  }

  private calculateRelevantExperience(workExperience: any[]): number {
    // Simplified - in reality would use AI to determine relevance
    return this.calculateTotalExperience(workExperience) * 0.8; // Assume 80% is relevant
  }

  private checkExperienceLevelMatch(years: number, requiredLevel: ExperienceLevel): boolean {
    const levelRequirements = {
      [ExperienceLevel.ENTRY]: 0,
      [ExperienceLevel.JUNIOR]: 1,
      [ExperienceLevel.MID]: 3,
      [ExperienceLevel.SENIOR]: 5,
      [ExperienceLevel.LEAD]: 8,
      [ExperienceLevel.EXECUTIVE]: 10
    };
    
    return years >= levelRequirements[requiredLevel];
  }

  private calculateExperienceScore(totalYears: number, relevantYears: number, levelMatch: boolean): number {
    const baseScore = Math.min(relevantYears / 5, 1); // Normalize to 5 years
    const levelBonus = levelMatch ? 0.2 : 0;
    return Math.min(baseScore + levelBonus, 1);
  }

  private getHighestDegree(education: any[]): EducationLevel {
    const degreeHierarchy = {
      [EducationLevel.HIGH_SCHOOL]: 1,
      [EducationLevel.ASSOCIATE]: 2,
      [EducationLevel.BACHELOR]: 3,
      [EducationLevel.MASTER]: 4,
      [EducationLevel.DOCTORATE]: 5
    };
    
    let highest = EducationLevel.HIGH_SCHOOL;
    
    for (const edu of education) {
      const degree = this.mapDegreeToLevel(edu.degree);
      if (degreeHierarchy[degree] > degreeHierarchy[highest]) {
        highest = degree;
      }
    }
    
    return highest;
  }

  private mapDegreeToLevel(degree: string): EducationLevel {
    const lowerDegree = degree.toLowerCase();
    
    if (lowerDegree.includes('phd') || lowerDegree.includes('doctorate')) return EducationLevel.DOCTORATE;
    if (lowerDegree.includes('master') || lowerDegree.includes('mba')) return EducationLevel.MASTER;
    if (lowerDegree.includes('bachelor') || lowerDegree.includes('bs') || lowerDegree.includes('ba')) return EducationLevel.BACHELOR;
    if (lowerDegree.includes('associate')) return EducationLevel.ASSOCIATE;
    
    return EducationLevel.HIGH_SCHOOL;
  }

  private checkRelevantField(education: any[], requirements: any[]): boolean {
    // Simplified check - would use AI for better field matching
    return education.some(edu => 
      requirements.some(req => 
        req.field && edu.field && edu.field.toLowerCase().includes(req.field.toLowerCase())
      )
    );
  }

  private checkEducationRequirement(highestDegree: EducationLevel, requirements: any[]): boolean {
    const degreeHierarchy = {
      [EducationLevel.HIGH_SCHOOL]: 1,
      [EducationLevel.ASSOCIATE]: 2,
      [EducationLevel.BACHELOR]: 3,
      [EducationLevel.MASTER]: 4,
      [EducationLevel.DOCTORATE]: 5
    };
    
    const requiredLevels = requirements.filter(req => req.isRequired).map(req => req.level);
    if (requiredLevels.length === 0) return true;
    
    const minRequired = Math.min(...requiredLevels.map(level => degreeHierarchy[level]));
    return degreeHierarchy[highestDegree] >= minRequired;
  }

  private calculateEducationScore(degree: EducationLevel, relevantField: boolean, meetsRequirement: boolean): number {
    const degreeScores = {
      [EducationLevel.HIGH_SCHOOL]: 0.2,
      [EducationLevel.ASSOCIATE]: 0.4,
      [EducationLevel.BACHELOR]: 0.6,
      [EducationLevel.MASTER]: 0.8,
      [EducationLevel.DOCTORATE]: 1.0
    };
    
    let score = degreeScores[degree];
    if (relevantField) score += 0.2;
    if (!meetsRequirement) score *= 0.5;
    
    return Math.min(score, 1);
  }

  private identifyStrengthsWeaknesses(skillMatches: SkillMatch[], experienceMatch: ExperienceMatch, educationMatch: EducationMatch, jobRequirements: JobRequirements): { strengths: string[]; weaknesses: string[] } {
    const strengths: string[] = [];
    const weaknesses: string[] = [];
    
    // Analyze skills
    const strongSkills = skillMatches.filter(match => match.found && match.score > 0.8);
    const weakSkills = skillMatches.filter(match => match.required && (!match.found || match.score < 0.5));
    
    if (strongSkills.length > 0) {
      strengths.push(`Strong skills in: ${strongSkills.map(s => s.skillName).join(', ')}`);
    }
    
    if (weakSkills.length > 0) {
      weaknesses.push(`Missing or weak skills: ${weakSkills.map(s => s.skillName).join(', ')}`);
    }
    
    // Analyze experience
    if (experienceMatch.levelMatch) {
      strengths.push(`Meets experience requirements (${experienceMatch.yearsExperience} years)`);
    } else {
      weaknesses.push(`Insufficient experience for ${jobRequirements.experienceLevel} level`);
    }
    
    // Analyze education
    if (educationMatch.meetsRequirement) {
      strengths.push(`Meets education requirements`);
    } else {
      weaknesses.push(`Does not meet minimum education requirements`);
    }
    
    return { strengths, weaknesses };
  }

  private determineRecommendation(score: number, minimumScore: number): RecommendationType {
    if (score >= 90) return RecommendationType.STRONG_MATCH;
    if (score >= 75) return RecommendationType.GOOD_MATCH;
    if (score >= minimumScore) return RecommendationType.POTENTIAL_MATCH;
    if (score >= 40) return RecommendationType.WEAK_MATCH;
    return RecommendationType.NO_MATCH;
  }

  /**
   * Configure external integration
   */
  async configureIntegration(integrationId: string, integration: ExternalIntegration): Promise<void> {
    logger.info(`Configuring resume screener integration: ${integration.service}`);
    this.integrations.set(integrationId, integration);
  }

  /**
   * Get health status
   */
  async getHealthStatus(): Promise<any> {
    return {
      status: 'healthy',
      resumeParser: 'available',
      skillMatcher: 'available',
      aiClassification: 'available',
      integrations: Array.from(this.integrations.keys())
    };
  }
}