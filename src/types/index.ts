// ─── Intake Types ──────────────────────────────────────────────

export type IntakeFieldType = "text" | "textarea" | "date" | "file" | "select" | "email" | "phone";

export interface IntakeField {
  id: string;
  type: IntakeFieldType;
  label: string;
  placeholder?: string;
  required?: boolean;
  options?: string[]; // For select fields
}

export interface IntakeForm {
  id: string;
  firmId: string;
  title: string;
  description?: string;
  fields: IntakeField[];
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
}

export interface IntakeSubmission {
  id: string;
  formId: string;
  firmId: string;
  data: Record<string, string>;
  caseSummary?: string;
  status: "pending" | "reviewed" | "archived";
  createdAt: string;
  reviewedAt?: string;
}

// ─── Document Types ────────────────────────────────────────────

export type DocumentType = "demand-letter" | "contract" | "pleading" | "memo" | "letter" | "other";

export interface DocumentDraft {
  id: string;
  firmId: string;
  title: string;
  documentType: DocumentType;
  content: string;
  caseDetails?: Record<string, string>;
  sourceSubmissionId?: string;
  status: "draft" | "finalized" | "archived";
  createdAt: string;
  updatedAt: string;
}

// ─── Firm / User Types ─────────────────────────────────────────

export interface Firm {
  id: string;
  name: string;
  slug: string;
  plan: "starter" | "pro" | "enterprise";
  createdAt: string;
}

export interface User {
  id: string;
  firmId: string;
  email: string;
  name: string;
  role: "admin" | "attorney" | "paralegal" | "staff";
  createdAt: string;
}

// ─── API Response Types ────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}