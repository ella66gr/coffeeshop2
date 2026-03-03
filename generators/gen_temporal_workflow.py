"""
Generate a Temporal workflow from a SysML v2 orchestration action flow.

Reads an orchestration-level action def annotated with TemporalMetadata
metadata definitions and emits a TypeScript Temporal workflow that uses
proxyActivities, defineSignal, setHandler, and condition.

Lightweight text-based parser for the CoffeeShop demonstrator.
For production use, replace with Syside Automator for proper
semantic model access.

Usage:
    python generators/gen_temporal_workflow.py \
        model/domain/fulfil-drink-orchestration.sysml \
        generated/fulfil-drink.ts
"""

import re
import sys
from dataclasses import dataclass, field
from pathlib import Path


# ── Parsed model types ──


@dataclass
class ActivityStep:
    """A step annotated with @TemporalActivity."""
    name: str
    activity_name: str
    state_event: str | None = None


@dataclass
class SignalStep:
    """A step annotated with @TemporalSignal."""
    name: str
    signal_name: str
    timeout_minutes: int
    state_event: str | None = None


@dataclass
class WorkflowModel:
    """Parsed representation of a SysML orchestration action def."""
    workflow_name: str
    task_queue: str
    action_def_name: str
    steps: list[ActivityStep | SignalStep] = field(default_factory=list)


# ── Parser ──


def parse_orchestration(content: str) -> WorkflowModel | None:
    """Parse a SysML orchestration action def with Temporal metadata.

    Extracts the action def body, then walks through the action steps
    in source order. Each step is classified as an activity or signal
    based on its metadata annotations.

    Returns None if no @TemporalWorkflow-annotated action def is found.
    """

    # Find the action def with a @TemporalWorkflow annotation.
    # We look for the action def block, then check for the annotation inside.
    action_def_match = re.search(
        r"action\s+def\s+(\w+)\s*\{(.*)",
        content,
        re.DOTALL,
    )
    if not action_def_match:
        return None

    action_def_name = action_def_match.group(1)
    # Extract the balanced body — count braces from the opening {
    body_start = action_def_match.start(2)
    body = _extract_braced_body(content, action_def_match.start() + content[action_def_match.start():].index("{"))
    if body is None:
        return None

    # Extract @TemporalWorkflow metadata
    wf_match = re.search(
        r"@TemporalWorkflow\s*\{([^}]+)\}",
        body,
    )
    if not wf_match:
        return None

    wf_attrs = _parse_metadata_attrs(wf_match.group(1))
    workflow_name = wf_attrs.get("workflowName", action_def_name)
    task_queue = wf_attrs.get("taskQueue", "default")

    model = WorkflowModel(
        workflow_name=workflow_name,
        task_queue=task_queue,
        action_def_name=action_def_name,
    )

    # Find all action steps within the body (nested action blocks)
    # We need to extract them in source order.
    # Use balanced-brace extraction rather than regex for the body,
    # because each step can contain multiple @Metadata { ... } blocks.
    step_header_pattern = re.compile(
        r"action\s+(\w+)\s*\{",
    )

    for step_match in step_header_pattern.finditer(body):
        step_name = step_match.group(1)
        # Skip the outer action def if it somehow matches again
        if step_name == action_def_name:
            continue
        # Extract the balanced body from the opening brace
        open_brace_pos = step_match.start() + step_match.group(0).index("{")
        step_body = _extract_braced_body(body, open_brace_pos)
        if step_body is None:
            continue

        # Check for state transition trigger
        state_event = None
        trigger_match = re.search(
            r"@StateTransitionTrigger\s*\{([^}]+)\}",
            step_body,
        )
        if trigger_match:
            trigger_attrs = _parse_metadata_attrs(trigger_match.group(1))
            state_event = trigger_attrs.get("eventName")

        # Classify step by its metadata annotation
        activity_match = re.search(
            r"@TemporalActivity\s*\{([^}]+)\}",
            step_body,
        )
        signal_match = re.search(
            r"@TemporalSignal\s*\{([^}]+)\}",
            step_body,
        )

        if activity_match:
            attrs = _parse_metadata_attrs(activity_match.group(1))
            model.steps.append(ActivityStep(
                name=step_name,
                activity_name=attrs.get("activityName", step_name),
                state_event=state_event,
            ))
        elif signal_match:
            attrs = _parse_metadata_attrs(signal_match.group(1))
            model.steps.append(SignalStep(
                name=step_name,
                signal_name=attrs.get("signalName", step_name),
                timeout_minutes=int(attrs.get("timeoutMinutes", "0")),
                state_event=state_event,
            ))

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


