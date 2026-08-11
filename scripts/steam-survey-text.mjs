/** Extracts plain survey labels without treating remote markup as renderable HTML. */
export const extractSteamSurveyText = (value) => {
  let output = "";
  let insideTag = false;

  for (const character of value) {
    if (character === "<") {
      insideTag = true;
      output += " ";
      continue;
    }
    if (character === ">") {
      insideTag = false;
      output += " ";
      continue;
    }
    if (!insideTag) output += character === "\u00a0" ? " " : character;
  }

  return output.replace(/\s+/g, " ").trim();
};
