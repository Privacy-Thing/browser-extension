import {
  CONTROL_D_COMMANDS,
  CONTROL_D_PROVIDER_ID,
} from "../../src/experimental/control-d/contracts";
import type { ExportedSettings, PopupState } from "../../src/shared/types";

import {
  exportSettings,
  getPopupState,
  importSettings,
  openPopupWithDefaults,
  openSettingsTab,
  saveLocationModel,
} from "./extension-test.helpers";
import { ackReleaseNotices, expect, test } from "./fixtures";
import {
  CLIPS_HOST,
  LOCAL_HOST,
  LOOPBACK_HOST,
  MEDIA_HOST,
  PARIS_LOCATION_ID,
  SOCIAL_FEATURE,
  VIDEO_FEATURE,
  VIDEO_HOST,
  WARSAW_LOCATION_ID,
  cancelRuleDialog,
  chooseCatalogueFeature,
  clickFeatureAction,
  expectExportSealed,
  expectFeatureDecision,
  expectFeatureSlot,
  expectHostUnprotected,
  expectNoFeatureDecision,
  expectPageHasNoProvider,
  expectProviderQuiet,
  expectSavedRule,
  fillRulePattern,
  openNewRuleDialog,
  openProbe,
  openSavedRuleEditor,
  prepareProviderPage,
  readControlDQueries,
  readDismissedHosts,
  restartExtensionWorker,
  saveRuleDialog,
  savedIdentity,
  selectRuleProfile,
  videoDecision,
  type SavedIdentity,
} from "./provider-feature.helpers";

test.beforeEach(async ({ context, extensionId }) => {
  await ackReleaseNotices(context, extensionId, { reduceMotion: true });
});

const bindingFor = (
  rulePattern: string,
  featureId: string,
  matchSource: "domain-test" | "manual",
  rulePatterns?: readonly string[],
) =>
  expect.objectContaining({
    rulePattern,
    providerId: CONTROL_D_PROVIDER_ID,
    featureId,
    featureType: "service",
    matchSource,
    ...(rulePatterns ? { rulePatterns: [...rulePatterns] } : {}),
  });

test("stages an automatic suggestion for an unsaved rule until save", async ({
  context,
  extensionId,
  serverUrl,
}) => {
  const { page, worker, escapes, pageRequests } = await prepareProviderPage(
    context,
    extensionId,
    { hosts: [VIDEO_HOST] },
  );
  const probe = await openProbe(context, serverUrl);
  await openNewRuleDialog(page, extensionId);
  await fillRulePattern(page, "*");
  await expectFeatureSlot(page, { state: "manual", variant: "default" });
  expect(await readControlDQueries(worker)).toEqual([]);

  await fillRulePattern(page, VIDEO_HOST);
  await expectFeatureSlot(page, { state: "suggest", variant: "default" });
  await expect(page.locator("[data-provider-feature-choice-title]")).toContainText(
    "Control D",
  );
  const queried = await readControlDQueries(worker);
  expect(queried).toEqual([
    { origin: "https://dns.controld.com", pathname: "/e2eresolver", name: VIDEO_HOST },
  ]);
  await expectPageHasNoProvider(probe);

  await clickFeatureAction(page, "accept");
  await expectFeatureSlot(page, { state: "staged", variant: "default" });
  await expect(page.locator("[data-provider-feature-chip]")).toHaveAttribute(
    "data-provider-feature-chip",
    "staged",
  );
  await expectFeatureDecision(page, videoDecision(VIDEO_FEATURE));
  const staged = await exportSettings<ExportedSettings>(page);
  expect(staged.rules).toEqual([]);
  expect(staged.featureBindings ?? []).toEqual([]);
  expectExportSealed(staged);

  await cancelRuleDialog(page);
  const cancelled = await exportSettings<ExportedSettings>(page);
  expect(cancelled.rules).toEqual([]);
  expect(cancelled.featureBindings ?? []).toEqual([]);

  await openNewRuleDialog(page, extensionId);
  await fillRulePattern(page, VIDEO_HOST);
  await expectFeatureSlot(page, { state: "suggest", variant: "default" });
  expect(await readControlDQueries(worker)).toEqual(queried);
  await clickFeatureAction(page, "accept");
  await selectRuleProfile(page, "Warsaw", WARSAW_LOCATION_ID);
  await saveRuleDialog(page);

  const saved = await exportSettings<ExportedSettings>(page);
  expect(saved.rules).toHaveLength(1);
  const identity = savedIdentity(saved, VIDEO_HOST);
  expect(identity.locationId).toBe(WARSAW_LOCATION_ID);
  expect(identity.enabled).toBe(true);
  expect(saved.featureBindings).toEqual([
    bindingFor(VIDEO_HOST, VIDEO_FEATURE, "domain-test"),
  ]);
  expect(saved.featureBindings?.[0]?.rulePatterns).toBeUndefined();
  expectExportSealed(saved);

  await openSavedRuleEditor(page, extensionId, VIDEO_HOST);
  await expectFeatureSlot(page, { state: "linked", variant: "default" });
  await expect(page.locator("[data-provider-feature]")).toHaveAttribute(
    "data-provider-feature-group-size",
    "1",
  );
  expect(await readControlDQueries(worker)).toEqual(queried);
  await saveRuleDialog(page);
  const resaved = await exportSettings<ExportedSettings>(page);
  expectSavedRule(resaved, identity);
  expect(resaved.featureBindings).toEqual(saved.featureBindings);
  await expectProviderQuiet(page, worker, [VIDEO_HOST], escapes, pageRequests);
});

