You are my founding engineer, product architect, oncology commercial-intelligence engineer, and biopharma business-development domain expert.

I want you to design and build a production-quality MVP for an AI-native platform that automates as much of the workflow of a biopharma Business Development Manager as reasonably possible, beginning specifically with oncology.

This is NOT a generic CRM.

This is NOT a generic AI sales-email generator.

This is NOT simply a news aggregator.

This is NOT just a ClinicalTrials.gov search interface.

The product should operate as an:

# AI-NATIVE ONCOLOGY BUSINESS DEVELOPMENT OPERATING SYSTEM

Its job is to continuously understand the oncology landscape, identify commercially relevant developments, determine which companies/assets/trials deserve attention, identify the right people inside those organizations, recommend why and when we should contact them, draft deeply personalized outreach, manage follow-up sequences, capture relationship history, and synchronize the resulting activity with Salesforce.

The core closed loop is:

EXTERNAL SIGNAL
→ SCIENTIFIC INTERPRETATION
→ COMMERCIAL INTERPRETATION
→ ACCOUNT / ASSET PRIORITIZATION
→ RIGHT PERSON
→ RIGHT REASON TO CONTACT THEM
→ PERSONALIZED MESSAGE
→ FOLLOW-UP
→ RESPONSE
→ MEETING
→ CRM UPDATE
→ OPPORTUNITY
→ NEXT BEST ACTION

The fundamental question the product should constantly answer is:

> “Based on what changed in oncology, who should our BD team contact today, why should we contact them now, what should we say, and what should happen next?”

Build the application around that question.

---

# 1. PRODUCT PHILOSOPHY

Business-development professionals do not need more information.

They already have too much information.

The problem is turning fragmented scientific and corporate information into prioritized commercial action.

Scientific novelty alone is NOT enough.

Every signal should be analyzed using:

1. What changed?
2. Is the change real and supported by a primary source?
3. What company does it affect?
4. What therapeutic asset does it affect?
5. What clinical trial does it affect?
6. What disease / indication does it affect?
7. What molecular target/pathway/biomarker does it affect?
8. What stage of clinical development is involved?
9. Does it create or change a biomarker, diagnostic, clinical-development, CRO, central-lab, liquid-biopsy, tissue-testing, MRD, patient-selection, response-monitoring, resistance-monitoring, or translational-science need?
10. Is there an actionable commercial opportunity?
11. How strong is that opportunity?
12. Who would likely own the relevant decision?
13. Does our organization already know them?
14. Has anyone from our organization contacted them?
15. What was the outcome?
16. When was the last interaction?
17. Is another colleague already engaging the account?
18. What is the best next action?
19. Why is NOW a good time?
20. What specifically should we say?

The product must move users from:

“I found an interesting article.”

to:

“This Phase II program just added a ctDNA exploratory endpoint; their Translational Medicine lead has not been contacted in 94 days; here are the two most relevant decision-makers, the source supporting the update, and a personalized message connecting our capabilities to the development.”

---

# 2. PRIMARY USER

Initial ICP:

Business Development Managers, Business Development Directors, Account Directors, Strategic Account Managers, Commercial Strategy teams, Translational Partnerships teams, Diagnostic Partnerships teams, and Biopharma Services BD teams selling into oncology drug developers.

Initial customer types may include:

- liquid biopsy companies
- molecular diagnostics companies
- central laboratories
- specialty CROs
- biomarker companies
- CDx companies
- sequencing companies
- oncology data companies
- translational research providers
- clinical-development service providers

The architecture must therefore allow each customer to define WHAT THEY SELL.

The system cannot assume every customer has the same commercial opportunity.

---

# 3. COMPANY CAPABILITY PROFILE

During onboarding, create an organization capability profile.

Example fields:

Company name
Website
Description
Products/services
Assay names
Testing modalities
Sample types
Technologies
Genes covered
Biomarkers covered
Cancer types
Clinical-development stages supported
Geographies supported
Laboratory locations
Regulatory status
Turnaround time
Sensitivity/LOD where relevant
Sequencing methodology
MRD capabilities
Patient-selection capabilities
CDx capabilities
Translational capabilities
Resistance-monitoring capabilities
Response-monitoring capabilities
Tissue capabilities
Plasma capabilities
Urine capabilities
WES
WTS
ctDNA
cfDNA
methylation
proteomics
other omics
bioinformatics
central-lab services
prospective trial support
retrospective research support

Allow users to define:

MUST-PURSUE attributes
DESIRABLE attributes
EXCLUSION criteria
competitive conflicts
geographical constraints
trial stages of interest
target indications
target pathways
target account types
minimum opportunity score

All opportunity scoring must reference this profile.

---

# 4. CORE DATA MODEL

DO NOT make the system document-centric.

Create a structured relational knowledge model.

Core entities:

## Organization

id
canonical_name
aliases
organization_type
parent_company
subsidiaries
website
headquarters
public/private
ticker
CIK
description
employee_estimate
oncology_focus
last_verified_at

## OrganizationSource

organization_id
source_type
url
feed_url
page_category
enabled
crawl_frequency
last_checked_at
last_changed_at
etag
content_hash

Source categories should include:

homepage
newsroom
press releases
investor relations
pipeline
R&D
oncology pipeline
leadership
management
clinical programs
publications
scientific presentations
conference presentations
SEC filings
partnerships
careers

## Asset

id
organization_id
canonical_name
aliases
development_code
brand_name
modality
mechanism_of_action
targets
pathways
indications
stage
status
licensed_from
licensed_to
partner_companies
first_seen
last_updated

## Trial

nct_id
title
official_title
sponsor
collaborators
asset_ids
conditions
interventions
phase
status
enrollment
study_type
start_date
primary_completion_date
completion_date
locations
countries
eligibility
biomarker_requirements
primary_endpoints
secondary_endpoints
exploratory_endpoints
biospecimens
central_lab_mentions
ctDNA_mentions
molecular_testing_mentions
last_ctgov_update
record_version_hash

## TrialChange

trial_id
detected_at
field_changed
old_value
new_value
severity
commercial_relevance
summary
source
source_timestamp

Trial changes must be FIRST-CLASS OBJECTS.

Do not merely overwrite a trial record.

We need to know:

WHAT CHANGED
WHEN IT CHANGED
HOW IMPORTANT THE CHANGE IS

Examples:

RECRUITING → ACTIVE_NOT_RECRUITING

Phase I → Phase I/II

Enrollment 40 → 120

New cohort added

New intervention added

New combination partner

New study arm

New country

New trial site

New biomarker requirement

New ctDNA endpoint

New molecular residual disease endpoint

New resistance endpoint

New companion diagnostic language

Primary completion date changed

Sponsor changed

Collaborator added

Study terminated

Study suspended

Study withdrawn

Study restarted

## Disease

canonical_name
synonyms
OncoTree mapping if available
ICD mapping if appropriate
solid/hematologic
line_of_therapy

## Target

gene
protein
synonyms
alterations
pathway

Examples:

KRAS
NRAS
HRAS
EGFR
ERBB2
FGFR2
FGFR3
BRAF
PIK3CA
AKT
PTEN
BRCA1
BRCA2
ATM
ESR1
ALK
ROS1
RET
MET
NTRK
IDH1
IDH2
TP53

## Pathway

name
members
related_targets

Examples:

RAS/MAPK
PI3K/AKT/mTOR
DNA damage repair
FGFR
HER2
EGFR
WNT
cell cycle
apoptosis
immune checkpoint

## Biomarker

name
type
target
alteration
assay_type
specimen_type
clinical_role

Clinical roles:

patient selection
screening
stratification
companion diagnostic
prognostic
predictive
response monitoring
resistance monitoring
MRD
recurrence surveillance
pharmacodynamic
exploratory translational endpoint

## Publication

pmid
doi
title
abstract
authors
affiliations
journal
publication_date
companies
assets
trials
targets
diseases
biomarkers
publication_type
source
url

## Person

id
name
organization
title
department
seniority
function
professional_profile_url
public_email if legally sourced
location
asset_associations
trial_associations
publication_associations
conference_associations
source_evidence
last_verified

DO NOT infer sensitive personal information.