def _parse_metadata_attrs(attr_block: str) -> dict[str, str]:
    """Parse key = "value"; pairs from a metadata annotation body."""
    attrs = {}
    for match in re.finditer(r'(\w+)\s*=\s*"([^"]*)"', attr_block):
        attrs[match.group(1)] = match.group(2)
    # Also handle integer values (no quotes)
    for match in re.finditer(r"(\w+)\s*=\s*(\d+)\s*;", attr_block):
        if match.group(1) not in attrs:
            attrs[match.group(1)] = match.group(2)
    return attrs


# ── Code generator ──


def generate_workflow(model: WorkflowModel) -> str:
    """Generate a TypeScript Temporal workflow from the parsed model."""

    activities = [s for s in model.steps if isinstance(s, ActivityStep)]
    signals = [s for s in model.steps if isinstance(s, SignalStep)]

    lines: list[str] = []

    # Header
    lines.extend([
        "// ==============================================",
        "// Generated from SysML v2 model — DO NOT EDIT",
        "// Source: model/domain/fulfil-drink-orchestration.sysml",
        "// Generator: gen_temporal_workflow.py",
        "// ==============================================",
        "",
    ])

    # Imports
    lines.extend([
        "import {",
        "  proxyActivities,",
        "  defineSignal,",
        "  setHandler,",
        "  condition,",
        "  log,",
        "} from '@temporalio/workflow';",
        "",
        "import type * as activities from '../activities/barista.js';",
        "",
    ])

    # Activity proxy
    activity_names = [a.activity_name for a in activities]
    lines.extend([
        "// -- Activity proxy --",
        "",
        "const {",
    ])
    for name in activity_names:
        lines.append(f"  {name},")
    lines.extend([
        "} = proxyActivities<typeof activities>({",
        "  startToCloseTimeout: '1 minute',",
        "  retry: {",
        "    maximumAttempts: 3,",
        "  },",
        "});",
        "",
    ])

    # Signal definitions
    lines.append("// -- Signal definitions --")
    lines.append("")
    for sig in signals:
        const_name = _signal_const_name(sig.signal_name)
        lines.append(f"export const {const_name} = defineSignal('{sig.signal_name}');")
    lines.append("")

    # Workflow function
    lines.append("// -- Workflow function --")
    lines.append("")
    lines.append(
        f"export async function {model.workflow_name}"
        f"(order: activities.OrderDetails): Promise<string> {{"
    )

    # Signal state variables
    if signals:
        lines.append("  // Mutable state that signal handlers will update.")
        for sig in signals:
            var_name = _signal_var_name(sig.signal_name)
            lines.append(f"  let {var_name} = false;")
        lines.append("")

    # Signal handlers
    if signals:
        lines.append("  // Register signal handlers")
        for sig in signals:
            const_name = _signal_const_name(sig.signal_name)
            var_name = _signal_var_name(sig.signal_name)
            lines.extend([
                f"  setHandler({const_name}, () => {{",
                f"    log.info('Signal received: {sig.signal_name}', {{ orderId: order.orderId }});",
                f"    {var_name} = true;",
                f"  }});",
                "",
            ])

    # Workflow body — emit steps in order
    is_first_step = True
    step_number = 0
    for step in model.steps:
        step_number += 1

        if isinstance(step, ActivityStep):
            lines.extend([
                f"  // -- Step {step_number}: {step.name} --",
                f"  log.info('{_step_log_message(step, model.workflow_name, is_first_step)}', {{ orderId: order.orderId }});",
            ])
            is_first_step = False
            if step == activities[0]:
                # First activity — capture validationResult
                lines.append(f"  const validationResult = await {step.activity_name}(order);")
                lines.extend([
                    f"  log.info('Order validated', {{",
                    f"    orderId: order.orderId,",
                    f"    result: validationResult.status,",
                    f"  }});",
                ])
            elif step == activities[-1]:
                # Last activity — capture completionResult
                lines.append(f"  const completionResult = await {step.activity_name}(order);")
                lines.extend([
                    f"  log.info('Order completed', {{",
                    f"    orderId: order.orderId,",
                    f"    result: completionResult.status,",
                    f"  }});",
                ])
            else:
                # Middle activities
                result_var = f"{step.activity_name}Result"
                lines.append(f"  const {result_var} = await {step.activity_name}(order);")
                lines.extend([
                    f"  log.info('{_humanise(step.activity_name)} recorded', {{",
                    f"    orderId: order.orderId,",
                    f"    result: {result_var}.status,",
                    f"  }});",
                ])
            lines.append("")

        elif isinstance(step, SignalStep):
            var_name = _signal_var_name(step.signal_name)
            lines.extend([
                f"  // -- Step {step_number}: {step.name} --",
                f"  log.info('{_step_log_message(step, model.workflow_name, is_first_step)}', {{ orderId: order.orderId }});",
                f"  await condition(() => {var_name});",
                "",
            ])
            is_first_step = False

    # Return
    lines.append("  return `Order ${order.orderId} fulfilled successfully`;")
    lines.append("}")
    lines.append("")

    return "\n".join(lines)


