import { Report, ReportDecision } from './entities/report.entity.js';
import { Thread, ThreadStatus } from './entities/thread.entity.js';
export const THREAD_READER = 'THREAD_READER' as const;
export const THREAD_WRITER = 'THREAD_WRITER' as const;
export const REPORT_READER = 'REPORT_READER' as const;
export const REPORT_WRITER = 'REPORT_WRITER' as const;
export const REACTION_READER = 'REACTION_READER' as const;
export const REACTION_WRITER = 'REACTION_WRITER' as const;
export const REPLY_WRITER = 'REPLY_WRITER' as const;
export interface ReplyListada {
  id: string;
  content: string;
  status: ThreadStatus;
  createdAt: Date;
  author: {
    id: string;
    name: string;
    role: 'STUDENT' | 'MENTOR' | 'ADMIN';
  };
}
export interface ThreadListada {
  thread: Thread;
  authorName: string;
  authorRole: 'STUDENT' | 'MENTOR' | 'ADMIN';
  hasUserReaction: boolean;
  openReports: number;
  replies: ReplyListada[];
}
export interface ThreadReader {
  list(filter: {
    status?: ThreadStatus;
    category?: string;
    page: number;
    perPage: number;
    userId?: string;
    replyStatuses?: ThreadStatus[];
  }): Promise<{
    threads: ThreadListada[];
    total: number;
  }>;
  byId(id: string): Promise<Thread | null>;
}
export interface ThreadWriter {
  create(thread: Thread): Promise<void>;
  save(thread: Thread): Promise<void>;
}
export interface ReactionReader {
  existe(threadId: string, userId: string): Promise<boolean>;
}
export interface ReactionWriter {
  add(threadId: string, userId: string): Promise<void>;
  remove(threadId: string, userId: string): Promise<void>;
}
export interface ReplyWriter {
  create(reply: {
    id: string;
    threadId: string;
    authorId: string;
    content: string;
    publicadaDirect: boolean;
  }): Promise<void>;
}
export interface ReportReader {
  byId(id: string): Promise<Report | null>;
  list(filter: {
    status?: 'IN_ANALYSIS' | 'RESOLVED';
    page: number;
    perPage: number;
  }): Promise<{
    reports: {
      row: Report;
      thread: {
        id: string;
        content: string;
        authorId: string;
        reportsCount: number;
      };
    }[];
    total: number;
  }>;
  kpis(): Promise<{
    openReports: number;
    resolved: number;
    authorsInAnalysis: number;
  }>;
}
export interface ReportWriter {
  create(report: Report): Promise<void>;
  save(report: Report): Promise<void>;
}
export interface CommunityRules {
  text: string[];
}
export const RULES_READER = 'RULES_READER' as const;
export interface CommunityRulesRepository {
  get(): Promise<CommunityRules>;
  save(rules: CommunityRules): Promise<void>;
}
export type { ThreadStatus, ReportDecision };
