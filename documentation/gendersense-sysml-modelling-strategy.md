# GenderSense — SysML v2 Model-Driven Business System Design

## Comprehensive Modelling Strategy and Package Architecture

**Discussion Report — 4 March 2026**

Ella · GenderSense Development Programme

*Status: Working document. Companion to the Coffee Shop Demonstrator Summary, Architecture Principles, and Syntax Reference.*

---

## 1. Executive Summary

This report captures a strategic discussion about the use of SysML v2 as the unified modelling language for the entire GenderSense business system. The discussion took place following the successful completion of the Coffee Shop Action Flow Demonstrator, which validated a model-driven architecture in which SysML v2 models serve as the single source of truth for business processes, generating both executable runtime code and governance documentation from the same source.

The central question was whether SysML v2 can serve as the modelling foundation for every significant aspect of the GenderSense business, not just clinical pathways. The conclusion is that it can, with the understanding that the value proposition and depth of modelling varies across different parts of the business. Clinical pathway orchestration, entity lifecycle management, and governance traceability represent the inner core where model-driven execution is fully validated. Platform interfaces, decision support, and operational processes form a middle tier of structural design and partial generation. Business context, organisational structure, and marketing form an outer tier of architectural documentation.

A comprehensive top-level package structure was developed that covers enterprise context, service delivery, platform infrastructure, business operations, a knowledge and decision support layer, and cross-cutting foundation services. This structure is designed to give confidence that no significant concern lies off the map, while allowing each area to be elaborated at an appropriate level of detail and at the right time.

---

## 2. Background and Context

### 2.1 The Coffee Shop Demonstrator

The Coffee Shop Action Flow Demonstrator was completed on 3 March 2026. It validated the core thesis that a SysML v2 model can generate both Temporal workflows (for durable process execution) and visual pathway diagrams (for governance documentation) from a single source of truth. Four phases were completed: Temporal foundation (hand-coded workflow), generation (SysML-to-code pipeline), integration (XState lifecycle enforcement with a SvelteKit web UI), and governance outputs (pathway diagrams and compliance audit tables). All exit criteria were met.

Key architectural decisions validated by the demonstrator include Temporal for process orchestration, XState for entity lifecycle enforcement, a two-layer action flow architecture separating domain-level process description from orchestration-level execution detail, and metadata-driven generation using SysML v2 metadata definitions as first-class annotation mechanisms.

### 2.2 Prior Analytical Work

Significant business analysis and systems design work has been undertaken over several years across multiple projects, most notably the SHC/MedMind online private GP-led mental health service (2018). This work produced detailed artefacts including UML use case diagrams defining system purpose and actor interactions, BPMN 2.0 process maps for discovery, registration, assessment, and clinical workflows, a top-level five-phase patient journey model (Acquisition, Registration, Assessment, Treatment, Follow Up), UML class diagrams mapping technology components and their relationships, and detailed data object catalogues referenced throughout the process models.

While the clinical domain has shifted from general mental health to gender-affirming healthcare, and the technology choices have evolved significantly, the structural thinking transfers directly. The five-phase patient journey arc, the use case decomposition approach, the identification of data objects within process flows, and the technology capability mapping all provide valuable input to the GenderSense SysML v2 model.

### 2.3 The Architecture Principles

A companion discussion established the foundational architecture principles for GenderSense. The most important of these is the separation of the representation layer (where knowledge lives: process definitions, entity lifecycles, clinical data structures, decision logic, governance requirements) from the execution layer (where things happen: Temporal workflows, XState machines, openEHR CDR, external service integrations, front-end applications). Execution components consume the representation layer but do not define it. When any aspect of the system needs to change, the change happens in the representation layer and propagates to execution via generation or configuration.

### 2.4 Modelling Philosophy

The approach to comprehensive modelling is informed by several factors. There is a strong preference, rooted in long experience and reinforced by an autistic cognitive style, for delimiting the working space from the top down to avoid the psychological concern that something unconsidered lies off the map. This brings the acknowledged risk of mission creep and over-complication, but this risk is managed by adopting suitable levels of abstraction from the top down. Not every area requires the same depth of modelling; the discipline is in choosing the right level for each area and resisting the urge to elaborate prematurely.

