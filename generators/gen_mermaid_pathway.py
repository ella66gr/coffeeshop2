"""
Generate a Mermaid flowchart from a SysML v2 domain-level action flow.

Reads a domain action def with sequential steps, branching, and
convergence, and emits a Mermaid flowchart (.mmd) showing the
process visually.

Lightweight text-based parser for the CoffeeShop demonstrator.
For production use, replace with Syside Automator for proper
semantic model access.

Usage:
    python generators/gen_mermaid_pathway.py \
        ../coffeeshop-exercise/model/domain/drink-fulfilment.sysml \
        generated/fulfil-drink-pathway.mmd
"""

import re
import sys
from dataclasses import dataclass, field
from pathlib import Path


# ── Parsed model types ──


@dataclass
class ActionStep:
    """A step in the action flow."""
    name: str
    doc: str | None = None
    successors: list[str] = field(default_factory=list)


@dataclass
class ActionFlowModel:
    """Parsed representation of a SysML action def as a flow graph."""
    name: str
    doc: str | None = None
    input_param: str | None = None
    steps: dict[str, ActionStep] = field(default_factory=dict)


# ── Parser ──


def parse_action_flow(content: str) -> ActionFlowModel | None:
    """Parse a SysML domain-level action def into a flow graph.

    Handles:
    - Sequential steps: action A; then B;
    - Branching: action A; then B; then C; (multiple then from one action)
    - Convergence: multiple paths leading to the same target action

    Returns None if no action def is found.
    """

    # Find the action def
    action_def_match = re.search(
        r"action\s+def\s+(\w+)\s*\{",
        content,
    )
    if not action_def_match:
        return None

    name = action_def_match.group(1)
    open_brace = content.index("{", action_def_match.start())
    body = _extract_braced_body(content, open_brace)
    if body is None:
        return None

    # Extract doc block for the action def
    doc = _extract_doc(body)

    # Extract input parameter
    input_param = None
    param_match = re.search(r"in\s+item\s+(\w+)\s*:\s*(\w+)\s*;", body)
    if param_match:
        input_param = f"{param_match.group(1)} : {param_match.group(2)}"

    model = ActionFlowModel(name=name, doc=doc, input_param=input_param)

    # Parse the body line by line to extract actions and then-chains.
    # The key rule: `then X;` attaches to the most recently declared action.
    #
    # We need to handle:
    #   action A;              -> declares step A
    #   then B;                -> A -> B
    #
    #   action A { ... }       -> declares step A (with body)
    #   then B;                -> A -> B
    #
    #   action A;
    #   then B;                -> A -> B
    #   then C;                -> A -> C  (branch!)

    current_action: str | None = None

    for line in body.split("\n"):
        stripped = line.strip()

        # Skip empty lines, comments, doc blocks, imports, in/out params
        if not stripped or stripped.startswith("//") or stripped.startswith("*"):
            continue
        if stripped.startswith("doc") or stripped.startswith("private import"):
            continue
        if stripped.startswith("in ") or stripped.startswith("out "):
            continue

        # Match action declaration (simple: `action name;` or with body `action name { ... }`)
        action_match = re.match(r"action\s+(\w+)\s*[;{]", stripped)
        if action_match:
            action_name = action_match.group(1)
            if action_name not in model.steps:
                # Extract doc if it's an action with a body
                action_doc = None
                if "{" in stripped:
                    # Find this action's body in the full text
                    full_match = re.search(
                        rf"action\s+{action_name}\s*\{{",
                        body,
                    )
                    if full_match:
                        action_body = _extract_braced_body(
                            body,
                            full_match.start() + full_match.group(0).index("{"),
                        )
                        if action_body:
                            action_doc = _extract_doc(action_body)

                model.steps[action_name] = ActionStep(
                    name=action_name,
                    doc=action_doc,
                )
            current_action = action_name
            continue

        # Match then-chain: `then targetName;`
        then_match = re.match(r"then\s+(\w+)\s*;", stripped)
        if then_match and current_action:
            target = then_match.group(1)
            # Ensure target step exists (it may be declared later)
            if target not in model.steps:
                model.steps[target] = ActionStep(name=target)
            if target not in model.steps[current_action].successors:
                model.steps[current_action].successors.append(target)
            # Important: do NOT update current_action here.
            # Multiple `then` lines after an action all attach to that action.
            continue

    return model


