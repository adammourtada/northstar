# Northstar Product Requirements

## 1. Product Overview

Northstar is a Management Intelligence & Strategy Execution Platform designed to help organizations connect strategic objectives with execution.

The platform brings together strategy, projects, KPIs, risks, resources, and organizational performance so management can understand whether the organization is actually progressing toward its stated goals.

---

## 2. Target User

Northstar is initially designed for managers and leadership teams in small to mid-sized organizations that currently manage strategy and execution across disconnected tools.

Initial target users include:

- Operations managers
- Project managers
- Program managers
- Strategy managers
- Department heads
- Executives
- Management consultants
- Nonprofit and public-sector managers

---

## 3. Core Management Problem

Organizations often separate strategic planning from operational execution.

Strategic plans may exist in documents or presentations, while projects, KPIs, budgets, risks, and team responsibilities are managed across different systems.

This creates several problems:

- Management lacks a unified view of execution
- Strategic objectives can become disconnected from active projects
- Risks are identified too late
- KPIs are monitored without clear strategic context
- Resources may be allocated to low-priority work
- Executives spend significant time manually assembling status reports
- Teams may not understand how their work contributes to organizational priorities

Northstar is designed to connect these layers into a single management system.

---

## 4. Product Value Proposition

Northstar helps management answer five core questions:

1. What are we trying to achieve?
2. What work is currently supporting those goals?
3. Are projects and KPIs progressing as expected?
4. What risks or constraints require management attention?
5. Where should leadership intervene?

The platform converts fragmented organizational information into structured management intelligence.

---

## 5. MVP Scope

The MVP will focus on the core strategy-to-execution workflow.

The initial system will support:

- User authentication
- Organization creation
- Organization membership
- Strategic objectives
- Projects
- Project milestones
- KPIs
- KPI measurements
- Risks
- Executive dashboard
- Basic management alerts
- Basic organizational health indicators

---

## 6. Core User Workflow

A typical Northstar user will:

1. Create an organization
2. Define strategic objectives
3. Create projects linked to those objectives
4. Define milestones for each project
5. Create KPIs and performance targets
6. Record KPI measurements
7. Identify organizational and project risks
8. Review the executive dashboard
9. Identify projects, KPIs, or risks requiring management attention
10. Use Northstar's management intelligence features to understand emerging issues

---

## 7. MVP Features

### Organization Management

Users can:

- Create an organization
- Invite or add organization members
- Assign basic roles
- Ensure organization data remains isolated from other organizations

### Strategic Objectives

The initial implementation provides organization-scoped list, create, and edit
pages. Owners/admins/managers can write; members/viewers can read. The creator
is database-controlled and is the initial owner; assignment and deletion are
deferred. Progress is entered manually as an integer from 0 to 100. KPI definitions are
implemented separately; executive dashboard metrics remain planned.

Users can create objectives containing:

- Title
- Description
- Owner
- Priority
- Start date
- Target date
- Status
- Progress percentage

### Project Portfolio

Implemented: organization-scoped project list, create, and edit pages. Owners,
admins, and managers can manage projects; members and viewers are read-only.
Creation assigns the authenticated creator as initial owner. Owner reassignment
and deletion are deferred. Completion timestamps are maintained by the database.

Projects support zero or more strategic objectives through a same-tenant
many-to-many relationship. Create/edit forms show available objective titles as
checkboxes; the list displays linked titles or a no-alignment message. Fields,
selects, and checked objectives survive validation errors. No alignment/health
scores, milestones, KPIs, risks, dashboards, or AI are implemented by this feature.

Users can create projects containing:

- Project name
- Description
- Owner
- Status
- Start date
- Target date
- Strategic objective relationship

### Milestones

Implemented: project detail pages list milestones, with create/edit forms for
owners, admins, and managers. Members and viewers have read-only access. Progress
is an integer from 0 to 100; completion forces 100% and records a database-controlled
timestamp. Reopening clears that timestamp. Deletion and automatic project progress
calculations are deferred.

Projects can contain measurable milestones with:

- Name
- Deadline
- Completion status
- Progress

### KPI Monitoring

Implemented: organization-scoped KPI definition lists and create/edit forms, with
owner/admin/manager management and member/viewer read-only access. Definitions include:

- Name, optional description, and required unit
- Optional exact decimal target (up to 20 integer and 10 fractional digits)
- Direction: increase, decrease, or maintain
- Optional reporting frequency: daily, weekly, monthly, quarterly, or annually
- Status: active, paused, or archived
- Optional same-organization strategic objective, whose title appears in the list

Creation assigns the authenticated caller as owner. Forms preserve all submitted
values after errors and allow clearing objective alignment. Server routes/actions
and database RPCs enforce authorization; tenant-aware constraints protect relationships.
Deletion, ownership reassignment, and project-to-KPI links are deferred.
Measurements, current measured values, trends, charts, performance calculations,
alerts, and executive dashboards remain planned, rather than implemented.

### Risk Management

Users can create risks containing:

- Risk name
- Description
- Probability
- Impact
- Owner
- Mitigation action
- Related project or objective

### Executive Dashboard

The dashboard will provide management with a consolidated view of:

- Strategic objectives
- Active projects
- Project status
- KPI performance
- Major risks
- Items requiring management attention

---

## 8. Features Explicitly Excluded From the MVP

The following features will not be included in the first version:

- Payroll
- Accounting
- Full CRM functionality
- HR information systems
- Employee performance reviews
- Advanced workforce optimization
- Slack integration
- Microsoft Teams integration
- Jira integration
- Enterprise SSO
- Mobile applications
- Advanced forecasting
- Full process mining
- Automated resource optimization
- Complex AI agents
- Enterprise compliance tooling
- Full billing and subscription management

These may be considered in later releases.

---

## 9. Key Entities and Relationships

Northstar will initially contain the following major entities:

- User
- Organization
- Organization Member
- Strategic Objective
- Project
- Milestone
- KPI
- KPI Measurement
- Risk

Primary relationships:

- A user can belong to one or more organizations
- An organization can contain many users
- An organization can contain many strategic objectives
- A strategic objective can contain or relate to many projects
- A project can contain many milestones
- A strategic objective can contain many KPIs
- A KPI can contain many measurements
- Risks can relate to projects or strategic objectives

---

## 10. Initial Success Criteria

The MVP will be considered successful when a user can:

- Create an organization
- Create strategic objectives
- Link projects to strategic objectives
- Add project milestones
- Create and update KPIs
- Record KPI measurements
- Create and manage risks
- View a consolidated executive dashboard
- Identify which projects, KPIs, and risks require management attention
- Use the system without accessing data belonging to another organization

---

## 11. Future SaaS Considerations

Northstar should be architected so it can later become a commercial multi-tenant SaaS platform.

Future considerations include:

- Subscription plans
- Stripe billing
- Usage limits
- Advanced organization permissions
- Enterprise SSO
- API access
- Third-party integrations
- Audit logs
- Automated reporting
- AI-generated executive management briefs
- Resource allocation analysis
- Strategic alignment scoring
- Project health scoring
- Scenario modelling
- Decision intelligence
- Enterprise security and compliance requirements

The MVP should remain focused while preserving an architecture that can support these future capabilities.