The analogy is a large sheet of paper on which areas of key relationships and concepts are pencilled in. More or less detail can be added at different abstraction layers as appropriate. The sheet is not a blueprint for building everything from scratch; it is a map that makes assumptions and scope explicit, identifies relationships and dependencies, and ensures that when detailed work begins in any area, its context within the whole is understood.

---

## 3. The Case for Comprehensive Modelling

### 3.1 A Self-Describing System

The conventional framing of system modelling is to model the system so it can be built. The GenderSense framing is subtly different and more powerful: model the system so it can explain itself. This means that reporting on activity, decision logic, structural semantics, constraints, governance, entity and relationship ontologies, and similar features are all first-class citizens of the environment, not afterthoughts added later.

A system designed from the ground up with these properties is intrinsically self-describing. It knows what it is, what it is doing, why it is doing it, and what rules govern it, because all of that is encoded in the model that generates and drives it. Meeting business needs, including regulatory and governance requirements, becomes much more straightforward when the system can produce its own evidence rather than requiring manual documentation and audit processes.

### 3.2 Regulatory and Governance Implications

For a regulated clinical service, the self-describing property has concrete and significant implications:

- **CQC and clinical governance:** The system can answer questions such as "show me the defined pathway for hormone therapy initiation, show me every instance where a patient deviated from that pathway, and show me the decision logic applied at each deviation point" with full traceability to the model. This transforms audit from a painful manual process into a system capability.
- **Clinical risk management:** DCB0129/DCB0160 require demonstration that clinical systems behave as specified and that hazards can be traced through the system. When the SysML model that defines the pathway is the same artefact that generates the running code, the traceability gap that plagues most clinical software largely disappears.
- **Indemnity and defensibility:** A practice that can demonstrate formally defined clinical processes, system enforcement of those processes, and complete audit trails showing conformance presents a materially stronger risk profile to indemnifiers.
- **Business intelligence:** If every process, decision, entity state transition, and constraint evaluation is modelled and tracked, then operational questions (average referral-to-appointment time, pathway bottlenecks, patients awaiting lab results) are queries over existing event history rather than separate analytics pipelines.

### 3.3 Why SysML v2 Specifically

SysML v2 is preferred over alternative modelling approaches (separate UML, BPMN, and diagramming tools) because it provides a single semantically typed model. A dependency in a diagram is just a line. A `satisfy` relationship in SysML v2 means something specific: this element satisfies that requirement, and a tool can trace, validate, and report on it.

The 2018 SHC work used three separate formalisms (use case diagrams for purpose, BPMN for process, UML class diagrams for technology structure) that could not reference each other formally. Data objects in BPMN floated free without type definitions or lifecycle state machines. Swim lanes corresponded to subsystems by naming convention only. SysML v2 closes all of these gaps by providing a unified model where structural elements, behavioural elements, requirements, constraints, and metadata all participate in a single queryable, generatable knowledge structure.

---

## 4. Modelling Value Across the Business

The value proposition of SysML v2 modelling varies across different parts of the business. This section categorises areas by the strength of the model-to-execution pipeline and the nature of the modelling investment.

### 4.1 Strong Model-to-Execution Value

These are areas where the coffee shop demonstrator patterns apply directly and the modelling investment generates executable code, governance documentation, or both.

- **Clinical pathway orchestration:** Each clinical pathway (hormone therapy initiation, new patient assessment, ongoing monitoring, referrals) maps to a SysML v2 action flow at the domain layer, generates a Temporal workflow at the orchestration layer, and produces visual pathway diagrams and compliance audit tables for governance.
- **Entity lifecycle management:** Every entity with state (patient, episode, consultation, prescription, referral, lab result, booking, payment, support ticket) can be modelled as a SysML state machine, enforced by XState at runtime, and audited. Invalid transitions are rejected regardless of what application code requests.
- **Service contracts and interfaces:** The interfaces between platform subsystems (what data flows between booking and pathway tracking, what the EHR exposes to the patient portal, what the lab interface expects and returns) can be modelled as SysML v2 ports and generate TypeScript types or API schemas.
- **Requirements and constraints traceability:** Clinical governance requirements, CQC obligations, data protection constraints, and safeguarding policies can be modelled as SysML requirements with satisfy/verify relationships to system elements, enabling cross-cutting compliance queries.

### 4.2 Valuable Modelling with Partial Execution

These are areas where the model provides significant structural design value and some generation is feasible, but the model does not generate complete implementations.

