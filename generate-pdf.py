"""
Sweet Crumbs Baking Blog - Session Summary PDF Generator
Generates a beautifully formatted PDF document.
"""

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import inch, mm
from reportlab.lib.colors import HexColor, white, black
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, KeepTogether, HRFlowable
)
from reportlab.pdfgen import canvas
from reportlab.lib import colors
import os

# ── Colors ──────────────────────────────────────────────
PRIMARY = HexColor("#C45D3E")      # Warm terracotta
PRIMARY_DARK = HexColor("#A34A30")
SECONDARY = HexColor("#8B9E7C")    # Sage green
ACCENT = HexColor("#E8A838")       # Golden
BG_LIGHT = HexColor("#FFF8F0")     # Cream
BG_ALT = HexColor("#FEF3E2")       # Light cream
TEXT = HexColor("#3D2B1F")         # Dark brown
TEXT_LIGHT = HexColor("#6B5B50")   # Medium brown
CODE_BG = HexColor("#2D2D2D")      # Dark gray
CODE_TEXT = HexColor("#F8F8F2")    # Light text
SUPABASE = HexColor("#3ECF8E")     # Supabase green
VERCEL = HexColor("#000000")       # Vercel black
GOOGLE = HexColor("#4285F4")       # Google blue

WIDTH, HEIGHT = A4


