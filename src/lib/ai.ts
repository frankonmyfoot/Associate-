/**
 * AI integration for document generation.
 *
 * Supports OpenAI and Anthropic APIs.
 * Falls back to template-based generation if no API key is configured.
 */

import { getDocumentType, type DocumentType } from "./documents";

// ─── Configuration ────────────────────────────────────────────

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

// ─── Types ─────────────────────────────────────────────────────

export interface GenerateDocumentParams {
  documentType: DocumentType;
  caseDetails: Record<string, string>;
  /** Optional reference to an intake submission for auto-fill */
  sourceSubmissionId?: string;
}

export interface GenerateDocumentResult {
  content: string;
  model: string;
}

// ─── Generate Document ────────────────────────────────────────

export async function generateDocument(
  params: GenerateDocumentParams,
): Promise<GenerateDocumentResult> {
  const config = getDocumentType(params.documentType);
  if (!config) {
    throw new Error(`Unknown document type: ${params.documentType}`);
  }

  // Try OpenAI first
  if (OPENAI_API_KEY) {
    try {
      return await generateWithOpenAI(config.systemPrompt, params.caseDetails);
    } catch (error) {
      console.warn("OpenAI generation failed, trying fallback:", error);
    }
  }

  // Try Anthropic second
  if (ANTHROPIC_API_KEY) {
    try {
      return await generateWithAnthropic(config.systemPrompt, params.caseDetails);
    } catch (error) {
      console.warn("Anthropic generation failed, trying fallback:", error);
    }
  }

  // Fallback: template-based generation
  return generateWithTemplate(config, params.caseDetails);
}

// ─── OpenAI Integration ───────────────────────────────────────

async function generateWithOpenAI(
  systemPrompt: string,
  caseDetails: Record<string, string>,
): Promise<GenerateDocumentResult> {
  const detailsText = Object.entries(caseDetails)
    .map(([key, value]) => `${key}: ${value}`)
    .join("\n");

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Please draft a legal document based on the following case details:\n\n${detailsText}\n\nUse proper legal formatting and language.`,
        },
      ],
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${response.status} ${error}`);
  }

  const data = await response.json();
  return {
    content: data.choices[0].message.content,
    model: "gpt-4o-mini",
  };
}

// ─── Anthropic Integration ────────────────────────────────────

async function generateWithAnthropic(
  systemPrompt: string,
  caseDetails: Record<string, string>,
): Promise<GenerateDocumentResult> {
  const detailsText = Object.entries(caseDetails)
    .map(([key, value]) => `${key}: ${value}`)
    .join("\n");

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-3-haiku-20240307",
      max_tokens: 4000,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: `Please draft a legal document based on the following case details:\n\n${detailsText}\n\nUse proper legal formatting and language.`,
        },
      ],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Anthropic API error: ${response.status} ${error}`);
  }

  const data = await response.json();
  return {
    content: data.content[0].text,
    model: "claude-3-haiku-20240307",
  };
}

// ─── Template-based Fallback ──────────────────────────────────

function generateWithTemplate(
  config: ReturnType<typeof getDocumentType>,
  caseDetails: Record<string, string>,
): GenerateDocumentResult {
  if (!config) throw new Error("Unknown document type");

  const d = caseDetails;
  const today = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  let content = "";

  switch (config.id) {
    case "demand-letter":
      content = `[FIRM LETTERHEAD]

${today}

${d.defendant_address || "[Defendant Address]"}

RE: Demand Letter — ${d.plaintiff_name || "[Client Name]"} vs. ${d.defendant_name || "[Defendant Name]"}

Dear ${d.defendant_name || "[Defendant]"}:

This firm represents ${d.plaintiff_name || "our client"} regarding the incident that occurred on ${d.incident_date || "[date]"}. 

FACTUAL BACKGROUND
${d.incident_description || "[Description of incident]"}

DAMAGES
${d.damages || "[Description of damages]"}

DEMAND
Based on the above, we demand payment of ${d.demand_amount || "[amount]"} to compensate for the damages suffered. This amount accounts for medical expenses, lost wages, pain and suffering, and other losses.

Please respond within ${d.deadline_days || "30"} days of the date of this letter. If we do not receive a satisfactory response, we will pursue all available legal remedies without further notice.

This letter is an attempt to resolve this matter without litigation. Nothing herein constitutes an admission of liability.

Sincerely,

[Attorney Name]
[Law Firm Name]
[Contact Information]`;
      break;

    case "contract":
      content = `CONTRACT / AGREEMENT

THIS AGREEMENT (the "Agreement") is made and entered into on ${d.effective_date || "[date]"}, by and between:

${d.party_a || "Party A"} ("Party A")

AND

${d.party_b || "Party B"} ("Party B")

1. TYPE OF AGREEMENT
This is a ${d.contract_type || "Service Agreement"}.

2. SCOPE OF WORK
${d.scope_of_work || "[Description of services/obligations]"}

3. TERM
This Agreement shall commence on ${d.effective_date || "[date]"}${d.term_length ? " and continue for " + d.term_length : ""}.

4. COMPENSATION
${d.compensation || "[Payment terms]"}