- **Business operations processes:** Processes such as contract approval, invoice lifecycle, and complaint handling are structurally identical to clinical pathways and could drive Temporal workflows. The model defines the process; some execution can be generated; but the complete implementation includes integrations with tools like Xero that the model does not replace.
- **Forms and questionnaires:** The structure of clinical forms (fields, validation rules, conditional logic, data mappings) is highly amenable to SysML modelling. Generation of form definitions from the model is feasible and worth pursuing, given that forms are a major surface area for clinical data capture.
- **Clinical decision support and logic programming:** Decision rules, eligibility criteria, monitoring protocols, and constraint evaluation can be modelled as SysML constraints and decision tables, with generation targeting a logic engine runtime for deterministic, auditable reasoning.

### 4.3 Architectural Documentation Value

These are areas where the model primarily serves as structural design documentation, providing the connective tissue for cross-cutting queries and making the system boundary and its assumptions explicit.

- **Organisational structure:** Roles, teams, governance structures, and responsibility allocations are modelled as parts with allocated responsibilities, but do not generate executable code.
- **Third-party integrations:** The model defines the boundary contract (what data is sent, received, error states, timeouts) for each external service, regardless of whether the integration is built or bought.
- **Marketing, community, and content:** Processes such as content approval or community onboarding can be modelled, but much of this domain is inherently creative and ad-hoc. The model defines touchpoints and data flows rather than generating execution.
- **Brand, design, and tone of voice:** Not system-modellable in any meaningful sense. The model can define where brand assets are used and what content types exist, but not what they look like.

---

## 5. Mapping Legacy Artefacts to SysML v2

The 2018 SHC/MedMind work and other legacy projects provide a significant head start. Each diagram type maps to SysML v2 as follows.

### 5.1 Use Case Diagrams

SysML v2 has `use case` as a language element with `include` and `extend` relationships. The semantic content (actors, system boundary, use cases, extension points) maps directly. Visual rendering in Syside Modeler is less polished than in Visual Paradigm, so the recommended approach is to model use cases in SysML v2 for semantic traceability (enabling queries such as "requirement R.001 is satisfied by use case UC.02.03 which is realised by action flow AF.ClinAssessment") while accepting that presentation-quality use case diagrams may continue to be produced in VP for communication purposes.

### 5.2 BPMN Processes

This is the most significant and most valuable transition. BPMN process maps such as the clinician assessment (BP.02.03) map almost directly to SysML v2 action flows at the domain layer. Activities become action nodes. Swim lanes become partitions or allocations to structural parts. Data objects become typed items flowing through the action flow, each with its own lifecycle state machine.

What SysML v2 gains over BPMN is integration: data objects are typed and traceable, preconditions reference constraints on entity state, constraints trace to requirements, and requirements are verifiable by runtime checks. What is lost is the richness of the BPMN event model (message events, timer events, error events, compensation handlers). The coffee shop demonstrator handles this pragmatically through orchestration-layer Temporal metadata annotations.

### 5.3 Top-Level Process Maps

The five-phase patient journey model (Acquisition, Registration, Assessment, Treatment, Follow Up) maps to a top-level SysML v2 action flow in the PatientJourney package. This provides the structural skeleton that detailed pathways elaborate and makes visible the relationship between clinical and non-clinical touchpoints.

### 5.4 Technology Component Diagrams

The UML class diagram mapping technology components maps to a SysML v2 structural model using part definitions with metadata annotations. Technology categories become part definitions. Concrete products become usages or specialisations with `@Preferred` or `@Alternative` annotations. Crucially, these structural parts can be formally allocated to action flow steps, enabling impact analysis ("what happens if we replace service X with service Y?").

### 5.5 Gathering and Synthesising Legacy Material

There is a fair amount of legacy business analytics material from projects and businesses over the years beyond MedMind. Similarities and evolution across these projects suggest value in gathering the various artefacts and synthesising structural patterns, entity catalogues, process inventories, and recurring architectural themes. Claude Cowork is well suited to this kind of trawl-and-synthesise task, producing a curated input set for the SysML modelling work.

---

## 6. Knowledge, Decision Support, and Adaptive Behaviour

A distinctive feature of the GenderSense system design is the explicit treatment of knowledge, decision logic, and adaptive behaviour as first-class architectural concerns rather than afterthoughts.

### 6.1 The Three-Tier Reasoning Stack

