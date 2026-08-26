export const STYLE_PROMPT = `centered, large, filling most of the frame, \
isolated on a pure white background, \
clean bold-line cartoon illustration, simple rounded contours, \
smooth thick uniform black outlines, clean closed vector outlines, \
coloring book style, high-contrast 2D drawing reference for kids, \
friendly chunky proportions, flat 2D orthographic view, \
no shading, no gradient, no shadows, no background details, no color, black and white line art`;

export const NEGATIVE_SUFFIX = `Do NOT include: cropped edges, cutoff lines, \
wobbly lines, shaky strokes, hand-drawn scribbles, sketchy lines, \
shading, gradients, drop shadows, 3D perspective, angled perspective, \
gray tones, color, watercolor, crosshatching, texture, patterns, \
multiple subjects, text, letters, watermarks, borders, frames, thin lines, \
panel lines, body seams, door cuts, rivets, grille slats, small windows, \
mechanical detail, technical drawing, realistic proportions, scary imagery, background details.`;

export const PRESETS = {
  organic: {
    id: "organic",
    name: "Organic (Animals, Plants, Food, People)",
    description: "Natural forms with friendly proportions and flat 2D perspective",
    stylePrompt: STYLE_PROMPT,
    negativeSuffix: NEGATIVE_SUFFIX,
    exampleSubject: "cute cartoon sleeping cat lying down peacefully with head on paws, side view",
  },
  detail_prone: {
    id: "detail_prone",
    name: "Detail-Prone (Vehicles, Buildings, Machines)",
    description: "Enforces strict geometric decomposition, orthogonal elevation, and blank canvas bodies",
    stylePrompt: STYLE_PROMPT,
    negativeSuffix: NEGATIVE_SUFFIX,
    exampleSubject: "semi truck made of a small square cab on the left and a long blank rectangular trailer on the right, two round wheels under the cab and four round wheels under the trailer, strict orthogonal side profile view, the entire trailer body is completely blank empty canvas space with no logos, text, panel lines, or seams",
  },
  ultra_simple: {
    id: "ultra_simple",
    name: "Ultra-Simple (Toddler / 3-6 Strokes)",
    description: "Minimalist primitive shapes for very young children (ages 2-4)",
    stylePrompt: `centered, large, filling most of the frame, isolated on a pure white background, \
ultra-minimalist bold-line cartoon, 3-6 simple primitive geometric shapes, \
extra thick uniform black outlines, clean closed vector contours, \
toddler coloring book style, high-contrast reference, \
no shading, no gradient, no shadows, no background details, no color, black and white line art`,
    negativeSuffix: NEGATIVE_SUFFIX,
    exampleSubject: "smiling sun with a simple round circle face and 6 straight ray lines coming out",
  },
  detailed: {
    id: "detailed",
    name: "Detailed / Dynamic (Ages 6-8 / 12-18 Strokes)",
    description: "Multi-part shapes, expressive poses, and clear cartoon details for older kids",
    stylePrompt: `centered, large, filling most of the frame, isolated on a pure white background, \
clean bold-line cartoon illustration, expressive multi-part geometric shapes, \
smooth thick uniform black outlines, clean closed vector contours, \
coloring book style, high-contrast 2D drawing reference for older kids, \
dynamic friendly proportions, flat 2D view, roughly 12-18 bold strokes, \
no shading, no gradient, no shadows, no background details, no color, black and white line art`,
    negativeSuffix: NEGATIVE_SUFFIX,
    exampleSubject: "playful dog jumping to catch a frisbee, side profile",
  },
};

export function buildPrompt(subjectDescription, style = STYLE_PROMPT, negative = NEGATIVE_SUFFIX) {
  const desc = subjectDescription.trim().startsWith("A single") ? subjectDescription.trim() : `A single ${subjectDescription.trim()}`;
  return `${desc}, ${style}. ${negative}`;
}

export function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