5. GENERAL PROVISIONS
5.1 Governing Law. This Agreement shall be governed by the laws of [State].
5.2 Entire Agreement. This Agreement constitutes the entire agreement between the parties.
5.3 Amendments. Any amendments must be in writing and signed by both parties.

IN WITNESS WHEREOF, the parties have executed this Agreement as of the date first written above.

_________________________          _________________________
${d.party_a || "Party A"}                    ${d.party_b || "Party B"}`;
      break;

    case "pleading":
      content = `${d.court_name || "[COURT NAME]"}

${d.plaintiff_name || "Plaintiff"},

v.                                              Case No. ${d.case_number || "_____"}

${d.defendant_name || "Defendant"}.

________________________________________________

${d.pleading_type || "COMPLAINT"}

________________________________________________

COMES NOW the ${d.plaintiff_name || "Plaintiff"}, by and through counsel, and alleges as follows:

JURISDICTION AND VENUE
${d.jurisdiction || "[Jurisdiction statement]"}

FACTUAL ALLEGATIONS
${d.factual_allegations || "[Numbered factual allegations]"}

CAUSES OF ACTION
${d.causes_of_action || "[Legal claims]"}

PRAYER FOR RELIEF
WHEREFORE, ${d.plaintiff_name || "Plaintiff"} respectfully requests that this Court:
${d.relief_sought || "[Relief requested]"}

Respectfully submitted,

[Attorney Name]
[Bar Number]
[Firm Name]
[Address]`;
      break;

    case "settlement-agreement":
      content = `SETTLEMENT AGREEMENT AND RELEASE

This Settlement Agreement (the "Agreement") is entered into on ${today}, by and between:

${d.party_a || "Claimant"} ("Releasor")

AND

${d.party_b || "Respondent"} ("Releasee")

RECITALS
WHEREAS, the parties are involved in a dispute described as follows:
${d.dispute_description || "[Description of dispute]"}

NOW, THEREFORE, in consideration of the mutual promises contained herein, the parties agree as follows:

1. SETTLEMENT PAYMENT
${d.party_b || "Releasee"} shall pay ${d.party_a || "Releasor"} the sum of ${d.settlement_amount || "[amount]"} under the following terms:
${d.payment_terms || "[Payment terms]"}

2. RELEASE OF CLAIMS
${d.release_scope || "Upon receipt of payment, Releasor releases Releasee from all claims arising from the above dispute."}

3. CONFIDENTIALITY
${d.confidentiality === "Confidential" ? "The terms of this Agreement shall remain confidential." : d.confidentiality === "Limited Disclosure" ? "The terms may be disclosed only as required by law." : "This Agreement is not confidential."}

4. GOVERNING LAW
This Agreement shall be governed by the laws of [State].

IN WITNESS WHEREOF, the parties have executed this Agreement.

_________________________          _________________________
${d.party_a || "Claimant"}                    ${d.party_b || "Respondent"}

Date: _____________           Date: _____________`;
      break;

    case "legal-memo":
      content = `MEMORANDUM

TO:        ${d.to_attorney || "[Recipient]"}
FROM:      ${d.from_attorney || "[Author]"}
DATE:      ${d.date || today}
RE:        ${d.re_subject || "[Subject]"}
${d.client_matter ? "CLIENT:    " + d.client_matter : ""}

1. QUESTION PRESENTED
${d.question_presented || "[Legal question]"}

${d.brief_answer ? "2. BRIEF ANSWER\n" + d.brief_answer + "\n\n" : ""}3. FACTS
${d.facts || "[Relevant facts]"}

4. LEGAL ANALYSIS
${d.legal_analysis || "[Statutes, case law, and analysis]"}

5. CONCLUSION
${d.conclusion || "[Conclusion and recommendation]"}

Respectfully submitted,

${d.from_attorney || "[Author]"}`;
      break;

    case "engagement-letter":
      content = `[FIRM LETTERHEAD]

${today}

${d.client_name || "[Client Name]"}
${d.client_address || "[Client Address]"}

RE: Engagement Letter — ${d.matter_description || "[Matter Description]"}

Dear ${d.client_name || "[Client]"}:

We are pleased to confirm our representation of you in connection with the following matter:

SCOPE OF REPRESENTATION
${d.matter_description || "[Scope of legal services]"}

FEES
${d.fee_structure === "Hourly" ? "We will bill at a rate of " + (d.hourly_rate || "[rate]") + " per hour." : ""}
    ${d.fee_structure === "Flat Fee" ? "The flat fee for this matter is " + (d.flat_fee_amount || "[amount]") + "." : ""}
    ${d.fee_structure === "Contingency" ? "Our fee is " + (d.contingency_percentage || "[%]") + " of any recovery." : ""}
    ${d.retainer_amount ? "\nAn initial retainer of " + d.retainer_amount + " is required before we begin work." : ""}

${d.expenses ? "EXPENSES\n" + d.expenses + "\n" : ""}Please sign and return a copy of this letter to confirm our engagement.

Sincerely,

[Attorney Name]
[Law Firm Name]

ACCEPTED AND AGREED:

_________________________
${d.client_name || "[Client Name]"}

Date: _____________`;
      break;

    default:
      content = `Document generation template not available for this type.`;
  }

  return {
    content,
    model: "template-fallback",
  };
}