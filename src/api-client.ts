import { Config, log } from './config.js';

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
}

export interface JobSearchFilters {
  title?: string;
  titles?: string[];
  company?: string;
  companies?: string[];
  excludedCompanies?: string[];
  excludedTitles?: string[];
  locations?: string[];
  locationTiers?: string[];
  country?: string;
  countries?: string[];
  skills?: string[];
  remote?: boolean;
  remotePriority?: boolean;
  excludedKeywords?: string[];
  relevancy?: string;
  aaOnly?: boolean;
  workArrangement?: string[];
  industries?: string[];
  fundingStages?: string[];
  latestFundingDate?: string;
  companyTags?: string[];
  companySize?: string[];
  jobFamilies?: string[];
  expLevels?: string[];
  seniorityLevels?: string[];
  expBuckets?: string[];
  minExp?: number;
  maxExp?: number;
  managementExpMin?: number;
  baseSalaryMin?: number;
  baseSalaryMax?: number;
  marketBaseCurrency?: string;
  marketBaseSalaryMin?: number;
  marketBaseSalaryMax?: number;
  marketTotalCompensationMin?: number;
  marketTotalCompensationMax?: number;
  workMode?: string[];
  minimumDegree?: string[];
  h1bSponsorship?: boolean;
  workAuthorization?: string[];
  roleType?: 'ic' | 'manager';
  roleTypeInternal?: 'ic' | 'manager';
  languageRequirements?: string[];
  startDate?: string;
  endDate?: string;
  dateOffset?: '24H' | '1D' | '2D' | '7D' | '14D' | '1M' | '3M' | '6M' | '9M' | '1Y';
}

export interface JobSearchParams {
  filters?: JobSearchFilters;
  page?: number;
  limit?: number;
  sort?: string;
  description?: boolean;
  includeFilters?: boolean;
  src?: string;
}

export interface JobMatchParams {
  jobHuntId: string;
  page?: number;
  limit?: number;
}

export interface Job {
  id: string;
  title: string;
  company: string;
  location: string;
  description?: string;
  url: string;
  applyUrl?: string;
  remote: boolean;
  salaryMin?: number;
  salaryMax?: number;
  postedDate: string;
  ats?: string;
  status?: string;
  companyIndustries?: string[];
  companySize?: string;
  experienceLevel?: string;
  skills?: string[];
}

export interface Profile {
  id: string;
  email: string;
  fullName: string;
  firstName?: string;
  lastName?: string;
  headline?: string;
  location?: string;
  skills?: string[];
  experience?: number;
  resumeFileName?: string;
  resumeUri?: string;
  company?: Array<{
    name: string;
    title: string;
    start?: string;
    end?: string;
    current?: boolean;
    location?: string;
  }>;
  school?: Array<{
    name: string;
    degree?: string;
    specialization?: string;
    year?: string;
  }>;
}

