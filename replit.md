# EggGrade ERP System

## Overview

EggGrade is an internal ERP (Enterprise Resource Planning) system designed for egg grading plant production operations. The system manages just-in-time production workflows where products are processed and finished within 2 days due to the perishable nature of eggs.

The platform supports multiple functional teams including Sales & Supply Chain, Logistics, HR, Productions, Quality Assurance, Stock Management, and Engineering/Maintenance. Core workstations managed include Goods Receiving, Grading, Packing, Order Picking, Load Out, and Reprocessing.

## Recent Changes

### Egg Grade Composition Normalization (January 5, 2026)
- **New Tables**: `eggGradeCompositions` (reusable grade formulas), `eggGradeCompositionItems` (grade percentages per composition)
- **Semantic Codes**: Composition codes use `egg_spec_b1_100` format for single grades, `egg_spec_b3b4_40_60` for mixed grades
- **Data Reduction**: Consolidated 98 grade records → 10 unique compositions with 14 items total
- **FG Pack Specs Update**: Specs now reference `compositionId` instead of embedding grade data
- **Backward Compatibility**: API returns both legacy `grades` array and new `composition` object
- **API Endpoints**: `/api/egg-grade-compositions` with full CRUD, validation for 100% percentage sum
- **Validation**: Duplicate code check, 1-based sequence numbering, min 1 item per composition

### FG Pack Specs Schema Consolidation (January 4, 2026)
- **New Tables**: `packTypes` (pack format lookup), `fgPackSpecs` (FG specifications), `fgPackSpecGrades` (mixed-grade support), `partnerProductPackSpecs` (partner-specific assignments)
- **Pack Types Lookup**: 7 Thai packaging formats (Pack 4/10/12/15, ถาด/30, มัด 4/120, มัด 5/150) with `eggsPerPack` values
- **Spec → PackType Reference**: Specs now reference packTypeId instead of storing packEggs directly
- **Mixed-Size Support**: `fgPackSpecGrades` child table supports percentage-based mixed sizes (e.g., 40% B3, 60% B4)
- **Item Master Cleanup**: Removed `packEggs`, `minTotalWeightG`, `allowBelowGradeEggs`, `allowedGrades` from itemMaster (now in separate spec tables)
- **API Endpoints**: `/api/pack-types`, `/api/fg-pack-specs`, `/api/partner-product-pack-specs`
- **UI Updates**: Pack Specs tab uses pack type selector instead of manual egg count input
- **Bulk Import Simplified**: 4 columns: code | name | type | grade

### Human-Readable Code Prefix System (January 3, 2026)
- **Design Pattern**: Integer primary keys for performance + separate human-readable code fields (matches SAP/Oracle/Microsoft Dynamics)
- **Entity Codes**: PREFIX-NNNN format (e.g., BP-0001, DS-0001, VH-0001)
- **Document Numbers**: PREFIX-YYYY-NNNN format (e.g., ORD-2024-0001, INV-2024-0001)
- **Utility Functions**: `formatCode()`, `formatDocumentNumber()`, `parseCode()` in `shared/constants/codePrefixes.ts`
- **Tables Updated**: businessPartners, deliverySites, suppliers, drivers, vehicles, partnerContacts, stockLocations, gradingActivities, sizedEggStock, packingActivities, finishedGoodsStock, stockMovements, deliverySchedules, priceAdjustments

### Business Partner Schema Refactor (January 3, 2026)
- **Unified Partner Model**: Merged `vendors` and `customerAccounts` into `businessPartners` table
- **Partner Types**: Single table supports customer, supplier, or both via `partnerType` field
- **Renamed Tables**: `customerContacts` → `partnerContacts`, `accountId`/`vendorId` → `partnerId`
- **Relation Names**: Updated Drizzle relations to use `partner` instead of `account`/`vendor`
- **Backward Compatibility**: Type aliases maintained for smooth transition (CustomerAccount = BusinessPartner, etc.)
- **Database Ready**: Fresh tables created for user data upload

