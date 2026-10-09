import { CONTROL_D_PROVIDER_ID } from "../../src/experimental/control-d/contracts";
import type { ExportedSettings } from "../../src/shared/types";

import {
  exportSettings,
  importSettings,
  saveLocationModel,
} from "./extension-test.helpers";
import { ackReleaseNotices, expect, test } from "./fixtures";
import {
  LOOPBACK_HOST,
  LOOPBACK_SOURCE,
  SOCIAL_FEATURE,
  VIDEO_FEATURE,
  VIDEO_HOST,
  VIDEO_SOURCE,
  clickFeatureAction,
  confirmManualFeature,
  expectFeatureState,
  expectHostUnprotected,
  expectQuietProvider,
  expectSourceUnchanged,
  expectedDomainQuery,
  openPopupRuleEditor,
  openProbe,
  openSavedRuleEditor,
  prepareProviderPage,
  readControlDQueries,
  readDismissedHosts,
  readProviderGuard,
  renameSource,
  type FeatureViewState,
  type SourceRule,
} from "./provider-feature.helpers";

test.beforeEach(async ({ context, extensionId }) => {
  await ackReleaseNotices(context, extensionId, { reduceMotion: true });
});

const editorState = (
  rule: SourceRule,
  state: Omit<FeatureViewState, "variant" | "rulePattern">,
): FeatureViewState => ({
  ...state,
  variant: "default",
  rulePattern: rule.pattern,
});

test("confirms a cached service suggestion without calling Control D", async ({
  context,
  extensionId,
  serverUrl,
}) => {
  const { page, worker } = await prepareProviderPage(context, extensionId, {
    rule: VIDEO_SOURCE,
    suggestion: true,
  });
  await openSavedRuleEditor(page, extensionId, VIDEO_HOST);
  await expectFeatureState(
    page,
    editorState(VIDEO_SOURCE, {
      view: "suggested",
      matchSource: "domain-test",
      matchStatus: "matched",
      sync: "none",
    }),
  );

  await clickFeatureAction(page, "confirm");
  await expectFeatureState(
    page,
    editorState(VIDEO_SOURCE, {
      view: "bound",
      matchSource: "domain-test",
      matchStatus: "matched",
      sync: "queued",
    }),
  );
  await expectSourceUnchanged(page, VIDEO_SOURCE, {
    featureId: VIDEO_FEATURE,
    matchSource: "domain-test",
  });
  await expectQuietProvider(page, worker);

  const probe = await openProbe(context, serverUrl);
  await expectHostUnprotected(context, extensionId, probe, LOOPBACK_HOST);
});

test("recognizes the open host from the popup through the controlled resolver", async ({
  context,
  extensionId,
  serverUrl,
  secondaryServerUrl,
}) => {
  test.slow();
  const { worker } = await prepareProviderPage(context, extensionId, {
    rule: LOOPBACK_SOURCE,
    recognition: true,
    queryHost: LOOPBACK_HOST,
  });
  const probe = await openProbe(context, serverUrl);
  const popup = await openPopupRuleEditor(context, extensionId, probe);
  await expectFeatureState(popup, {
    view: "idle",
    variant: "compact",
    matchSource: "none",
    matchStatus: "none",
    sync: "none",
    rulePattern: LOOPBACK_HOST,
  });

  await clickFeatureAction(popup, "recognize");
  const domainQuery = expectedDomainQuery(LOOPBACK_HOST);
  await expect.poll(() => readControlDQueries(worker)).toEqual([domainQuery]);
  await expectFeatureState(popup, {
    view: "suggested",
    variant: "compact",
    matchSource: "domain-test",
    matchStatus: "matched",
    sync: "none",
    rulePattern: LOOPBACK_HOST,
  });

  await clickFeatureAction(popup, "confirm");
  await expectFeatureState(popup, {
    view: "bound",
    variant: "compact",
    matchSource: "domain-test",
    matchStatus: "matched",
    sync: "queued",
    rulePattern: LOOPBACK_HOST,
  });
  await expectSourceUnchanged(popup, LOOPBACK_SOURCE, {
    featureId: VIDEO_FEATURE,
    matchSource: "domain-test",
  });
  expect(await readControlDQueries(worker)).toEqual([domainQuery]);
  expect(await readProviderGuard(popup)).toEqual({
    autoSyncEnabled: false,
    lastSyncedHash: null,
    managedServiceCount: 0,
  });

  const other = await openProbe(context, secondaryServerUrl);
  await expectHostUnprotected(context, extensionId, other, "localhost");
});

test("dismisses a cached suggestion and restores it without another query", async ({
  context,
  extensionId,
}) => {
  const { page, worker } = await prepareProviderPage(context, extensionId, {
    rule: VIDEO_SOURCE,
    suggestion: true,
  });
  await openSavedRuleEditor(page, extensionId, VIDEO_HOST);
  await clickFeatureAction(page, "dismiss");
  await expectFeatureState(
    page,
    editorState(VIDEO_SOURCE, {
      view: "dismissed",
      matchSource: "domain-test",
      matchStatus: "matched",
      sync: "none",
    }),
  );
  expect(await readDismissedHosts(page)).toEqual([VIDEO_HOST]);

  await clickFeatureAction(page, "recognize");
  await expectFeatureState(
    page,
    editorState(VIDEO_SOURCE, {
      view: "suggested",
      matchSource: "domain-test",
      matchStatus: "matched",
      sync: "none",
    }),
  );
  expect(await readDismissedHosts(page)).toEqual([]);
  await expectSourceUnchanged(page, VIDEO_SOURCE, null);
  await expectQuietProvider(page, worker);
});