test("keeps a declined domain unbound and commits reassignment or detach on save", async ({
  context,
  extensionId,
}) => {
  test.slow();
  const { page, worker, escapes, pageRequests } = await prepareProviderPage(
    context,
    extensionId,
    { hosts: [VIDEO_HOST, CLIPS_HOST] },
  );
  await openNewRuleDialog(page, extensionId);
  await fillRulePattern(page, CLIPS_HOST);
  await expectFeatureSlot(page, { state: "suggest", variant: "default" });
  await clickFeatureAction(page, "accept");
  await clickFeatureAction(page, "accept");
  await expectFeatureSlot(page, { state: "suggest", variant: "default" });
  await expect(
    page.locator('[data-provider-feature-choice] [role="switch"]'),
  ).toHaveAttribute("aria-checked", "false");
  await expectFeatureDecision(page, videoDecision(null));
  await selectRuleProfile(page, "Paris", PARIS_LOCATION_ID);
  await saveRuleDialog(page);

  const declined = await exportSettings<ExportedSettings>(page);
  const clips = savedIdentity(declined, CLIPS_HOST);
  expect(clips.locationId).toBe(PARIS_LOCATION_ID);
  expect(declined.featureBindings ?? []).toEqual([]);
  expect(await readDismissedHosts(page)).toEqual([CLIPS_HOST]);

  await openSavedRuleEditor(page, extensionId, CLIPS_HOST);
  await expectFeatureSlot(page, { state: "suggest", variant: "default" });
  await expectNoFeatureDecision(page);
  await cancelRuleDialog(page);
  expect(await readControlDQueries(worker)).toHaveLength(1);

  await openNewRuleDialog(page, extensionId);
  await fillRulePattern(page, VIDEO_HOST);
  await expectFeatureSlot(page, { state: "suggest", variant: "default" });
  await clickFeatureAction(page, "accept");
  await selectRuleProfile(page, "Warsaw", WARSAW_LOCATION_ID);
  await saveRuleDialog(page);
  const video = savedIdentity(await exportSettings<ExportedSettings>(page), VIDEO_HOST);

  await openSavedRuleEditor(page, extensionId, VIDEO_HOST);
  await chooseCatalogueFeature(page, SOCIAL_FEATURE);
  await expectFeatureSlot(page, { state: "staged", variant: "default" });
  await expectFeatureDecision(page, videoDecision(SOCIAL_FEATURE));
  const beforeReassign = await exportSettings<ExportedSettings>(page);
  expect(beforeReassign.featureBindings).toEqual([
    bindingFor(VIDEO_HOST, VIDEO_FEATURE, "domain-test"),
  ]);
  expectSavedRule(beforeReassign, video);
  await saveRuleDialog(page);

  const reassigned = await exportSettings<ExportedSettings>(page);
  expectSavedRule(reassigned, video);
  expectSavedRule(reassigned, clips);
  expect(reassigned.featureBindings).toEqual([
    bindingFor(VIDEO_HOST, SOCIAL_FEATURE, "manual"),
  ]);

  await openSavedRuleEditor(page, extensionId, VIDEO_HOST);
  await clickFeatureAction(page, "open");
  await clickFeatureAction(page, "detach");
  await expect(page.locator("[data-provider-feature-pending]")).toBeVisible();
  await expectFeatureDecision(page, videoDecision(null));
  const beforeDetach = await exportSettings<ExportedSettings>(page);
  expect(beforeDetach.featureBindings).toEqual(reassigned.featureBindings);
  await saveRuleDialog(page);

  const detached = await exportSettings<ExportedSettings>(page);
  expect(detached.featureBindings ?? []).toEqual([]);
  expect(detached.rules).toHaveLength(2);
  expectSavedRule(detached, video);
  expectSavedRule(detached, clips);
  await expectProviderQuiet(
    page,
    worker,
    [CLIPS_HOST, VIDEO_HOST],
    escapes,
    pageRequests,
  );
});