Use only professional/relevant information.

## Relationship

person_id
organization_id
owner_user_id
relationship_strength
first_contacted
last_contacted
last_response
last_meeting
status
notes
crm_id

## Interaction

type:

email_sent
email_received
linkedin_manual
call
meeting
conference_meeting
note
introduction
proposal
NDA
quote
opportunity_update

Include:

date
user
contact
account
asset
campaign
message
response
outcome
next_step
CRM sync status

## CommercialSignal

This is one of the most important entities.

signal_type
organization
asset
trial
person
publication
detected_at
source_date
source
headline
summary
scientific_interpretation
commercial_interpretation
why_it_matters
recommended_action
recommended_personas
urgency
confidence
opportunity_score
evidence

## Opportunity

account
asset
trial
indication
commercial_use_case
stage
estimated_value
probability
owner
stakeholders
competitor_status
next_action
next_action_date
CRM opportunity ID

---

# 5. ONCOLOGY KNOWLEDGE GRAPH

Represent relationships between:

COMPANY
→ ASSET
→ TARGET
→ PATHWAY
→ INDICATION
→ TRIAL
→ COHORT
→ ENDPOINT
→ BIOMARKER
→ SPECIMEN
→ DIAGNOSTIC NEED

Also:

COMPANY
→ PERSON
→ ROLE
→ DEPARTMENT
→ ASSET
→ TRIAL
→ PUBLICATION

And:

PERSON
→ INTERACTION
→ CAMPAIGN
→ RESPONSE
→ MEETING
→ OPPORTUNITY

The knowledge graph should allow queries like:

“Who works on KRAS G12D programs in pancreatic cancer?”

“Which Phase II/III trials have ctDNA endpoints?”

“Which companies have active FGFR3 programs but no known diagnostic partnership?”

“Who has published on the biomarker program associated with Asset X?”

“Which companies have recently moved a RAS inhibitor into Phase II?”

“Which accounts have had meaningful clinical developments but no outreach in 60 days?”

---

# 6. SOURCE INTELLIGENCE LAYER

Create a Source Registry.

Each source must include:

source_type
authority_level
update_frequency
access_method
organization
URL
last_checked
last_changed
status
robots_allowed
parser
reliability_score

Prefer PRIMARY SOURCES.

## Tier 1 — Clinical Trials

Integrate ClinicalTrials.gov API v2.

Track:

NCT ID
sponsor
collaborators
phase
status
enrollment
study design
arms
interventions
conditions
eligibility
molecular eligibility
endpoints
locations
contacts
dates
biospecimen information
responsible party
last update

Store previous snapshots.

Diff them.

Do not merely ingest current values.

Generate TrialChange records.

Allow watchlists for:

company
asset
drug
target
pathway
mutation
indication
trial
biomarker

---

# 7. COMPANY WEBSITE MONITORING

Create a configurable universe of at least:

TOP 100 GLOBAL BIOPHARMA COMPANIES

plus:

user-defined target companies
emerging biotech companies
portfolio companies
existing customers
prospects
competitors

Do not hard-code the system to exactly 100 companies.

Create an Admin → Company Universe interface.

Seed it with a current list of approximately 100 leading global biopharma companies and let users add/remove accounts.

For each company, discover and register relevant official pages:

/news
/newsroom
/media
/press-releases
/investors
/investor-relations
/pipeline
/research
/research-development
/science
/oncology
/clinical-trials
/publications
/scientific-presentations
/leadership
/management
/about
/events
/conferences
/partnerships

Use RSS when available.

Use sitemap.xml when appropriate.

Use HTTP headers/content hashing before full parsing to reduce unnecessary crawling.

Prefer standard HTTP fetching.

Only use browser automation when required.

Respect:

robots.txt
rate limits
terms of service
copyright
authentication restrictions

Never bypass paywalls or access controls.

For each page:

store a normalized representation
create content hashes
compare against previous snapshots
identify meaningful changes
ignore cosmetic changes

Classify changes.

Examples:

new press release
pipeline page updated
new asset added
asset removed
stage changed
new indication
new partnership
licensing agreement
M&A
new clinical data
new conference presentation
new publication
new CEO
new CMO
new CSO
new Head of Oncology
new Head of Translational Medicine
new Head of Precision Medicine
new Head of Business Development
new biomarker leader
management departure
restructuring
layoffs
fundraising
strategic review
FDA submission
FDA acceptance
FDA approval
FDA hold
trial discontinuation
new manufacturing agreement
diagnostic partnership
CDx partnership

---

# 8. PUBLICATION MONITORING

Integrate:

NCBI PubMed / E-utilities
Europe PMC
Crossref

Monitor by:

company
company aliases
drug name
drug development code
target
author
known employee
trial NCT number
biomarker
disease
pathway

Resolve publications to:

organizations
authors
assets
trials
targets
diseases
biomarkers

The system should recognize when authors are company employees or collaborators.

A new publication should NOT merely produce:

“Company X published a paper.”

It should produce:

“Researchers from Company X published new longitudinal ctDNA data from their Phase I KRAS inhibitor program. This provides a strong reason to approach Translational Medicine / Biomarker Development because the study demonstrates active use of serial molecular monitoring.”

Publication signals should extract:

study type
patient population
sample type
assay
technology
sequencing approach
biomarkers
genes
clinical endpoints
main findings
limitations
authors
sponsors
trial identifier
asset
diagnostic vendor if disclosed

DO NOT hallucinate diagnostic vendors.

If none is disclosed, say:

“No diagnostic provider identified in the public source.”

---

# 9. REGULATORY INTELLIGENCE

Monitor:

FDA oncology approval notifications
Drugs@FDA
relevant openFDA datasets
FDA guidance
FDA press announcements
company regulatory announcements

Identify:

IND submissions if publicly disclosed
NDA/BLA submissions
filing acceptance
priority review
accelerated approval
breakthrough therapy designation
orphan designation where relevant
complete response letters if public
clinical holds
label expansions
companion diagnostic requirements
FDA-authorized test language

Every regulatory development should be mapped to commercial relevance.

Example:

FDA approval requires detection of ESR1 mutation using an FDA-authorized test

→ biomarker-selection relevance = HIGH
→ identify commercial stakeholders in Precision Medicine / CDx / Biomarkers
→ check whether company already has an announced CDx partner
→ if partner exists, characterize opportunity differently
→ do not imply an opportunity that public evidence contradicts

---

# 10. SEC / CORPORATE INTELLIGENCE

Integrate SEC EDGAR for public U.S. companies.

Watch important filings:

8-K
10-Q
10-K
20-F
6-K
S-1
relevant exhibits

Extract oncology BD signals such as:

clinical milestones
pipeline prioritization
program discontinuation
restructuring
cash runway
acquisitions
licensing agreements
asset sales
partnerships
leadership changes
strategy changes
trial delays
regulatory events
new financing

Do NOT overwhelm users with finance information.

Commercial relevance first.

---

# 11. ONCOLOGY CONFERENCE INTELLIGENCE

Create adapters/watchlists for major oncology meetings, subject to available/public access.

Priority meetings include:

ASCO Annual Meeting
ASCO GI
ASCO GU
ASCO Quality Care where relevant
AACR Annual Meeting
AACR-NCI-EORTC
ESMO Congress
ESMO GI
ESMO Breast
ESMO Gynaecological
ESMO Immuno-Oncology
SABCS
WCLC
ASH for hematologic oncology
EHA
IASLC meetings
SITC
World GI
major molecular diagnostics / precision medicine meetings where relevant

Track:

abstract title releases
abstract publications
late-breaking abstracts
Trials in Progress
poster/oral presentations
presentation times
authors
companies
assets
targets
NCTs
biomarker methodology
liquid-biopsy use
molecular testing

Create a Conference Mode.

Example:

“Show all high-priority accounts attending ASCO.”

For each:

company
asset
presentation
speaker
date/time
commercial relevance
existing relationship
people we should meet
recommended message
meeting-request draft

---

# 12. MANAGEMENT AND PERSONNEL CHANGES

Monitor public professional changes through:

company leadership pages
company press releases
SEC filings
company announcements
publicly accessible professional sources
approved people-data providers if configured

