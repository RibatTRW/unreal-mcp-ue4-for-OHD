def add_blueprint_function_node(args):
    blueprint_name = args.get("blueprint_name")
    target = args.get("target") or "self"
    function_name = args.get("function_name")
    params = args.get("params") or {}
    node_position = args.get("node_position") or [0, 0]

    try:
        blueprint, graph = _load_blueprint_and_graph(blueprint_name, args.get("graph_name"))
    except Exception as exc:
        return {"success": False, "message": str(exc)}

    try:
        if str(target).lower() == "self":
            node = create_graph_node(
                graph, "/Script/BlueprintGraph.K2Node_CallFunction", node_position
            )
            target_class = get_blueprint_parent_class(blueprint)
            function_reference = get_editor_property_value(node, "function_reference")
            configured = try_set_member_reference(
                function_reference,
                function_name,
                parent_class=target_class,
                self_context=True,
            )
            set_object_property(node, "function_reference", function_reference)
        else:
            _, _, target_class = _find_component_class(blueprint, target)
            node = create_graph_node(
                graph,
                "/Script/BlueprintGraph.K2Node_CallFunctionOnMember",
                node_position,
            )
            function_reference = get_editor_property_value(node, "function_reference")
            configured = try_set_member_reference(
                function_reference,
                function_name,
                parent_class=target_class,
                self_context=False,
            )
            set_object_property(node, "function_reference", function_reference)

            member_reference = get_editor_property_value(
                node, "member_variable_to_call_on"
            )
            configured = configured and try_set_member_reference(
                member_reference,
                target,
                self_context=True,
            )
            set_object_property(node, "member_variable_to_call_on", member_reference)

        if not configured:
            return {
                "success": False,
                "message": "UE4.25 Python could not configure function node references in this environment.",
            }

        reconstruct_graph_node(node)

        for param_name, param_value in params.items():
            pin = find_node_pin(node, param_name)
            if pin:
                set_pin_default(pin, param_value)

        return _result_for_node(blueprint, graph, node)
    except Exception as exc:
        return {"success": False, "message": str(exc)}


def add_node(args):
    node_type = str(args.get("node_type") or args.get("node_kind") or "").strip().lower()
    node_class = args.get("node_class")

    if node_type in ("event", "event_node"):
        return add_blueprint_event_node(
            {
                "blueprint_name": args.get("blueprint_name"),
                "event_name": args.get("event_name"),
                "graph_name": args.get("graph_name"),
                "node_position": args.get("node_position"),
            }
        )

    if node_type in ("input_action", "inputaction", "input_action_node"):
        return add_blueprint_input_action_node(
            {
                "blueprint_name": args.get("blueprint_name"),
                "action_name": args.get("action_name"),
                "graph_name": args.get("graph_name"),
                "node_position": args.get("node_position"),
            }
        )

    if node_type in ("function", "function_call", "call_function"):
        return add_blueprint_function_node(
            {
                "blueprint_name": args.get("blueprint_name"),
                "target": args.get("target"),
                "function_name": args.get("function_name"),
                "params": args.get("params"),
                "graph_name": args.get("graph_name"),
                "node_position": args.get("node_position"),
            }
        )

    if node_type in ("self", "self_reference"):
        return add_blueprint_self_reference(
            {
                "blueprint_name": args.get("blueprint_name"),
                "graph_name": args.get("graph_name"),
                "node_position": args.get("node_position"),
            }
        )

    if node_type in ("component_reference", "get_self_component_reference"):
        return add_blueprint_get_self_component_reference(
            {
                "blueprint_name": args.get("blueprint_name"),
                "component_name": args.get("component_name"),
                "graph_name": args.get("graph_name"),
                "node_position": args.get("node_position"),
            }
        )

    if not node_class:
        return {
            "success": False,
            "message": "Provide node_type for a supported helper or node_class for raw node creation.",
        }

    try:
        blueprint, graph = _load_blueprint_and_graph(
            args.get("blueprint_name"),
            args.get("graph_name"),
        )
        normalized_node_class = str(node_class)
        if not normalized_node_class.startswith("/Script/"):
            normalized_node_class = "/Script/BlueprintGraph.{0}".format(node_class)
        node = create_graph_node(graph, normalized_node_class, args.get("node_position") or [0, 0])
        reconstruct_graph_node(node)
        return _result_for_node(blueprint, graph, node)
    except Exception as exc:
        return {"success": False, "message": str(exc)}
