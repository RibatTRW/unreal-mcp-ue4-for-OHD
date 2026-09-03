import io
import json
import os


def _parse_key_spec(key_spec):
    tokens = [token.strip() for token in unreal_text(key_spec or "").split("+") if token.strip()]
    if not tokens:
        raise ValueError("Key is required")

    modifiers = {"shift": False, "ctrl": False, "alt": False, "cmd": False}
    key_name = tokens[-1]

    for token in tokens[:-1]:
        token_lower = token.lower()
        if token_lower in modifiers:
            modifiers[token_lower] = True
            continue

        if token_lower == "control":
            modifiers["ctrl"] = True
            continue

        if token_lower in ("command", "meta"):
            modifiers["cmd"] = True
            continue

        raise ValueError("Unsupported modifier in key spec: {0}".format(token))

    return key_name, modifiers


def _build_mapping_line(mapping_name, key_name, input_type, scale, modifiers):
    if input_type == "axis":
        return '+AxisMappings=(AxisName="{0}",Scale={1:.6f},Key={2})'.format(
            mapping_name,
            float(scale),
            key_name,
        )

    return (
        '+ActionMappings=(ActionName="{0}",bShift={1},bCtrl={2},bAlt={3},bCmd={4},Key={5})'
    ).format(
        mapping_name,
        "True" if modifiers["shift"] else "False",
        "True" if modifiers["ctrl"] else "False",
        "True" if modifiers["alt"] else "False",
        "True" if modifiers["cmd"] else "False",
        key_name,
    )


def _insert_mapping_line(config_text, mapping_line):
    section_header = "[/Script/Engine.InputSettings]"
    lines = config_text.splitlines()

    if section_header not in lines:
        if config_text and not config_text.endswith("\\n"):
            config_text += "\\n"
        config_text += "{0}\\n{1}\\n".format(section_header, mapping_line)
        return config_text

    updated_lines = []
    inside_section = False
    inserted = False

    for index, line in enumerate(lines):
        stripped = line.strip()
        if stripped == section_header:
            inside_section = True
            updated_lines.append(line)
            continue

        if inside_section and stripped.startswith("[") and stripped.endswith("]"):
            if not inserted:
                updated_lines.append(mapping_line)
                inserted = True
            inside_section = False

        updated_lines.append(line)

    if inside_section and not inserted:
        updated_lines.append(mapping_line)

    return "\\n".join(updated_lines) + "\\n"


def create_input_mapping(args):
    mapping_name = args.get("mapping_name") or args.get("action_name")
    key_spec = args.get("key")
    input_type = unreal_text(args.get("input_type") or "Action").strip().lower()
    scale = float(args.get("scale", 1.0))

    if not mapping_name:
        return {
            "success": False,
            "message": "mapping_name or action_name is required",
        }

    if input_type not in ("action", "axis"):
        return {
            "success": False,
            "message": "input_type must be 'Action' or 'Axis'",
        }

    try:
        key_name, modifiers = _parse_key_spec(key_spec)
    except Exception as exc:
        return {"success": False, "message": unreal_text(exc)}

    config_path = os.path.abspath(os.path.join(unreal.Paths.project_dir(), "Config", "DefaultInput.ini"))
    config_text = ""
    if os.path.exists(config_path):
        with io.open(config_path, encoding="utf-8", errors="ignore") as config_file:
            config_text = config_file.read()

    mapping_line = _build_mapping_line(
        mapping_name,
        key_name,
        input_type,
        scale,
        modifiers,
    )
    if mapping_line in config_text:
        return {
            "success": True,
            "message": "Input mapping already exists",
            "mapping_line": mapping_line,
            "config_path": unreal_text(config_path),
        }

    updated_text = _insert_mapping_line(config_text, mapping_line)
    try:
        os.makedirs(os.path.dirname(config_path))
    except OSError:
        pass
    with io.open(config_path, "w", encoding="utf-8") as config_file:
        config_file.write(updated_text)

    input_settings_class = getattr(unreal, "InputSettings", None)
    if input_settings_class and hasattr(input_settings_class, "get_input_settings"):
        try:
            input_settings = input_settings_class.get_input_settings()
            if input_settings:
                for method_name in ("save_key_mappings", "force_rebuild_keymaps"):
                    method = getattr(input_settings, method_name, None)
                    if callable(method):
                        try:
                            method()
                        except Exception:
                            continue
        except Exception:
            pass

    return {
        "success": True,
        "input_type": input_type.title(),
        "mapping_name": mapping_name,
        "key": key_name,
        "modifiers": modifiers,
        "scale": scale,
        "mapping_line": mapping_line,
        "config_path": unreal_text(config_path),
    }


OPERATIONS = {
    "create_input_mapping": create_input_mapping,
}


def main():
    operation = decode_template_json("""${operation}""")
    args = decode_template_json("""${args}""")

    handler = OPERATIONS.get(operation)
    if not handler:
        print(
            json.dumps(
                {
                    "success": False,
                    "message": "Unknown project tool operation: {0}".format(
                        operation
                    ),
                },
                indent=2,
            )
        )
        return

    try:
        result = handler(args or {})
    except Exception as exc:
        result = {"success": False, "message": unreal_text(exc)}

    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
