export function checkHeading(str) {
  if (!str) return false;
  return /^\*\*(.*?)\*\*$/.test(str.trim());
}

export function replaceHeadingStarts(str) {
  if (!str) return "";
  return str.trim().replace(/^\*\*|\*\*$/g, "");
}