Important changes:

CEO
President
CSO
CMO
Chief Development Officer
Chief Commercial Officer
Head of Oncology
Head of Clinical Development
Head of Translational Medicine
Head of Precision Medicine
Head of Biomarkers
Head of Companion Diagnostics
Head of Clinical Operations
Head of Business Development
Alliance Management leadership

Management changes are commercial signals.

Examples:

New Head of Translational Medicine
→ potential relationship-reset opportunity

New CMO
→ potential new strategic priorities

New Head of Biomarkers
→ high relevance for diagnostic partnership vendors

Do NOT write creepy messages such as:

“I saw you changed jobs three days ago.”

Instead create natural professional outreach:

“Congratulations on joining X. Given the team's expanding work in KRAS-mutant solid tumors…”

---

# 13. SIGNAL NORMALIZATION

All incoming intelligence should flow through:

RAW EVENT
↓
ENTITY RESOLUTION
↓
DEDUPLICATION
↓
SCIENTIFIC EXTRACTION
↓
COMMERCIAL CLASSIFICATION
↓
OPPORTUNITY SCORING
↓
CONTACT RECOMMENDATION
↓
ACTION RECOMMENDATION

Never allow five sources covering the same event to generate five separate opportunities.

Cluster events.

Maintain source provenance.

---

# 14. SIGNAL TAXONOMY

Build at minimum these commercial signal categories:

NEW_TRIAL
TRIAL_PHASE_CHANGE
TRIAL_STATUS_CHANGE
TRIAL_ENROLLMENT_CHANGE
NEW_TRIAL_COHORT
NEW_COMBINATION_ARM
NEW_INDICATION
NEW_BIOMARKER_REQUIREMENT
NEW_CT_DNA_ENDPOINT
NEW_MRD_ENDPOINT
NEW_RESISTANCE_ENDPOINT
NEW_TRANSLATIONAL_ENDPOINT
NEW_TRIAL_SITE
TRIAL_EXPANSION
TRIAL_TERMINATION
CLINICAL_HOLD
NEW_PUBLICATION
NEW_PREPRINT
NEW_CONFERENCE_ABSTRACT
NEW_DATA_READOUT
POSITIVE_DATA
NEGATIVE_DATA
NEW_ASSET
ASSET_DISCONTINUED
PIPELINE_PRIORITIZATION
LICENSING_DEAL
PARTNERSHIP
DIAGNOSTIC_PARTNERSHIP
M_AND_A
FINANCING
FDA_SUBMISSION
FDA_ACCEPTANCE
FDA_APPROVAL
LABEL_EXPANSION
REGULATORY_SETBACK
NEW_EXECUTIVE
EXECUTIVE_DEPARTURE
RESTRUCTURING
NEW_JOB_POSTING
CRM_RELATIONSHIP_STALE
CONTACT_JOB_CHANGE
CONTACT_RESPONDED
CONTACT_NO_RESPONSE
MEETING_REQUIRED
CONFERENCE_OPPORTUNITY

---

# 15. COMMERCIAL OPPORTUNITY ENGINE

Create an Opportunity Score from 0–100.

Do NOT let the LLM arbitrarily generate this number.

Use interpretable components.

Suggested model:

Commercial Fit: 0–25
Clinical Timing: 0–20
Biomarker/Diagnostic Need: 0–20
Relationship Accessibility: 0–10
Signal Strength: 0–10
Account Strategic Value: 0–10
Urgency: 0–5

Total = 100.

Expose component scores.

## Commercial Fit

Does the program require something our organization can actually provide?

## Clinical Timing

Highest value generally around moments where external vendors may be selected or expanded.

Examples:

new trial
new cohort
phase transition
protocol expansion
large enrollment expansion
new biomarker endpoint

## Biomarker Need

Signals:

molecular eligibility
ctDNA
NGS
MRD
companion diagnostic
serial blood collection
resistance analysis
tumor profiling
genomic screening
translational endpoints

## Relationship Accessibility

existing warm contact
previous reply
meeting history
colleague relationship
no relationship
contact recently joined

## Signal Strength

Primary source > secondary source.

Confirmed change > AI inference.

## Strategic Value

account tier
program size
clinical phase
trial enrollment
strategic target/pathway

## Urgency

Conference next week
new announcement today
upcoming trial launch
new cohort
recent leadership change

---

# 16. CONFIDENCE

Separate:

OPPORTUNITY SCORE

from

CONFIDENCE SCORE.

A highly attractive but uncertain inference may be:

Opportunity 92
Confidence 58

Show both.

Never hide uncertainty.

---

# 17. COMMERCIAL USE-CASE CLASSIFICATION

For a biomarker/diagnostics-focused customer, classify opportunities into:

patient screening
molecular eligibility
patient selection
companion diagnostics
clinical trial assay
central laboratory testing
baseline genomic characterization
longitudinal ctDNA
treatment response monitoring
molecular resistance monitoring
MRD
recurrence surveillance
exploratory biomarker work
retrospective biomarker analysis
prospective biomarker support
WES/WTS
tissue-plasma concordance
urine testing
methylation
tumor fraction
pharmacodynamic biomarker work

The system must understand an important distinction:

PROSPECTIVE CURRENT OPPORTUNITY

versus

RETROSPECTIVE RESEARCH OPPORTUNITY.

These should not be conflated.

For outbound BD, prioritize prospective current opportunities.

---

# 18. PERSONA / CONTACT ENGINE

For each commercial opportunity, identify likely buyer/influencer personas.

Rank them.

Example hierarchy depends on the opportunity.

## Biomarker / diagnostic opportunity

High relevance:

VP/SVP Translational Medicine
Head of Translational Medicine
VP Precision Medicine
Head of Precision Medicine
Head of Biomarker Development
Biomarker Lead
Companion Diagnostics Lead
Clinical Biomarker Scientist
Translational Medicine Director

## Clinical trial services

High relevance:

Clinical Development
Clinical Operations
Program Lead
Asset Lead
Clinical Scientist
Study Lead

## Strategic partnership

High relevance:

Business Development
External Innovation
Strategic Partnerships
Alliance Management
Corporate Development

Do not assume BD is always the best contact.

The scientific owner of the need may be more important.

Create:

PERSON RELEVANCE SCORE 0–100.

Components:

functional relevance
asset association
trial association
seniority
decision authority
publication evidence
conference involvement
relationship history
contact recency

---

# 19. CONTACT-ASSET EVIDENCE

This is extremely important.

Every claim that a person works on an asset should carry evidence.

Example:

Dr. Jane Doe
Asset association: ABC-123
Confidence: 94%

Evidence:
- coauthor on Phase I publication
- listed investigator / sponsor contact
- speaker on company presentation
- job title: Director, Translational Medicine

Never invent asset associations based purely on company employment.

---

# 20. ACCOUNT PAGE

The Account view should answer everything a BD manager needs.

Header:

Company
Account tier
Opportunity score
Relationship status
Last interaction
Owner
Next action

Tabs:

OVERVIEW
PIPELINE
TRIALS
SIGNALS
PEOPLE
RELATIONSHIPS
OUTREACH
MEETINGS
PUBLICATIONS
NEWS
OPPORTUNITIES
CRM

Overview should include:

Why this account matters
Top opportunities
Latest meaningful developments
Relevant assets
Relationship health
Recommended actions

---

# 21. ASSET PAGE

Show:

Asset name
aliases
company
partner
target
MOA
modality
clinical stage
indications
trial list
latest data
biomarker strategy
diagnostic landscape
known diagnostic partners
recent publications
conference appearances
recent changes
relevant people
commercial opportunity
recommended outreach

---

# 22. DAILY BD COMMAND CENTER

This should be the default homepage.

Example:

GOOD MORNING

18 meaningful oncology signals detected
6 high-priority commercial opportunities
11 follow-ups due
4 replies need attention
3 accounts have new trial activity
2 contacts changed roles
7 CRM records need sync

TOP OPPORTUNITIES

1. Company A — Asset A
Opportunity Score: 94

What changed:
Phase II cohort added.

Why it matters:
New serial plasma collection and ctDNA response endpoint.

Relationship:
Two known contacts.
Last outreach 81 days ago.

