import json


OPERATIONS = {
    "create_town": create_town,
    "construct_house": construct_house,
    "construct_mansion": construct_mansion,
    "create_tower": create_tower,
    "create_arch": create_arch,
    "create_staircase": create_staircase,
    "create_castle_fortress": create_castle_fortress,
    "create_suspension_bridge": create_suspension_bridge,
    "create_bridge": create_bridge,
    "create_aqueduct": create_aqueduct,
    "create_maze": create_maze,
    "create_pyramid": create_pyramid,
    "create_wall": create_wall,
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
                    "message": "Unknown world building tool operation: {0}".format(
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