def _signal_const_name(signal_name: str) -> str:
    """Convert a signal name like 'baristaStarted' to 'baristaStartedSignal'."""
    return f"{signal_name}Signal"


def _signal_var_name(signal_name: str) -> str:
    """Convert a signal name like 'baristaStarted' to the boolean variable name."""
    return signal_name


def _step_log_message(step: ActivityStep | SignalStep, workflow_name: str = "", is_first: bool = False) -> str:
    """Generate a human-readable log message for a step."""
    if isinstance(step, ActivityStep):
        if is_first:
            return f"Workflow started: {workflow_name}"
        return _humanise(step.name)
    elif isinstance(step, SignalStep):
        return f"Waiting for {_humanise(step.signal_name)}"
    return step.name


def _humanise(camel_case: str) -> str:
    """Convert camelCase to a readable phrase: 'baristaStarted' -> 'barista started'."""
    result = re.sub(r"([A-Z])", r" \1", camel_case)
    return result.strip().lower()


# ── CLI entry point ──


def main() -> None:
    if len(sys.argv) != 3:
        print("Usage: python gen_temporal_workflow.py <input.sysml> <output.ts>")
        sys.exit(1)

    input_path = Path(sys.argv[1])
    output_path = Path(sys.argv[2])

    if not input_path.exists():
        print(f"Error: {input_path} not found")
        sys.exit(1)

    content = input_path.read_text()
    model = parse_orchestration(content)

    if not model:
        print("Error: no @TemporalWorkflow-annotated action def found")
        sys.exit(1)

    typescript = generate_workflow(model)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(typescript)

    print(f"Generated {output_path}")
    print(f"  Workflow: {model.workflow_name}")
    print(f"  Task queue: {model.task_queue}")
    print(f"  Steps: {len(model.steps)}")
    print(f"    Activities: {len([s for s in model.steps if isinstance(s, ActivityStep)])}")
    print(f"    Signals: {len([s for s in model.steps if isinstance(s, SignalStep)])}")


if __name__ == "__main__":
    main()
