import json


OPERATIONS = {
    "spawn_physics_blueprint_actor": spawn_physics_blueprint_actor,
    "get_available_materials": get_available_materials,
    "apply_material_to_actor": apply_material_to_actor,
    "apply_material_to_blueprint": apply_material_to_blueprint,
    "set_mesh_material_color": set_mesh_material_color,
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
                    "message": "Unknown material tool operation: {0}".format(operation),
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
