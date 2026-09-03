import json


OPERATIONS = {
    "get_actors_in_level": get_actors_in_level,
    "find_actors_by_name": find_actors_by_name,
    "spawn_actor": spawn_actor,
    "delete_actor": delete_actor,
    "set_actor_transform": set_actor_transform,
    "get_actor_properties": get_actor_properties,
    "get_actor_material_info": get_actor_material_info,
    "set_actor_property": set_actor_property,
    "spawn_blueprint_actor": spawn_blueprint_actor,
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
                    "message": "Unknown actor tool operation: {0}".format(operation),
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