test("shares one product rule with a service through edit, restart, and import", async ({
  context,
  extensionId,
  serverUrl,
  secondaryServerUrl,
}) => {
  test.slow();
  const { page, worker, escapes, pageRequests } = await prepareProviderPage(
    context,
    extensionId,
    { hosts: [LOOPBACK_HOST, MEDIA_HOST] },
  );
  await openNewRuleDialog(page, extensionId);
  await fillRulePattern(page, LOOPBACK_HOST);
  await expectFeatureSlot(page, { state: "suggest", variant: "default" });
  await clickFeatureAction(page, "accept");
  await selectRuleProfile(page, "Warsaw", WARSAW_LOCATION_ID);
  await saveRuleDialog(page);
  const primary = savedIdentity(
    await exportSettings<ExportedSettings>(page),
    LOOPBACK_HOST,
  );

  await openNewRuleDialog(page, extensionId);
  await fillRulePattern(page, MEDIA_HOST);
  await expectFeatureSlot(page, { state: "join", variant: "default" });
  await clickFeatureAction(page, "join");
  await expectFeatureDecision(page, videoDecision(VIDEO_FEATURE, true));
  await selectRuleProfile(page, "Paris", PARIS_LOCATION_ID);
  await saveRuleDialog(page);

  const grouped = await exportSettings<ExportedSettings>(page);
  const shared: SavedIdentity = { ...primary, locationId: WARSAW_LOCATION_ID };
  expectSavedRule(grouped, shared);
  expectSavedRule(grouped, { ...shared, pattern: MEDIA_HOST });
  expect(grouped.featureBindings).toEqual([
    bindingFor(LOOPBACK_HOST, VIDEO_FEATURE, "domain-test", [
      LOOPBACK_HOST,
      MEDIA_HOST,
    ]),
  ]);
  expectExportSealed(grouped);

  const group = page.locator(`#rules-list tr[data-feature-group="${VIDEO_FEATURE}"]`);
  await expect(group).toHaveCount(1);
  await expect(group.locator("[data-provider-initials]")).toHaveAttribute(
    "data-provider-initials",
    "CD",
  );
  await expect(group.locator("[data-rule-hosts] span")).toHaveText([
    LOOPBACK_HOST,
    MEDIA_HOST,
  ]);
  await expect(
    page.getByRole("button", { name: `Edit rule ${MEDIA_HOST}`, exact: true }),
  ).toHaveCount(0);

  await openSavedRuleEditor(page, extensionId, LOOPBACK_HOST);
  await expect(page.locator("[data-rule-host-input]")).toHaveValue(MEDIA_HOST);
  await selectRuleProfile(page, "Paris", PARIS_LOCATION_ID);
  await expectNoFeatureDecision(page);
  await saveRuleDialog(page);
  const edited = await exportSettings<ExportedSettings>(page);
  const propagated: SavedIdentity = { ...shared, locationId: PARIS_LOCATION_ID };
  expectSavedRule(edited, propagated);
  expectSavedRule(edited, { ...propagated, pattern: MEDIA_HOST });
  expect(edited.featureBindings).toEqual(grouped.featureBindings);

  const probe = await openProbe(context, serverUrl);
  const popup = await openPopupWithDefaults(context, extensionId, probe);
  await expect(popup.locator("#current-rule")).toHaveAttribute(
    "data-presentation",
    "rule-active",
  );
  await expect(
    popup.locator("[data-provider-decorators] [data-provider-initials]"),
  ).toHaveAttribute("data-provider-initials", "CD");
  await expect(popup.locator("[data-provider-feature-site-count]")).toHaveCount(0);
  const popupState = await getPopupState<PopupState>(popup);
  expect(popupState.decorators?.[0]).toEqual(
    expect.objectContaining({
      providerId: CONTROL_D_PROVIDER_ID,
      initials: "CD",
      featureId: VIDEO_FEATURE,
    }),
  );
  expect(popupState.groupPatterns).toEqual([LOOPBACK_HOST, MEDIA_HOST]);
  await popup.locator("#open-rule-settings").click();
  await expect(popup.locator("[data-rule-hosts]")).toBeVisible();
  await expect(popup.locator("[data-rule-host]")).toHaveCount(2);
  await expect(popup.locator("[data-rule-host]").nth(0)).toHaveAttribute(
    "data-rule-host",
    LOOPBACK_HOST,
  );
  await expect(popup.locator("[data-rule-host]").nth(1)).toHaveAttribute(
    "data-rule-host",
    MEDIA_HOST,
  );
  await popup.close();
  await expectHostUnprotected(
    context,
    extensionId,
    await openProbe(context, secondaryServerUrl),
    LOCAL_HOST,
  );

  await openSavedRuleEditor(page, extensionId, LOOPBACK_HOST);
  await page.locator("#dialog-rule-enabled").click();
  await expect(page.locator("#dialog-rule-enabled")).toHaveAttribute(
    "data-state",
    "unchecked",
  );
  await saveRuleDialog(page);
  const disabled = await exportSettings<ExportedSettings>(page);
  const inactive: SavedIdentity = { ...propagated, enabled: false };
  expectSavedRule(disabled, inactive);
  expectSavedRule(disabled, { ...inactive, pattern: MEDIA_HOST });
  expect(disabled.featureBindings).toEqual(grouped.featureBindings);

  await page.reload();
  const reloaded = await exportSettings<ExportedSettings>(page);
  expect(reloaded.rules).toEqual(disabled.rules);
  expect(reloaded.featureBindings).toEqual(disabled.featureBindings);
  await expectProviderQuiet(
    page,
    worker,
    [LOOPBACK_HOST, MEDIA_HOST],
    escapes,
    pageRequests,
  );

  const restarted = await restartExtensionWorker(context, extensionId);
  const afterRestart = await exportSettings<ExportedSettings>(restarted);
  expect(afterRestart.rules).toEqual(disabled.rules);
  expect(afterRestart.featureBindings).toEqual(disabled.featureBindings);

  await saveLocationModel(restarted, {
    locations: afterRestart.locations,
    rules: [],
  });
  expect(
    (await exportSettings<ExportedSettings>(restarted)).featureBindings ?? [],
  ).toEqual([]);
  await importSettings(restarted, { ...disabled, onboardingCompleted: true });
  const imported = await exportSettings<ExportedSettings>(restarted);
  expect(imported.rules).toEqual(disabled.rules);
  expect(imported.featureBindings).toEqual(disabled.featureBindings);
  expectExportSealed(imported);

  await restarted.goto(`chrome-extension://${extensionId}/src/ui/options/index.html`);
  await openSettingsTab(restarted, "rules");
  await openSavedRuleEditor(restarted, extensionId, LOOPBACK_HOST);
  await clickFeatureAction(restarted, "open");
  await clickFeatureAction(restarted, "detach");
  await saveRuleDialog(restarted);
  const unlinked = await exportSettings<ExportedSettings>(restarted);
  expect(unlinked.featureBindings ?? []).toEqual([]);
  expect(unlinked.rules).toEqual(imported.rules);
  await expect(restarted.locator("#rules-list tr[data-rule-group]")).toHaveCount(1);
  await restarted
    .getByRole("button", { name: `Delete rule ${LOOPBACK_HOST}`, exact: true })
    .click();
  await expect(restarted.locator("#confirm-dialog")).toBeVisible();
  await restarted.locator("#confirm-dialog-confirm").click();
  await expect(restarted.locator("#confirm-dialog")).toHaveCount(0);
  const removed = await exportSettings<ExportedSettings>(restarted);
  expect(removed.rules).toEqual([]);
  expect(removed.featureBindings ?? []).toEqual([]);
  expect(escapes).toEqual([]);
  expect(pageRequests).toEqual([]);
});