Best person:
Director of Translational Medicine.

Recommended action:
Re-engage today.

[Review Outreach]

---

2. Company B — Asset B
Score: 89

What changed:
New Phase III trial posted.

Why it matters:
Molecular screening required.

Relationship:
No existing contact.

Recommended action:
Map Precision Medicine and Clinical Development stakeholders.

[Find Contacts]

Do NOT make the home page a wall of news.

Every card needs an action.

---

# 23. INTELLIGENCE FEED

Allow filtering by:

company
target
pathway
indication
asset
phase
signal type
score
date
owner
account tier
actionability
confidence

Each signal card shows:

Signal
Date
Company
Asset
Trial
Source
Scientific summary
Commercial implication
Opportunity score
Confidence
Recommended personas
Recommended next action

Actions:

Save
Dismiss
Follow account
Create opportunity
Find contacts
Draft outreach
Add to campaign
Assign owner
Sync to Salesforce

User feedback should train preference models:

Relevant
Not Relevant
Wrong Company
Wrong Asset
Wrong Interpretation
Already Knew
Good Opportunity
Bad Opportunity

---

# 24. NATURAL-LANGUAGE BD COPILOT

Add an AI search/copilot over the structured system.

Examples:

“What happened in KRAS this week?”

“Show me the highest-priority RAS opportunities.”

“Which companies recently opened Phase II oncology trials?”

“Find Phase II or III prostate cancer trials that could benefit from longitudinal ctDNA.”

“Which companies are working on FGFR3-mutant bladder cancer?”

“Who should I contact at Company X?”

“Why is Company X a good opportunity?”

“Prepare me for tomorrow’s meeting.”

“What has changed at Novartis since we last contacted them?”

“Which companies had major clinical updates but have not been contacted in 90 days?”

“Find oncology companies entering Phase III without a known liquid biopsy partner.”

“Show all companies presenting KRAS data at ASCO.”

“Which of our Salesforce accounts have the highest opportunity scores?”

Answers must provide source provenance.

---

# 25. MEETING PREPARATION

Create a one-click:

PREPARE ME

report.

Include:

Company overview
relationship history
attendees
titles
professional backgrounds
relevant assets
trial status
recent announcements
recent publications
relevant conference data
biomarker strategy
known partners
diagnostic landscape
open opportunities
previous discussions
CRM notes
what changed since last meeting
recommended pitch
questions to ask
risks
next-step objective

The goal:

A BD executive should be able to read the brief in 5 minutes and walk into the meeting prepared.

---

# 26. OUTBOUND SALES ENGINE

This is a CENTRAL feature.

The system should generate personalized outreach based on genuine commercial context.

Do not generate generic emails like:

“I came across your profile and was impressed by your work.”

BAD.

Instead connect:

PERSON
+
ROLE
+
ASSET
+
RECENT DEVELOPMENT
+
RELEVANT BUSINESS NEED
+
OUR CAPABILITY
+
LOW-FRICTION CTA

Example logic:

Signal:
Company launches Phase II KRAS inhibitor trial.

Trial:
requires KRAS confirmation and serial molecular assessment.

Person:
Director of Translational Medicine associated with the program.

Our capability:
high-sensitivity liquid biopsy supporting longitudinal resistance monitoring.

Message logic:

Relevant development
→ scientifically credible connection
→ one sentence explaining relevance
→ one sentence demonstrating capability
→ simple meeting ask.

---

# 27. OUTREACH QUALITY RULES

Messages should be:

short
specific
credible
professional
scientifically informed
commercially relevant
human-sounding
easy to answer

Avoid:

excessive compliments
fake familiarity
generic AI phrases
long company descriptions
three-paragraph product pitches
buzzwords
unsupported claims
overexplaining
fake urgency

Default initial email:

60–130 words.

Default follow-up:

35–90 words.

Prefer one CTA.

---

# 28. PERSONALIZATION DEPTH

Create personalization levels.

LEVEL 0
Generic persona-based.

LEVEL 1
Company personalized.

LEVEL 2
Asset personalized.

LEVEL 3
Trial personalized.

LEVEL 4
Contact + asset + signal personalized.

LEVEL 5
Contact + asset + signal + publication / conference / prior relationship.

Encourage Level 3+.

Display evidence used to create personalization.

---

# 29. OUTREACH GENERATOR INPUTS

Before generating a message, build an OutreachContext object:

contact
title
company
function
asset
trial
signal
signal date
source
relationship history
previous messages
previous replies
colleague interactions
company priorities
our relevant capability
commercial hypothesis
conference context
CTA
tone
campaign stage

The LLM should never write outreach without context.

---

# 30. MULTI-TOUCH DRIP CAMPAIGNS

Build campaign sequencing.

Example:

DAY 0
Signal-triggered personalized email.

DAY 4
Short follow-up.

DAY 9
Value-add follow-up using publication/data.

DAY 16
Final concise follow-up.

But do not hard-code this cadence.

Allow user configuration.

Campaign logic must respond dynamically.

---

# 31. EVENT-DRIVEN SEQUENCES

This is more important than fixed drip timing.

Example:

Contact does not respond
→ follow-up.

Contact opens repeatedly
→ flag interest, do not automatically over-email.

Contact replies
→ stop automation immediately.

Meeting booked
→ stop sales sequence.

Person changes jobs
→ pause sequence.

Trial terminated
→ pause/reassess.

New major company development
→ potentially replace generic follow-up with signal-driven message.

Colleague receives response from same account
→ notify account owner and prevent accidental duplicate outreach.

Company enters sensitive event / major setback
→ avoid insensitive automated sales outreach.

---

# 32. HUMAN APPROVAL

For initial MVP:

AI may:

research
score
recommend
draft
schedule proposed touches
prepare CRM changes

But require human approval before sending first-touch outbound messages.

Architecture can support optional future auto-send.

Never automatically send something based solely on low-confidence AI inference.

---

# 33. REPLY INTELLIGENCE

When email integrations exist, classify responses:

Positive
Interested
Meeting request
Referral
Not responsible
Not now
Already partnered
No budget
Not relevant
Out of office
Unsubscribe
Negative
Unknown

Extract:

new contact
timing
next step
meeting intent
objection
relevant asset
commercial information

Update relationship state.

Recommend reply.

Stop sequence when appropriate.

---

# 34. SALESFORCE INTEGRATION

Salesforce should remain an external system of record where desired.

Our app should become the WORKING INTERFACE.

Build OAuth architecture for Salesforce.

Support:

Accounts
Contacts
Leads
Opportunities
Tasks
Events
Campaigns
Campaign Members
Notes/custom objects where configured

Create field mapping UI.

Implement:

read
create
update
upsert
deduplicate
conflict handling

Every meaningful BD action should have a CRM sync state.

Example:

contact created
email sent
response received
meeting booked
opportunity created
note added
next step changed

---

# 35. CRM DEDUPLICATION

Before creating a contact:

check CRM ID
email
normalized name + account
professional URL

Before creating an account:

domain
normalized company name
aliases
parent/subsidiary relationships

Never create uncontrolled duplicates.

---

# 36. CRM CHANGE QUEUE

Create a screen:

CRM UPDATES

Example:

23 proposed changes

Contact Jane Smith
New title detected
Director → Senior Director

Account Company A
New pipeline program detected

Contact John Doe
Last contacted = today

Opportunity ABC
Next step = follow-up Oct 12

Users can:

Approve all
Approve individually
Reject
Edit
Auto-approve selected field types

This directly solves spreadsheet-based Salesforce cleanup.

---

# 37. CSV FALLBACK

Some organizations will restrict CRM API access.

Support:

CSV import
CSV export
Salesforce-compatible export

Maintain clean mappings.

Never make spreadsheets the primary database.

---

# 38. RELATIONSHIP INTELLIGENCE

Create relationship health states:

No relationship
Cold outreach
Engaged
Warm
Meeting held
Opportunity active
Dormant
Customer
Partner
Closed lost
Do not contact

Calculate account-level coverage.

Example:

Company A

Clinical Development: Strong
Translational Medicine: Strong
Precision Medicine: None
Business Development: Moderate
Clinical Operations: None

