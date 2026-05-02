import { runExpand } from "./steps/expand.js";
import { runGenerate } from "./steps/generate.js";
import { runTag } from "./steps/tag.js";
import { runPublish } from "./steps/publish.js";
import { runReview } from "./review/server.js";
import { readCatalog, readState, readManifest } from "./lib/state.js";

function parseFlags(args) {
  const flags = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith("--")) {
      const raw = args[i].slice(2);
      // Handle --key=value syntax
      if (raw.includes("=")) {
        const [key, ...rest] = raw.split("=");
        flags[key] = rest.join("=");
      } else if (!args[i + 1] || args[i + 1].startsWith("--")) {
        flags[raw] = true;
      } else {
        flags[raw] = args[i + 1];
        i++;
      }
    }
  }
  return flags;
}

async function runStatus() {
  const catalog = readCatalog();
  const variants = readState("variants.json", { variants: {} });
  const generation = readState("generation.json", { generated: {}, totalCost: 0, totalImages: 0 });
  const review = readState("review.json", { decisions: {}, skipped: [], feedback: {} });
  const tagging = readState("tagging.json", { tagged: {} });
  const manifest = readManifest();

  // Catalog stats
  let totalCategories = 0;
  let totalSubjects = 0;
  for (const { subjects } of Object.values(catalog.categories)) {
    totalCategories++;
    totalSubjects += subjects.length;
  }

  // Variant stats
  const expandedSubjects = Object.keys(variants.variants).length;
  let totalVariants = 0;
  for (const v of Object.values(variants.variants)) {
    totalVariants += v.length;
  }

  // Generation stats
  const generatedVariants = Object.keys(generation.generated).length;
  const pendingGeneration = totalVariants - generatedVariants;

  // Review stats (decisions is now { variantKey: imagePath })
  const picked = Object.keys(review.decisions).length;
  const skipped = review.skipped?.length || 0;
  const reviewableVariants = Object.values(generation.generated).filter(g => !g.refused && g.images.length > 0).length;
  const pendingReview = reviewableVariants - picked - skipped;

  // Tagging stats
  const tagged = Object.keys(tagging.tagged).length;

  // Manifest stats
  const published = Object.keys(manifest.images).length;

  console.log("Pipeline Status:");
  console.log(`  Catalog:   ${totalCategories} categories, ${totalSubjects} subjects`);
  console.log(`  Variants:  ${expandedSubjects}/${totalSubjects} subjects expanded, ${totalVariants} total variants`);
  console.log(`  Generated: ${generatedVariants}/${totalVariants} variants (${pendingGeneration} pending), $${generation.totalCost.toFixed(2)} spent`);
  console.log(`  Review:    ${picked} picked, ${skipped} skipped, ${pendingReview} pending`);
  console.log(`  Tagged:    ${tagged}/${picked} picked images tagged`);
  console.log(`  Published: ${published} in manifest`);
}

function printUsage() {
  console.log(`Usage: node cli.js <command> [flags]

Commands:
  expand      Brainstorm variants for new subjects (LLM)
              --category <name>   Only expand subjects in this category
              --subject <name>    Only expand this subject
              --force             Re-expand even if variants already exist

  generate    Generate images for new variants (Imagen API)
              --dry-run           Show what would be generated + cost estimate
              --limit <n>         Max variants to generate
              --category <name>   Only generate for this category
              --subject <name>    Only generate for this subject
              --force             Regenerate (skips picked/published variants)

  review      Start the review web UI (localhost:3456)

  tag         Score difficulty + generate search tags for picked images
              --dry-run           Show what would be tagged

  publish     Copy picked+tagged images to library and update manifest
              --dry-run           Show what would be published

  status      Show pipeline progress summary
`);
}

const command = process.argv[2];
const flags = parseFlags(process.argv.slice(3));

switch (command) {
  case "expand":   await runExpand(flags); break;
  case "generate": await runGenerate(flags); break;
  case "review":   await runReview(flags); break;
  case "tag":      await runTag(flags); break;
  case "publish":  await runPublish(flags); break;
  case "status":   await runStatus(); break;
  default:         printUsage();
}