def _extract_braced_body(content: str, open_brace_pos: int) -> str | None:
    """Extract content between matched braces starting at open_brace_pos."""
    depth = 0
    for i in range(open_brace_pos, len(content)):
        if content[i] == "{":
            depth += 1
        elif content[i] == "}":
            depth -= 1
            if depth == 0:
                return content[open_brace_pos + 1 : i]
    return None


def _extract_doc(body: str) -> str | None:
    """Extract first doc block content from a body string."""
    doc_match = re.search(r"doc\s*/\*\s*(.*?)\s*\*/", body, re.DOTALL)
    if doc_match:
        # Clean up multi-line doc: strip leading * and whitespace
        raw = doc_match.group(1)
        lines = []
        for line in raw.split("\n"):
            cleaned = line.strip().lstrip("*").strip()
            if cleaned:
                lines.append(cleaned)
        return " ".join(lines)
    return None


# ── Mermaid generator ──


def generate_mermaid(model: ActionFlowModel) -> str:
    """Generate a Mermaid flowchart from the parsed action flow."""

    lines: list[str] = []

    lines.append("%% ==============================================")
    lines.append("%% Generated from SysML v2 model — DO NOT EDIT")
    lines.append(f"%% Source: {model.name} action def")
    lines.append("%% Generator: gen_mermaid_pathway.py")
    lines.append("%% ==============================================")
    lines.append("")
    lines.append("flowchart TD")

    # Find the first step (the one that is declared first in the ordered dict)
    step_names = list(model.steps.keys())
    if not step_names:
        return "\n".join(lines)

    first_step = step_names[0]

    # Find terminal steps (no successors)
    terminal_steps = [
        name for name, step in model.steps.items()
        if not step.successors
    ]

    # Emit node definitions with labels
    for name, step in model.steps.items():
        label = _humanise_action(name)
        if step.doc:
            # Use the doc as a tooltip-style subtitle
            short_doc = step.doc[:60] + "..." if len(step.doc) > 60 else step.doc
            label = f"{_humanise_action(name)}\\n<small>{short_doc}</small>"

        if name in terminal_steps:
            # Terminal nodes get a rounded box (stadium shape)
            lines.append(f"    {name}([{_humanise_action(name)}])")
        elif name == first_step:
            # First node gets a rounded box too
            lines.append(f"    {name}([{_humanise_action(name)}])")
        else:
            # Regular nodes
            lines.append(f"    {name}[{_humanise_action(name)}]")

    lines.append("")

    # Identify branch points (actions with multiple successors)
    # and convergence points (actions targeted by multiple predecessors)
    targets_count: dict[str, int] = {}
    for step in model.steps.values():
        for succ in step.successors:
            targets_count[succ] = targets_count.get(succ, 0) + 1

    # Emit edges
    for name, step in model.steps.items():
        for succ in step.successors:
            lines.append(f"    {name} --> {succ}")

    lines.append("")

    # Style the start and end nodes
    lines.append(f"    style {first_step} fill:#4CAF50,color:#fff,stroke:#388E3C")
    for term in terminal_steps:
        lines.append(f"    style {term} fill:#2196F3,color:#fff,stroke:#1565C0")

    # Style branch points (multiple outgoing edges)
    for name, step in model.steps.items():
        if len(step.successors) > 1:
            lines.append(f"    style {name} fill:#FF9800,color:#fff,stroke:#E65100")

    lines.append("")

    return "\n".join(lines)


def _humanise_action(name: str) -> str:
    """Convert camelCase action name to a readable label.
    
    receiveOrder -> Receive Order
    prepareHotBase -> Prepare Hot Base
    """
    result = re.sub(r"([A-Z])", r" \1", name)
    return result.strip().title()


# ── CLI entry point ──


def main() -> None:
    if len(sys.argv) != 3:
        print("Usage: python gen_mermaid_pathway.py <input.sysml> <output.mmd>")
        sys.exit(1)

    input_path = Path(sys.argv[1])
    output_path = Path(sys.argv[2])

    if not input_path.exists():
        print(f"Error: {input_path} not found")
        sys.exit(1)

    content = input_path.read_text()
    model = parse_action_flow(content)

    if not model:
        print("Error: no action def found in input file")
        sys.exit(1)

    mermaid = generate_mermaid(model)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(mermaid)

    print(f"Generated {output_path}")
    print(f"  Action flow: {model.name}")
    print(f"  Steps: {len(model.steps)}")

    # Show the flow structure
    for name, step in model.steps.items():
        succs = ", ".join(step.successors) if step.successors else "(terminal)"
        print(f"    {name} -> {succs}")


if __name__ == "__main__":
    main()