export interface JobHunt {
  id: string;
  name: string;
  status: string;
  autoMode: boolean;
  dailyLimit?: number;
  minMatchScore?: number;
  customizeResume?: boolean;
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface JobApplication {
  id: string;
  jobHuntId: string;
  jobId?: string;
  title: string;
  company: string;
  location?: string;
  url: string;
  status: string;
  autoApplied?: boolean;
  appliedDate?: string;
  notes?: string;
  aiRelevancyScore?: number;
  createdAt: string;
  updatedAt: string;
}

export interface Interview {
  id: string;
  jobApplicationId: string;
  jobHuntId: string;
  company: Record<string, unknown>;
  title: string;
  interviewTime: string | null;
  timezone: string | null;
  format: string | null;
  meetingPlatform: string | null;
  location: string | null;
  interviewerName: string | null;
  interviewerEmail: string | null;
  duration: string | null;
  notes: string | null;
  status: string;
  dateCreated: string;
  dateUpdated: string;
}

export interface ApplicationStats {
  total: number;
  byStatus: Record<string, number>;
  autoApply: {
    successful: number;
    failed: number;
    inProgress: number;
  };
}

export interface Currency {
  code: number;
  isoCode: string;
  symbol: string;
  region: string | null;
  unit: string;
}

export interface ProfileSalary {
  salary?: number;
  base?: number;
  stocks?: number;
  totalStocks?: number;
  bonus?: number;
  signingBonus?: number;
  targetSalary?: number;
  currency?: number;
  equityType?: string;
  bonusInputType?: string;
  stockDetails?: Record<string, unknown>;
  salaryDateUpdated?: string;
}

export interface SalaryStats {
  title: string;
  location?: string;
  region: string;
  count: number;
  stats: {
    median?: number;
    mean?: number;
    p25?: number;
    p75?: number;
    p90?: number;
    min?: number;
    max?: number;
  };
  currencySign: string;
  currencyPostfix?: string;
}

export interface ResumeAnalysis {
  job: {
    id: string;
    title: string;
    company: string;
  };
  analysis: {
    matchScore: number;
    matchingQualifications: string[];
    gaps: string[];
    suggestions: string[];
  };
}

// Resume from accountController.getResumes - returns array directly
export interface Resume {
  fileName: string;
  uri: string;
  url: string;
  primary: boolean;
  createdAt: string;
  tags?: string[];
  rawTxt?: string;
}

// Resume from accountController.getResume - returns single object
export interface ResumeDetail {
  fileName: string;
  url: string;
  rawTxt?: string;
}

// Generated resume from jobsController.getGeneratedResumes - raw Mongoose doc
export interface GeneratedResume {
  _id: string;
  userId: string;
  jobId?: string;
  jobApplicationId?: string;
  fileName: string;
  uri: string;
  source?: string;
  manualTrigger?: boolean;
  aiRelevancyScore?: number;
  status: string;
  meta?: {
    title?: string;
    companyName?: string;
    modifications?: string[];
  };
  dateCreated: string;
  dateUpdated: string;
}

export interface GeneratedResumeListResponse {
  resumes: GeneratedResume[];
}

// Generated resume detail from jobsController.getGeneratedResume
export interface GeneratedResumeDetail {
  resumeFileName: string;
  url: string;
}

// Resume JSON generation response from jobsController.generateResumeJson
export interface GeneratedResumeJsonResponse {
  jsonResume?: Record<string, unknown>;
  addedKeywords?: string[];
  pdfUrl?: string;
  generatedResumeId?: string;
}

// Match score response from jobsController.getJobApplicationAiAnalysis
export interface MatchScoreResponse {
  relevancyScore: number;
  justification?: string;
  optimizations?: string[];
  matchingSkills?: string[];
  missingSkills?: string[];
}

// Contact from Contact model's public scope
export interface Contact {
  id: string;
  firstName?: string;
  fullName?: string;
  email?: string;
  title?: string;
  headline?: string;
  linkedinUrl?: string;
  companyName?: string;
  companyLogo?: string;
  avatar?: string;
}

export interface ContactWithEmail {
  emailTemplate: string;
  subject: string;
  contact: Contact;
}

export interface ContactsResponse {
  contacts: ContactWithEmail[];
}

// Outreach
export interface Outreach {
  id: string;
  jobApplicationId: string;
  contactId: string;
  contactEmail?: string;
  contactName?: string;
  subject: string;
  body: string;
  status?: string;
  sentAt?: string;
  createdAt: string;
}

export interface OutreachListResponse {
  outreaches: Outreach[];
  count: number;
}

// Email templates
export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  type: 'recruiter' | 'referral';
}

export interface GeneratedEmail {
  subject: string;
  body: string;
}

export class JobGPTApiClient {
  private baseURL: string;
  private headers: Record<string, string>;