test("stages a popup draft until save and then shows the summary badge", async ({
  context,
  extensionId,
  serverUrl,
  secondaryServerUrl,
}) => {
  test.slow();
  const { page, worker, escapes, pageRequests } = await prepareProviderPage(
    context,
    extensionId,
    { hosts: [LOCAL_HOST] },
  );
  const probe = await openProbe(context, secondaryServerUrl);
  const popup = await openPopupWithDefaults(context, extensionId, probe);
  await expect(popup.locator("#current-rule")).toHaveAttribute(
    "data-presentation",
    "fallback-inactive",
  );
  await expect(popup.locator("[data-provider-decorators]")).toHaveCount(0);
  await expect(popup.locator("#open-domain-rule-settings")).toBeEnabled();
  await popup.locator("#open-domain-rule-settings").click();
  await expect(popup.locator("#close-rule-settings")).toBeVisible();
  await expectFeatureSlot(popup, { state: "suggest", variant: "compact" });
  await clickFeatureAction(popup, "accept");
  await expectFeatureDecision(popup, videoDecision(VIDEO_FEATURE));
  const staged = await exportSettings<ExportedSettings>(page);
  expect(staged.rules).toEqual([]);
  expect(staged.featureBindings ?? []).toEqual([]);

  await popup.locator("#close-rule-settings").click();
  await expect(popup.locator("#close-rule-settings")).toBeHidden();
  const cancelled = await exportSettings<ExportedSettings>(page);
  expect(cancelled.rules).toEqual([]);
  expect(cancelled.featureBindings ?? []).toEqual([]);

  await popup.locator("#open-domain-rule-settings").click();
  await expectFeatureSlot(popup, { state: "suggest", variant: "compact" });
  expect(await readControlDQueries(worker)).toHaveLength(1);
  await clickFeatureAction(popup, "accept");
  await popup.locator("#apply-current-profile").click();
  await expect(popup.locator("#close-rule-settings")).toBeHidden();

  const saved = await exportSettings<ExportedSettings>(page);
  const pattern = `*${LOCAL_HOST}`;
  expect(saved.rules).toEqual([expect.objectContaining({ pattern, enabled: true })]);
  expect(saved.featureBindings).toEqual([
    bindingFor(pattern, VIDEO_FEATURE, "domain-test"),
  ]);
  expectExportSealed(saved);
  await expect(popup.locator("#current-rule")).toHaveAttribute(
    "data-presentation",
    "rule-active",
  );
  await expect(
    popup.locator("[data-provider-decorators] [data-provider-initials]"),
  ).toHaveAttribute("data-provider-initials", "CD");
  await expect(popup.locator("[data-provider-feature-site-count]")).toHaveCount(0);
  await expectPageHasNoProvider(probe);
  await expectHostUnprotected(
    context,
    extensionId,
    await openProbe(context, serverUrl),
    LOOPBACK_HOST,
  );
  await expectProviderQuiet(page, worker, [LOCAL_HOST], escapes, pageRequests);
});