Then recommend:

“Relationship gap: Precision Medicine.”

---

# 39. ACCOUNT COLLISION PREVENTION

Before outreach, check whether:

another team member contacted this person
another team member contacted this company recently
a meeting is upcoming
an active opportunity exists
an NDA is active
the person opted out
a colleague owns the relationship

Show warnings.

---

# 40. EMAIL / CALENDAR INTEGRATION

Architecture should support:

Gmail
Microsoft Outlook
Google Calendar
Microsoft Calendar

Capture:

sent messages
received messages
threads
meetings
attendees
meeting history

Do not require users to manually log every interaction.

---

# 41. CAMPAIGN BUILDER

Campaign examples:

KRAS
FGFR
Prostate Cancer
ASCO 2027
ADC
MRD
Phase III Trials
New Biotech Accounts

A campaign can define:

target pathways
companies
indications
trial stages
personas
scoring threshold
signal criteria
message templates
follow-up sequence

System dynamically adds/removes prospects when they match criteria.

---

# 42. PROSPECT LIST BUILDER

Allow query-based lists:

“Phase II–III KRAS programs in the U.S.”

“Companies with active FGFR2/3 trials.”

“New oncology biotechs with Phase I assets.”

“Companies presenting ctDNA data at ASCO.”

“Existing Salesforce accounts with no interaction for >60 days and a new clinical signal.”

Return structured lists.

---

# 43. COMPANY PRIORITIZATION

Account score should include:

number of relevant assets
clinical maturity
biomarker intensity
trial activity
strategic pathway fit
number of active trials
recent signal velocity
existing relationships
deal history
known competing partner
estimated service opportunity

Separate:

ACCOUNT SCORE

from

ASSET OPPORTUNITY SCORE.

---

# 44. COMPETITOR / EXISTING PARTNER INTELLIGENCE

Identify publicly announced relationships with:

diagnostic companies
CROs
central laboratories
sequencing companies
CDx partners

Evidence required.

Classify:

Confirmed partner
Likely partner
Historical partner
Unknown

Never label a competitor relationship as confirmed without evidence.

A known partner does NOT necessarily mean discard the opportunity.

Instead classify:

Exclusive-looking
Potentially complementary
Trial-specific
Asset-specific
Legacy
Unknown scope

---

# 45. WHAT SHOULD TRIGGER OUTREACH?

High-value triggers include:

trial posted
trial expansion
new phase
new cohort
new indication
new combination
new biomarker requirement
new ctDNA endpoint
new MRD endpoint
new resistance work
new data readout
new publication
new conference abstract
new asset licensed
new partnership
new financing enabling clinical expansion
new regulatory milestone
new relevant executive
upcoming conference presentation
relationship becomes stale after a meaningful signal

Every trigger needs:

WHY NOW.

---

# 46. WHAT SHOULD NOT TRIGGER OUTREACH?

Avoid contacting people merely because:

company stock moved
generic corporate blog posted
unrelated paper published
website changed cosmetically
random employee joined
irrelevant indication progressed
publication has weak company connection

Minimize noise.

Precision > volume.

---

# 47. BD DAILY WORKFLOW

Design the product so a BD manager can work like this:

8:30 AM

Open dashboard.

AI says:

“I reviewed the monitored oncology universe and found 123 raw updates. After deduplication and relevance scoring, 9 are commercially meaningful.”

User sees nine.

Three warrant outreach.

User reviews evidence.

Clicks one.

System identifies four relevant contacts.

Two already exist in Salesforce.

One has been contacted recently.

One appears ideal.

User clicks:

GENERATE OUTREACH.

AI generates an evidence-based message.

User edits and approves.

Message sends.

Interaction logged.

Salesforce updated.

Follow-up scheduled.

Later:

contact replies.

Sequence stops.

AI recommends reply.

Meeting booked.

Meeting appears in relationship timeline.

Meeting brief generated.

After meeting:

AI drafts notes and CRM updates.

That is the core experience.

---

# 48. USER INTERFACE

Design a polished B2B SaaS UI.

Left navigation:

Home
Signals
Accounts
Assets
Trials
People
Outreach
Campaigns
Meetings
Opportunities
CRM
Watchlists
Search
Settings

Global search at top.

Persistent Copilot button.

---

# 49. SIGNAL CARD UI

Each signal card:

COMPANY
Asset
Signal type
Time detected

Headline

What changed

Why this matters commercially

Opportunity Score
Confidence

Related trial
Related pathway
Relevant personas

Evidence

Buttons:

Review
Find People
Draft Outreach
Add to Campaign
Dismiss

---

# 50. WATCHLISTS

Users should be able to follow:

Company
Asset
Target
Pathway
Indication
Trial
Person

Example:

RAS Watchlist

KRAS
NRAS
HRAS
SOS1
SHP2
RAF/MEK resistance

Cancers:
NSCLC
CRC
PDAC

Then tailor thresholds.

---

# 51. ALERTING

Support:

Immediate high-priority alerts
Daily digest
Weekly summary

Allow delivery via:

in-app
email
Slack later

Do not alert on everything.

Use threshold-based alerting.

---

# 52. AI DAILY BRIEF

Generate:

TODAY IN YOUR TERRITORY

Major developments

Highest priority opportunities

Follow-ups due

Relationship changes

Upcoming meetings

Upcoming conferences

Accounts at risk

CRM cleanup

Example:

“Six meaningful events occurred overnight. Two merit outreach. Company A expanded its KRAS trial and Company B appointed a new Head of Precision Medicine.”

---

# 53. CHANGE DETECTION ENGINE

For every monitored structured or unstructured source:

store timestamp
source
canonical content
hash
previous version

Run semantic diff.

Classify:

No meaningful change
Minor change
Meaningful change
High-priority commercial change

LLM receives ONLY relevant diff + necessary context, not entire giant pages when avoidable.

This reduces cost.

---

# 54. ENTITY RESOLUTION

The system must handle aliases.

Example:

JNJ
Johnson & Johnson
Janssen
Janssen Biotech

Assets:

development code
generic name
brand name

Genes:

HER2
ERBB2

Diseases:

NSCLC
non-small cell lung cancer

Build alias tables.

Never duplicate entities because terminology differs.

---

# 55. SOURCE PROVENANCE

Every significant factual claim must be traceable.

Store:

source
URL
publication/update date
retrieval date
excerpt
entity association
confidence

The UI should allow:

VIEW SOURCE.

Never present AI synthesis as source fact.

---

# 56. AI HALLUCINATION SAFEGUARDS

The system must distinguish:

FACT
INFERENCE
RECOMMENDATION

Example:

FACT:
Trial added a ctDNA endpoint.

INFERENCE:
The program may require an external molecular-testing partner.

RECOMMENDATION:
Contact the Translational Medicine lead.

Display these separately.

Never turn:

“No partner identified”

into:

“They do not have a partner.”

Correct language:

“No publicly disclosed partner identified in monitored sources.”

---

# 57. LLM ARCHITECTURE

Create a provider abstraction.

Do not tightly couple core logic to one model.

Functions:

extractEntities()
classifySignal()
summarizeChange()
interpretCommercialRelevance()
scoreOpportunityNarrative()
recommendPersonas()
generateOutreach()
generateFollowup()
classifyReply()
prepareMeetingBrief()
answerCopilotQuery()

Use structured outputs validated using schemas.

Prefer deterministic code for:

scores
dates
deduplication
database operations
CRM updates

Use AI for:

interpretation
classification
entity extraction
summarization
message generation

---

# 58. DATA INGESTION ARCHITECTURE

Build independent adapters.

Example:

/integrations
  /clinicaltrials
  /pubmed
  /europepmc
  /crossref
  /fda
  /sec
  /company-web
  /conference
  /salesforce
  /email
  /calendar

Each adapter implements roughly:

fetch()
normalize()
resolveEntities()
detectChanges()
emitSignals()

Never write one monolithic scraper.

---

# 59. SCHEDULING

Suggested schedules:

ClinicalTrials.gov:
daily after upstream refresh.

Company pages:
high-value pages every few hours or daily depending on source.

SEC:
frequent polling / feed-compatible schedule.

PubMed:
daily.