  constructor(config: Config) {
    this.baseURL = `${config.apiUrl}/api/v1/mcp`;
    this.headers = {
      'Authorization': `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    };
  }

  private async request<T>(method: string, path: string, body?: unknown, params?: Record<string, string | number | boolean>): Promise<T> {
    let url = `${this.baseURL}${path}`;

    if (params) {
      const searchParams = new URLSearchParams();
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null) {
          searchParams.set(key, String(value));
        }
      }
      const qs = searchParams.toString();
      if (qs) {
        url += `?${qs}`;
      }
    }

    log('API Request:', method.toUpperCase(), path);

    const options: RequestInit = {
      method,
      headers: this.headers,
      signal: AbortSignal.timeout(60000),
    };

    if (body !== undefined) {
      options.body = JSON.stringify(body);
    }

    let response: Response;
    try {
      response = await fetch(url, options);
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'TimeoutError') {
        throw new Error('Network error: Request timed out after 60 seconds');
      }
      throw new Error('Network error: Unable to reach JobGPT API');
    }

    log('API Response:', response.status, response.statusText);

    const json = await response.json() as ApiResponse<T>;

    if (!response.ok) {
      const message = json.message || response.statusText;
      throw new Error(this.enrichErrorMessage(`API Error (${response.status}): ${message}`));
    }

    if (!json.success) {
      throw new Error(this.enrichErrorMessage(json.message || `Request failed: ${method} ${path}`));
    }

    return json.data as T;
  }

  private enrichErrorMessage(message: string): string {
    if (/quota.*exhausted|no.*credits|insufficient.*credits|out of credits/i.test(message)) {
      return `${message}\n\nYou have run out of credits. Please purchase more credits to continue: https://6figr.com/jobgpt?addCreditsPopup=true`;
    }
    return message;
  }

  private async get<T>(path: string, params?: Record<string, string | number | boolean>): Promise<T> {
    return this.request<T>('GET', path, undefined, params);
  }

