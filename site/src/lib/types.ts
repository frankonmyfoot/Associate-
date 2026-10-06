// Shared product types (ported from the AssociateAI MVP).

export type IntakeFieldType =
  | "text"
  | "textarea"
  | "date"
  | "file"
  | "select"
  | "email"
  | "phone";

export interface IntakeField {
  id: string;
  type: IntakeFieldType;
  label: string;
  placeholder?: string;
  required?: boolean;
  options?: string[];
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

export type DocumentType =
  | "demand-letter"
  | "contract"
  | "pleading"
  | "settlement-agreement"
  | "legal-memo"
  | "engagement-letter";

export interface Firm {
  id: string;
  name: string;
  slug: string;
  plan: "starter" | "pro" | "enterprise";
  practiceAreas?: string | null;
  teamSize?: number | null;
  createdAt: string;
}

export interface FirmUser {
  id: string;
  firmId: string;
  clerkUserId: string;
  email: string;
  name: string;
  role: "admin" | "attorney" | "paralegal" | "staff";
  createdAt: string;
}

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