test("owns a three-site rule independently of provider assignments", async ({
  context,
  extensionId,
}) => {
  test.slow();
  const { page, worker, escapes, pageRequests } = await prepareProviderPage(
    context,
    extensionId,
    { hosts: [] },
  );
  const disconnected = await page.evaluate(
    async (type) => chrome.runtime.sendMessage({ type }),
    CONTROL_D_COMMANDS.disconnect,
  );
  expect(disconnected.ok).toBe(true);
  await page.reload();
  const hosts = ["one.example.test", "two.example.test", "three.example.test"];
  await openNewRuleDialog(page, extensionId);
  await fillRulePattern(page, hosts[0]!);
  for (const host of hosts.slice(1)) {
    await page.locator('[data-rule-host-action="add"]').click();
    await page.locator("[data-rule-host-input]").last().fill(host);
  }
  await selectRuleProfile(page, "Warsaw", WARSAW_LOCATION_ID);
  await saveRuleDialog(page);
  const saved = await exportSettings<ExportedSettings>(page);
  expect(saved.rules.map((rule) => rule.pattern)).toEqual(hosts);
  expect(saved.featureBindings ?? []).toEqual([]);
  const identity = savedIdentity(saved, hosts[0]!);
  const groupId = saved.rules[0]?.groupId;
  expect(groupId).toEqual(expect.any(String));
  for (const rule of saved.rules) {
    expect(rule.groupId).toBe(groupId);
    expectSavedRule(saved, { ...identity, pattern: rule.pattern });
  }
  const row = page.locator("#rules-list tr[data-rule-group]");
  await expect(row).toHaveCount(1);
  await expect(row.locator("[data-rule-host]")).toHaveText(hosts);
  await expect(row.locator("[data-provider-initials]")).toHaveCount(0);
  await openSavedRuleEditor(page, extensionId, hosts[0]!);
  await expect(page.locator("[data-rule-host-input]")).toHaveCount(2);
  await expect(page.locator("[data-rule-host-input]").nth(0)).toHaveValue(hosts[1]!);
  await expect(page.locator("[data-rule-host-input]").nth(1)).toHaveValue(hosts[2]!);
  await page.locator('[data-rule-host-action="remove"]').last().click();
  await selectRuleProfile(page, "Paris", PARIS_LOCATION_ID);
  await page.locator("#dialog-rule-enabled").click();
  await saveRuleDialog(page);
  const edited = await exportSettings<ExportedSettings>(page);
  expect(edited.rules.map((rule) => rule.pattern)).toEqual(hosts.slice(0, 2));
  for (const rule of edited.rules) {
    expect(rule.groupId).toBe(groupId);
    expectSavedRule(edited, {
      ...identity,
      pattern: rule.pattern,
      locationId: PARIS_LOCATION_ID,
      enabled: false,
    });
  }
  await expectProviderQuiet(page, worker, [], escapes, pageRequests);
  const restarted = await restartExtensionWorker(context, extensionId);
  expect((await exportSettings<ExportedSettings>(restarted)).rules).toEqual(
    edited.rules,
  );
  await saveLocationModel(restarted, { locations: edited.locations, rules: [] });
  await importSettings(restarted, { ...edited, onboardingCompleted: true });
  const imported = await exportSettings<ExportedSettings>(restarted);
  expect(imported.rules).toEqual(edited.rules);
  expect(imported.featureBindings ?? []).toEqual([]);
  expect(escapes).toEqual([]);
  expect(pageRequests).toEqual([]);
});