The system's reasoning capabilities are organised into three architecturally distinct tiers:

- **Tier 1 — Deterministic logic:** Constraint evaluation, eligibility rules, safety checks, drug interaction screening. Implemented via logic programming or constraint evaluation (preserving explicit space for Prolog-style inference). Fully traceable, always auditable, never overridden. When the system says a patient is not eligible, the exact chain of inference is available as a formal proof.
- **Tier 2 — Structured decision support:** DMN-style decision tables for clinical protocol decisions (prescribing protocols, referral routing, risk stratification). Also deterministic and auditable, but more expressive for multi-factor evaluation. Decision tables map well to SysML v2 constraints and can be read and validated by clinicians.
- **Tier 3 — ML/LLM-augmented intelligence:** Pattern recognition, natural language processing of clinical notes, predictive analytics, literature synthesis. Powerful but probabilistic, and always advisory rather than authoritative. The upper tier can inform but never override the lower tiers.

### 6.2 Logic Programming

There is a deliberate decision to preserve an explicit architectural space for logic programming when conducting system-augmented evaluations and decisions. Logic programming (Prolog-style inference, DMN, constraint solving) provides deterministic, auditable, reproducible reasoning with a complete explanation trace. This is fundamentally different from what LLMs provide and is essential for regulated clinical decision support. A clinical governance report requires formal proof of reasoning, not probabilistic estimation.

The SysML model can define logic rules as constraints and decision tables as structured value types. The generation pipeline can target a logic engine runtime (whether an embedded Prolog, a TypeScript constraint evaluator, or a DMN engine) alongside the Temporal workflows and XState state machines. The metadata library in Foundation gets annotations such as `@LogicRule`, `@DecisionTable`, and `@SafetyConstraint` that the generators use to route each piece of reasoning to the appropriate evaluation tier.

### 6.3 Outcome Tracking and Learning Cycles

The system records structured outcomes: not just that a patient was treated, but the specific regimen, monitoring results at defined intervals, whether clinical targets were achieved, and any adverse events. Over time this builds a dataset that informs pathway refinement. The learning cycle is: capture structured outcomes → analyse patterns → propose pathway refinement → clinical governance review → update model → regenerate. The model is the mechanism for both capturing and enacting the learning.

### 6.4 Predictive and Adaptive Behaviour

Predictive capabilities (trajectory-based dose adjustment suggestions, capacity pressure forecasting) sit at the outer edge of what the model directly generates. The model's contribution is defining the data structures and event streams that feed predictive analytics, and defining the action points where predictions are surfaced to clinicians or operations. The crucial architectural principle is that adaptive features suggest and inform; they do not autonomously alter pathways or override gates. Any pathway change goes through the learning cycle's governance process and results in a model update.

---

## 7. Top-Level Package Structure

The following package structure is designed to ensure that every significant concern within the GenderSense business system has an identified home, while allowing each area to be elaborated at the appropriate level of detail and at the right time. Packages are grouped into six top-level concerns. Most packages begin as lightweight placeholders containing only high-level part definitions and use case outlines; elaboration proceeds from the inside out, with clinical pathway packages receiving the most detailed and rigorous modelling first.

### 7.1 Enterprise

Defines what GenderSense is and how it is governed. Primarily architectural documentation; provides the anchoring context that everything else traces to.

| Package | Purpose |
|---|---|
| **Organisation** | Roles, teams, governance structure, board, leadership, responsibility allocations |
| **Regulation** | CQC fundamental standards, ICO/GDPR obligations, DCB0129/DCB0160 clinical safety, GMC professional standards, Equality Act requirements |
| **Strategy** | Partnerships, business model, ethos and values, CIC/limited company structure, strategic direction |
| **Risk** | Clinical risk management, business continuity, safeguarding framework, information governance risk |

### 7.2 ServiceDelivery

The clinical and operational heart of the system. This is the inner ring where model-driven execution is fully validated and the coffee shop demonstrator patterns apply directly. Maximum modelling rigour and full generation pipeline.

