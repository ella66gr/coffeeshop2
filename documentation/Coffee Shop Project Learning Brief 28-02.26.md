28 Feb

# CoffeeShop

CoffeeShop will cover across the learning sequence below, so we have a roadmap for the exercise before you start setting up tooling.

**Phase 1 — Structural foundations**

Define the domain vocabulary. The "nouns" of the coffee shop:

Menu items (drinks, food), with attributes like price, size, dietary flags. Customers, with a simple loyalty concept. Staff, with roles (barista, manager). Orders, linking a customer to one or more items. The shop itself as the containing system.

This gets you comfortable with `package`, `part def`, `attribute def`, `enum def`, and the `def`/`usage` distinction. It's the equivalent of your UML class diagrams.

**Phase 2 — State machine**

Model the lifecycle of an Order: Placed → InPreparation → Ready → Collected (with a Cancelled branch). Simple, obvious states. This introduces `state def`, transitions, `entry`/`do`/`exit` behaviours, and guard conditions (e.g., can only cancel if still in Placed state).

**Phase 3 — Action flow**

Model the process of fulfilling a drink order: receive order, check stock, prepare drink, call customer. This introduces `action def`, `then` sequencing, `in`/`out` items, `decide` for branching (out of stock?), and how actions relate to the structural parts that perform them.

**Phase 4 — Requirements and constraints**

A handful of simple rules: maximum queue length before a second barista is needed, loyalty discount kicks in after 10 orders, shop can't sell alcohol before 11am. This introduces `requirement def`, `constraint def`, and the `satisfy`/`verify` relationships that trace requirements to the parts of the system that fulfil them.

**Phase 5 — First generator**

Write a Python script using Syside Automator that reads your coffee shop model and generates TypeScript interfaces for the domain types. This is where the pipeline becomes real — you see your SysML v2 definitions turn into usable code.

**Phase 6 — State machine generator**

Generate an executable state machine (probably XState or a Python `transitions` library implementation) from your Order lifecycle model. You run it, send it events, watch it transition. The model drives real behaviour.