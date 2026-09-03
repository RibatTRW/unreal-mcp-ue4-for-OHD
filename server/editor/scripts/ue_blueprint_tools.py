import json


OPERATIONS = {
    "create_blueprint": create_blueprint,
    "add_component_to_blueprint": add_component_to_blueprint,
    "set_static_mesh_properties": set_static_mesh_properties,
    "set_component_property": set_component_property,
    "set_physics_properties": set_physics_properties,
    "compile_blueprint": compile_blueprint,
    "set_blueprint_property": set_blueprint_property,
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
                    "message": "Unknown blueprint tool operation: {0}".format(
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
