"""
Generate TypeScript interfaces from SysML v2 part definitions.

This is a lightweight text-based parser for the CoffeeShop exercise.
For production use, replace with Syside Automator for proper
semantic model access.

Usage:
    python generators/gen_typescript_types.py \
        model/domain/coffeeshop.sysml \
        generated/types.ts
"""

import re
import sys
from pathlib import Path


# SysML v2 → TypeScript type mapping
TYPE_MAP = {
    "String": "string",
    "Boolean": "boolean",
    "Integer": "number",
    "Real": "number",
}


def parse_enum_defs(content: str) -> dict[str, list[str]]:
    """Extract enum definitions and their variants."""
    enums = {}
    pattern = r"enum\s+def\s+(\w+)\s*\{([^}]+)\}"
    for match in re.finditer(pattern, content):
        name = match.group(1)
        body = match.group(2)
        variants = [v.strip().rstrip(";") for v in body.split(";") if v.strip()]
        # Filter out doc comments and other non-variant content
        variants = [v for v in variants if v and not v.startswith("doc") and not v.startswith("/*")]
        enums[name] = variants
    return enums


def parse_part_defs(content: str) -> list[dict]:
    """Extract part definitions with their attributes and relationships."""
    parts = []

    # Match part def blocks (handling specialisation with :>)
    pattern = r"part\s+def\s+(\w+)(?:\s*:>\s*(\w+))?\s*\{([^}]*(?:\{[^}]*\}[^}]*)*)\}"
    for match in re.finditer(pattern, content):
        name = match.group(1)
        parent = match.group(2)  # None if no specialisation
        body = match.group(3)

        attributes = []
        refs = []
        compositions = []

        for line in body.split("\n"):
            line = line.strip()

            # Skip empty lines, comments, doc blocks, and non-attribute lines
            if not line or line.startswith("//") or line.startswith("doc") or line.startswith("/*") or line.startswith("*"):
                continue

            # Match: attribute name : Type;
            attr_match = re.match(r"attribute\s+(\w+)\s*:\s*(\w+)\s*;", line)
            if attr_match:
                attributes.append({
                    "name": attr_match.group(1),
                    "type": attr_match.group(2),
                })
                continue

            # Match: ref name : Type;
            ref_match = re.match(r"ref\s+(\w+)\s*:\s*(\w+)\s*;", line)
            if ref_match:
                refs.append({
                    "name": ref_match.group(1),
                    "type": ref_match.group(2),
                })
                continue

            # Match: part name : Type[multiplicity];
            part_match = re.match(r"part\s+(\w+)\s*:\s*(\w+)(\[[\d.*]+\])?\s*;", line)
            if part_match:
                compositions.append({
                    "name": part_match.group(1),
                    "type": part_match.group(2),
                    "multiplicity": part_match.group(3),
                })
                continue

        parts.append({
            "name": name,
            "parent": parent,
            "attributes": attributes,
            "refs": refs,
            "compositions": compositions,
        })

    return parts


def resolve_ts_type(sysml_type: str, enums: dict[str, list[str]]) -> str:
    """Map a SysML type to its TypeScript equivalent."""
    if sysml_type in TYPE_MAP:
        return TYPE_MAP[sysml_type]
    if sysml_type in enums:
        return sysml_type  # Will be generated as a TS enum
    return sysml_type  # Assume it's another interface


def resolve_multiplicity(mult: str | None) -> bool:
    """Return True if the multiplicity indicates an array."""
    if mult is None:
        return False
    return "*" in mult or re.search(r"\d+\.\.\d+", mult) is not None


def generate_typescript(enums: dict[str, list[str]], parts: list[dict]) -> str:
    """Generate TypeScript source from parsed model elements."""
    lines = [
        "// ==============================================",
        "// Generated from SysML v2 model — DO NOT EDIT",
        "// Source: model/domain/coffeeshop.sysml",
        f"// Generator: gen_typescript_types.py",
        "// ==============================================",
        "",
    ]

    # Generate enums
    for name, variants in enums.items():
        lines.append(f"export enum {name} {{")
        for v in variants:
            lines.append(f'  {v} = "{v}",')
        lines.append("}")
        lines.append("")

    # Generate interfaces
    for part in parts:
        extends = f" extends {part['parent']}" if part["parent"] else ""
        lines.append(f"export interface {part['name']}{extends} {{")

        for attr in part["attributes"]:
            ts_type = resolve_ts_type(attr["type"], enums)
            lines.append(f"  {attr['name']}: {ts_type};")

        for ref in part["refs"]:
            ts_type = resolve_ts_type(ref["type"], enums)
            lines.append(f"  {ref['name']}: {ts_type};")

        for comp in part["compositions"]:
            ts_type = resolve_ts_type(comp["type"], enums)
            is_array = resolve_multiplicity(comp.get("multiplicity"))
            if is_array:
                lines.append(f"  {comp['name']}: {ts_type}[];")
            else:
                lines.append(f"  {comp['name']}: {ts_type};")

        lines.append("}")
        lines.append("")

    return "\n".join(lines)


def main():
    if len(sys.argv) != 3:
        print("Usage: python gen_typescript_types.py <input.sysml> <output.ts>")
        sys.exit(1)

    input_path = Path(sys.argv[1])
    output_path = Path(sys.argv[2])

    if not input_path.exists():
        print(f"Error: {input_path} not found")
        sys.exit(1)

    content = input_path.read_text()

    enums = parse_enum_defs(content)
    parts = parse_part_defs(content)

    typescript = generate_typescript(enums, parts)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(typescript)

    print(f"Generated {output_path}")
    print(f"  {len(enums)} enums, {len(parts)} interfaces")


if __name__ == "__main__":
    main()
