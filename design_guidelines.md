# SimulChess Design Guidelines

## Design Approach

**Hybrid Strategy**: Combine Linear's precision and clarity with Notion's organized information density. Reference Chess.com for familiar patterns but differentiate through professional, tournament-focused aesthetics.

**Core Principle**: Professional training tool first, game second. Every design decision should communicate serious skill development over casual play.

---

## Typography

**Font Stack**:
- Primary: Inter (headings, UI elements)
- Secondary: JetBrains Mono (chess notation, move lists, timers)

**Scale**:
- Hero/H1: text-5xl/text-6xl, font-bold
- H2: text-3xl/text-4xl, font-semibold  
- H3: text-xl/text-2xl, font-semibold
- Body: text-base, font-normal
- Small/Meta: text-sm, font-medium
- Chess Notation: text-sm mono, font-medium

---

## Layout System

**Spacing Primitives**: Use units of 4, 8, 16, 24, 32 (p-4, p-8, p-16, etc.)

**Grid System**:
- Container max-width: max-w-7xl for marketing, max-w-screen-2xl for app
- Sidebar: fixed w-64 or w-80 for game lists/navigation
- Main content: flex-1 with appropriate padding

**Vertical Rhythm**: py-16 to py-24 for marketing sections, py-8 to py-12 for app containers

---

## Color Strategy

**Dark Blue Theme with Red Accents** - Professional tournament aesthetic:

**Primary Colors**:
- Background: Dark blue-grey (hsl 207 20% 14%) - professional, focused environment
- Sidebar: Darker blue (hsl 207 24% 11%) - distinct navigation area
- Card/Surface: Slightly lighter blue (hsl 207 22% 17%) - elevated content
- Primary/Accent: Vibrant red (hsl 0 72% 51%) - premium features, calls-to-action, highlights

**Text Colors**:
- Primary text: Near white (hsl 210 6% 96%) - optimal readability
- Secondary text: Muted grey (hsl 210 8% 70%) - supporting information
- Borders: Subtle blue (hsl 207 18% 20%) - gentle separation

**Application**:
- Premium features: Red buttons and highlighted cards
- Featured mode: Red background for "Simul Exhibition" card
- Navigation: Dark blue sidebar with red active states
- Default mode: Dark theme always enabled
- Strong differentiation between primary actions (red) and secondary (outlined)
- Clear disabled/inactive states
- Distinct success/warning/error states for game outcomes

---

## Component Library

### Navigation
- **App Header**: Persistent top bar with mode selector, user profile, premium badge
- **Mode Selector**: Prominent 3-tab navigation (OTB/Blindfold/Simul) with icons
- **Marketing Nav**: Minimal top bar, sticky on scroll, clear CTA

### Chess Board Components
- **Board Container**: aspect-square, responsive sizing
- **Clock Display**: Large, monospace numerals, clear active/inactive states
- **Move List**: Scrollable sidebar, alternating row backgrounds, monospace notation
- **Manual Clock Button**: Large touch target (min-h-16), distinct visual feedback on press

### Cards & Containers
- **Mode Cards**: rounded-xl, p-6, hover lift effect, clear mode icon/title
- **Stat Cards**: compact, number-focused, trend indicators
- **Game History Cards**: dense information, quick scan pattern

### Forms & Inputs
- **Standard Fields**: rounded-lg, p-3, clear focus states
- **Premium Upgrade**: prominent card with feature list, pricing, single CTA
- **Age Verification**: inline date picker, clear 13+ requirement

### Buttons
- **Primary Actions**: rounded-lg, px-6 py-3, bold text
- **Secondary Actions**: outlined variant, same sizing
- **Clock Press**: Extra large (min-h-20), haptic-style visual feedback
- **Hero CTAs over images**: Blurred background, no hover effects

---

## Mode-Specific Design

### OTB Tournament Mode
- Clean, minimal distractions
- Prominent clock and press button
- Professional tournament aesthetic
- 3-level highlighting system clearly differentiated
- Arbiter AI notifications: subtle but impossible to miss

### Blindfold Challenge  
- High contrast grid on dark background
- Peek counter: always visible, decrements clearly
- Audio feedback indicators (visual wave/pulse)
- Level selector: progressive difficulty visualization

### Simul Mode
- **Text-only sidebar** (NOT thumbnails): Opponent name, material count (+2, -1 format), time remaining
- Active game highlighted
- Quick-switch interaction (single click)
- FIFO order maintained visually

---

## Marketing Pages

### Homepage Hero
- **Large hero image**: Chess tournament scene or player in concentration
- Headline: "Master OTB. Strengthen Memory. Dominate Simuls."
- Subtitle: Mission statement
- Two CTAs: "Start Training" (primary), "View Features" (secondary)
- Blurred button backgrounds over image

### Three-Mode Showcase
- 3-column grid on desktop (single column mobile)
- Each mode card: Icon, title, 4 bullet features, "Learn More" link
- Visual differentiation through icons/imagery

### Feature Sections
- 5-7 sections total
- Alternating image/content layout
- Social proof: "Used by tournament players worldwide"
- Comparison table: Free vs Premium (2-column, clear feature checkmarks)

### Footer
- 4-column grid: Product, Company, Resources, Legal
- Newsletter signup inline
- Social links (if applicable)
- Age restriction notice (13+)

---

## Application UI

### Dashboard
- Top: Current rating display (5 Elos in compact cards)
- Middle: Quick mode selector (large cards)
- Bottom: Recent games (scrollable list)

### Game Screen
- Chess board: centered, maximum size while leaving room for controls
- Right sidebar: Move list, game info
- Bottom: Clock(s), action buttons (resign, draw, etc.)
- OTB mode: Clock press button takes priority position

### Settings
- Tabbed interface: Account, Preferences, OTB Settings, Subscription
- Toggle switches for binary options
- Inline descriptions for complex settings

---

## Images

**Hero Section**: Professional chess tournament photograph - player contemplating board, tournament clock visible, serious atmosphere. Full viewport width, text overlay with blur treatment.

**Mode Cards**: Icon-based (chess piece, brain, multiple boards) - no photographs needed.

**Feature Sections**: Alternate between UI screenshots (chess board in action) and conceptual imagery (memory visualization, multiple boards).

**About Section**: Authentic tournament/training photos reinforcing professional positioning.

---

## Accessibility & Polish

- Minimum touch targets: 44px × 44px
- Focus indicators: 2px offset ring
- Screen reader labels for all chess moves
- High contrast mode support
- Keyboard shortcuts documented (spacebar for clock press prominently featured)
- Loading states: skeleton screens for game history, pulse for live games