Company leadership:
daily or several times weekly.

Conference programs:
increase frequency near meetings.

Do not make excessive requests.

---

# 60. BACKGROUND JOBS

Need:

source crawler
structured API ingestion
diff detector
entity resolution
signal classifier
opportunity scoring
watchlist matcher
notification generator
CRM sync
email sync
sequence scheduler
data freshness checker

All jobs should be:

idempotent
retryable
logged
observable

---

# 61. RECOMMENDED TECH STACK

Use a maintainable modern stack.

Preferred initial implementation:

Frontend:
Next.js
TypeScript
Tailwind
shadcn/ui

Database:
PostgreSQL

ORM:
Prisma or Drizzle

Vector:
pgvector if semantic retrieval is needed.

Authentication:
Supabase Auth, Clerk, Auth.js, or equivalent.

Background workers:
Trigger.dev, Inngest, or a clean queue architecture.

Validation:
Zod.

LLM:
provider abstraction.

Charts:
Recharts if needed.

Scraping:
fetch + parser first
Playwright only for JS-heavy public pages when permitted.

Testing:
Vitest/Jest
Playwright for E2E.

Use environment variables for credentials.

NEVER commit secrets.

---

# 62. DATABASE DESIGN

Use migrations.

Proper indexes.

Important indexes:

organization
asset aliases
NCT ID
PMID
DOI
signal date
opportunity score
contact email
CRM ID
source hash

Use join tables for many-to-many relationships.

Do not put everything in JSON blobs.

Use JSON only where flexibility genuinely benefits us.

---

# 63. RAG / SEARCH

Use structured database queries before vector retrieval.

Vector retrieval is useful for:

press-release content
publication abstracts
historical notes
meeting notes
CRM notes
scientific context

But:

company
asset
trial
contact
score

should remain structured.

Hybrid retrieval:

structured filters
+
full-text search
+
vector similarity.

---

# 64. SECURITY

Implement:

organization-level tenancy
role-based access
data encryption
OAuth token protection
audit logs
least-privilege access
secure secret handling
rate limiting
input validation

Never expose one customer's CRM data to another tenant.

---

# 65. EMAIL COMPLIANCE

Support proper suppression handling.

Track:

unsubscribe
do-not-contact
bounce
invalid address
complaint

Comply with applicable commercial-email requirements.

Do not allow sequences to continue after opt-out.

---

# 66. PROFESSIONAL-DATA GUARDRAILS

Do not gather sensitive personal information.

Do not infer:

race
religion
health conditions
politics
sexual orientation
personal family data

Professional personalization only.

Do not automate unauthorized scraping of restricted professional-network platforms.

Provide adapters for approved providers/imports where necessary.

---

# 67. SCIENTIFIC CREDIBILITY

This is oncology.

Scientific mistakes destroy trust.

Always preserve distinctions between:

mutation
amplification
fusion
expression
methylation
protein status

Preserve distinctions between:

ctDNA
cfDNA
germline DNA
tumor tissue DNA
RNA

Preserve distinctions between:

clinical assay
research assay
CDx
exploratory biomarker assay

Do not describe germline DNA as ctDNA.

Do not infer a diagnostic strategy simply because sequencing was mentioned.

---

# 68. ONCOLOGY ONTOLOGY

Build extensibly.

Start with key domains:

RAS/MAPK
EGFR
HER2
FGFR
PI3K/AKT
DNA damage repair
IO
ADC targets
MRD
prostate cancer
breast cancer
lung cancer
CRC
pancreatic
bladder
hematologic malignancies

But never hard-code the product exclusively to those.

---

# 69. COMMERCIAL RELEVANCE EXAMPLES

## Example A

Signal:
Phase I KRAS inhibitor becomes Phase I/II.

Interpretation:
Program is expanding clinically.

Potential commercial needs:
additional biomarker testing
central-lab scalability
patient selection
serial molecular monitoring.

Action:
identify Translational Medicine + Clinical Development.

---

## Example B

Signal:
New publication shows acquired KRAS resistance mutations using serial ctDNA.

Interpretation:
Strong evidence that longitudinal liquid biopsy is important in this program.

Action:
identify translational / biomarker program owners.

Outreach angle:
resistance monitoring.

---

## Example C

Signal:
New Phase III trial requires mutation-positive eligibility.

Interpretation:
Large prospective patient-screening requirement.

Action:
assess known CDx partner.

If none publicly disclosed:
identify Precision Medicine/CDx stakeholders.

---

## Example D

Signal:
Company appoints Head of Precision Medicine.

Interpretation:
Possible strategic reset/new vendor relationships.

Action:
low-to-medium urgency relationship-building outreach.

---

## Example E

Signal:
Company announces asset discontinuation.

Interpretation:
DO NOT pitch that asset.

Close/pause opportunity.

Evaluate whether resources shifted to another relevant program.

---

# 70. COMMERCIAL TIMING MODEL

Classify:

TOO EARLY
EARLY
IDEAL
LATE
MAINTENANCE
CLOSED

Examples:

Discovery/preclinical:
relationship-building.

Phase I planning:
potentially excellent for translational work.

Phase I expansion:
excellent.

Phase II:
excellent.

Phase III:
potentially large but vendors may already be selected.

Approved product:
different opportunity type.

Interpret based on service being sold.

---

# 71. “WHY NOW?” FIELD

Every opportunity must have a one-sentence Why Now.

Examples:

“Company X added a Phase II expansion cohort five days ago.”

“New publication demonstrates serial ctDNA monitoring in this program.”

“Trial enrollment increased from 80 to 240.”

“Company X will present updated biomarker results at ASCO next month.”

If no credible Why Now exists, lower outreach urgency.

---

# 72. NEXT BEST ACTION ENGINE

Possible actions:

Research account
Find contact
Request introduction
Send initial email
Follow up
Send scientific resource
Invite to meeting
Request conference meeting
Prepare for meeting
Create opportunity
Escalate internally
Pause
Do nothing

“Do nothing” must be a valid recommendation.

---

# 73. OUTREACH DEDUPLICATION

Before recommending any email:

check:

same person
same account
same asset
same campaign
last message
last response
owner
next meeting
active sequence
opt-out

Do not let multiple salespeople unknowingly spam the same account.

---

# 74. MANAGER DASHBOARD

Show:

Top opportunities
Pipeline created
Meetings created
Signals → outreach conversion
Outreach → reply
Reply → meeting
Meeting → opportunity
Opportunities by pathway
Opportunities by company
Activity by rep
CRM completeness
stale accounts
relationship coverage
sequence performance

But avoid vanity metrics.

The important outcome is qualified commercial pipeline.

---

# 75. ANALYTICS

Track:

signals detected
signals deemed relevant
opportunities created
people recommended
messages drafted
messages approved
messages sent
reply rate
positive reply rate
meeting rate
opportunity rate
time from signal → outreach
time from signal → meeting
revenue influenced

The unique metric:

SIGNAL-TO-ACTION TIME.

---

# 76. SOURCE PERFORMANCE

Track which sources actually create value.

Example:

ClinicalTrials.gov
42 signals
12 opportunities
4 meetings

Press releases
31 signals
5 opportunities
2 meetings

Publications
18 signals
6 opportunities
3 meetings

This improves prioritization.

---

# 77. DATA FRESHNESS UI

Each record displays:

Last verified
Source
Freshness

Flag stale information.

Person titles become stale quickly.

Trial status requires frequent refresh.

---

# 78. ADMIN SOURCE REGISTRY

Create interface for admins to:

add organization
add source URL
edit parser
change crawl frequency
disable source
view crawl status
view errors
force refresh
inspect change history

This is essential because 100+ company sites will change layouts.

---

# 79. ERROR HANDLING

Do not silently fail.

Create Source Health dashboard.

Fields:

Source
Last success
Last failure
Failure count
HTTP status
Parser status
Last content change

Alert admins to broken high-priority sources.

---

# 80. MVP PRIORITY

DO NOT attempt every feature simultaneously.

Build the architecture for the full product but implement vertical slices.

## MVP 1

Authentication
Organizations
Assets
Trials
Watchlists
ClinicalTrials.gov integration
Trial change detection
Signal feed
Opportunity scoring
Basic contact records
Outreach drafting
CRM-ready activity log

