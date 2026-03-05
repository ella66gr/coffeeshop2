# GenderSense Architecture: Principles and Insights

**Summary of exploratory discussion, 4 March 2026**

*Captures the architectural thinking emerging from completion of the Coffee Shop Demonstrator and initial consideration of the clinical data repository, governance, decision support, and service integration layers.*

---

## Context

The Coffee Shop Action Flow Demonstrator validated a core thesis: SysML v2 models can serve as a single source of truth, generating executable Temporal workflows, XState state machines, visual pathway diagrams, and governance audit outputs. All success criteria were met across four phases. The full project summary and phase journals are companion documents.

This discussion explored what comes next: extending the validated architecture to support the full range of capabilities GenderSense requires as a clinical service. The conversation deliberately stayed at a high level, seeking to establish principles and identify constraints rather than to design specific components. The guiding concern throughout was that no decision taken now should prevent the kind of modular, flexible, robust, and adaptable system that GenderSense needs to grow into.

---

## The separation principle

The single most important architectural principle to emerge is the separation of the representation layer from the execution layer.

The **representation layer** is where knowledge lives. It includes process definitions (SysML v2 action flows), entity lifecycle rules (SysML v2 state definitions), clinical data structures (openEHR archetypes and templates), decision logic and clinical rules (SysML v2 constraints), governance requirements (SysML v2 requirements), and terminology bindings (SNOMED CT via openEHR). This layer is declarative. It describes what the system knows, what it expects, and how things should work. It is the source of truth.

The **execution layer** is where things happen. It includes process orchestration (Temporal workflows generated from SysML), state enforcement (XState machines generated from SysML), clinical data persistence (openEHR CDR accessed via REST API), external service integrations (booking, payments, messaging, video, labs — each accessed via its own API), and front-end applications (clinician-facing, patient-facing, operational).

The principle is that execution components consume the representation layer but do not define it. Process logic lives in the model, not in application code. Clinical data structure lives in archetypes, not in database schemas. Decision rules live in constraints, not in if-statements scattered through the codebase. When any of these need to change, the change happens in the representation layer and propagates to execution via generation or configuration.

This separation is what makes the system adaptable. Business direction can change — new pathways, new service models, new partnerships, new regulatory requirements — and the response is to update the representation layer, not to rewrite application code.

---

## The clinical data repository

openEHR was identified as the underpinning architecture for the clinical record. The ecosystem has matured significantly and now offers viable open-source CDR options (EHRbase), active community and specification development, a five-year SNOMED CT collaboration for first-class terminology integration, and a data model (archetypes and templates) that cleanly separates clinical semantics from application logic.

### How openEHR fits the architecture

openEHR provides the persistent, semantically structured clinical data layer. It complements the process and state layers validated in the demonstrator. Data enters the CDR from two paths: **workflow-driven** (Temporal activities commit compositions as part of pathway execution) and **form-driven** (clinicians or patients enter data directly via front-end forms, outside any workflow). Both paths produce the same kind of structured, queryable, semantically typed data. The CDR does not care how data arrived; it stores compositions conforming to templates built from archetypes.

### Two views onto the same data

The clinical record supports two fundamentally different but equally necessary views.

The **process view** shows where a patient is in their care pathway — what has happened, what happens next, who is responsible, whether the pathway is on track. This is driven by Temporal workflow state and history.

The **entity view** shows the patient's record organised by type of information — demographics, blood results, medications, consultations, assessments, communications, safeguarding. This is driven by AQL queries against the CDR, filtering by archetype type. Each entity view is essentially a query template paired with a front-end rendering component.

These are not separate systems. They are two views onto the same underlying data. A blood result committed by a pathway activity appears in both the process audit trail (via Temporal history) and the blood results entity view (via AQL query against the CDR). The architecture supports both without duplication.

### Preliminary decisions for openEHR

The following decisions were identified as necessary before implementation, with the recommendation to validate them via a coffee shop CDR extension exercise before applying them to clinical data:

- **CDR choice:** EHRbase (open-source, Java/PostgreSQL, Docker-based, REST API) is the natural starting point for development. Commercial hosted options exist for later if operational burden becomes a concern.
- **Archetype and template design:** Use the Archetype Designer (Better, web-based, free) for visual modelling. Search the Clinical Knowledge Manager for existing archetypes before creating new ones. For GenderSense, existing archetypes will cover common clinical concepts (lab results, medications, encounters); gender-specific patterns may require new archetypes.
- **SysML-to-openEHR integration:** Two levels were identified. Runtime integration (activities commit compositions via REST) is the immediate priority. Model-level integration (generating template definitions or composition-construction code from SysML) is a future possibility that should be deferred until hands-on archetype experience informs the design.
- **SNOMED CT:** Effectively mandated by the NHS context. The SNOMED/openEHR collaboration means binding patterns will be increasingly well-documented. Design archetypes with terminology binding slots from the outset.

---

## Governance audit across the EHR

The demonstrator validated process-level audit: did this specific workflow execution follow its defined pathway? GenderSense also requires population-level audit across the entire patient cohort.

Examples: does every patient have height and weight recorded within six months? What is the state of adherence to blood test monitoring schedules? Are hormone levels within therapeutic ranges? Are prescribing guidelines being followed?

These are AQL queries against the CDR compared against rules derived from the SysML model. The CDR provides the "what has actually been recorded" data. The SysML requirements and constraints provide the "what should have been recorded, and when" rules. Compliance is the comparison between the two.

This could run as scheduled Temporal workflows — periodic audit processes that query the CDR, evaluate rules, and produce governance reports. The pattern is a direct extension of the Phase D compliance table, scaled from individual workflow execution to population-level record keeping.

---

## Clinical decision support

Three levels of decision support were identified, all operating on structured CDR data evaluated against model-derived rules.

**Rule-based triggers:** If clinical data meets certain conditions (e.g. hormone level outside therapeutic range), flag for review. This maps to SysML constraint evaluation against CDR query results.

**Pathway triggers:** When conditions are met, automatically initiate a new pathway or referral without waiting for a clinician to notice and act. This is a Temporal workflow started programmatically in response to CDR data.

**Self-care support:** If the CDR holds structured data and the clinical rules are formally modelled, patient-facing interfaces can present personalised guidance derived from the same data and rules that inform clinical decisions. Patients see their own results, understand therapeutic ranges, know when monitoring is due, and receive prompted self-assessments at the right intervals — all generated from the model.

The single-source-of-truth principle extends into clinical reasoning: a change to a monitoring guideline updates the model, which regenerates the constraint logic, which changes both clinician alerts and patient-facing information simultaneously.

---

## Issue, complaint and query management

When a patient raises a query or complaint, the handler needs a coherent composite picture: pathway status (from Temporal), clinical history (from CDR), communications (from CDR and messaging services), and governance context (from audit data). This is an aggregation pattern that queries multiple authoritative sources and assembles a case view.

The same infrastructure supports contingency handling. When something goes wrong in a pathway — missed appointment, overdue blood test, failed referral — the governance audit detects it, and a contingency workflow is initiated automatically. Issue management tracks resolution. Everything is auditable because it's all either workflow-driven or data-driven.

---

## External service integration

Booking, scheduling, payments, messaging, mobile applications, audio/video consultations, and lab ordering are solved problems with mature APIs. GenderSense does not need to build any of these. It needs to orchestrate them as participants in clinical processes and ensure the data they produce flows into the right places.

Each external service is consumed via a Temporal activity whose implementation is a thin wrapper around an API call. The SysML model defines where in the pathway the integration occurs and what data flows to and from it. The workflow orchestrates the sequence, including retry, timeout, and failure handling via Temporal's durable execution model.

