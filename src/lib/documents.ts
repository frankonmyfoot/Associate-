/**
 * Document type definitions and prompt templates for AI document generation.
 */

export type DocumentType =
  | "demand-letter"
  | "contract"
  | "pleading"
  | "settlement-agreement"
  | "legal-memo"
  | "engagement-letter";

export interface DocumentTypeConfig {
  id: DocumentType;
  label: string;
  description: string;
  fields: DocumentField[];
  systemPrompt: string;
}

export interface DocumentField {
  id: string;
  label: string;
  type: "text" | "textarea" | "select" | "date";
  placeholder?: string;
  required?: boolean;
  options?: string[];
  /** If true, try to auto-populate from intake submission data */
  autoFill?: boolean;
}

export const DOCUMENT_TYPES: DocumentTypeConfig[] = [
  {
    id: "demand-letter",
    label: "Demand Letter",
    description: "A formal letter demanding payment or action before litigation.",
    fields: [
      { id: "plaintiff_name", label: "Client Name (Plaintiff)", type: "text", required: true, autoFill: true },
      { id: "defendant_name", label: "Defendant Name", type: "text", required: true },
      { id: "defendant_address", label: "Defendant Address", type: "text", required: true },
      { id: "incident_date", label: "Incident Date", type: "date", required: true },
      { id: "incident_description", label: "Incident Description", type: "textarea", required: true, placeholder: "Describe what happened..." },
      { id: "damages", label: "Damages / Losses", type: "textarea", required: true, placeholder: "Medical bills, lost wages, property damage, etc." },
      { id: "demand_amount", label: "Demand Amount ($)", type: "text", required: true, placeholder: "e.g. $50,000" },
      { id: "deadline_days", label: "Response Deadline (days)", type: "text", required: false, placeholder: "e.g. 30" },
    ],
    systemPrompt: `You are a legal document drafting assistant. Generate a professional demand letter.
Use proper legal format with:
- Attorney/firm letterhead area
- Date
- Defendant's address
- RE: line with case reference
- Body: factual background, liability argument, demand for compensation
- Deadline for response
- Signature block

Make it formal, persuasive, and specific to the facts provided. Use standard legal language.`,
  },
  {
    id: "contract",
    label: "Contract / Agreement",
    description: "A legal agreement between two or more parties.",
    fields: [
      { id: "party_a", label: "Party A Name", type: "text", required: true },
      { id: "party_b", label: "Party B Name", type: "text", required: true },
      { id: "contract_type", label: "Type of Agreement", type: "select", required: true, options: ["Service Agreement", "Independent Contractor", "Non-Disclosure Agreement", "Partnership Agreement", "License Agreement", "Other"] },
      { id: "effective_date", label: "Effective Date", type: "date", required: true },
      { id: "term_length", label: "Term Length", type: "text", required: false, placeholder: "e.g. 12 months, ongoing" },
      { id: "scope_of_work", label: "Scope of Work / Description", type: "textarea", required: true, placeholder: "Describe what services or obligations are involved..." },
      { id: "compensation", label: "Compensation / Payment Terms", type: "textarea", required: true, placeholder: "Amount, schedule, payment method..." },
      { id: "special_terms", label: "Special Terms / Provisions", type: "textarea", required: false, placeholder: "Any additional clauses or special arrangements..." },
    ],
    systemPrompt: `You are a legal document drafting assistant. Generate a professional contract/agreement.
Use standard contract format with:
- Title and parties identification
- Recitals (WHEREAS clauses)
- Definitions
- Term and termination
- Scope of work / obligations
- Compensation and payment terms
- Confidentiality (if applicable)
- Intellectual property (if applicable)
- Limitation of liability
- Governing law
- Entire agreement clause
- Signature blocks

Make it clear, specific, and legally sound.`,
  },
  {
    id: "pleading",
    label: "Pleading (Complaint / Motion)",
    description: "A formal court pleading such as a complaint or motion.",
    fields: [
      { id: "court_name", label: "Court Name", type: "text", required: true, placeholder: "e.g. United States District Court" },
      { id: "case_number", label: "Case Number", type: "text", required: false, placeholder: "Leave blank if new filing" },
      { id: "plaintiff_name", label: "Plaintiff Name", type: "text", required: true, autoFill: true },
      { id: "defendant_name", label: "Defendant Name(s)", type: "text", required: true },
      { id: "pleading_type", label: "Type of Pleading", type: "select", required: true, options: ["Complaint", "Motion to Dismiss", "Motion for Summary Judgment", "Answer", "Other Motion"] },
      { id: "jurisdiction", label: "Jurisdiction / Venue Statement", type: "textarea", required: true, placeholder: "Basis for court jurisdiction..." },
      { id: "factual_allegations", label: "Factual Allegations", type: "textarea", required: true, placeholder: "Numbered paragraphs of facts..." },
      { id: "causes_of_action", label: "Causes of Action / Legal Claims", type: "textarea", required: true, placeholder: "List the legal claims with elements..." },
      { id: "relief_sought", label: "Relief Sought", type: "textarea", required: true, placeholder: "What the court should order..." },
    ],
    systemPrompt: `You are a legal document drafting assistant. Generate a professional court pleading.
Use proper legal format with:
- Caption (court name, parties, case number)
- Document title
- Background / jurisdictional allegations
- Factual allegations (numbered paragraphs)
- Causes of action / counts
- Prayer for relief / demand for judgment
- Signature block with certificate of service

Use precise legal language and format appropriate for the chosen pleading type.`,
  },
  {
    id: "settlement-agreement",
    label: "Settlement Agreement",
    description: "An agreement resolving a legal dispute between parties.",
    fields: [
      { id: "party_a", label: "Party A (Claimant)", type: "text", required: true, autoFill: true },
      { id: "party_b", label: "Party B (Respondent)", type: "text", required: true },
      { id: "dispute_description", label: "Description of Dispute", type: "textarea", required: true, placeholder: "Briefly describe the dispute being settled..." },
      { id: "settlement_amount", label: "Settlement Amount ($)", type: "text", required: true },
      { id: "payment_terms", label: "Payment Terms", type: "textarea", required: true, placeholder: "Lump sum, installment plan, deadline..." },
      { id: "release_scope", label: "Scope of Release", type: "textarea", required: false, placeholder: "What claims are being released..." },
      { id: "confidentiality", label: "Confidentiality Terms", type: "select", required: false, options: ["Confidential", "Not Confidential", "Limited Disclosure"] },
    ],
    systemPrompt: `You are a legal document drafting assistant. Generate a professional settlement agreement and release.
Use standard format with:
- Parties and recitals
- Recitals describing the dispute
- Settlement payment terms
- Release of claims
- Confidentiality provisions
- Non-disparagement clause (optional)
- Governing law
- Entire agreement clause
- Execution / signature blocks

Make it clear and enforceable.`,
  },
  {
    id: "legal-memo",
    label: "Legal Memo",
    description: "An internal memorandum analyzing a legal issue.",
    fields: [
      { id: "to_attorney", label: "To (Attorney Name)", type: "text", required: true },
      { id: "from_attorney", label: "From (Your Name)", type: "text", required: true },
      { id: "client_name", label: "Client Name", type: "text", required: true, autoFill: true },
      { id: "client_matter", label: "Client Matter / File No.", type: "text", required: false },
      { id: "date", label: "Date", type: "date", required: true },
      { id: "re_subject", label: "RE: Subject", type: "text", required: true, placeholder: "Brief description of the legal issue" },
      { id: "question_presented", label: "Question Presented", type: "textarea", required: true, placeholder: "The legal question to be analyzed..." },
      { id: "brief_answer", label: "Brief Answer", type: "textarea", required: false, placeholder: "Short answer to the legal question..." },
      { id: "facts", label: "Facts", type: "textarea", required: true, placeholder: "Relevant facts of the case..." },
      { id: "legal_analysis", label: "Legal Analysis", type: "textarea", required: true, placeholder: "Statutes, case law, and analysis..." },
      { id: "conclusion", label: "Conclusion / Recommendation", type: "textarea", required: true, placeholder: "Summary and recommended action..." },
    ],
    systemPrompt: `You are a legal document drafting assistant. Generate a professional legal memorandum.
Use formal legal memo format with:
- TO / FROM / DATE / RE heading block
- Question Presented
- Brief Answer
- Facts section
- Discussion / Legal Analysis section (with applicable statutes and case law references)
- Conclusion

Use clear legal reasoning and cite relevant legal principles.`,
  },
  {
    id: "engagement-letter",
    label: "Engagement Letter",
    description: "A letter outlining the terms of legal representation.",
    fields: [
      { id: "client_name", label: "Client Name", type: "text", required: true, autoFill: true },
      { id: "client_address", label: "Client Address", type: "text", required: true },
      { id: "matter_description", label: "Scope of Representation", type: "textarea", required: true, placeholder: "What legal services will be provided..." },
      { id: "fee_structure", label: "Fee Structure", type: "select", required: true, options: ["Hourly", "Flat Fee", "Contingency", "Hybrid"] },
      { id: "hourly_rate", label: "Hourly Rate ($)", type: "text", required: false, placeholder: "e.g. $350/hour" },
      { id: "flat_fee_amount", label: "Flat Fee Amount ($)", type: "text", required: false, placeholder: "e.g. $5,000" },
      { id: "contingency_percentage", label: "Contingency Percentage", type: "text", required: false, placeholder: "e.g. 33%" },
      { id: "retainer_amount", label: "Initial Retainer ($)", type: "text", required: false, placeholder: "e.g. $2,500" },
      { id: "expenses", label: "Expense Handling", type: "textarea", required: false, placeholder: "How costs and expenses are billed..." },
    ],
    systemPrompt: `You are a legal document drafting assistant. Generate a professional engagement letter for legal services.
Use standard format with:
- Firm letterhead
- Date
- Client address
- RE: Engagement for [matter description]
- Scope of representation
- Fee arrangement details
- Billing and payment terms
- Client responsibilities
- Conflict of interest acknowledgment
- Termination clause
- Signature lines for both parties

Make it clear, compliant with ethical rules, and professional.`,
  },
];

/** Get a document type config by ID */
export function getDocumentType(id: string): DocumentTypeConfig | undefined {
  return DOCUMENT_TYPES.find((dt) => dt.id === id);
}