  private async post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('POST', path, body);
  }

  private async put<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('PUT', path, body);
  }

  private async del<T>(path: string): Promise<T> {
    return this.request<T>('DELETE', path);
  }

  // ==================== Jobs ====================

  async searchJobs(params: JobSearchParams): Promise<{ jobs: Job[]; count: number }> {
    return this.post<{ jobs: Job[]; count: number }>('/jobs/search', params);
  }

  async getJob(id: string): Promise<Job> {
    return this.get<Job>(`/jobs/${id}`);
  }

  async matchJobs(params: JobMatchParams): Promise<{ jobs: Job[]; count: number }> {
    return this.post<{ jobs: Job[]; count: number }>('/jobs/match', params);
  }

  // ==================== Profile ====================

  async getProfile(): Promise<Profile> {
    return this.get<Profile>('/profile');
  }

  async updateProfile(data: Partial<Profile>): Promise<void> {
    await this.put('/profile', data);
  }

  // ==================== Credits ====================

  async getCredits(): Promise<{ autoApplyQuota: number; autoApplyQuotaRemaining: number }> {
    const result = await this.get<{ jobHunts: JobHunt[]; autoApplyQuota: number; autoApplyQuotaRemaining: number }>('/credits');
    return {
      autoApplyQuota: result.autoApplyQuota,
      autoApplyQuotaRemaining: result.autoApplyQuotaRemaining,
    };
  }

  // ==================== Job Hunts ====================

  async listJobHunts(page = 1, limit = 20): Promise<{ jobHunts: JobHunt[]; autoApplyQuota: number; autoApplyQuotaRemaining: number }> {
    return this.get<{ jobHunts: JobHunt[]; autoApplyQuota: number; autoApplyQuotaRemaining: number }>('/job-hunts', { page, limit });
  }

  async createJobHunt(data: { name: string; config: JobSearchFilters; autoMode?: boolean; dailyLimit?: number; minMatchScore?: number; customizeResume?: boolean }): Promise<JobHunt> {
    return this.post<JobHunt>('/job-hunts', data);
  }

  async getJobHunt(id: string): Promise<JobHunt> {
    return this.get<JobHunt>(`/job-hunts/${id}`);
  }

  async updateJobHunt(id: string, data: Partial<JobHunt>): Promise<JobHunt> {
    return this.put<JobHunt>(`/job-hunts/${id}`, data);
  }

  // ==================== Applications ====================

  async listApplications(params: { jobHuntId?: string; status?: string; page?: number; limit?: number }): Promise<{ applications: JobApplication[]; count: number }> {
    const query: Record<string, string | number | boolean> = {};
    if (params.jobHuntId) { query.jobHuntId = params.jobHuntId; }
    if (params.status) { query.status = params.status; }
    if (params.page) { query.page = params.page; }
    if (params.limit) { query.limit = params.limit; }
    const result = await this.get<{ jobs: JobApplication[]; count: number }>('/job-applications', query);
    return { applications: result.jobs || [], count: result.count || 0 };
  }

  async getApplicationStats(jobHuntId?: string, dateOffset?: string): Promise<ApplicationStats> {
    const params: Record<string, string | number | boolean> = {};
    if (jobHuntId) { params.jobHuntId = jobHuntId; }
    if (dateOffset) { params.dateOffset = dateOffset; }
    return this.get<ApplicationStats>('/job-applications/stats', params);
  }

  async getApplication(id: string, opts?: { includeJobListing?: boolean }): Promise<JobApplication> {
    const query: Record<string, string | number | boolean> = {};
    if (opts?.includeJobListing) { query.includeJobListing = true; }
    return this.get<JobApplication>(`/job-applications/${id}`, query);
  }

  async updateApplication(id: string, data: Partial<JobApplication>): Promise<JobApplication> {
    return this.put<JobApplication>(`/job-applications/${id}`, data);
  }

  async autoApply(applicationId: string, resumeUri?: string): Promise<void> {
    const payload: { resumeUri?: string } = {};
    if (resumeUri) {
      payload.resumeUri = resumeUri;
    }
    await this.post(`/job-applications/${applicationId}/auto-apply`, payload);
  }

  async listInterviews(params?: { jobApplicationId?: string; status?: string; upcoming?: boolean; page?: number; limit?: number }): Promise<{ interviews: Interview[]; count: number }> {
    const query: Record<string, string | number | boolean> = {};
    if (params?.jobApplicationId) { query.jobApplicationId = params.jobApplicationId; }
    if (params?.status) { query.status = params.status; }
    if (params?.upcoming) { query.upcoming = true; }
    if (params?.page) { query.page = params.page; }
    if (params?.limit) { query.limit = params.limit; }
    return this.get<{ interviews: Interview[]; count: number }>('/interviews', query);
  }

  async addJobToApplications(jobId: string, jobHuntId: string): Promise<{ id: string; title?: string; company?: string; status?: string; message?: string; existing?: boolean }> {
    return this.post<{ id: string; title?: string; company?: string; status?: string; message?: string; existing?: boolean }>(`/jobs/${jobId}/create-application`, { jobHuntId });
  }

  async importJobByUrl(url: string, jobHuntId: string, autoApply = false): Promise<JobApplication> {
    return this.post<JobApplication>('/jobs/import', { url, jobHuntId, autoApply });
  }

  // ==================== Resume ====================

  async analyzeResumeMatch(jobId: string): Promise<ResumeAnalysis> {
    return this.post<ResumeAnalysis>('/resume-analysis', { jobId });
  }

  async listResumes(includeRawTxt = false): Promise<Resume[]> {
    return this.get<Resume[]>('/resumes', { includeRawTxt });
  }

  async getResume(id: string, includeRawTxt = false): Promise<ResumeDetail> {
    return this.get<ResumeDetail>(`/resumes/${encodeURIComponent(id)}`, { includeRawTxt });
  }

  async deleteResume(id: string): Promise<void> {
    await this.del(`/resumes/${encodeURIComponent(id)}`);
  }

  async uploadResumeFromUrl(url: string, syncProfile = true, isAltResume = false): Promise<{ uri: string; fileName: string }> {
    return this.post<{ uri: string; fileName: string }>('/resumes/upload-url', { url, syncProfile, isAltResume });
  }

  async uploadResumeFromBase64(fileContent: string, fileName: string, syncProfile = true, isAltResume = false): Promise<{ uri: string; fileName: string }> {
    return this.post<{ uri: string; fileName: string }>('/resumes/upload', { fileContent, fileName, syncProfile, isAltResume });
  }

  async listGeneratedResumes(params?: { jobApplicationId?: string; manualTrigger?: boolean }): Promise<GeneratedResumeListResponse> {
    const query: Record<string, string | number | boolean> = {};
    if (params?.jobApplicationId) { query.jobApplicationId = params.jobApplicationId; }
    if (params?.manualTrigger !== undefined) { query.manualTrigger = params.manualTrigger; }
    return this.get<GeneratedResumeListResponse>('/generated-resumes', query);
  }

  async getGeneratedResume(id: string): Promise<GeneratedResumeDetail> {
    return this.get<GeneratedResumeDetail>(`/generated-resumes/${id}`);
  }

  async generateResumeForJob(applicationId: string, params?: { modifications?: string[]; keywords?: string[]; sections?: string[]; generatePdf?: boolean }): Promise<GeneratedResumeJsonResponse> {
    return this.post<GeneratedResumeJsonResponse>(`/job-applications/${applicationId}/generate-resume`, params || {});
  }

  async calculateMatchScore(applicationId: string): Promise<MatchScoreResponse> {
    return this.post<MatchScoreResponse>(`/job-applications/${applicationId}/match-score`);
  }

  // ==================== Currencies ====================

  async getCurrencies(): Promise<Currency[]> {
    return this.get<Currency[]>('/currencies');
  }

  // ==================== Profile Salary ====================

  async getProfileSalary(): Promise<ProfileSalary> {
    return this.get<ProfileSalary>('/profile/salary');
  }

  async updateProfileSalary(data: Record<string, unknown>): Promise<void> {
    await this.post('/profile/salary', data);
  }

  // ==================== Salary Data ====================

  async getSalary(title: string, region = 'us', location?: string): Promise<SalaryStats> {
    const params: Record<string, string | number | boolean> = { region };
    if (location) { params.location = location; }
    return this.get<SalaryStats>(`/salary/${encodeURIComponent(title)}`, params);
  }

  // ==================== Recruiters & Referrers ====================

  async getJobRecruiters(jobId: string): Promise<ContactsResponse> {
    return this.get<ContactsResponse>(`/jobs/${jobId}/recruiters`);
  }

  async getJobReferrers(jobId: string, limit = 2): Promise<ContactsResponse> {
    return this.get<ContactsResponse>(`/jobs/${jobId}/referrers`, { limit });
  }

  async getApplicationRecruiters(applicationId: string): Promise<ContactsResponse> {
    return this.get<ContactsResponse>(`/job-applications/${applicationId}/recruiters`);
  }

  async getApplicationReferrers(applicationId: string, limit = 2): Promise<ContactsResponse> {
    return this.get<ContactsResponse>(`/job-applications/${applicationId}/referrers`, { limit });
  }

  // ==================== Outreach ====================

  async listOutreaches(params?: { jobApplicationId?: string; page?: number; limit?: number }): Promise<OutreachListResponse> {
    const query: Record<string, string | number | boolean> = {};
    if (params?.jobApplicationId) { query.jobApplicationId = params.jobApplicationId; }
    if (params?.page) { query.page = params.page; }
    if (params?.limit) { query.limit = params.limit; }
    return this.get<OutreachListResponse>('/outreaches', query);
  }

  async createOutreach(applicationId: string, contactId: string, subject: string, body: string): Promise<Outreach> {
    return this.post<Outreach>(`/job-applications/${applicationId}/outreaches`, { contactId, subject, body });
  }

  // ==================== Email Templates ====================

  async listEmailTemplates(type?: 'recruiter' | 'referral'): Promise<EmailTemplate[]> {
    const params: Record<string, string | number | boolean> = {};
    if (type) { params.type = type; }
    return this.get<EmailTemplate[]>('/email-templates', params);
  }

  async generateEmailFromTemplate(applicationId: string, templateId: string, contactId: string): Promise<GeneratedEmail> {
    return this.post<GeneratedEmail>(`/job-applications/${applicationId}/generate-email`, { templateId, contactId });
  }
}
