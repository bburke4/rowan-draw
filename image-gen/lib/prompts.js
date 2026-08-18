export const STYLE_PROMPT = `centered, large, filling most of the frame, \
isolated on a pure white background, \
clean bold-line cartoon illustration, simple rounded geometric shapes, \
smooth thick uniform black outlines, coloring book style, high-contrast reference art for kids, \
friendly chunky proportions, roughly 10-15 bold strokes total, \
no shading, no gradient, no background details, no color, black and white line art`;

export const NEGATIVE_SUFFIX = `Do NOT include: wobbly lines, shaky strokes, hand-drawn scribbles, \
crooked lines, messy strokes, shading, gradients, shadows, gray tones, \
color, watercolor, crosshatching, texture, patterns, multiple subjects, \
text, watermarks, borders, frames, thin lines, \
panel lines, body seams, door cuts, rivets, grille slats, small windows, \
mechanical detail, technical drawing, realistic proportions, \
scary imagery, background details.`;

export function buildPrompt(subjectDescription) {
  return `A single ${subjectDescription}, ${STYLE_PROMPT}. ${NEGATIVE_SUFFIX}`;
}

export function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
