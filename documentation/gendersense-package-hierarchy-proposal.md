# Package hierarchy proposal



GenderSense
├── Enterprise
│   ├── Organisation          — roles, teams, governance structure
│   ├── Regulation            — CQC, ICO/GDPR, DCB0129, professional standards
│   ├── Strategy              — partnerships, business model, ethos & values
│   └── Risk                  — clinical risk, business continuity, safeguarding
│

├── Knowledge
│   ├── ClinicalDecisionSupport  — decision rules, eligibility criteria, monitoring protocols
│   ├── ConstraintLibrary        — composable clinical constraints, safety rules, interaction checks
│   ├── LogicEngine              — inference rules, Prolog-style reasoning, deterministic evaluation
│   ├── DecisionModels           — DMN-style decision tables, decision requirement graphs
│   ├── OutcomeFramework         — outcome definitions, measurement points, structured capture
│   ├── LearningCycles           — pathway refinement process, evidence review, change control
│   └── Analytics                — data contracts for BI/predictive/ML, event streams,
│                                  LLM integration points, advisory layer interface

├── ServiceDelivery
│   ├── PatientJourney        — top-level lifecycle (acquisition → discharge)
│   ├── ClinicalPathways
│   │   ├── HormoneTherapy    — initiation, monitoring, shared care
│   │   ├── Assessment        — new patient assessment, self-assessment, clinician assessment
│   │   ├── Referrals         — inbound, outbound, specialist
│   │   └── Prescribing       — prescribing, dispensing, monitoring
│   ├── Consent               — consent models, withdrawal, capacity
│   ├── CoachingSupport       — transition coaching, group work, peer support
│   ├── ClinicalGovernance    — policies, protocols, procedures, audit, outcome tracking
│   └── ClinicalEntities      — patient, episode, consultation, prescription, referral, lab result
│
├── Platform
│   ├── PatientPortal         — web platform, secure access, self-service
│   ├── Booking               — appointment scheduling, availability, reminders
│   ├── EHR                   — clinical record, demographics, document storage
│   ├── Forms                 — questionnaires, clinical forms, validation rules
│   ├── Messaging             — patient comms, secure messaging, notifications
│   ├── VideoConsulting       — telehealth integration
│   ├── LabInterface          — lab orders, results, pathology integration
│   ├── Prescribing           — electronic prescribing system integration
│   ├── Payments              — payment processing, invoicing, receipts
│   ├── Documents             — document generation, templates, signing
│   ├── Identity              — user accounts, authentication, authorisation
│   ├── Orchestration         — Temporal infrastructure, workflow engine
│   └── Integration           — API gateway, third-party connectors, Dante networking of services
│
├── Operations
│   ├── Finance               — billing, accounts, Xero integration
│   ├── People                — HR, contracts, indemnity
│   ├── Marketing             — acquisition funnel, content, community (Mighty Networks, Kit)
│   ├── CRM                   — prospect/patient relationship management
│   └── Reporting             — BI, operational dashboards, regulatory reporting
│
└── Foundation
    ├── MetadataLibrary       — @TemporalWorkflow, @ClinicalReviewGate, etc.
    ├── CommonTypes           — shared data types, enumerations, units
    ├── StatePatterns         — reusable lifecycle state machine patterns
    └── GenerationPipeline    — generator configs, templates, conventions