| Package | Purpose |
|---|---|
| **PatientJourney** | Top-level lifecycle from acquisition through to discharge/follow-up. The five-phase arc that provides the structural skeleton for detailed pathways. |
| **ClinicalPathways::HormoneTherapy** | Hormone therapy initiation, titration, monitoring, shared care protocols. The recommended first clinical pathway to model end to end. |
| **ClinicalPathways::Assessment** | New patient assessment, self-assessment instruments, clinician assessment, formulation and treatment planning. |
| **ClinicalPathways::Referrals** | Inbound referral processing, outbound specialist referrals, shared care arrangements with GPs. |
| **ClinicalPathways::Prescribing** | Prescribing protocols, dispensing, medication monitoring, repeat prescriptions, dose adjustments. |
| **Consent** | Consent models (informed consent, capacity assessment), consent withdrawal, ongoing consent management. |
| **CoachingSupport** | Transition coaching services, group work, peer support programmes. |
| **ClinicalGovernance** | Policies, protocols, procedures, clinical audit, outcome tracking, significant event analysis. |
| **ClinicalEntities** | Core domain entities: Patient, Episode, Consultation, Prescription, Referral, LabResult. Each with lifecycle state machine. Referenced by all pathways. |

### 7.3 Platform

The technology systems that support service delivery. Each subsystem is modelled as a part definition with ports defining its interfaces. Build-vs-buy decisions are independent of the model; the model captures what each subsystem does and how it connects.

| Package | Purpose |
|---|---|
| **PatientPortal** | Web platform, secure access, patient self-service, dashboard. |
| **Booking** | Appointment scheduling, availability management, reminders, cancellation handling. |
| **EHR** | Clinical record (openEHR CDR), demographics, document storage, AQL queries, archetype/template management. |
| **Forms** | Questionnaires, clinical assessment forms, validation rules, conditional logic, data mappings to CDR compositions. |
| **Messaging** | Patient communications, secure messaging, notifications, email, SMS. |
| **VideoConsulting** | Telehealth platform integration, session management. |
| **LabInterface** | Laboratory orders, results receipt, pathology integration, SNOMED-coded results. |
| **Prescribing** | Electronic prescribing system integration, medication databases, interaction checking. |
| **Payments** | Payment processing, invoicing, receipts, subscription management. |
| **Documents** | Document generation, templates, electronic signing, document storage. |
| **Identity** | User accounts, authentication, authorisation, role-based access control. |
| **Orchestration** | Temporal infrastructure, workflow engine, worker deployment, workflow versioning. |
| **Integration** | API gateway, third-party connectors, webhook management, event routing. |

### 7.4 Operations

Back office and growth functions. Modelled at the lightest level: enough structure to show data flows between operations and clinical service delivery, but not attempting to model the internal workings of accounting or newsletter production.

| Package | Purpose |
|---|---|
| **Finance** | Billing, accounts, Xero integration, financial reporting, payroll interfaces. |
| **People** | HR, contracts, indemnity arrangements, personnel management. |
| **Marketing** | Acquisition funnel, content production, community development (Mighty Networks, Kit), advertising, SEO. |
| **CRM** | Prospect and patient relationship management, communication preferences, segmentation. |
| **Reporting** | Business intelligence, operational dashboards, regulatory reporting, KPI tracking. |

### 7.5 Knowledge

Explicit treatment of knowledge, decision logic, and adaptive behaviour as first-class architectural concerns. Cross-cutting: imported by clinical pathways, referenced by governance, and consuming outcome data.

| Package | Purpose |
|---|---|
| **ClinicalDecisionSupport** | Decision rules, eligibility criteria, monitoring protocols, clinical guidelines modelled as evaluable constraints. |
| **ConstraintLibrary** | Composable clinical constraints, safety rules, drug interaction checks, contraindication screening. |
| **LogicEngine** | Inference rules, Prolog-style reasoning, deterministic constraint evaluation. Explicit architectural space for logic programming. |
| **DecisionModels** | DMN-style decision tables, decision requirement graphs, multi-criteria clinical protocol decisions. |
| **OutcomeFramework** | Outcome definitions, measurement points, structured outcome capture, outcome-to-pathway feedback. |
| **LearningCycles** | Pathway refinement process, evidence review, change control governance. Itself modelled as an action flow. |
| **Analytics** | Data contracts for BI and predictive analytics, event stream definitions, ML/LLM integration points, advisory layer interface definitions. |

### 7.6 Foundation

Cross-cutting infrastructure that everything else imports. The shared vocabulary of the entire model.

