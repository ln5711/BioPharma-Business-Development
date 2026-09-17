import { z } from "zod";
import { buyerFunctionEnum, seniorityEnum } from "@/db/schema";

export const EvidenceItemSchema = z.object({
  kind: z
    .enum(["company_page", "conference_bio", "publication", "trial_record", "announcement", "other"])
    .default("other"),
  url: z.string().max(600),
  excerpt: z.string().max(500).nullable().optional(),
  date: z.string().max(20).nullable().optional(),
});

export const EmployeeExampleSchema = z.object({
  name: z.string().min(1).max(150),
  email: z.string().max(200),
  sourceUrl: z.string().max(600),
  date: z.string().max(20).nullable().optional(),
});

export const CandidateSchema = z.object({
  name: z.string().min(1).max(150),
  title: z.string().max(200).nullable().optional(),
  function: z.enum(buyerFunctionEnum.enumValues).default("other"),
  seniority: z.enum(seniorityEnum.enumValues).default("unknown"),
  professionalProfileUrl: z.string().max(600).nullable().optional(),
  /** ONLY when a cited source is literally a photo of this named person —
   * never guessed or generated. Omit rather than invent. */
  headshotUrl: z.string().max(600).nullable().optional(),
  headshotSourceUrl: z.string().max(600).nullable().optional(),
  description: z.string().max(600).nullable().optional(),
  whyThisPerson: z.string().max(600),
  /** True ONLY when evidence explicitly names this person in connection with
   * the specific asset/trial/program asked about — never inferred from
   * employment at the sponsor alone. */
  hasDirectProgramEvidence: z.boolean().default(false),
  evidence: z.array(EvidenceItemSchema).min(1).max(6),
  /** A directly published email for THIS person, if the sources show one. */
  publishedEmail: z.string().max(200).nullable().optional(),
  /** Other named employees' published emails at the SAME company, offered as
   * pattern evidence — NOT this candidate's own address. */
  employeeEmailExamples: z.array(EmployeeExampleSchema).max(8).default([]),
});
export type Candidate = z.infer<typeof CandidateSchema>;

export const ExtractionSchema = z.object({
  companyDomain: z.string().max(200).nullable().default(null),
  /** e.g. { linkedin: "unavailable", companySite: "used", conferences: "used" } */
  coverage: z.record(z.string(), z.string()).default({}),
  candidates: z.array(CandidateSchema).max(12).default([]),
});
export type Extraction = z.infer<typeof ExtractionSchema>;

export const SOURCE_COVERAGE_KEYS = [
  "companySite",
  "linkedin",
  "conferences",
  "publications",
  "trialRecords",
  "announcements",
] as const;
