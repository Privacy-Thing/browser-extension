import { existsSync } from "node:fs";
import process from "node:process";

const FIREFOX_INSTALL_GUIDANCE =
  "Unable to resolve a Firefox executable. Run `pnpm exec playwright install firefox` or set `FIREFOX_EXECUTABLE_PATH`.";

const trimEnvironmentValue = (value) => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : null;
};

const assertExistingFxBinary = (candidatePath, sourceLabel) => {
  if (existsSync(candidatePath)) {
    return candidatePath;
  }

  throw new Error(
    `${sourceLabel} points to a missing Firefox executable: ${candidatePath}. ${FIREFOX_INSTALL_GUIDANCE}`,
  );
};

const resolvePlaywrightFx = async () => {
  const { firefox } = await import("@playwright/test");
  const candidatePath = trimEnvironmentValue(firefox.executablePath());

  if (candidatePath == null) {
    return null;
  }

  return existsSync(candidatePath) ? candidatePath : null;
};

export const getFxBinaryGuidance = () => FIREFOX_INSTALL_GUIDANCE;

export const resolveRequiredFxBinary = async (contextLabel = "Firefox workflow") => {
  const configuredFxBinaryPath = trimEnvironmentValue(
    process.env.FIREFOX_EXECUTABLE_PATH,
  );
  if (configuredFxBinaryPath != null) {
    return assertExistingFxBinary(configuredFxBinaryPath, "FIREFOX_EXECUTABLE_PATH");
  }

  const configuredFxBinary = trimEnvironmentValue(process.env.PT_FIREFOX_BINARY);
  if (configuredFxBinary != null) {
    return assertExistingFxBinary(configuredFxBinary, "PT_FIREFOX_BINARY");
  }

  const playwrightFirefoxBinary = await resolvePlaywrightFx();
  if (playwrightFirefoxBinary != null) {
    return playwrightFirefoxBinary;
  }

  throw new Error(`${contextLabel}: ${FIREFOX_INSTALL_GUIDANCE}`);
};
