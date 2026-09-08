# Opportunity scoring

`src/lib/scoring/model.ts` · `scoreOpportunity(input): ScoreResult`

Deterministic and interpretable. **The language model never produces this
number** (spec §57). Every component is bounded, every point is explained in a
`rationale` string, and the weights are configurable per tenant (spec §88).

## The model (spec §15)

| Component | Max | Question it answers |
| --- | --- | --- |
| Commercial Fit | 25 | Does the program actually need something *this customer* can provide? |
| Clinical Timing | 20 | Is this a moment when external vendors get selected or expanded? |
| Biomarker / Diagnostic Need | 20 | How much molecular-testing pull does the trial record show? |
| Relationship Accessibility | 10 | Warm contact? Prior reply? Recent interaction? |
| Signal Strength | 10 | Primary source & confirmed change > secondary inference. |
| Account Strategic Value | 10 | Account tier + program size. |
| Urgency | 5 | How fresh is the trigger? |
| **Total** | **100** | |

`total = Σ components`, clamped 0–100.

### Commercial Fit (0–25)
`capabilityFlags` from the tenant's capability profile are matched against the
trial's derived flags: ctDNA↔`ctdna|liquid_biopsy`, MRD↔`mrd`,
NGS↔`ngs|wes|wts`, molecular eligibility↔`patient_selection|cdx`, resistance↔
`resistance_monitoring`, central lab↔`central_lab`, serial plasma↔
`liquid_biopsy|ctdna`. +5 if the indication is in `cancerTypes` /
`targetIndications`. If the indication matches an **exclusion** the component is
capped at 4 and the rationale says so.

### Clinical Timing (0–20)
Phase multiplier — Phase I/II and Phase II peak (1.0), Phase I 0.85, Phase III
0.65, Phase IV / NA lowest. +0.2 when the trigger is `NEW_TRIAL`,
`NEW_TRIAL_COHORT`, `NEW_COMBINATION_ARM`, `TRIAL_PHASE_CHANGE`,
`TRIAL_EXPANSION` or `NEW_BIOMARKER_REQUIREMENT`. Small bonus/penalty for
recruiting vs not.

### Biomarker Need (0–20)
`(# of {molecular eligibility, ctDNA, MRD, NGS, serial sampling, resistance,
central lab} present} / 4) × 20`, capped at 20.

### Relationship Accessibility (0–10)
Base 2. +5 prior reply, else +3 known contact. +1 colleague engaged. +2 if last
interaction ≤ 90 days.

### Signal Strength (0–10)
`0.7 × 10` for a primary-source confirmed change (ClinicalTrials.gov record
diff) vs `0.4 × 10` for inference, plus up to `0.3 × 10` scaled by the change's
own `commercialRelevance`.

### Account Strategic Value (0–10)
Tier weight (strategic 1.0 → excluded 0) + 0.15 if planned enrollment ≥ 200.

### Urgency (0–5)
Signal age ≤ 3 days → full; ≤ 14 days → 0.6; older → 0.25.

## Confidence — separate from opportunity (spec §16)

`ScoreResult.confidence` (0–100) measures **evidence quality**, not commercial
attractiveness. Base 55, +25 primary source, +8 for ≥2 need signals, +7 for ≥1
capability match, −10 on an exclusion hit. A signal can legitimately be
*Opportunity 92 / Confidence 58* — the UI shows both with different visual
treatment (`ConfidenceIndicator` vs `OpportunityScore`).

## Explainability (spec §86)

`opportunity_score_components` stores all seven sub-scores + `rationale` JSON.
The `OpportunityCard` / `ScoreBreakdown` components render the per-component
bars (`24/25`, `19/20`, …) inline.

## Configurability (spec §88)

`scoring_profiles.weights` holds a per-tenant weight object. `DEFAULT_WEIGHTS`
(25/20/20/10/10/10/5) is seeded as the default profile. Customer A can weight
Phase III + large enrollment + CDx; Customer B can weight Phase I +
translational endpoints + WES. Per-profile scoring is wired through `emitSignal`
via the `weights` argument (default model in MVP 1; profile selection UI in a
later slice).

## Suppression (spec §46 / §109)

`SUPPRESSED_OUTREACH_SIGNALS` (trial termination, clinical hold, asset
discontinued, negative data, regulatory setback, exec departure, restructuring,
no-response) never drive standard outbound outreach. The signal is still
recorded, the recommended action becomes *notify owner / pause sequences /
reassess*, and the commercial interpretation is explicitly negative.

## "Why now" (spec §71)

Every signal gets a one-sentence `why_now`. From a ClinicalTrials.gov diff it is
derived from the record's `lastUpdatePostDate` ("record updated 2 days ago"). If
no credible *why now* exists, urgency — and therefore score — drops.