# ── Custom Page Templates ───────────────────────────────
class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        canvas.Canvas.__init__(self, *args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_number(num_pages)
            canvas.Canvas.showPage(self)
        canvas.Canvas.save(self)

    def draw_page_number(self, page_count):
        if self._pageNumber > 1:
            self.setFont("Helvetica", 9)
            self.setFillColor(TEXT_LIGHT)
            self.drawRightString(
                WIDTH - 30, 25,
                f"Sweet Crumbs Setup Guide  |  Page {self._pageNumber - 1}"
            )


def build_styles():
    styles = getSampleStyleSheet()

    styles.add(ParagraphStyle(
        'CoverTitle', parent=styles['Title'],
        fontSize=36, leading=42, textColor=PRIMARY,
        fontName='Helvetica-Bold', alignment=TA_CENTER,
        spaceAfter=12
    ))
    styles.add(ParagraphStyle(
        'CoverSubtitle', parent=styles['Normal'],
        fontSize=14, leading=20, textColor=TEXT_LIGHT,
        fontName='Helvetica', alignment=TA_CENTER,
        spaceAfter=6
    ))
    styles.add(ParagraphStyle(
        'SectionTitle', parent=styles['Heading1'],
        fontSize=22, leading=28, textColor=PRIMARY,
        fontName='Helvetica-Bold', spaceBefore=20, spaceAfter=10,
        borderWidth=0, borderPadding=0
    ))
    styles.add(ParagraphStyle(
        'SubSection', parent=styles['Heading2'],
        fontSize=15, leading=20, textColor=PRIMARY_DARK,
        fontName='Helvetica-Bold', spaceBefore=14, spaceAfter=6
    ))
    styles.add(ParagraphStyle(
        'BodyText2', parent=styles['Normal'],
        fontSize=10, leading=14, textColor=TEXT,
        fontName='Helvetica', alignment=TA_JUSTIFY,
        spaceAfter=6
    ))
    styles.add(ParagraphStyle(
        'BulletItem', parent=styles['Normal'],
        fontSize=10, leading=14, textColor=TEXT,
        fontName='Helvetica', leftIndent=20, spaceAfter=3,
        bulletIndent=8
    ))
    styles.add(ParagraphStyle(
        'CodeBlock', parent=styles['Normal'],
        fontSize=8.5, leading=12, textColor=CODE_TEXT,
        fontName='Courier', backColor=CODE_BG,
        leftIndent=12, rightIndent=12,
        spaceBefore=6, spaceAfter=6,
        borderWidth=1, borderColor=HexColor("#444444"),
        borderPadding=8
    ))
    styles.add(ParagraphStyle(
        'Highlight', parent=styles['Normal'],
        fontSize=10, leading=14, textColor=PRIMARY_DARK,
        fontName='Helvetica-Bold', spaceAfter=4
    ))
    styles.add(ParagraphStyle(
        'StepNumber', parent=styles['Normal'],
        fontSize=28, leading=32, textColor=ACCENT,
        fontName='Helvetica-Bold', alignment=TA_CENTER
    ))
    styles.add(ParagraphStyle(
        'Caption', parent=styles['Normal'],
        fontSize=8, leading=10, textColor=TEXT_LIGHT,
        fontName='Helvetica-Oblique', alignment=TA_CENTER,
        spaceAfter=8
    ))
    styles.add(ParagraphStyle(
        'FlowStep', parent=styles['Normal'],
        fontSize=9, leading=12, textColor=white,
        fontName='Helvetica-Bold', alignment=TA_CENTER
    ))
    styles.add(ParagraphStyle(
        'TableHeader', parent=styles['Normal'],
        fontSize=9, leading=12, textColor=white,
        fontName='Helvetica-Bold', alignment=TA_CENTER
    ))
    styles.add(ParagraphStyle(
        'TableCell', parent=styles['Normal'],
        fontSize=9, leading=12, textColor=TEXT,
        fontName='Helvetica', alignment=TA_LEFT
    ))
    styles.add(ParagraphStyle(
        'Tip', parent=styles['Normal'],
        fontSize=9, leading=13, textColor=SECONDARY,
        fontName='Helvetica-Oblique',
        leftIndent=15, rightIndent=15,
        spaceBefore=6, spaceAfter=6,
        borderWidth=1, borderColor=SECONDARY,
        borderPadding=8, backColor=HexColor("#F0F5EC")
    ))
    styles.add(ParagraphStyle(
        'BugTitle', parent=styles['Normal'],
        fontSize=11, leading=15, textColor=PRIMARY,
        fontName='Helvetica-Bold', spaceBefore=10, spaceAfter=2
    ))
    return styles


def colored_line(color=PRIMARY, width=WIDTH - 80):
    return HRFlowable(
        width=width, thickness=2, color=color,
        spaceBefore=4, spaceAfter=8
    )


def section_header(text, styles):
    return [
        Spacer(1, 10),
        colored_line(PRIMARY),
        Paragraph(text, styles['SectionTitle']),
    ]


def code_block(code, styles):
    escaped = code.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
    return Paragraph(f"<pre>{escaped}</pre>", styles['CodeBlock'])


def tip_box(text, styles):
    return Paragraph(f"<b>Tip:</b> {text}", styles['Tip'])


def build_pdf():
    output_path = os.path.join(os.path.dirname(__file__), "Sweet-Crumbs-Setup-Guide.pdf")

    doc = SimpleDocTemplate(
        output_path, pagesize=A4,
        topMargin=40, bottomMargin=50,
        leftMargin=40, rightMargin=40
    )

    styles = build_styles()
    story = []

    # ════════════════════════════════════════════════════
    # COVER PAGE
    # ════════════════════════════════════════════════════
    story.append(Spacer(1, 100))

    # Decorative top bar
    cover_bar_data = [['']]
    cover_bar = Table(cover_bar_data, colWidths=[WIDTH - 80], rowHeights=[6])
    cover_bar.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), PRIMARY),
        ('LINEBELOW', (0, 0), (-1, -1), 0, white),
    ]))
    story.append(cover_bar)
    story.append(Spacer(1, 30))

    story.append(Paragraph("🧁", ParagraphStyle(
        'Emoji', fontSize=60, alignment=TA_CENTER, spaceAfter=10
    )))
    story.append(Paragraph("Sweet Crumbs", styles['CoverTitle']))
    story.append(Paragraph("Baking Blog — Full Setup Guide", styles['CoverSubtitle']))
    story.append(Spacer(1, 20))
    story.append(colored_line(ACCENT, 200))
    story.append(Spacer(1, 20))

    # Tech stack badges
    badge_data = [[
        Paragraph('<font color="#3ECF8E"><b>Supabase</b></font>', styles['FlowStep']),
        Paragraph('<font color="#000000"><b>Vercel</b></font>', styles['FlowStep']),
        Paragraph('<font color="#4285F4"><b>Google Auth</b></font>', styles['FlowStep']),
        Paragraph('<font color="#E8A838"><b>OmniRoute</b></font>', styles['FlowStep']),
    ]]
    badge = Table(badge_data, colWidths=[120]*4, rowHeights=[30])
    badge.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, 0), HexColor("#E8F8F0")),
        ('BACKGROUND', (1, 0), (1, 0), HexColor("#F0F0F0")),
        ('BACKGROUND', (2, 0), (2, 0), HexColor("#E8F0FF")),
        ('BACKGROUND', (3, 0), (3, 0), HexColor("#FFF8E8")),
        ('ROUNDEDCORNERS', [6, 6, 6, 6]),
        ('BOX', (0, 0), (0, 0), 1, SUPABASE),
        ('BOX', (1, 0), (1, 0), 1, VERCEL),
        ('BOX', (2, 0), (2, 0), 1, GOOGLE),
        ('BOX', (3, 0), (3, 0), 1, ACCENT),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
    ]))
    story.append(badge)
    story.append(Spacer(1, 40))

    story.append(Paragraph(
        "A complete walkthrough of building a production baking blog<br/>"
        "with database, authentication, deployment, and browser automation.",
        ParagraphStyle('CoverDesc', fontSize=11, leading=16,
                       textColor=TEXT_LIGHT, alignment=TA_CENTER)
    ))
    story.append(Spacer(1, 30))

    # Bottom bar
    story.append(cover_bar)
    story.append(PageBreak())

    # ════════════════════════════════════════════════════
    # TABLE OF CONTENTS
    # ════════════════════════════════════════════════════
    story.extend(section_header("Table of Contents", styles))

    toc_items = [
        ("1", "Supabase Project Setup", "Database, RLS, API access"),
        ("2", "Frontend Integration", "REST API fetching, async loading"),
        ("3", "Vercel Deployment", "Production hosting, auto-deploys"),
        ("4", "Google OAuth", "Cloud Console + Supabase + flow"),
        ("5", "Bugs Fixed", "4 critical issues resolved"),
        ("6", "Playwright MCP", "Browser automation setup"),
        ("7", "OmniRoute", "AI gateway, token management"),
    ]

    for num, title, desc in toc_items:
        toc_data = [[
            Paragraph(f'<font color="{PRIMARY.hexval()}">{num}</font>',
                      ParagraphStyle('TOCNum', fontSize=22, fontName='Helvetica-Bold',
                                     alignment=TA_CENTER, textColor=PRIMARY)),
            Paragraph(f'<b>{title}</b><br/><font size="9" color="{TEXT_LIGHT.hexval()}">{desc}</font>',
                      ParagraphStyle('TOCItem', fontSize=12, leading=16, fontName='Helvetica')),
        ]]
        toc_table = Table(toc_data, colWidths=[40, WIDTH - 140])
        toc_table.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('LINEBELOW', (0, 0), (-1, -1), 0.5, HexColor("#E8DDD0")),
        ]))
        story.append(toc_table)

    story.append(PageBreak())

    # ════════════════════════════════════════════════════
    # STEP 1: SUPABASE
    # ════════════════════════════════════════════════════
    story.extend(section_header("1. Supabase Project Setup", styles))

    story.append(Paragraph(
        "Supabase provides a PostgreSQL database with a built-in REST API (PostgREST). "
        "We created a project, defined a recipes table, configured security, and seeded data.",
        styles['BodyText2']
    ))

    # Project info table
    proj_data = [
        [Paragraph('<b>Property</b>', styles['TableHeader']),
         Paragraph('<b>Value</b>', styles['TableHeader'])],
        [Paragraph('Project Name', styles['TableCell']),
         Paragraph('baking-blog-recipes', styles['TableCell'])],
        [Paragraph('Project ID', styles['TableCell']),
         Paragraph('bynfesgbvgcmkpnwysil', styles['TableCell'])],
        [Paragraph('Region', styles['TableCell']),
         Paragraph('ap-south-1 (Mumbai)', styles['TableCell'])],
        [Paragraph('URL', styles['TableCell']),
         Paragraph('https://bynfesgbvgcmkpnwysil.supabase.co', styles['TableCell'])],
        [Paragraph('Tier', styles['TableCell']),
         Paragraph('Free', styles['TableCell'])],
    ]
    proj_table = Table(proj_data, colWidths=[120, WIDTH - 220])
    proj_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), PRIMARY),
        ('TEXTCOLOR', (0, 0), (-1, 0), white),
        ('BACKGROUND', (0, 1), (-1, -1), BG_LIGHT),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [BG_LIGHT, white]),
        ('BOX', (0, 0), (-1, -1), 1, PRIMARY),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, HexColor("#E8DDD0")),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('LEFTPADDING', (0, 0), (-1, -1), 10),
    ]))
    story.append(proj_table)
    story.append(Spacer(1, 12))

    story.append(Paragraph("Table Schema", styles['SubSection']))
    story.append(code_block(
        "CREATE TABLE recipes (\n"
        "  id           TEXT PRIMARY KEY,\n"
        "  title        TEXT NOT NULL,\n"
        "  image        TEXT,\n"
        "  category     TEXT NOT NULL,\n"
        "  \"prepTime\"   INTEGER NOT NULL,\n"
        "  \"cookTime\"   INTEGER NOT NULL,\n"
        "  servings     INTEGER NOT NULL,\n"
        "  difficulty   TEXT NOT NULL,\n"
        "  description  TEXT,\n"
        "  ingredients  JSONB DEFAULT '[]'::jsonb,\n"
        "  steps        JSONB DEFAULT '[]'::jsonb,\n"
        "  created_at   TIMESTAMPTZ DEFAULT now()\n"
        ");", styles
    ))

    story.append(Paragraph(
        "RLS enabled with public read policy. Data API grants configured for <b>anon</b> role.",
        styles['BodyText2']
    ))

    story.append(tip_box(
        "Always enable RLS on tables in exposed schemas. Without it, your data is publicly accessible via the REST API.",
        styles
    ))

    story.append(PageBreak())

    # ════════════════════════════════════════════════════
    # STEP 2: FRONTEND
    # ════════════════════════════════════════════════════
    story.extend(section_header("2. Frontend Integration", styles))

    story.append(Paragraph(
        "The frontend fetches recipes from Supabase using plain <b>fetch()</b> — no SDK needed. "
        "Each page loads data asynchronously with loading states and error handling.",
        styles['BodyText2']
    ))

    story.append(Paragraph("REST API Call Pattern", styles['SubSection']))
    story.append(code_block(
        "const response = await fetch(\n"
        "  `${SUPABASE_URL}/rest/v1/recipes?select=*`,\n"
        "  {\n"
        "    headers: {\n"
        "      'apikey': SUPABASE_ANON_KEY,\n"
        "      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`\n"
        "    }\n"
        "  }\n"
        ");\n"
        "const recipes = await response.json();", styles
    ))

    # Architecture diagram
    story.append(Paragraph("Data Flow", styles['SubSection']))

    flow_data = [[
        Paragraph('<font size="8"><b>Browser</b></font>', styles['FlowStep']),
        Paragraph('<font size="8"><b>fetch()</b></font>', styles['FlowStep']),
        Paragraph('<font size="8"><b>Supabase</b><br/>PostgREST</font>', styles['FlowStep']),
        Paragraph('<font size="8"><b>PostgreSQL</b></font>', styles['FlowStep']),
    ]]
    flow = Table(flow_data, colWidths=[110, 80, 110, 110], rowHeights=[40])
    flow.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, 0), PRIMARY),
        ('BACKGROUND', (1, 0), (1, 0), ACCENT),
        ('BACKGROUND', (2, 0), (2, 0), SUPABASE),
        ('BACKGROUND', (3, 0), (3, 0), HexColor("#336791")),
        ('ROUNDEDCORNERS', [6, 6, 6, 6]),
        ('BOX', (0, 0), (0, 0), 1, PRIMARY),
        ('BOX', (1, 0), (1, 0), 1, ACCENT),
        ('BOX', (2, 0), (2, 0), 1, SUPABASE),
        ('BOX', (3, 0), (3, 0), 1, HexColor("#336791")),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('LINEAFTER', (0, 0), (2, 0), 2, white),
    ]))
    story.append(flow)
    story.append(Paragraph(
        "Browser → fetch() → Supabase PostgREST → PostgreSQL",
        styles['Caption']
    ))

    story.append(PageBreak())

    # ════════════════════════════════════════════════════
    # STEP 3: VERCEL
    # ════════════════════════════════════════════════════
    story.extend(section_header("3. Vercel Deployment", styles))

    story.append(Paragraph(
        "The baking blog is deployed on Vercel as a static site. Deployments happen instantly "
        "via the Vercel CLI with <b>npx vercel --prod --yes</b>.",
        styles['BodyText2']
    ))

    deploy_data = [
        [Paragraph('<b>Property</b>', styles['TableHeader']),
         Paragraph('<b>Value</b>', styles['TableHeader'])],
        [Paragraph('Production URL', styles['TableCell']),
         Paragraph('https://baking-blog-three.vercel.app', styles['TableCell'])],
        [Paragraph('Project ID', styles['TableCell']),
         Paragraph('prj_Tn5Grdcjfm8csMr55dpl9z6xqmnL', styles['TableCell'])],
        [Paragraph('Deploy Command', styles['TableCell']),
         Paragraph('npx vercel --prod --yes', styles['TableCell'])],
    ]
    deploy_table = Table(deploy_data, colWidths=[120, WIDTH - 220])
    deploy_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), VERCEL),
        ('TEXTCOLOR', (0, 0), (-1, 0), white),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [BG_LIGHT, white]),
        ('BOX', (0, 0), (-1, -1), 1, VERCEL),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, HexColor("#E8DDD0")),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('LEFTPADDING', (0, 0), (-1, -1), 10),
    ]))
    story.append(deploy_table)

    story.append(PageBreak())

    # ════════════════════════════════════════════════════
    # STEP 4: GOOGLE OAUTH
    # ════════════════════════════════════════════════════
    story.extend(section_header("4. Google OAuth Setup", styles))

    story.append(Paragraph(
        "Google authentication was set up across three systems: Google Cloud Console, "
        "Supabase Auth, and the frontend JavaScript.",
        styles['BodyText2']
    ))

    # Auth flow diagram
    story.append(Paragraph("Authentication Flow", styles['SubSection']))

    auth_steps = [
        ("1. User clicks\nSign In", PRIMARY),
        ("2. Supabase\nredirects to Google", GOOGLE),
        ("3. User logs in\nwith Google", GOOGLE),
        ("4. Google returns\nto Supabase", SUPABASE),
        ("5. Tokens stored\nin localStorage", ACCENT),
        ("6. Profile shown\nin header", SECONDARY),
    ]

    auth_cells = []
    for text, color in auth_steps:
        auth_cells.append(Paragraph(
            f'<font size="7" color="white"><b>{text}</b></font>',
            ParagraphStyle('AuthStep', alignment=TA_CENTER, leading=10)
        ))

    auth_row = [auth_cells]
    auth_table = Table(auth_row, colWidths=[95]*6, rowHeights=[50])
    auth_style_cmds = [
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('ROUNDEDCORNERS', [4, 4, 4, 4]),
    ]
    for i, (_, color) in enumerate(auth_steps):
        auth_style_cmds.append(('BACKGROUND', (i, 0), (i, 0), color))
    auth_table.setStyle(TableStyle(auth_style_cmds))
    story.append(auth_table)
    story.append(Spacer(1, 12))

    # Setup steps
    setup_data = [
        [Paragraph('<b>System</b>', styles['TableHeader']),
         Paragraph('<b>Configuration</b>', styles['TableHeader'])],
        [Paragraph('Google Cloud', styles['TableCell']),
         Paragraph('OAuth consent screen (External) → Web Client ID → Redirect URI: '
                   'https://bynfesgbvgcmkpnwysil.supabase.co/auth/v1/callback',
                   styles['TableCell'])],
        [Paragraph('Supabase', styles['TableCell']),
         Paragraph('Auth → Providers → Google → Paste Client ID + Secret → Save',
                   styles['TableCell'])],
        [Paragraph('Redirect URLs', styles['TableCell']),
         Paragraph('Remove localhost entries. Add: '
                   'https://baking-blog-three.vercel.app/**',
                   styles['TableCell'])],
    ]
    setup_table = Table(setup_data, colWidths=[100, WIDTH - 200])
    setup_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), GOOGLE),
        ('TEXTCOLOR', (0, 0), (-1, 0), white),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [BG_LIGHT, white]),
        ('BOX', (0, 0), (-1, -1), 1, GOOGLE),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, HexColor("#E8DDD0")),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('LEFTPADDING', (0, 0), (-1, -1), 10),
    ]))
    story.append(setup_table)

    story.append(PageBreak())

    # ════════════════════════════════════════════════════
    # STEP 5: BUGS
    # ════════════════════════════════════════════════════
    story.extend(section_header("5. Bugs Fixed", styles))

    bugs = [
        {
            'title': 'Bug 1: Broken Images (404)',
            'problem': 'Vanilla cupcakes and banana bread images returned 404 from Unsplash.',
            'fix': 'Replaced with working Unsplash photo IDs.',
            'code': 'Cupcakes: photo-1576618148400-f54bed99fcfd\n'
                    'Banana bread: photo-1606313564200-e75d5e30476c',
        },
        {
            'title': 'Bug 2: Auth Redirect to localhost',
            'problem': 'After Google login, browser redirected to localhost:3000 instead of production.',
            'fix': 'Hardcoded production URL in auth redirect + removed localhost from Supabase URLs.',
            'code': 'const PROD_URL = "https://baking-blog-three.vercel.app";',
        },
        {
            'title': 'Bug 3: Duplicate const Declaration (CRITICAL)',
            'problem': 'Both auth.js and script.js declared const SUPABASE_URL — '
                       'crashed entire script, no recipes loaded.',
            'fix': 'Removed duplicate from script.js, kept only in auth.js.',
            'code': '// BEFORE (broken):\n'
                    '// auth.js:    const SUPABASE_URL = "...";\n'
                    '// script.js:  const SUPABASE_URL = "..."; // ERROR!\n\n'
                    '// AFTER (fixed):\n'
                    '// auth.js:    const SUPABASE_URL = "..."; // Only here\n'
                    '// script.js:  // Uses SUPABASE_URL from auth.js',
        },
        {
            'title': 'Bug 4: User Profile Not Showing',
            'problem': 'Supabase API returns raw_user_meta_data, not user_metadata.',
            'fix': 'Check both field names + JWT decode fallback.',
            'code': 'const meta = user.user_metadata || user.raw_user_meta_data || {};',
        },
    ]

    for bug in bugs:
        story.append(Paragraph(bug['title'], styles['BugTitle']))
        story.append(Paragraph(f"<b>Problem:</b> {bug['problem']}", styles['BodyText2']))
        story.append(Paragraph(f"<b>Fix:</b> {bug['fix']}", styles['BodyText2']))
        story.append(code_block(bug['code'], styles))
        story.append(Spacer(1, 4))

    story.append(PageBreak())

    # ════════════════════════════════════════════════════
    # STEP 6: PLAYWRIGHT
    # ════════════════════════════════════════════════════
    story.extend(section_header("6. Playwright MCP Setup", styles))

    story.append(Paragraph(
        "Playwright MCP enables browser automation for testing. The key insight: "
        "shell script calls create new HTTP sessions (losing browser context), "
        "while a registered MCP server uses persistent stdio connections.",
        styles['BodyText2']
    ))

    # Comparison table
    comp_data = [
        [Paragraph('<b>Approach</b>', styles['TableHeader']),
         Paragraph('<b>Transport</b>', styles['TableHeader']),
         Paragraph('<b>Context</b>', styles['TableHeader']),
         Paragraph('<b>Result</b>', styles['TableHeader'])],
        [Paragraph('Shell scripts', styles['TableCell']),
         Paragraph('HTTP (new per call)', styles['TableCell']),
         Paragraph('Lost between calls', styles['TableCell']),
         Paragraph('<font color="red">Blank screenshots</font>', styles['TableCell'])],
        [Paragraph('MCP server', styles['TableCell']),
         Paragraph('Stdio (persistent)', styles['TableCell']),
         Paragraph('Maintained', styles['TableCell']),
         Paragraph('<font color="green">Working automation</font>', styles['TableCell'])],
    ]
    comp_table = Table(comp_data, colWidths=[100, 110, 110, 110])
    comp_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), PRIMARY),
        ('TEXTCOLOR', (0, 0), (-1, 0), white),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [BG_LIGHT, white]),
        ('BOX', (0, 0), (-1, -1), 1, PRIMARY),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, HexColor("#E8DDD0")),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
    ]))
    story.append(comp_table)
    story.append(Spacer(1, 10))

    story.append(Paragraph("MCP Server Config (.mcp.json)", styles['SubSection']))
    story.append(code_block(
        '{\n'
        '  "mcpServers": {\n'
        '    "playwright": {\n'
        '      "command": "npx",\n'
        '      "args": ["@playwright/mcp@latest"]\n'
        '    }\n'
        '  }\n'
        '}', styles
    ))

    story.append(PageBreak())

    # ════════════════════════════════════════════════════
    # STEP 7: OMNIROUTE
    # ════════════════════════════════════════════════════
    story.extend(section_header("7. OmniRoute (AI Gateway)", styles))

    story.append(Paragraph(
        "OmniRoute is a free AI gateway that proxies requests to 36+ providers. "
        "It handles OAuth token management for Claude Code with automatic background refresh.",
        styles['BodyText2']
    ))

    story.append(Paragraph("Key Info", styles['SubSection']))
    omni_data = [
        [Paragraph('<b>Property</b>', styles['TableHeader']),
         Paragraph('<b>Value</b>', styles['TableHeader'])],
        [Paragraph('Dashboard', styles['TableCell']),
         Paragraph('http://localhost:20128', styles['TableCell'])],
        [Paragraph('GitHub', styles['TableCell']),
         Paragraph('https://github.com/pitbaden/omniroute', styles['TableCell'])],
        [Paragraph('Config Dir', styles['TableCell']),
         Paragraph('~/.omniroute/', styles['TableCell'])],
    ]
    omni_table = Table(omni_data, colWidths=[120, WIDTH - 220])
    omni_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), ACCENT),
        ('TEXTCOLOR', (0, 0), (-1, 0), white),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [BG_LIGHT, white]),
        ('BOX', (0, 0), (-1, -1), 1, ACCENT),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, HexColor("#E8DDD0")),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('LEFTPADDING', (0, 0), (-1, -1), 10),
    ]))
    story.append(omni_table)
    story.append(Spacer(1, 10))

    story.append(Paragraph("Fixing 401 Token Errors", styles['SubSection']))
    story.append(Paragraph(
        "When Claude Code shows <b>401: You need to sign in to use this model</b>:",
        styles['BodyText2']
    ))

    fix_steps = [
        "Open OmniRoute dashboard: http://localhost:20128",
        "Go to <b>Providers</b>",
        "Find the Claude/Anthropic provider",
        "Click <b>Reconnect</b> — or delete and re-add it",
        "Restart Claude Code terminal",
    ]
    for i, step in enumerate(fix_steps, 1):
        story.append(Paragraph(f"<b>{i}.</b> {step}", styles['BulletItem']))

    story.append(Spacer(1, 8))
    story.append(tip_box(
        "From OmniRoute docs: \"OAuth token expired. Auto-refreshed; if stuck, "
        "delete + re-auth in Providers.\"",
        styles
    ))

    story.append(PageBreak())

    # ════════════════════════════════════════════════════
    # FILE STRUCTURE
    # ════════════════════════════════════════════════════
    story.extend(section_header("File Structure", styles))

    files = [
        ("index.html", "Homepage with recipe grid + category filter"),
        ("recipe.html", "Individual recipe page with built-in timers"),
        ("login.html", "Google OAuth login page"),
        ("auth-callback.html", "OAuth redirect handler"),
        ("script.js", "Recipe fetching, rendering, timer logic"),
        ("auth.js", "Supabase auth config + Google OAuth flow"),
        ("styles.css", "All styling (CSS variables, responsive)"),
        ("recipes.json", "Original static data (now unused)"),
        ("SETUP-GUIDE.md", "Detailed markdown documentation"),
        ("generate-pdf.py", "PDF generator script"),
    ]

    file_data = [
        [Paragraph('<b>File</b>', styles['TableHeader']),
         Paragraph('<b>Purpose</b>', styles['TableHeader'])]
    ]
    for fname, purpose in files:
        file_data.append([
            Paragraph(f'<font face="Courier" size="9">{fname}</font>', styles['TableCell']),
            Paragraph(purpose, styles['TableCell']),
        ])

    file_table = Table(file_data, colWidths=[140, WIDTH - 240])
    file_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), PRIMARY),
        ('TEXTCOLOR', (0, 0), (-1, 0), white),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [BG_LIGHT, white]),
        ('BOX', (0, 0), (-1, -1), 1, PRIMARY),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, HexColor("#E8DDD0")),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
    ]))
    story.append(file_table)

    story.append(PageBreak())

    # ════════════════════════════════════════════════════
    # KEY TAKEAWAYS
    # ════════════════════════════════════════════════════
    story.extend(section_header("Key Takeaways", styles))

    takeaways = [
        ("Supabase REST API", "Just HTTP GET with an API key header — no SDK needed for simple cases"),
        ("RLS Policies", "Critical — without them, your data is publicly exposed via the REST API"),
        ("Data API Grants", "Separate from RLS — both must be configured for tables to be accessible"),
        ("OAuth Redirect URIs", "Must exactly match — even trailing slashes matter"),
        ("const Scope", "Multiple script tags share scope — duplicate const = TypeError"),
        ("User Metadata", "Supabase API returns raw_user_meta_data, not user_metadata"),
        ("JWT Fallback", "Tokens contain user data — useful when API calls fail"),
        ("MCP Transport", "Stdio maintains persistent connections; HTTP does not"),
        ("OmniRoute Tokens", "Auto-refresh but can get stuck — reconnect in dashboard"),
    ]

    for i, (title, desc) in enumerate(takeaways, 1):
        takeaway_data = [[
            Paragraph(f'<font color="{ACCENT.hexval()}" size="16"><b>{i}</b></font>',
                      ParagraphStyle('TKNum', alignment=TA_CENTER, fontSize=16)),
            Paragraph(f'<b>{title}</b><br/><font size="9" color="{TEXT_LIGHT.hexval()}">{desc}</font>',
                      ParagraphStyle('TKText', fontSize=10, leading=14)),
        ]]
        tk_table = Table(takeaway_data, colWidths=[35, WIDTH - 115])
        tk_table.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
            ('LINEBELOW', (0, 0), (-1, -1), 0.5, HexColor("#E8DDD0")),
        ]))
        story.append(tk_table)

    story.append(Spacer(1, 30))

    # Final bar
    final_bar_data = [['']]
    final_bar = Table(final_bar_data, colWidths=[WIDTH - 80], rowHeights=[6])
    final_bar.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), PRIMARY),
    ]))
    story.append(final_bar)
    story.append(Spacer(1, 15))
    story.append(Paragraph(
        "🧁 Sweet Crumbs Baking Blog — Session Summary",
        ParagraphStyle('Footer', fontSize=12, textColor=PRIMARY,
                       fontName='Helvetica-Bold', alignment=TA_CENTER)
    ))
    story.append(Paragraph(
        "Generated from a Claude Code + OmniRoute session",
        ParagraphStyle('Footer2', fontSize=9, textColor=TEXT_LIGHT,
                       fontName='Helvetica', alignment=TA_CENTER)
    ))

    # ── Build ──
    doc.build(story, canvasmaker=NumberedCanvas)
    print(f"PDF created: {output_path}")


if __name__ == "__main__":
    build_pdf()
