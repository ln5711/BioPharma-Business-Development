import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Oncology knowledge graph reference entities (spec §5 / §68). Kept extensible —
 * seeded with RAS/MAPK, EGFR, HER2, FGFR, PI3K/AKT, DDR, IO … but never limited
 * to a hard-coded list.
 */
export const targets = pgTable(
  "targets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    gene: text("gene").notNull(),
    protein: text("protein"),
    synonyms: jsonb("synonyms").$type<string[]>().notNull().default([]),
    alterations: jsonb("alterations").$type<string[]>().notNull().default([]),
    pathwayName: text("pathway_name"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("targets_gene_idx").on(t.gene)],
);

export const pathways = pgTable(
  "pathways",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    members: jsonb("members").$type<string[]>().notNull().default([]),
    relatedTargets: jsonb("related_targets").$type<string[]>().notNull().default([]),
  },
  (t) => [uniqueIndex("pathways_name_idx").on(t.name)],
);

export const diseases = pgTable(
  "diseases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    canonicalName: text("canonical_name").notNull(),
    synonyms: jsonb("synonyms").$type<string[]>().notNull().default([]),
    oncotreeCode: text("oncotree_code"),
    icdCode: text("icd_code"),
    category: text("category").notNull().default("solid"), // solid | hematologic
  },
  (t) => [uniqueIndex("diseases_name_idx").on(t.canonicalName)],
);

export const biomarkers = pgTable(
  "biomarkers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    type: text("type"), // mutation | amplification | fusion | expression | methylation | protein
    targetGene: text("target_gene"),
    alteration: text("alteration"),
    assayType: text("assay_type"), // ngs | pcr | ihc | liquid_biopsy | ...
    specimenType: text("specimen_type"), // ctdna | cfdna | tumor_tissue | rna | urine
    clinicalRole: text("clinical_role"), // patient_selection | cdx | mrd | response_monitoring | ...
  },
  (t) => [index("biomarkers_name_idx").on(t.name)],
);

/**
 * Disease alias table (spec §54) — "NSCLC / non-small cell lung cancer".
 * Genes reuse `targets.synonyms`; diseases get a dedicated table for fast lookup.
 */
export const diseaseAliases = pgTable(
  "disease_aliases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    diseaseId: uuid("disease_id")
      .notNull()
      .references(() => diseases.id, { onDelete: "cascade" }),
    alias: text("alias").notNull(),
    normalized: text("normalized").notNull(),
  },
  (t) => [index("disease_aliases_normalized_idx").on(t.normalized)],
);
