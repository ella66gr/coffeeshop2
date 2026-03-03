"""
Generate XState v5 state machine definitions from SysML v2 state defs.

Lightweight text-based parser for the CoffeeShop exercise.
For production use, replace with Syside Automator.

Usage:
    python generators/gen_state_machines.py \
        model/domain/order-lifecycle.sysml \
        generated/order-lifecycle-machine.ts
"""

import re
import sys
from pathlib import Path


def parse_state_def(content: str) -> dict | None:
    """Extract state machine definition from SysML v2 content."""

    # Find the state def block
    state_def_match = re.search(
        r"state\s+def\s+(\w+)\s*\{(.*)\}",
        content,
        re.DOTALL,
    )
    if not state_def_match:
        return None

    name = state_def_match.group(1)
    body = state_def_match.group(2)

    # Extract states
    states = []
    for match in re.finditer(r"(?<!initial\s)\bstate\s+(\w+)\s*;", body):
        states.append(match.group(1))

    # Check for initial pseudostate
    has_initial = bool(re.search(r"\binitial\s*;", body))

    # Extract transitions
    transitions = []
    transition_pattern = (
        r"transition\s+(\w+)\s+"
        r"first\s+(\w+)\s+"
        r"accept\s+(\w+)\s+"
        r"then\s+(\w+)\s*;"
    )
    for match in re.finditer(transition_pattern, body):
        transitions.append({
            "name": match.group(1),
            "source": match.group(2),
            "event": match.group(3),
            "target": match.group(4),
        })

    # Identify terminal states (no outgoing transitions)
    sources = {t["source"] for t in transitions}
    terminal_states = [s for s in states if s not in sources]

    # Identify initial state (first state listed, if initial pseudostate exists)
    initial_state = states[0] if has_initial and states else None

    return {
        "name": name,
        "states": states,
        "transitions": transitions,
        "terminal_states": terminal_states,
        "initial_state": initial_state,
    }


def parse_events(content: str) -> list[str]:
    """Extract event attribute definitions."""
    events = []
    for match in re.finditer(r"attribute\s+def\s+(\w+)\s*;", content):
        events.append(match.group(1))
    return events


def generate_xstate(machine: dict, events: list[str]) -> str:
    """Generate XState v5 machine definition."""
    lines = [
        "// ==============================================",
        "// Generated from SysML v2 model — DO NOT EDIT",
        "// Source: model/domain/order-lifecycle.sysml",
        "// Generator: gen_state_machines.py",
        "// ==============================================",
        "",
        'import { setup } from "xstate";',
        "",
        "// Event types derived from SysML attribute defs",
        "export type OrderEvent =",
    ]

    # Generate event union type
    for i, event in enumerate(events):
        separator = ";" if i == len(events) - 1 else ""
        prefix = "  | " if i > 0 else "  "
        lines.append(f'{prefix}{{ type: "{event}" }}{separator}')

    lines.append("")

    # Generate state type
    state_names = [f'"{s}"' for s in machine["states"]]
    lines.append(f"export type OrderState = {' | '.join(state_names)};")
    lines.append("")

    # Generate XState machine
    lines.append(f"export const orderLifecycleMachine = setup({{")
    lines.append(f"  types: {{")
    lines.append(f"    events: {{}} as OrderEvent,")
    lines.append(f"  }},")
    lines.append(f"}}).createMachine({{")
    lines.append(f'  id: "{machine["name"]}",')
    lines.append(f'  initial: "{machine["initial_state"]}",')
    lines.append(f"  states: {{")

    # Group transitions by source state
    transitions_by_source: dict[str, list[dict]] = {}
    for t in machine["transitions"]:
        transitions_by_source.setdefault(t["source"], []).append(t)

    for state in machine["states"]:
        is_terminal = state in machine["terminal_states"]

        if is_terminal:
            lines.append(f'    {state}: {{')
            lines.append(f'      type: "final",')
            lines.append(f'    }},')
        else:
            lines.append(f"    {state}: {{")
            lines.append(f"      on: {{")

            for t in transitions_by_source.get(state, []):
                lines.append(f'        {t["event"]}: "{t["target"]}",')

            lines.append(f"      }},")
            lines.append(f"    }},")

    lines.append(f"  }},")
    lines.append(f"}});")
    lines.append("")

    return "\n".join(lines)


def main():
    if len(sys.argv) != 3:
        print("Usage: python gen_state_machines.py <input.sysml> <output.ts>")
        sys.exit(1)

    input_path = Path(sys.argv[1])
    output_path = Path(sys.argv[2])

    if not input_path.exists():
        print(f"Error: {input_path} not found")
        sys.exit(1)

    content = input_path.read_text()

    events = parse_events(content)
    machine = parse_state_def(content)

    if not machine:
        print("Error: no state def found in input file")
        sys.exit(1)

    typescript = generate_xstate(machine, events)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(typescript)

    print(f"Generated {output_path}")
    print(f"  Machine: {machine['name']}")
    print(f"  States: {len(machine['states'])}")
    print(f"  Transitions: {len(machine['transitions'])}")
    print(f"  Events: {len(events)}")


if __name__ == "__main__":
    main()