The medication review example illustrates the pattern: the pathway requires a review before prescription renewal. The workflow orchestrates booking an appointment, taking payment, ordering bloods, notifying the patient, hosting the consultation, and recording the outcome. Each step calls an external service. The workflow reads as a straightforward sequence; Temporal handles durability and recovery underneath.

Metadata annotations (extending the @TemporalActivity, @TemporalSignal patterns from the demonstrator) can mark activity steps as external integration points. The generator produces the activity signature; the implementation is hand-written API integration code. The boundary between generated orchestration and hand-written integration stays clean.

---

## Data availability and security

Multiple data sources, each authoritative for its own domain: openEHR for clinical data, Temporal for process state and history, external services for operational data (bookings, payments, message delivery). Front-end applications assemble what they need by querying the appropriate sources.

A clinician sees clinical data from openEHR, pathway status from Temporal, upcoming appointments from the booking system, outstanding payments from the payment system. A patient sees their next appointment, latest results, a triggered self-assessment, and a message thread. Each view is an aggregation, not a copy in a separate database.

Security follows the same principle. Each service manages its own access control. The aggregation layer presents only what the requesting user is authorised to see. Clinical data follows NHS information governance. Payment data is PCI-scoped. Process data is role-filtered. No single unified access control system is required; each service enforces its own rules.

---

## Guiding constraints for decisions taken now

The following constraints should govern architectural decisions at this stage to preserve the modularity and adaptability the system requires:

1. **Process knowledge lives in the model, not in code.** Any decision that embeds process logic in application code rather than in the SysML model reduces adaptability. Generated code is a derived artefact.

2. **Clinical data structure lives in archetypes, not in schemas.** Any decision that creates bespoke database tables for clinical data instead of using openEHR compositions reduces interoperability and queryability.

3. **External services are behind activity interfaces, not embedded in workflows.** Any decision that couples workflow logic to a specific booking system, payment provider, or messaging platform reduces flexibility. The workflow knows an activity signature; the activity implementation knows the specific service.

4. **Execution components are replaceable; the representation layer is not.** Temporal could theoretically be replaced by another workflow engine. EHRbase could be swapped for another openEHR CDR. The front end could be rebuilt. The SysML models and openEHR archetypes carry the knowledge and are the long-term investment.

5. **Views aggregate from authoritative sources; they do not maintain separate copies.** Any decision that duplicates clinical or process data into a separate store for convenience creates synchronisation problems and undermines the single-source-of-truth principle.

6. **The two-layer action flow pattern applies to all pathways.** Domain models describe clinical processes for governance audiences. Orchestration models describe system execution for runtime generation. Both are derived from the same SysML source but serve different purposes and different audiences.

7. **Terminology bindings are designed in from the start.** Even in toy exercises, archetypes should include terminology binding slots. Retrofitting SNOMED CT bindings onto unstructured data is far harder than designing them in.

8. **Governance is a first-class architectural concern, not a reporting add-on.** Audit, compliance, and clinical governance capabilities should be considered at design time for every pathway and data structure, not bolted on after the fact.

---

## Recommended next steps

The immediate priority is to validate the openEHR integration patterns via a coffee shop CDR extension exercise. This should cover standing up EHRbase locally, designing minimal archetypes and templates, committing compositions from Temporal workflow activities, querying via AQL for entity views, direct form-based data entry outside workflows, and a population-level governance query as a proxy for clinical audit.

Following that, a first clinical pathway (hormone therapy initiation is the natural candidate) would exercise the full architecture at realistic complexity: long-running waits, multiple participants, governance requirements, clinical decision points, external service integrations, and both process and entity views of the patient record.

The high-level architecture does not need to be fully specified before beginning either of these. The principles and constraints captured here are sufficient to guide decisions as each component is developed incrementally.

---

###### **Document status:** Working document. Captures architectural thinking as of 4 March 2026. Intended to inform subsequent exercise specifications and design decisions. Not a formal architecture document.