## MVP 2

Company website monitoring
Press releases
PubMed
Europe PMC
Crossref
publication-to-asset resolution
daily intelligence dashboard

## MVP 3

Salesforce OAuth
contacts/accounts sync
CRM update queue
deduplication
two-way relationship history

## MVP 4

Email integration
campaigns
sequences
reply detection
automatic CRM activity logging

## MVP 5

Conference intelligence
management changes
meeting-prep briefs
advanced account mapping

---

# 81. FIRST DEMO VERTICAL

Use:

RAS / KRAS ONCOLOGY

as initial vertical.

Track:

KRAS
NRAS
HRAS
SOS1
SHP2
RAF/MEK pathway components where commercially relevant.

Prioritize:

NSCLC
CRC
PDAC
other KRAS-mutated solid tumors.

Use this only as demo configuration.

Architecture must support any pathway.

---

# 82. SEED DEMO DATA

Create realistic but clearly marked demo data if an API cannot yet be connected.

However:

prefer live ClinicalTrials.gov ingestion wherever practical.

Do not represent synthetic demo data as real current information.

Label:

DEMO DATA.

---

# 83. TOP-100 BIOPHARMA UNIVERSE

Create a seed workflow, not a brittle hardcoded product assumption.

Build:

scripts/seed-biopharma-universe

It should support:

company name
canonical domain
ticker
CIK
aliases
parent company
IR page
news page
pipeline page
leadership page

Populate approximately 100 major biopharma organizations using a current ranking/reference source during setup.

Then allow admins to edit this universe.

Company monitoring should NEVER depend on Google search every time.

Maintain canonical source URLs.

---

# 84. COMPANY SOURCE DISCOVERY

When adding a new company:

1. inspect canonical domain
2. inspect sitemap
3. identify likely source pages
4. suggest them to admin
5. validate content
6. store canonical URLs
7. begin monitoring

Use AI only as aid.

Admin can approve/disable discovered sources.

---

# 85. INTELLIGENCE COST CONTROL

Do not send every webpage through an expensive LLM.

Pipeline:

HTTP fetch
→ hash
→ if unchanged STOP
→ DOM cleanup
→ deterministic diff
→ relevance keyword/ontology filter
→ cheap classifier
→ expensive scientific/commercial interpretation only when warranted

Cache results.

---

# 86. EXPLAINABILITY

Opportunity pages must show:

Why scored this way.

Example:

Opportunity 89

Commercial Fit +23/25
Biomarker Need +19/20
Clinical Timing +18/20
Account Value +10/10
Signal Strength +9/10
Relationship +6/10
Urgency +4/5

Users should trust the system.

---

# 87. EDITABLE AI

Allow user corrections:

Wrong asset.
Wrong person.
Not an opportunity.
Company already has partner.
This pathway matters more.
This persona should rank higher.

Persist these corrections.

Use them as organization-specific rules.

---

# 88. CUSTOM COMMERCIAL STRATEGY

Different organizations should be able to define scoring weights.

Example:

Customer A cares about:

Phase III
large enrollment
CDx

Customer B cares about:

Phase I
translational endpoints
WES

Customer C cares about:

MRD studies.

Create configurable scoring profiles.

---

# 89. INTERNAL COLLABORATION

Allow:

assign account
@mention colleague
comment on signal
share opportunity
mark ownership
create internal task

Create immutable activity history for important actions.

---

# 90. INTERNAL NOTES

Notes may contain private commercial information.

Treat them differently from external web intelligence.

Clearly label:

PUBLIC SOURCE

vs

INTERNAL INFORMATION.

Never leak private CRM/internal information into outbound copy unless user intentionally chooses it.

---

# 91. MESSAGE APPROVAL SCREEN

Display:

TO
Company
Role

WHY THIS PERSON

WHY NOW

SOURCES USED

MESSAGE

Editable text.

Then:

Approve
Edit
Regenerate
Reject
Schedule

This makes AI transparent.

---

# 92. OUTREACH TONE ENGINE

Organization can define style.

Default:

concise
scientifically credible
curious
professional
peer-like
not overly salesy
not sycophantic

Allow message goals:

Introduction
Conference meeting
Post-publication
Clinical trial update
Follow-up
Re-engagement
Referral request
Partnership discussion

---

# 93. FOLLOW-UP GENERATION

Never repeat the same email.

Each follow-up should have a purpose.

Follow-up types:

gentle bump
new evidence
new clinical update
conference timing
relevant publication
specific question
close-the-loop

---

# 94. SALES EMAIL EXAMPLE LOGIC

Initial:

Subject:
Specific but natural.

Sentence 1:
Relevant contextual reason.

Sentence 2:
Why our capability maps to their program.

Sentence 3:
Specific credibility.

Sentence 4:
Low-friction CTA.

Keep it human.

---

# 95. BAD OUTREACH DETECTOR

Before approval, score message on:

Specificity
Relevance
Credibility
Brevity
Naturalness
CTA quality
Scientific correctness
Spam risk

Flag:

generic opener
excessive adjectives
fake praise
overlong message
multiple CTAs
unsupported scientific claim
creepy personalization
irrelevant product pitch

---

# 96. INTELLIGENCE → OUTREACH EXPLANATION

For every draft show:

Signal:
what happened

Hypothesis:
commercial interpretation

Target:
why this person

Angle:
why our offering fits

Message:
actual email

This prevents black-box outreach.

---

# 97. API-FIRST DESIGN

Expose internal services through stable APIs.

Eventually product should support integrations with:

Salesforce
HubSpot
Gmail
Outlook
Slack
Teams
data warehouses
commercial intelligence providers
approved contact-data providers

---

# 98. SEARCH AND EXPORT

Any table should allow:

filter
sort
search
save view
CSV export

Examples:

Accounts
Assets
Trials
People
Signals
Outreach
Opportunities

---

# 99. PERFORMANCE

Dashboard should load quickly.

Paginate large lists.

Use background refresh.

Do not block UI while crawling sources.

---

# 100. DESIGN LANGUAGE

Professional life-sciences SaaS.

Dense enough for power users but not cluttered.

Think:

scientific intelligence
+
modern CRM
+
AI command center

Avoid:

consumer chatbot aesthetic
giant gradient cards
excessive animations
unnecessary emojis

---

# 101. FIRST HOME SCREEN MOCKUP

Build something conceptually similar to:

ONCOLOGY BD COMMAND CENTER

Tuesday, September 8

────────────────────────────

YOUR PRIORITIES

6 High-Priority Signals
11 Follow-Ups Due
4 Replies
3 Meetings
7 CRM Updates

────────────────────────────

TOP OPPORTUNITY

Company X
KRAS G12D Program
Score 94

NEW SIGNAL
Phase II expansion cohort added

WHY IT MATTERS
Serial ctDNA collection was added as an exploratory endpoint.

WHY NOW
Trial record updated 2 days ago.

RELATIONSHIP
3 relevant contacts
1 previous interaction
Last contact: 74 days

BEST CONTACT
Jane Doe
Director, Translational Medicine
Relevance 92

[Review Opportunity]
[Draft Outreach]

────────────────────────────

RECENT SIGNALS

...

────────────────────────────

FOLLOW-UPS

...

---

# 102. BUILD MEETING PREP EXAMPLE

When a user says:

“Prepare me for Company X.”

Return:

30-SECOND SUMMARY

WHAT THEY CARE ABOUT

RELEVANT PIPELINE

RECENT CHANGES

WHO YOU ARE MEETING

OUR RELATIONSHIP

LIKELY NEED

PITCH ANGLE

QUESTIONS TO ASK

WHAT NOT TO SAY

DESIRED NEXT STEP

SOURCES

---

# 103. DAILY INTELLIGENCE EXAMPLE

The desired product experience:

“I reviewed 137 new source updates across your monitored oncology universe. 119 were duplicates or low relevance. 18 contained meaningful scientific or corporate developments. Six mapped strongly to your commercial capabilities. Three warrant outreach today.”

Then list the three.

That is the value proposition.

---

# 104. PRODUCT MOAT