test("confirms a manually chosen service and detaches it from the source", async ({
  context,
  extensionId,
}) => {
  const { page, worker } = await prepareProviderPage(context, extensionId, {
    rule: VIDEO_SOURCE,
  });
  await openSavedRuleEditor(page, extensionId, VIDEO_HOST);
  await expectFeatureState(
    page,
    editorState(VIDEO_SOURCE, {
      view: "idle",
      matchSource: "none",
      matchStatus: "none",
      sync: "none",
    }),
  );

  await confirmManualFeature(page, SOCIAL_FEATURE);
  await expectFeatureState(
    page,
    editorState(VIDEO_SOURCE, {
      view: "bound",
      matchSource: "manual",
      matchStatus: "matched",
      sync: "queued",
    }),
  );
  await expectSourceUnchanged(page, VIDEO_SOURCE, {
    featureId: SOCIAL_FEATURE,
    matchSource: "manual",
  });

  await clickFeatureAction(page, "detach");
  await expectFeatureState(
    page,
    editorState(VIDEO_SOURCE, {
      view: "idle",
      matchSource: "none",
      matchStatus: "none",
      sync: "none",
    }),
  );
  await expectSourceUnchanged(page, VIDEO_SOURCE, null);
  await expectQuietProvider(page, worker);
});

test("round-trips the service binding and keeps it with the source identity", async ({
  context,
  extensionId,
}) => {
  test.slow();
  const { page, worker } = await prepareProviderPage(context, extensionId, {
    rule: VIDEO_SOURCE,
    suggestion: true,
  });
  await openSavedRuleEditor(page, extensionId, VIDEO_HOST);
  await clickFeatureAction(page, "confirm");
  await expectFeatureState(
    page,
    editorState(VIDEO_SOURCE, {
      view: "bound",
      matchSource: "domain-test",
      matchStatus: "matched",
      sync: "queued",
    }),
  );
  const backup = await expectSourceUnchanged(page, VIDEO_SOURCE, {
    featureId: VIDEO_FEATURE,
    matchSource: "domain-test",
  });

  await clickFeatureAction(page, "detach");
  await expectFeatureState(
    page,
    editorState(VIDEO_SOURCE, {
      view: "suggested",
      matchSource: "domain-test",
      matchStatus: "matched",
      sync: "none",
    }),
  );
  await expectSourceUnchanged(page, VIDEO_SOURCE, null);

  await page.goto(`chrome-extension://${extensionId}/src/ui/options/index.html`);
  await importSettings(page, { ...backup, onboardingCompleted: true });
  await openSavedRuleEditor(page, extensionId, VIDEO_HOST);
  await expectFeatureState(
    page,
    editorState(VIDEO_SOURCE, {
      view: "bound",
      matchSource: "domain-test",
      matchStatus: "matched",
      sync: "queued",
    }),
  );

  const restored = await exportSettings<ExportedSettings>(page);
  await page.goto(`chrome-extension://${extensionId}/src/ui/options/index.html`);
  await renameSource(page, restored, VIDEO_HOST, LOOPBACK_HOST);
  const renamed = await exportSettings<ExportedSettings>(page);
  expect(renamed.rules).toEqual([
    expect.objectContaining({
      pattern: LOOPBACK_HOST,
      authKey: VIDEO_SOURCE.authKey,
      ruleSeedKey: VIDEO_SOURCE.ruleSeedKey,
      enabled: true,
      locationId: VIDEO_SOURCE.locationId,
    }),
  ]);
  expect(renamed.featureBindings).toEqual([
    expect.objectContaining({
      rulePattern: LOOPBACK_HOST,
      providerId: CONTROL_D_PROVIDER_ID,
      featureId: VIDEO_FEATURE,
      featureType: "service",
    }),
  ]);

  const renamedRule = renamed.rules[0];
  if (!renamedRule) throw new Error("Renamed source is missing.");
  await saveLocationModel(page, {
    locations: renamed.locations,
    rules: [{ ...renamedRule, enabled: false }],
  });
  const disabled = await exportSettings<ExportedSettings>(page);
  expect(disabled.rules).toEqual([
    expect.objectContaining({
      pattern: LOOPBACK_HOST,
      enabled: false,
      authKey: VIDEO_SOURCE.authKey,
      ruleSeedKey: VIDEO_SOURCE.ruleSeedKey,
    }),
  ]);
  expect(disabled.featureBindings).toEqual([
    expect.objectContaining({ rulePattern: LOOPBACK_HOST }),
  ]);

  await saveLocationModel(page, { locations: disabled.locations, rules: [] });
  const removed = await exportSettings<ExportedSettings>(page);
  expect(removed.rules).toEqual([]);
  expect(removed.featureBindings ?? []).toEqual([]);
  await expectQuietProvider(page, worker);
});
