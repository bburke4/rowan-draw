export const STYLE_PROMPT = `centered, large, filling most of the frame, \
isolated on a pure white background, \
drawn the way a young child imagines it — chunky, exaggerated, toy-like proportions, \
oversized features, stubby and friendly, \
extremely simplified: outline plus 2-3 key feature lines only, \
roughly 10-15 bold strokes total, \
thick uniform black outlines, simple rounded geometric shapes, \
coloring book style, kids illustration, no shading, no gradient, \
no background details, no color, black and white line art`;

export const NEGATIVE_SUFFIX = `Do NOT include: shading, gradients, shadows, gray tones, \
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
