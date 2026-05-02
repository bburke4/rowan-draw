export const STYLE_PROMPT = `centered, large, filling most of the frame, \
isolated on a pure white background, \
minimalist bold-line cartoon, thick black outlines, simple geometric shapes, \
coloring book style, kids illustration, no shading, no gradient, \
no background details, no color, black and white line art`;

export const NEGATIVE_SUFFIX = `Do NOT include: shading, gradients, shadows, gray tones, \
color, watercolor, crosshatching, texture, patterns, multiple subjects, \
text, watermarks, borders, frames, thin lines, realistic proportions, \
scary imagery, background details.`;

export function buildPrompt(subjectDescription) {
  return `A single ${subjectDescription}, ${STYLE_PROMPT}. ${NEGATIVE_SUFFIX}`;
}

export function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
