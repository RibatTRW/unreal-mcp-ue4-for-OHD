import json


OPERATIONS = {
    "add_blueprint_event_node": add_blueprint_event_node,
    "add_blueprint_input_action_node": add_blueprint_input_action_node,
    "add_blueprint_function_node": add_blueprint_function_node,
    "connect_blueprint_nodes": connect_blueprint_nodes,
    "add_node": add_node,
    "connect_nodes": connect_nodes,
    "disconnect_nodes": disconnect_nodes,
    "add_blueprint_variable": add_blueprint_variable,
    "create_variable": create_variable,
    "add_blueprint_get_self_component_reference": add_blueprint_get_self_component_reference,
    "add_blueprint_self_reference": add_blueprint_self_reference,
    "find_blueprint_nodes": find_blueprint_nodes,
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
                    "message": "Unknown blueprint graph tool operation: {0}".format(
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
