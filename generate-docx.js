const fs = require('fs');
const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
        Header, Footer, AlignmentType, LevelFormat, ExternalHyperlink,
        HeadingLevel, BorderStyle, WidthType, ShadingType, VerticalAlign,
        PageNumber, PageBreak, TableOfContents } = require('docx');

// ── Colors ──
const C = {
  primary: "C45D3E",
  primaryDark: "A34A30",
  secondary: "8B9E7C",
  accent: "E8A838",
  text: "3D2B1F",
  textLight: "6B5B50",
  white: "FFFFFF",
  bgLight: "FFF8F0",
  bgAlt: "FEF3E2",
  supabase: "3ECF8E",
  vercel: "000000",
  google: "4285F4",
  border: "E8DDD0",
  codeBg: "2D2D2D",
  codeText: "F8F8F2",
};

const tBorder = { style: BorderStyle.SINGLE, size: 1, color: C.border };
const cellBorders = { top: tBorder, bottom: tBorder, left: tBorder, right: tBorder };
const noBorder = { style: BorderStyle.NONE, size: 0 };
const noBorders = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder };

function headerCell(text, width, color = C.primary) {
  return new TableCell({
    borders: cellBorders,
    width: { size: width, type: WidthType.DXA },
    shading: { fill: color, type: ShadingType.CLEAR },
    verticalAlign: VerticalAlign.CENTER,
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 60, after: 60 },
      children: [new TextRun({ text, bold: true, color: C.white, size: 20, font: "Arial" })]
    })]
  });
}

function dataCell(text, width, opts = {}) {
  return new TableCell({
    borders: cellBorders,
    width: { size: width, type: WidthType.DXA },
    shading: opts.shade ? { fill: C.bgLight, type: ShadingType.CLEAR } : undefined,
    verticalAlign: VerticalAlign.CENTER,
    children: [new Paragraph({
      spacing: { before: 40, after: 40 },
      children: [new TextRun({
        text, size: 19, font: "Arial",
        bold: opts.bold || false,
        color: opts.color || C.text
      })]
    })]
  });
}

function codeCell(text, width) {
  return new TableCell({
    borders: cellBorders,
    width: { size: width, type: WidthType.DXA },
    shading: { fill: C.codeBg, type: ShadingType.CLEAR },
    children: [new Paragraph({
      spacing: { before: 60, after: 60 },
      indent: { left: 100 },
      children: [new TextRun({ text, size: 17, font: "Courier New", color: C.codeText })]
    })]
  });
}

function spacer(height = 100) {
  return new Paragraph({ spacing: { before: height }, children: [] });
}

function sectionTitle(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 300, after: 100 },
    children: [new TextRun({ text })]
  });
}

function subTitle(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 200, after: 80 },
    children: [new TextRun({ text })]
  });
}

function bodyText(text, opts = {}) {
  return new Paragraph({
    spacing: { after: 80 },
    children: [new TextRun({ text, size: 20, font: "Arial", color: C.text, ...opts })]
  });
}

function richBody(parts) {
  return new Paragraph({
    spacing: { after: 80 },
    children: parts.map(p => new TextRun({ size: 20, font: "Arial", color: C.text, ...p }))
  });
}

