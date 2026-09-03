import json


def read_console_variable(variable_name):
    normalized_name = unreal_text(variable_name or "").strip()
    if not normalized_name:
        return {"success": False, "message": "variable_name is required"}

    float_value = unreal.SystemLibrary.get_console_variable_float_value(normalized_name)
    int_value = unreal.SystemLibrary.get_console_variable_int_value(normalized_name)
    bool_value = unreal.SystemLibrary.get_console_variable_bool_value(normalized_name)
    string_getter = getattr(unreal.SystemLibrary, "get_console_variable_string_value", None)
    if callable(string_getter):
        try:
            string_value = unreal_text(string_getter(normalized_name))
        except Exception:
            string_value = unreal_text(float_value if float_value != 0.0 else int_value)
    else:
        string_value = unreal_text(float_value if float_value != 0.0 else int_value)

    return {
        "success": True,
        "variable_name": normalized_name,
        "string_value": string_value,
        "float_value": float(float_value),
        "int_value": int(int_value),
        "bool_value": bool(bool_value),
    }


def main():
    variable_name = decode_template_json("""${variable_name}""")
    print(json.dumps(read_console_variable(variable_name), indent=2))


if __name__ == "__main__":
    main()