| Package | Purpose |
|---|---|
| **MetadataLibrary** | `@TemporalWorkflow`, `@TemporalActivity`, `@TemporalSignal`, `@StateTransitionTrigger` (validated in demonstrator), plus clinical extensions: `@ClinicalReviewGate`, `@ConsentRequired`, `@AuditPoint`, `@LogicRule`, `@DecisionTable`, `@SafetyConstraint`. |
| **CommonTypes** | Shared data types, enumerations, units of measure, value types used across the model. |
| **StatePatterns** | Reusable lifecycle state machine patterns (created/active/suspended/completed/cancelled and variants). Many entities share similar lifecycle shapes. |
| **GenerationPipeline** | Generator configurations, template definitions, generation conventions, output format specifications. |

---

## 8. Structural Principles for the Model

### 8.1 Concentric Rings of Modelling Rigour

The model should be thought of in concentric rings of decreasing modelling rigour:

- **Inner ring — Clinical pathway system:** Pathway models, entity lifecycles, governance outputs. Full model-driven execution with generation pipeline. Maximum rigour.
- **Middle ring — Supporting infrastructure:** Service interfaces, data models, forms, booking, patient portal, messaging. Modelled for structural clarity and interface generation, with varying degrees of code generation.
- **Outer ring — Business context:** Organisational structure, back office processes, marketing, partnerships. Modelled at a higher level of abstraction for traceability and architectural documentation.

All three rings live in the same model and can reference each other. The inner ring receives the most modelling investment; the outer ring accepts that the model is a useful map rather than the territory itself.

### 8.2 ClinicalEntities Separation

Core domain entities (Patient, Episode, Consultation, Prescription, Referral, LabResult) are deliberately separated from the pathways that operate on them. These are the nouns of the clinical domain, each with a lifecycle state machine. Pathways are the verbs. This separation means the Patient lifecycle is defined once and referenced from every pathway, rather than being redefined inside each pathway.

### 8.3 ServiceDelivery/Platform Split

The ServiceDelivery and Platform packages mirror the two-layer action flow architecture from the demonstrator. ServiceDelivery is the domain layer describing clinical processes in terms meaningful to clinicians and governance reviewers. Platform is the orchestration and infrastructure layer describing how the system implements those processes. The connection between the two layers is made through allocation relationships: each domain-layer activity is allocated to one or more platform subsystems.

### 8.4 Regulation as a First-Class Package

Regulatory and compliance requirements have their own package rather than being scattered across the model. CQC fundamental standards, GDPR data protection requirements, DCB0129 clinical safety requirements, GMC professional standards, and Equality Act obligations are modelled as requirements in one place, with `satisfy` relationships connecting them to the system elements that implement them. This enables the cross-cutting traceability queries that make compliance demonstrable.

### 8.5 Foundation as Shared Vocabulary

The Foundation package is the cross-cutting infrastructure that everything else imports. The metadata definitions validated in the coffee shop demonstrator live here and grow. Common type definitions, reusable state machine patterns, and generation pipeline configuration provide the shared vocabulary that ensures consistency across the entire model.

### 8.6 Avoiding Over-Modelling

Not every area benefits from formal modelling to the same depth. The guiding principle is that the model should earn its keep by either generating something (code, documentation, diagrams) or by making a non-obvious structural relationship visible. If modelling something merely restates the obvious, that is a signal to stop. The package structure permits elaboration but does not require it.

---

## 9. Recommendations

### 9.1 Immediate Next Steps

#### 9.1.1 Establish the top-level package skeleton

Create the full package hierarchy in Syside Modeler with minimal content: package declarations, brief doc comments describing scope, and placeholder use case definitions where appropriate. This immediately provides the "nothing is off the map" assurance and creates the namespace structure for all subsequent work. Time estimate: one to two sessions.

#### 9.1.2 Gather and synthesise legacy artefacts

Collect legacy business analysis material from SHC/MedMind and other prior projects. Use Claude Cowork to trawl through the material and extract structural patterns, entity catalogues, process inventories, and recurring architectural themes. The output is a curated synthesis document that informs the SysML modelling, not a direct import. This can proceed in parallel with the package skeleton work.

#### 9.1.3 Model the first clinical pathway

Following the demonstrator's recommendation 7.2, model hormone therapy initiation end to end using the validated architecture. This pathway exercises long-running waits (lab results, specialist referrals), multiple participants (patient, GP, endocrinologist, phlebotomy), governance requirements (consent, clinical review intervals, monitoring schedules), and the full two-layer action flow pattern. It will be the proof that the architecture works at realistic clinical complexity.

