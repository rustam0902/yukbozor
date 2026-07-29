# Yukbor.uz Design Guidelines

## Design Approach

**Selected Approach:** Design System (Material Design) with B2B marketplace references (Freightos, Alibaba.com, uShip)

**Justification:** This is a utility-focused, information-dense B2B platform where trust, efficiency, and data comprehension are paramount. The application handles complex workflows (orders, offers, deposits, contracts) requiring clear information hierarchy and consistent patterns across multiple user roles.

**Key Principles:**
- Trust and professionalism: Clean, corporate aesthetic that builds confidence in financial transactions
- Information clarity: Dense data presentation without overwhelming users
- Role-based efficiency: Each dashboard optimized for specific user workflows
- Status visibility: Clear visual indicators for order states, deposit balances, offer statuses

## Typography

**Font Families:**
- Primary: Inter (via Google Fonts) - professional, highly legible for data-heavy interfaces
- Numeric: Tabular figures for prices, weights, and financial data

**Hierarchy:**
- Page Headers: text-3xl font-bold (customer/carrier/agent dashboards)
- Section Headers: text-xl font-semibold
- Card Titles: text-lg font-medium
- Body Text: text-base font-normal
- Labels/Metadata: text-sm font-medium text-gray-600
- Numeric Data: text-lg font-semibold (prices, weights, deposit balances)
- Status Badges: text-xs font-bold uppercase tracking-wide

## Layout System

**Spacing Primitives:** Use Tailwind units of 2, 4, 6, and 8 consistently
- Component padding: p-4 to p-6
- Section spacing: space-y-6 to space-y-8
- Card gaps: gap-4
- Page margins: px-4 md:px-8

**Container Strategy:**
- Public pages: max-w-7xl mx-auto
- Dashboard content: max-w-screen-2xl mx-auto (wide for data tables)
- Forms: max-w-3xl mx-auto
- Two-column layouts: grid-cols-1 lg:grid-cols-3 (sidebar + main)

## Component Library

### Navigation
**Global Header:**
- Logo left, language switcher (RU/UZ) and user menu right
- Sticky navigation with shadow on scroll
- Role indicator badge next to user name

**Dashboard Sidebar:**
- Fixed left sidebar (240px) with role-specific menu items
- Active state: left border accent + background tint
- Collapsible on mobile (hamburger menu)

### Cards & Data Display
**Order Cards:**
- Structured grid layout with clear sections: Route (from/to), Details (weight, type), Price, Status badge
- Hover state: subtle elevation increase
- Action buttons in footer (View Offers, Submit Offer, Download Contract)

**Offer Cards:**
- Horizontal layout: Carrier info left, Price center (large, emphasized), Actions right
- Include carrier rating stars prominently
- Status indicator (Active, Accepted, Rejected)

**Data Tables:**
- Striped rows for transaction history, commission reports
- Sortable headers with arrow indicators
- Sticky header on scroll
- Row actions in final column

### Forms
**Order Creation:**
- Multi-step wizard with progress indicator (3 steps: Route Details → Cargo Details → Pricing)
- Grouped field sections with dividers
- Required field indicators (asterisk)
- Real-time validation messages

**Offer Submission:**
- Single prominent form with deposit balance check at top
- Price input with large font size, clear "2% will be blocked" warning
- Submit button shows calculated blocking amount

### Status & Feedback
**Status Badges:**
- New orders: Blue background
- Assigned: Yellow background
- Completed: Green background
- Cancelled: Red background
- All with white text, rounded-full, px-3 py-1

**Deposit Balance Widget:**
- Large numeric display with currency
- Progress bar showing available vs. blocked amounts
- Quick action: "Top Up Deposit" button prominently placed

**Alert Banners:**
- Information: Blue border-left accent
- Warning (insufficient deposit): Yellow background
- Success (offer accepted): Green background

### Admin Components
**User Management Table:**
- Filters toolbar at top (role, status, search)
- Inline action buttons: Edit, Assign Agent, Deactivate
- Pagination controls at bottom

**Withdrawal Request Queue:**
- Card-based layout showing pending requests
- Amount prominently displayed
- Two-button approval flow: Approve (green) / Reject (red)

## Images

**Public Homepage:**
- Large hero image (full-width, 60vh): Cargo trucks on highway or warehouse logistics scene, modern and professional
- Feature section images: 3 supporting images showing platform benefits (contract handshake, mobile app usage, delivery tracking)

**Dashboard Backgrounds:**
- No hero images in authenticated dashboards
- Small illustrative icons for empty states (no orders yet, no offers)

**Carrier/Customer Listings:**
- Optional profile avatars/company logos (circular, 48px) with placeholder for missing images

## Role-Specific Dashboard Patterns

**Customer Dashboard:**
- CTA-focused: Large "Create New Order" button prominently placed
- Active orders table with status overview
- Quick stats: Total orders, Active offers, Completed deliveries

**Carrier Dashboard:**
- Deposit balance widget in top-right (always visible)
- Order listings with filter sidebar (region, weight, transport type, price range)
- "Submit Offer" action requires deposit validation upfront

**Agent Dashboard:**
- Revenue-focused: Monthly commission summary in header cards
- Client list with connection status (active/inactive permanent agent)
- Simplified navigation (fewer options than customer/carrier)

**Admin Panel:**
- Dense, table-centric layouts
- Filter-heavy interfaces with advanced search
- Bulk action capabilities with checkboxes

All dashboards maintain consistent header, sidebar, and spacing but adapt content density to role needs.