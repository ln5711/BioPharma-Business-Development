/**
 * Minimal typing for the ClinicalTrials.gov API v2 study object. Only the
 * modules we consume are described; everything else is preserved verbatim in
 * `trial_snapshots.raw_payload`.
 * Docs: https://clinicaltrials.gov/data-api/api
 */
export interface CtgovStudy {
  protocolSection?: {
    identificationModule?: {
      nctId?: string;
      briefTitle?: string;
      officialTitle?: string;
      organization?: { fullName?: string };
    };
    statusModule?: {
      overallStatus?: string;
      whyStopped?: string;
      startDateStruct?: { date?: string };
      primaryCompletionDateStruct?: { date?: string };
      completionDateStruct?: { date?: string };
      lastUpdatePostDateStruct?: { date?: string };
    };
    sponsorCollaboratorsModule?: {
      leadSponsor?: { name?: string; class?: string };
      collaborators?: { name?: string; class?: string }[];
    };
    descriptionModule?: { briefSummary?: string; detailedDescription?: string };
    conditionsModule?: { conditions?: string[]; keywords?: string[] };
    designModule?: {
      studyType?: string;
      phases?: string[];
      designInfo?: Record<string, unknown>;
      enrollmentInfo?: { count?: number; type?: string };
      bioSpec?: { retention?: string; description?: string };
    };
    armsInterventionsModule?: {
      armGroups?: { label?: string; type?: string; description?: string }[];
      interventions?: {
        type?: string;
        name?: string;
        description?: string;
        otherNames?: string[];
      }[];
    };
    outcomesModule?: {
      primaryOutcomes?: { measure?: string; description?: string }[];
      secondaryOutcomes?: { measure?: string; description?: string }[];
      otherOutcomes?: { measure?: string; description?: string }[];
    };
    eligibilityModule?: {
      eligibilityCriteria?: string;
      studyPopulation?: string;
      samplingMethod?: string;
      sex?: string;
      stdAges?: string[];
    };
    contactsLocationsModule?: {
      overallOfficials?: { name?: string; affiliation?: string; role?: string }[];
      locations?: {
        facility?: string;
        city?: string;
        state?: string;
        country?: string;
        status?: string;
        contacts?: { name?: string; role?: string; email?: string }[];
      }[];
    };
  };
  derivedSection?: Record<string, unknown>;
  hasResults?: boolean;
}

export interface CtgovPage {
  studies: CtgovStudy[];
  nextPageToken?: string;
  totalCount?: number;
}

export interface CtgovQuery {
  /** Free-text terms OR'd together and passed as query.term. */
  terms: string[];
  /** Condition terms passed as query.cond. */
  conditions?: string[];
  /** overallStatus filter values, e.g. ["RECRUITING","ACTIVE_NOT_RECRUITING"]. */
  statuses?: string[];
  /** Phase filter values, e.g. ["PHASE1","PHASE2"]. */
  phases?: string[];
  /** Hard cap on studies pulled per run. */
  maxStudies?: number;
}