const doc = new Document({
  styles: {
    default: { document: { run: { font: "Arial", size: 20 } } },
    paragraphStyles: [
      { id: "Title", name: "Title", basedOn: "Normal",
        run: { size: 56, bold: true, color: C.primary, font: "Georgia" },
        paragraph: { spacing: { before: 0, after: 120 }, alignment: AlignmentType.CENTER } },
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 30, bold: true, color: C.primary, font: "Georgia" },
        paragraph: { spacing: { before: 300, after: 120 }, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 24, bold: true, color: C.primaryDark, font: "Georgia" },
        paragraph: { spacing: { before: 200, after: 80 }, outlineLevel: 1 } },
    ]
  },
  numbering: {
    config: [
      { reference: "bullets", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•",
        alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
      { reference: "steps-1", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.",
        alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
      { reference: "steps-2", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.",
        alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
      { reference: "steps-3", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.",
        alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
      { reference: "steps-4", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.",
        alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
      { reference: "takeaways", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.",
        alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
    ]
  },
  sections: [
    // ══════════════ COVER PAGE ══════════════
    {
      properties: {
        page: { margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } }
      },
      headers: {
        default: new Header({ children: [new Paragraph({ children: [] })] })
      },
      footers: {
        default: new Footer({ children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({ text: "Sweet Crumbs Setup Guide  |  Page ", size: 16, color: C.textLight, font: "Arial" }),
            new TextRun({ children: [PageNumber.CURRENT], size: 16, color: C.textLight, font: "Arial" }),
          ]
        })] })
      },
      children: [
        spacer(600),

        // Decorative line using paragraph border
        new Paragraph({
          spacing: { after: 0 },
          border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: C.primary, space: 1 } },
          children: []
        }),

        spacer(200),

        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: "🧁", size: 80 })]
        }),
        new Paragraph({
          heading: HeadingLevel.TITLE,
          children: [new TextRun("Sweet Crumbs")]
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
          children: [new TextRun({ text: "Baking Blog — Full Setup Guide", size: 26, color: C.textLight, font: "Georgia" })]
        }),

        spacer(100),

        // Tech stack badges table
        new Table({
          columnWidths: [2340, 2340, 2340, 2340],
          rows: [new TableRow({ children: [
            new TableCell({ borders: { ...cellBorders, top: { ...tBorder, color: C.supabase }, bottom: { ...tBorder, color: C.supabase }, left: { ...tBorder, color: C.supabase }, right: { ...tBorder, color: C.supabase } },
              width: { size: 2340, type: WidthType.DXA }, shading: { fill: "E8F8F0", type: ShadingType.CLEAR },
              verticalAlign: VerticalAlign.CENTER,
              children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Supabase", bold: true, size: 20, color: C.supabase, font: "Arial" })] })] }),
            new TableCell({ borders: { ...cellBorders, top: { ...tBorder, color: C.vercel }, bottom: { ...tBorder, color: C.vercel }, left: { ...tBorder, color: C.vercel }, right: { ...tBorder, color: C.vercel } },
              width: { size: 2340, type: WidthType.DXA }, shading: { fill: "F0F0F0", type: ShadingType.CLEAR },
              verticalAlign: VerticalAlign.CENTER,
              children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Vercel", bold: true, size: 20, color: C.vercel, font: "Arial" })] })] }),
            new TableCell({ borders: { ...cellBorders, top: { ...tBorder, color: C.google }, bottom: { ...tBorder, color: C.google }, left: { ...tBorder, color: C.google }, right: { ...tBorder, color: C.google } },
              width: { size: 2340, type: WidthType.DXA }, shading: { fill: "E8F0FF", type: ShadingType.CLEAR },
              verticalAlign: VerticalAlign.CENTER,
              children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Google Auth", bold: true, size: 20, color: C.google, font: "Arial" })] })] }),
            new TableCell({ borders: { ...cellBorders, top: { ...tBorder, color: C.accent }, bottom: { ...tBorder, color: C.accent }, left: { ...tBorder, color: C.accent }, right: { ...tBorder, color: C.accent } },
              width: { size: 2340, type: WidthType.DXA }, shading: { fill: "FFF8E8", type: ShadingType.CLEAR },
              verticalAlign: VerticalAlign.CENTER,
              children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "OmniRoute", bold: true, size: 20, color: C.accent, font: "Arial" })] })] }),
          ] })]
        }),

        spacer(200),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 100 },
          children: [new TextRun({ text: "A complete walkthrough of building a production baking blog", size: 20, color: C.textLight, font: "Arial" })]
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: "with database, authentication, deployment, and browser automation.", size: 20, color: C.textLight, font: "Arial" })]
        }),

        spacer(300),

        // Bottom line using paragraph border
        new Paragraph({
          spacing: { after: 0 },
          border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: C.primary, space: 1 } },
          children: []
        }),

        new Paragraph({ children: [new PageBreak()] }),

        // ══════════════ TABLE OF CONTENTS ══════════════
        sectionTitle("Table of Contents"),
        new TableOfContents("Table of Contents", { hyperlink: true, headingStyleRange: "1-2" }),

        new Paragraph({ children: [new PageBreak()] }),

        // ══════════════ STEP 1: SUPABASE ══════════════
        sectionTitle("1. Supabase Project Setup"),
        bodyText("Supabase provides a PostgreSQL database with a built-in REST API (PostgREST). We created a project, defined a recipes table, configured security, and seeded 4 recipes."),

        subTitle("Project Configuration"),
        new Table({
          columnWidths: [3000, 6360],
          rows: [
            new TableRow({ children: [headerCell("Property", 3000), headerCell("Value", 6360)] }),
            new TableRow({ children: [dataCell("Project Name", 3000, { bold: true, shade: true }), dataCell("baking-blog-recipes", 6360, { shade: true })] }),
            new TableRow({ children: [dataCell("Project ID", 3000, { bold: true }), dataCell("bynfesgbvgcmkpnwysil", 6360)] }),
            new TableRow({ children: [dataCell("Region", 3000, { bold: true, shade: true }), dataCell("ap-south-1 (Mumbai)", 6360, { shade: true })] }),
            new TableRow({ children: [dataCell("URL", 3000, { bold: true }), dataCell("https://bynfesgbvgcmkpnwysil.supabase.co", 6360)] }),
            new TableRow({ children: [dataCell("Tier", 3000, { bold: true, shade: true }), dataCell("Free", 6360, { shade: true })] }),
          ]
        }),

        spacer(100),
        subTitle("Table Schema"),
        new Table({
          columnWidths: [9360],
          rows: [new TableRow({ children: [
            new TableCell({ borders: cellBorders, width: { size: 9360, type: WidthType.DXA },
              shading: { fill: C.codeBg, type: ShadingType.CLEAR },
              children: [
                new Paragraph({ spacing: { after: 0 }, children: [new TextRun({ text: "CREATE TABLE recipes (", size: 17, font: "Courier New", color: C.codeText })] }),
                new Paragraph({ spacing: { after: 0 }, children: [new TextRun({ text: "  id           TEXT PRIMARY KEY,", size: 17, font: "Courier New", color: C.codeText })] }),
                new Paragraph({ spacing: { after: 0 }, children: [new TextRun({ text: "  title        TEXT NOT NULL,", size: 17, font: "Courier New", color: C.codeText })] }),
                new Paragraph({ spacing: { after: 0 }, children: [new TextRun({ text: "  image        TEXT,", size: 17, font: "Courier New", color: C.codeText })] }),
                new Paragraph({ spacing: { after: 0 }, children: [new TextRun({ text: "  category     TEXT NOT NULL,", size: 17, font: "Courier New", color: C.codeText })] }),
                new Paragraph({ spacing: { after: 0 }, children: [new TextRun({ text: '  "prepTime"   INTEGER NOT NULL,', size: 17, font: "Courier New", color: C.codeText })] }),
                new Paragraph({ spacing: { after: 0 }, children: [new TextRun({ text: '  "cookTime"   INTEGER NOT NULL,', size: 17, font: "Courier New", color: C.codeText })] }),
                new Paragraph({ spacing: { after: 0 }, children: [new TextRun({ text: "  servings     INTEGER NOT NULL,", size: 17, font: "Courier New", color: C.codeText })] }),
                new Paragraph({ spacing: { after: 0 }, children: [new TextRun({ text: "  difficulty   TEXT NOT NULL,", size: 17, font: "Courier New", color: C.codeText })] }),
                new Paragraph({ spacing: { after: 0 }, children: [new TextRun({ text: "  description  TEXT,", size: 17, font: "Courier New", color: C.codeText })] }),
                new Paragraph({ spacing: { after: 0 }, children: [new TextRun({ text: "  ingredients  JSONB DEFAULT '[]'::jsonb,", size: 17, font: "Courier New", color: C.codeText })] }),
                new Paragraph({ spacing: { after: 0 }, children: [new TextRun({ text: "  steps        JSONB DEFAULT '[]'::jsonb,", size: 17, font: "Courier New", color: C.codeText })] }),
                new Paragraph({ spacing: { after: 0 }, children: [new TextRun({ text: "  created_at   TIMESTAMPTZ DEFAULT now()", size: 17, font: "Courier New", color: C.codeText })] }),
                new Paragraph({ children: [new TextRun({ text: ");", size: 17, font: "Courier New", color: C.codeText })] }),
              ]
            })
          ] })]
        }),

        spacer(80),
        richBody([
          { text: "RLS enabled with public read policy. Data API grants configured for ", bold: false },
          { text: "anon", bold: true },
          { text: " role.", bold: false },
        ]),

        new Paragraph({ children: [new PageBreak()] }),

        // ══════════════ STEP 2: FRONTEND ══════════════
        sectionTitle("2. Frontend Integration"),
        bodyText("The frontend fetches recipes from Supabase using plain fetch() — no SDK needed. Each page loads data asynchronously with loading states and error handling."),

        subTitle("Data Flow"),
        new Table({
          columnWidths: [2340, 2340, 2340, 2340],
          rows: [new TableRow({ children: [
            new TableCell({ borders: cellBorders, width: { size: 2340, type: WidthType.DXA }, shading: { fill: C.primary, type: ShadingType.CLEAR }, verticalAlign: VerticalAlign.CENTER,
              children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Browser", bold: true, size: 18, color: C.white, font: "Arial" })] })] }),
            new TableCell({ borders: cellBorders, width: { size: 2340, type: WidthType.DXA }, shading: { fill: C.accent, type: ShadingType.CLEAR }, verticalAlign: VerticalAlign.CENTER,
              children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "fetch()", bold: true, size: 18, color: C.white, font: "Arial" })] })] }),
            new TableCell({ borders: cellBorders, width: { size: 2340, type: WidthType.DXA }, shading: { fill: C.supabase, type: ShadingType.CLEAR }, verticalAlign: VerticalAlign.CENTER,
              children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Supabase", bold: true, size: 18, color: C.white, font: "Arial" })] })] }),
            new TableCell({ borders: cellBorders, width: { size: 2340, type: WidthType.DXA }, shading: { fill: "336791", type: ShadingType.CLEAR }, verticalAlign: VerticalAlign.CENTER,
              children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "PostgreSQL", bold: true, size: 18, color: C.white, font: "Arial" })] })] }),
          ] })]
        }),

        spacer(100),
        subTitle("REST API Call Pattern"),
        new Table({
          columnWidths: [9360],
          rows: [new TableRow({ children: [
            new TableCell({ borders: cellBorders, width: { size: 9360, type: WidthType.DXA },
              shading: { fill: C.codeBg, type: ShadingType.CLEAR },
              children: [
                new Paragraph({ spacing: { after: 0 }, children: [new TextRun({ text: "const response = await fetch(", size: 17, font: "Courier New", color: C.codeText })] }),
                new Paragraph({ spacing: { after: 0 }, children: [new TextRun({ text: "  `${SUPABASE_URL}/rest/v1/recipes?select=*`,", size: 17, font: "Courier New", color: C.codeText })] }),
                new Paragraph({ spacing: { after: 0 }, children: [new TextRun({ text: "  {", size: 17, font: "Courier New", color: C.codeText })] }),
                new Paragraph({ spacing: { after: 0 }, children: [new TextRun({ text: "    headers: {", size: 17, font: "Courier New", color: C.codeText })] }),
                new Paragraph({ spacing: { after: 0 }, children: [new TextRun({ text: "      'apikey': SUPABASE_ANON_KEY,", size: 17, font: "Courier New", color: C.codeText })] }),
                new Paragraph({ spacing: { after: 0 }, children: [new TextRun({ text: "      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`", size: 17, font: "Courier New", color: C.codeText })] }),
                new Paragraph({ spacing: { after: 0 }, children: [new TextRun({ text: "    }", size: 17, font: "Courier New", color: C.codeText })] }),
                new Paragraph({ spacing: { after: 0 }, children: [new TextRun({ text: "  }", size: 17, font: "Courier New", color: C.codeText })] }),
                new Paragraph({ children: [new TextRun({ text: ");", size: 17, font: "Courier New", color: C.codeText })] }),
              ]
            })
          ] })]
        }),

        spacer(100),
        subTitle("Key Learning"),
        new Paragraph({ numbering: { reference: "bullets", level: 0 }, spacing: { after: 40 },
          children: [new TextRun({ text: "Endpoint: {SUPABASE_URL}/rest/v1/{table}?select=*", size: 19, font: "Arial" })] }),
        new Paragraph({ numbering: { reference: "bullets", level: 0 }, spacing: { after: 40 },
          children: [new TextRun({ text: "Headers required: apikey and Authorization (both use the anon key)", size: 19, font: "Arial" })] }),
        new Paragraph({ numbering: { reference: "bullets", level: 0 }, spacing: { after: 40 },
          children: [new TextRun({ text: "RLS policies control which rows are visible", size: 19, font: "Arial" })] }),
        new Paragraph({ numbering: { reference: "bullets", level: 0 }, spacing: { after: 40 },
          children: [new TextRun({ text: "Data API grants control whether the table is accessible at all", size: 19, font: "Arial" })] }),

        new Paragraph({ children: [new PageBreak()] }),

        // ══════════════ STEP 3: VERCEL ══════════════
        sectionTitle("3. Vercel Deployment"),
        bodyText("The baking blog is deployed on Vercel as a static site. Deployments happen instantly via the Vercel CLI."),

        new Table({
          columnWidths: [3000, 6360],
          rows: [
            new TableRow({ children: [headerCell("Property", 3000), headerCell("Value", 6360)] }),
            new TableRow({ children: [dataCell("Production URL", 3000, { bold: true, shade: true }), dataCell("https://baking-blog-three.vercel.app", 6360, { shade: true })] }),
            new TableRow({ children: [dataCell("Project ID", 3000, { bold: true }), dataCell("prj_Tn5Grdcjfm8csMr55dpl9z6xqmnL", 6360)] }),
            new TableRow({ children: [dataCell("Deploy Command", 3000, { bold: true, shade: true }), dataCell("npx vercel --prod --yes", 6360, { shade: true })] }),
          ]
        }),

        new Paragraph({ children: [new PageBreak()] }),

        // ══════════════ STEP 4: GOOGLE OAUTH ══════════════
        sectionTitle("4. Google OAuth Setup"),
        bodyText("Google authentication was set up across three systems: Google Cloud Console, Supabase Auth, and the frontend JavaScript."),

        subTitle("Authentication Flow"),
        new Table({
          columnWidths: [1560, 1560, 1560, 1560, 1560, 1560],
          rows: [new TableRow({ children: [
            new TableCell({ borders: cellBorders, width: { size: 1560, type: WidthType.DXA }, shading: { fill: C.primary, type: ShadingType.CLEAR }, verticalAlign: VerticalAlign.CENTER,
              children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "1. Click\nSign In", size: 15, color: C.white, font: "Arial" })] })] }),
            new TableCell({ borders: cellBorders, width: { size: 1560, type: WidthType.DXA }, shading: { fill: C.google, type: ShadingType.CLEAR }, verticalAlign: VerticalAlign.CENTER,
              children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "2. To Google", size: 15, color: C.white, font: "Arial" })] })] }),
            new TableCell({ borders: cellBorders, width: { size: 1560, type: WidthType.DXA }, shading: { fill: C.google, type: ShadingType.CLEAR }, verticalAlign: VerticalAlign.CENTER,
              children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "3. Login", size: 15, color: C.white, font: "Arial" })] })] }),
            new TableCell({ borders: cellBorders, width: { size: 1560, type: WidthType.DXA }, shading: { fill: C.supabase, type: ShadingType.CLEAR }, verticalAlign: VerticalAlign.CENTER,
              children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "4. Return", size: 15, color: C.white, font: "Arial" })] })] }),
            new TableCell({ borders: cellBorders, width: { size: 1560, type: WidthType.DXA }, shading: { fill: C.accent, type: ShadingType.CLEAR }, verticalAlign: VerticalAlign.CENTER,
              children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "5. Tokens", size: 15, color: C.white, font: "Arial" })] })] }),
            new TableCell({ borders: cellBorders, width: { size: 1560, type: WidthType.DXA }, shading: { fill: C.secondary, type: ShadingType.CLEAR }, verticalAlign: VerticalAlign.CENTER,
              children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "6. Profile", size: 15, color: C.white, font: "Arial" })] })] }),
          ] })]
        }),

        spacer(100),
        subTitle("Setup Steps"),
        new Paragraph({ numbering: { reference: "steps-1", level: 0 }, spacing: { after: 40 },
          children: [new TextRun({ text: "Google Cloud: OAuth consent screen (External) → Web Client ID → Redirect URI", size: 19, font: "Arial" })] }),
        new Paragraph({ numbering: { reference: "steps-1", level: 0 }, spacing: { after: 40 },
          children: [new TextRun({ text: "Supabase: Auth → Providers → Google → Paste Client ID + Secret → Save", size: 19, font: "Arial" })] }),
        new Paragraph({ numbering: { reference: "steps-1", level: 0 }, spacing: { after: 40 },
          children: [new TextRun({ text: "Remove localhost from redirect URLs. Add production URL only.", size: 19, font: "Arial" })] }),

        new Paragraph({ children: [new PageBreak()] }),

        // ══════════════ STEP 5: BUGS ══════════════
        sectionTitle("5. Bugs Fixed"),

        subTitle("Bug 1: Broken Images (404)"),
        richBody([{ text: "Problem: ", bold: true }, { text: "Vanilla cupcakes and banana bread images returned 404 from Unsplash." }]),
        richBody([{ text: "Fix: ", bold: true }, { text: "Replaced with working Unsplash photo IDs." }]),

        subTitle("Bug 2: Auth Redirect to localhost"),
        richBody([{ text: "Problem: ", bold: true }, { text: "After Google login, browser redirected to localhost:3000 instead of production." }]),
        richBody([{ text: "Fix: ", bold: true }, { text: "Hardcoded production URL in auth redirect + removed localhost from Supabase URLs." }]),

        subTitle("Bug 3: Duplicate const Declaration (CRITICAL)"),
        richBody([{ text: "Problem: ", bold: true }, { text: "Both auth.js and script.js declared const SUPABASE_URL — crashed entire script, no recipes loaded." }]),
        richBody([{ text: "Fix: ", bold: true }, { text: "Removed duplicate from script.js, kept only in auth.js." }]),
        richBody([{ text: "Lesson: ", bold: true, color: C.primary }, { text: "Multiple <script> tags share scope. Duplicate const = TypeError." }]),

        subTitle("Bug 4: User Profile Not Showing"),
        richBody([{ text: "Problem: ", bold: true }, { text: "Supabase API returns raw_user_meta_data, not user_metadata." }]),
        richBody([{ text: "Fix: ", bold: true }, { text: "Check both field names + JWT decode fallback." }]),

        new Paragraph({ children: [new PageBreak()] }),

        // ══════════════ STEP 6: PLAYWRIGHT ══════════════
        sectionTitle("6. Playwright MCP Setup"),
        bodyText("Playwright MCP enables browser automation for testing. The key insight: shell script calls create new HTTP sessions (losing browser context), while a registered MCP server uses persistent stdio connections."),

        subTitle("Comparison"),
        new Table({
          columnWidths: [2340, 2340, 2340, 2340],
          rows: [
            new TableRow({ children: [headerCell("Approach", 2340), headerCell("Transport", 2340), headerCell("Context", 2340), headerCell("Result", 2340)] }),
            new TableRow({ children: [
              dataCell("Shell scripts", 2340, { shade: true }),
              dataCell("HTTP (new per call)", 2340, { shade: true }),
              dataCell("Lost between calls", 2340, { shade: true }),
              dataCell("✘ Blank screenshots", 2340, { shade: true, color: "CC0000" }),
            ] }),
            new TableRow({ children: [
              dataCell("MCP server", 2340),
              dataCell("Stdio (persistent)", 2340),
              dataCell("Maintained", 2340),
              dataCell("✔ Working automation", 2340, { color: "008800" }),
            ] }),
          ]
        }),

        new Paragraph({ children: [new PageBreak()] }),

        // ══════════════ STEP 7: OMNIROUTE ══════════════
        sectionTitle("7. OmniRoute (AI Gateway)"),
        bodyText("OmniRoute is a free AI gateway that proxies requests to 36+ providers. It handles OAuth token management for Claude Code with automatic background refresh."),

        subTitle("Fixing 401 Token Errors"),
        bodyText("When Claude Code shows \"401: You need to sign in to use this model\":"),
        new Paragraph({ numbering: { reference: "steps-2", level: 0 }, spacing: { after: 40 },
          children: [new TextRun({ text: "Open OmniRoute dashboard: http://localhost:20128", size: 19, font: "Arial" })] }),
        new Paragraph({ numbering: { reference: "steps-2", level: 0 }, spacing: { after: 40 },
          children: [new TextRun({ text: "Go to Providers", size: 19, font: "Arial" })] }),
        new Paragraph({ numbering: { reference: "steps-2", level: 0 }, spacing: { after: 40 },
          children: [new TextRun({ text: "Find the Claude/Anthropic provider", size: 19, font: "Arial" })] }),
        new Paragraph({ numbering: { reference: "steps-2", level: 0 }, spacing: { after: 40 },
          children: [new TextRun({ text: "Click Reconnect — or delete and re-add it", size: 19, font: "Arial" })] }),
        new Paragraph({ numbering: { reference: "steps-2", level: 0 }, spacing: { after: 40 },
          children: [new TextRun({ text: "Restart Claude Code terminal", size: 19, font: "Arial" })] }),

        spacer(100),
        richBody([
          { text: "From OmniRoute docs: ", italics: true, color: C.textLight },
          { text: "\"OAuth token expired. Auto-refreshed; if stuck, delete + re-auth in Providers.\"", italics: true, color: C.secondary },
        ]),

        new Paragraph({ children: [new PageBreak()] }),

        // ══════════════ KEY TAKEAWAYS ══════════════
        sectionTitle("Key Takeaways"),

        new Paragraph({ numbering: { reference: "takeaways", level: 0 }, spacing: { after: 60 },
          children: [
            new TextRun({ text: "Supabase REST API: ", bold: true, size: 19, font: "Arial" }),
            new TextRun({ text: "Just HTTP GET with an API key header — no SDK needed", size: 19, font: "Arial" })
          ] }),
        new Paragraph({ numbering: { reference: "takeaways", level: 0 }, spacing: { after: 60 },
          children: [
            new TextRun({ text: "RLS Policies: ", bold: true, size: 19, font: "Arial" }),
            new TextRun({ text: "Critical — without them, your data is publicly exposed", size: 19, font: "Arial" })
          ] }),
        new Paragraph({ numbering: { reference: "takeaways", level: 0 }, spacing: { after: 60 },
          children: [
            new TextRun({ text: "Data API Grants: ", bold: true, size: 19, font: "Arial" }),
            new TextRun({ text: "Separate from RLS — both must be configured", size: 19, font: "Arial" })
          ] }),
        new Paragraph({ numbering: { reference: "takeaways", level: 0 }, spacing: { after: 60 },
          children: [
            new TextRun({ text: "OAuth Redirect URIs: ", bold: true, size: 19, font: "Arial" }),
            new TextRun({ text: "Must exactly match — even trailing slashes matter", size: 19, font: "Arial" })
          ] }),
        new Paragraph({ numbering: { reference: "takeaways", level: 0 }, spacing: { after: 60 },
          children: [
            new TextRun({ text: "const Scope: ", bold: true, size: 19, font: "Arial" }),
            new TextRun({ text: "Multiple script tags share scope — duplicate const = TypeError", size: 19, font: "Arial" })
          ] }),
        new Paragraph({ numbering: { reference: "takeaways", level: 0 }, spacing: { after: 60 },
          children: [
            new TextRun({ text: "User Metadata: ", bold: true, size: 19, font: "Arial" }),
            new TextRun({ text: "Supabase API returns raw_user_meta_data, not user_metadata", size: 19, font: "Arial" })
          ] }),
        new Paragraph({ numbering: { reference: "takeaways", level: 0 }, spacing: { after: 60 },
          children: [
            new TextRun({ text: "JWT Fallback: ", bold: true, size: 19, font: "Arial" }),
            new TextRun({ text: "Tokens contain user data — useful when API calls fail", size: 19, font: "Arial" })
          ] }),
        new Paragraph({ numbering: { reference: "takeaways", level: 0 }, spacing: { after: 60 },
          children: [
            new TextRun({ text: "MCP Transport: ", bold: true, size: 19, font: "Arial" }),
            new TextRun({ text: "Stdio maintains persistent connections; HTTP does not", size: 19, font: "Arial" })
          ] }),
        new Paragraph({ numbering: { reference: "takeaways", level: 0 }, spacing: { after: 60 },
          children: [
            new TextRun({ text: "OmniRoute Tokens: ", bold: true, size: 19, font: "Arial" }),
            new TextRun({ text: "Auto-refresh but can get stuck — reconnect in dashboard", size: 19, font: "Arial" })
          ] }),

        spacer(200),

        new Paragraph({
          spacing: { after: 0 },
          border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: C.primary, space: 1 } },
          children: []
        }),
        spacer(100),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: "🧁 Sweet Crumbs Baking Blog — Session Summary", size: 22, bold: true, color: C.primary, font: "Georgia" })]
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: "Generated from a Claude Code + OmniRoute session", size: 18, color: C.textLight, font: "Arial" })]
        }),
      ]
    }
  ]
});

Packer.toBuffer(doc).then(buffer => {
  const outPath = "D:\\unimem\\baking-blog\\Sweet-Crumbs-Setup-Guide.docx";
  fs.writeFileSync(outPath, buffer);
  console.log(`DOCX created: ${outPath}`);
});