### ERP Design System Implementation (January 3, 2026)
- **Thai Typography**: Noto Sans Thai as primary font for optimal Thai language readability
- **Brand Colors**: Primary red (#B70000), gold accent (#FFD44D), success green (#00B254)
- **Dark Sidebar**: #111827 background with light text (#E5E7EB) and red active indicators
- **Status Badges**: Thai ERP status colors (ร่าง, รอดำเนินการ, อนุมัติแล้ว, เสร็จสิ้น, ปฏิเสธ, เกินกำหนด)
- **Neutral App Background**: #F6F7F8 with white card surfaces for eye comfort
- **8px Border Radius**: Consistent rounded corners across components

### Customer & Contacts Enhancements (January 3, 2026)
- **Search Extended**: Search now includes delivery site names, addresses, provinces
- **Contacts Page**: Dedicated /database/contacts page with full CRUD, search, and sorting
- **Delete Functionality**: Added delete buttons with confirmation dialogs for customer accounts and delivery sites
- **Nickname Badge**: Moved nickname to 2nd column with colored badge for visual standout
- **Business Type**: Dropdown field (Individual/Corporation) added to customer accounts
- **Customer Type**: Dropdown field (Traditional Trade/Modern Trade) added to customer accounts
- **Thai Vehicle Options**: Updated acceptable vehicles to Thai: 4ล้อ, 4 ล้อ ต่อ, 6 ล้อ, ตู้ห้องเย็น
- **Thailand Regions**: Delivery zone dropdown with all regions (กรุงเทพและปริมณฑล, ภาคกลาง, ภาคเหนือ, etc.)

### Enhanced Contact & Delivery Site Management (January 2, 2026)
- **Contact Management**: Add/edit multiple contacts per customer account with name, role, phone, email, LINE ID
- **Delivery Region**: Renamed "Delivery Zone" to "Delivery Region" for clarity
- **Acceptable Vehicles**: Multi-select field for delivery sites (pickup, 6-wheel, 10-wheel, trailer, refrigerated, motorcycle)
- **Google Maps URL**: Field for storing and linking to Google Maps location
- Contacts table shows on customer row with inline edit and "Add" button

### Customer Nickname & Delivery Site Management (January 2, 2026)
- Replaced vendorId with **nickname** field in customerAccounts - stores the common name everyone uses (e.g., "MK - Makro")
- Added Add/Edit dialogs for delivery sites with full CRUD functionality
- Customers page now shows nickname column instead of vendor group
- Search now includes nickname in search terms

### Customer Schema Refactor (January 2, 2026)
Redesigned customer data structure from flat to account/site model:
- **customerAccounts**: Billing entities with nickname, business name, tax ID, branch info, credit terms, and billing address
- **deliverySites**: Delivery locations (one or more per account) with delivery type, address, GPS coordinates, and delivery zone
- **customerContacts**: Contacts linked to account (and optionally to specific delivery sites)
- Orders now reference both deliverySiteId (where to deliver) and accountId (who to bill)

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: TanStack React Query for server state and caching
- **Styling**: Tailwind CSS with shadcn/ui component library (New York style variant)
- **Build Tool**: Vite with custom plugins for Replit integration

### Backend Architecture
- **Runtime**: Node.js with Express
- **Language**: TypeScript with ESM modules
- **API Pattern**: RESTful endpoints defined in shared route definitions with Zod validation
- **Build Process**: esbuild for server bundling, Vite for client bundling

### Data Layer
- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Schema Location**: `shared/schema.ts` contains all table definitions
- **Migrations**: Drizzle Kit manages database migrations in `./migrations`
- **Validation**: Drizzle-Zod generates insert schemas from table definitions

### Authentication
- **Provider**: Replit OpenID Connect (OIDC) authentication
- **Session Storage**: PostgreSQL-backed sessions via connect-pg-simple
- **Session Management**: Express-session with secure cookie configuration

### Project Structure
- `client/` - React frontend application
- `server/` - Express backend with API routes
- `shared/` - Shared types, schemas, and route definitions
- `script/` - Build and utility scripts

### Key Design Patterns
- **Shared Route Definitions**: API contracts defined in `shared/routes.ts` with Zod schemas for type-safe client-server communication
- **Database Storage Class**: Centralized data access layer in `server/storage.ts`
- **Custom React Hooks**: Data fetching hooks in `client/src/hooks/` wrap React Query for each domain entity

## External Dependencies

### Database
- **PostgreSQL**: Primary database accessed via `DATABASE_URL` environment variable
- **Drizzle ORM**: Database queries and schema management

### Authentication
- **Replit OIDC**: User authentication via Replit's identity provider
- **Environment Variables**: `ISSUER_URL`, `REPL_ID`, `SESSION_SECRET`, `DATABASE_URL`

### UI Components
- **Radix UI**: Headless component primitives for accessibility
- **shadcn/ui**: Pre-built component library built on Radix
- **Lucide React**: Icon library

### Development Tools
- **Vite**: Development server with HMR
- **Replit Plugins**: Runtime error overlay, cartographer, dev banner for Replit environment