Architect around the following moat:

GENERIC SALES AI understands:

company
contact
email

This system understands:

company
asset
molecular target
pathway
indication
trial
cohort
biomarker
clinical endpoint
diagnostic need
scientific stakeholder
relationship
commercial timing
outreach.

The system's unique capability is:

SCIENTIFIC EVENT → COMMERCIAL ACTION.

Do not lose this during implementation.

---

# 105. ACCEPTANCE TEST: SIGNAL INTELLIGENCE

Given a ClinicalTrials.gov study whose enrollment changes from 60 to 180:

System should:

detect change
store old/new values
associate sponsor
associate asset
determine relevance
recalculate opportunity score
generate signal
recommend action
show source

No duplicate event on next refresh.

---

# 106. ACCEPTANCE TEST: PUBLICATION

Given a new publication mentioning:

Company X
Drug ABC
NCT123
serial ctDNA
acquired resistance

System should resolve:

Company X
Drug ABC
NCT123
ctDNA
resistance monitoring

Then generate:

scientific summary
commercial interpretation
relevant personas
opportunity score
source evidence

---

# 107. ACCEPTANCE TEST: OUTREACH

Given:

Signal
Trial
Person
Offering
Previous CRM history

System generates a message that:

references the right development
does not invent details
connects to relevant capability
does not repeat previous outreach
contains one CTA
is concise
shows source evidence to user

---

# 108. ACCEPTANCE TEST: CRM COLLISION

If another sales rep contacted the account yesterday:

System warns user before outreach.

If contact opted out:

System blocks outreach.

---

# 109. ACCEPTANCE TEST: NEGATIVE SIGNAL

If a trial is terminated:

System should NOT recommend standard sales outreach.

Instead:

lower opportunity
pause active sequences
notify owner
recommend reassessment.

---

# 110. ACCEPTANCE TEST: SOURCE DUPLICATION

If:

company press release
SEC 8-K
news article

all describe same licensing deal:

create ONE commercial event with multiple supporting sources.

---

# 111. CODE QUALITY

Requirements:

TypeScript strict mode
strong schemas
clean service boundaries
reusable components
migrations
seed scripts
unit tests
integration tests
E2E tests for primary flows
error states
loading states
empty states
logging

Avoid giant files.

Avoid unnecessary abstraction.

Document important architecture decisions.

---

# 112. DOCUMENTATION

Create:

README.md
ARCHITECTURE.md
DATA_MODEL.md
INTEGRATIONS.md
SCORING.md
SOURCE_REGISTRY.md

README should include:

setup
environment variables
database setup
migrations
seeding
running workers
starting app
tests

---

# 113. ENVIRONMENT VARIABLES

Provide `.env.example`.

Never include credentials.

Examples:

DATABASE_URL
LLM_API_KEY
CLINICALTRIALS_BASE_URL
NCBI_API_KEY optional
CROSSREF_MAILTO
SALESFORCE_CLIENT_ID
SALESFORCE_CLIENT_SECRET
SALESFORCE_REDIRECT_URI
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET

etc.

---

# 114. DEVELOPMENT PROCESS

Do NOT spend all your time giving me a conceptual explanation.

Inspect the repository.

Then:

1. Create architecture.
2. Create database schema.
3. Scaffold UI.
4. Implement ClinicalTrials.gov adapter.
5. Implement change detection.
6. Implement signal engine.
7. Implement opportunity scoring.
8. Implement dashboard.
9. Implement account/asset/trial pages.
10. Implement outreach context and drafting.
11. Add source registry.
12. Add company monitoring framework.
13. Add publication adapters.
14. Add CRM integration interfaces.
15. Add tests.
16. Update documentation.

Work incrementally.

After each major milestone:

run type checking
run lint
run tests
fix errors before continuing.

Do not leave obviously broken placeholder code.

---

# 115. MVP IMPLEMENTATION DECISIONS

When a third-party API key is unavailable:

build the interface and adapter
provide clear setup instructions
gracefully disable the feature
continue building other features

Do NOT halt the entire project asking for keys.

Do NOT fake successful integrations.

---

# 116. FIRST LIVE DATA

ClinicalTrials.gov should be our first live external data integration.

Build a RAS/KRAS watchlist.

Fetch relevant oncology trials.

Normalize them.

Store them.

Display them.

Save snapshots.

Allow future refreshes to create TrialChange objects.

Generate CommercialSignal records.

---

# 117. DEMO PATHWAY

Initial query concepts:

KRAS
KRAS G12C
KRAS G12D
KRAS G12V
pan-KRAS
pan-RAS
NRAS
HRAS
SOS1
SHP2

Indications:

NSCLC
CRC
PDAC
solid tumors

But this is only a seed configuration.

---

# 118. EVENT HISTORY

Every entity should have a timeline.

Company timeline:

trial launched
publication
executive joined
partnership
conference
outreach
reply
meeting
opportunity

Asset timeline:

Phase I
new cohort
publication
Phase II
conference update
regulatory milestone

This is extremely useful for BD.

---

# 119. “WHAT CHANGED SINCE LAST TIME?”

Implement this as a first-class feature.

Account page button:

WHAT CHANGED SINCE MY LAST INTERACTION?

System takes date of last interaction and summarizes only meaningful developments after that date.

This should become a major meeting-prep and re-engagement feature.

---

# 120. “WHY SHOULD I CONTACT THEM?”

Account page button:

WHY CONTACT THEM NOW?

Return:

Opportunity
Evidence
Why now
Relevant person
Recommended message angle
Potential objections

---

# 121. “WHO AM I MISSING?”

Account page:

RELATIONSHIP GAPS

Example:

Clinical Development ✓
Business Development ✓
Translational Medicine ✓
Precision Medicine ✕
Companion Diagnostics ✕

Recommendation:

“Build relationship with Precision Medicine before Phase III biomarker strategy is finalized.”

---

# 122. FUTURE ADVANCED AGENTS

Architect so we can later support specialized agents:

Trial Intelligence Agent
Scientific Literature Agent
Corporate Intelligence Agent
Conference Agent
Contact Mapping Agent
Account Strategy Agent
Outreach Agent
CRM Agent
Meeting Prep Agent
Reply Agent

But DO NOT create autonomous multi-agent complexity merely for marketing.

Use agents only where they make the system better.

---

# 123. PRODUCT SUCCESS CRITERIA

The product succeeds if it materially reduces time spent on:

manual company research
clinical trial monitoring
pipeline monitoring
paper tracking
conference research
contact mapping
spreadsheet management
CRM updates
outreach drafting
follow-up tracking
meeting preparation

while improving:

timing
personalization
account coverage
scientific credibility
CRM hygiene
meeting conversion
qualified pipeline.

---

# 124. NORTH STAR

The final product should eventually be capable of saying:

“Overnight I reviewed updates across the oncology companies, assets, trials, publications, regulatory sources, and relationships you monitor.

I found 43 potentially relevant developments.

After deduplication and commercial analysis, six materially affect your territory.

Three warrant outreach.

For each, I identified the program, why the development creates a potential commercial need, which existing relationships you have, who likely owns the relevant decision, what your organization could credibly offer, and why now is the right time to contact them.

Two contacts are already in Salesforce.

One was contacted recently, so I excluded them.

I prepared drafts for the remaining three and queued the CRM updates for your approval.”

THAT IS THE PRODUCT.

---

# 125. START BUILDING NOW

Begin by inspecting the current project directory and determining whether an application already exists.

If it does not:

initialize the application using the recommended stack.

Then create:

database schema
migrations
seed data
navigation
dashboard shell
source registry
ClinicalTrials.gov integration
trial ingestion
trial snapshotting
change detection
signal creation
opportunity score engine
RAS watchlist
account page
asset page
trial page
signal page
outreach draft workflow.

Do not ask me to decide trivial implementation details.

Use strong engineering judgment.

Where architectural choices are meaningful, document the decision in ARCHITECTURE.md and continue.

At every stage remember:

We are not building an oncology news reader.

We are building the system that determines:

WHAT CHANGED
→ WHY IT MATTERS
→ WHO TO CONTACT
→ WHAT TO SAY
→ WHAT TO DO NEXT.