### 9.2 Near-Term Priorities

#### 9.2.1 Validate the satisfy/verify traceability chain

Verify that SysML v2 requirement-to-constraint traceability (`satisfy`/`verify` relationships) works in Syside Modeler. For GenderSense, clinical requirements must trace to evaluable constraints, which must trace to runtime checks, which must trace to audit evidence. This was not verified in the demonstrator and should be an early priority.

#### 9.2.2 Extend the metadata library for clinical patterns

Build on the demonstrator's TemporalMetadata package with metadata definitions for clinical-specific patterns: consent requirements, clinical review gates, multi-participant handoff points, regulatory reporting triggers, logic rule markers, and decision table annotations. These form the shared vocabulary that all pathway models import.

#### 9.2.3 Evaluate Syside Automator for generation

The demonstrator used regex-based SysML parsing, which was adequate for controlled formatting but fragile for larger models maintained over longer periods. Syside Automator provides semantic model access and should replace the regex generators. Early evaluation will determine whether Automator's capabilities are sufficient for the planned generation targets.

#### 9.2.4 Validate the openEHR integration patterns

As identified in the Architecture Principles document, the immediate technical priority is validating the openEHR CDR integration: standing up EHRbase locally, designing minimal archetypes and templates, committing compositions from Temporal workflow activities, querying via AQL, and running a population-level governance query.

### 9.3 Medium-Term Considerations

#### 9.3.1 Logic engine integration

Determine the runtime target for logic programming: embedded Prolog (e.g. Tau Prolog in TypeScript), a dedicated constraint evaluation library, a DMN engine, or a combination. The choice should be informed by the complexity of the clinical decision rules encountered during the first pathway modelling. The architectural space is reserved in the Knowledge::LogicEngine package; the implementation technology decision can be deferred until the rules are better understood.

#### 9.3.2 Form generation from model

Investigate generation of clinical form definitions from SysML v2 model elements. Forms are a major surface area for clinical data capture and a natural candidate for model-driven generation. The form model should capture fields, validation rules, conditional logic, and mappings to openEHR compositions.

#### 9.3.3 Population-level governance

Extend the Phase D governance pattern from individual workflow audit to population-level clinical governance. This involves scheduled Temporal workflows that query the CDR, evaluate rules derived from the SysML model, and produce governance reports covering the entire patient cohort.

#### 9.3.4 Temporal deployment planning

Plan the transition from the development environment (`temporal server start-lite`) to a durable deployment. Self-hosted Temporal on a small cloud VM with PostgreSQL persistence is the recommended starting point, with Temporal Cloud as an option if operational overhead becomes a concern.

---

## 10. Summary

The Coffee Shop Demonstrator validated that SysML v2 models can serve as a single source of truth for generating executable workflows, state machines, visual pathway documentation, and governance audit outputs. This report extends that validation to consider the use of SysML v2 as the unified modelling foundation for the entire GenderSense business system.

The conclusion is that comprehensive SysML v2 modelling is both feasible and valuable, with the understanding that modelling rigour should vary by area: maximum for clinical pathways and entity lifecycles, moderate for platform interfaces and decision support, and lightweight for business context and organisational structure. The self-describing property of a system designed this way has concrete regulatory, governance, and operational benefits that go well beyond conventional system documentation.

A comprehensive top-level package structure has been defined covering enterprise context, service delivery, platform infrastructure, business operations, knowledge and decision support, and cross-cutting foundation services. This structure ensures that every significant concern has an identified home, while allowing elaboration to proceed at the right pace and in the right order.

The explicit preservation of architectural space for logic programming, deterministic constraint evaluation, and structured decision models alongside ML/LLM-augmented intelligence is a distinctive and important design decision. For a regulated clinical service, the ability to provide formal, auditable, reproducible reasoning chains for clinical decisions is not optional.

The recommended path forward begins with establishing the package skeleton, gathering and synthesising legacy analytical material, and modelling the first clinical pathway (hormone therapy initiation) end to end. This work proceeds incrementally, guided by the architecture principles already established, with each step validating and extending the model-driven approach at increasing clinical complexity.

---

*Document status: Working document. Companion to the Coffee Shop Demonstrator Summary (4 March 2026), Architecture Principles (4 March 2026), and SysML v2 Syntax Reference (v3.0, 3 March 2026).*
