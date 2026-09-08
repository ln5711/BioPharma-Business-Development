import { relations } from "drizzle-orm";
import {
  assetAliases,
  assetIndications,
  assetTargets,
  assets,
} from "./assets";
import {
  accountCoverage,
  organizationAliases,
  organizationPartners,
  organizationSources,
  organizations,
} from "./organizations";
import { diseases, targets } from "./ontology";
import { interactions, people, personAssetEvidence, relationships } from "./people";
import { commercialSignals, signalSources } from "./signals";
import { opportunities, opportunityScoreComponents } from "./opportunities";
import {
  trialAssets,
  trialChanges,
  trialSnapshots,
  trials,
} from "./trials";
import { watchlistItems, watchlists } from "./watchlists";

export const organizationsRelations = relations(organizations, ({ many, one }) => ({
  aliases: many(organizationAliases),
  sources: many(organizationSources),
  partners: many(organizationPartners),
  coverage: many(accountCoverage),
  assets: many(assets),
  trials: many(trials),
  people: many(people),
  signals: many(commercialSignals),
  opportunities: many(opportunities),
  parent: one(organizations, {
    fields: [organizations.parentCompanyId],
    references: [organizations.id],
  }),
}));

export const organizationAliasesRelations = relations(organizationAliases, ({ one }) => ({
  organization: one(organizations, {
    fields: [organizationAliases.organizationId],
    references: [organizations.id],
  }),
}));

export const organizationSourcesRelations = relations(organizationSources, ({ one }) => ({
  organization: one(organizations, {
    fields: [organizationSources.organizationId],
    references: [organizations.id],
  }),
}));

export const assetsRelations = relations(assets, ({ many, one }) => ({
  organization: one(organizations, {
    fields: [assets.organizationId],
    references: [organizations.id],
  }),
  aliases: many(assetAliases),
  targets: many(assetTargets),
  indications: many(assetIndications),
  trials: many(trialAssets),
  signals: many(commercialSignals),
  opportunities: many(opportunities),
}));

export const assetTargetsRelations = relations(assetTargets, ({ one }) => ({
  asset: one(assets, { fields: [assetTargets.assetId], references: [assets.id] }),
  target: one(targets, { fields: [assetTargets.targetId], references: [targets.id] }),
}));

export const assetIndicationsRelations = relations(assetIndications, ({ one }) => ({
  asset: one(assets, { fields: [assetIndications.assetId], references: [assets.id] }),
  disease: one(diseases, {
    fields: [assetIndications.diseaseId],
    references: [diseases.id],
  }),
}));

export const trialsRelations = relations(trials, ({ many, one }) => ({
  sponsorOrganization: one(organizations, {
    fields: [trials.sponsorOrganizationId],
    references: [organizations.id],
  }),
  snapshots: many(trialSnapshots),
  changes: many(trialChanges),
  assets: many(trialAssets),
  signals: many(commercialSignals),
}));

export const trialSnapshotsRelations = relations(trialSnapshots, ({ one }) => ({
  trial: one(trials, { fields: [trialSnapshots.trialId], references: [trials.id] }),
}));

export const trialChangesRelations = relations(trialChanges, ({ one, many }) => ({
  trial: one(trials, { fields: [trialChanges.trialId], references: [trials.id] }),
  signals: many(commercialSignals),
}));

export const trialAssetsRelations = relations(trialAssets, ({ one }) => ({
  trial: one(trials, { fields: [trialAssets.trialId], references: [trials.id] }),
  asset: one(assets, { fields: [trialAssets.assetId], references: [assets.id] }),
}));

export const peopleRelations = relations(people, ({ many, one }) => ({
  organization: one(organizations, {
    fields: [people.organizationId],
    references: [organizations.id],
  }),
  assetEvidence: many(personAssetEvidence),
  relationship: many(relationships),
  interactions: many(interactions),
}));

export const relationshipsRelations = relations(relationships, ({ one }) => ({
  person: one(people, { fields: [relationships.personId], references: [people.id] }),
  organization: one(organizations, {
    fields: [relationships.organizationId],
    references: [organizations.id],
  }),
}));

export const commercialSignalsRelations = relations(commercialSignals, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [commercialSignals.organizationId],
    references: [organizations.id],
  }),
  asset: one(assets, { fields: [commercialSignals.assetId], references: [assets.id] }),
  trial: one(trials, { fields: [commercialSignals.trialId], references: [trials.id] }),
  person: one(people, { fields: [commercialSignals.personId], references: [people.id] }),
  trialChange: one(trialChanges, {
    fields: [commercialSignals.trialChangeId],
    references: [trialChanges.id],
  }),
  sources: many(signalSources),
}));

export const signalSourcesRelations = relations(signalSources, ({ one }) => ({
  signal: one(commercialSignals, {
    fields: [signalSources.signalId],
    references: [commercialSignals.id],
  }),
}));

export const opportunitiesRelations = relations(opportunities, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [opportunities.organizationId],
    references: [organizations.id],
  }),
  asset: one(assets, { fields: [opportunities.assetId], references: [assets.id] }),
  trial: one(trials, { fields: [opportunities.trialId], references: [trials.id] }),
  originSignal: one(commercialSignals, {
    fields: [opportunities.originSignalId],
    references: [commercialSignals.id],
  }),
  components: many(opportunityScoreComponents),
}));

export const opportunityScoreComponentsRelations = relations(
  opportunityScoreComponents,
  ({ one }) => ({
    opportunity: one(opportunities, {
      fields: [opportunityScoreComponents.opportunityId],
      references: [opportunities.id],
    }),
  }),
);

export const watchlistsRelations = relations(watchlists, ({ many }) => ({
  items: many(watchlistItems),
}));

export const watchlistItemsRelations = relations(watchlistItems, ({ one }) => ({
  watchlist: one(watchlists, {
    fields: [watchlistItems.watchlistId],
    references: [watchlists.id],
  }),
}));
