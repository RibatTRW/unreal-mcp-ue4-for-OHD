def add_blueprint_event_node(args):
    blueprint_name = args.get("blueprint_name")
    event_name = args.get("event_name")
    node_position = args.get("node_position") or [0, 0]

    try:
        blueprint, graph = _load_blueprint_and_graph(blueprint_name, args.get("graph_name"))
    except Exception as exc:
        return {"success": False, "message": str(exc)}

    utility_class = getattr(unreal, "KismetEditorUtilities", None)
    if utility_class and hasattr(utility_class, "add_default_event_node"):
        try:
            in_out_pos_y = int(node_position[1])
            node = utility_class.add_default_event_node(
                blueprint,
                graph,
                event_name,
                get_blueprint_parent_class(blueprint),
                in_out_pos_y,
            )
            if node:
                set_object_property(node, "node_pos_x", int(node_position[0]))
                set_object_property(node, "node_pos_y", int(node_position[1]))
                return _result_for_node(blueprint, graph, node)
        except Exception:
            pass

    try:
        node = create_graph_node(graph, "/Script/BlueprintGraph.K2Node_Event", node_position)
        event_reference = get_editor_property_value(node, "event_reference")
        if not try_set_member_reference(
            event_reference,
            event_name,
            parent_class=get_blueprint_parent_class(blueprint),
            self_context=False,
        ):
            return {
                "success": False,
                "message": "UE4.25 Python could not configure K2Node_Event references in this environment.",
            }

        set_object_property(node, "event_reference", event_reference)
        set_object_property(node, "b_override_function", True)
        reconstruct_graph_node(node)
        return _result_for_node(blueprint, graph, node)
    except Exception as exc:
        return {"success": False, "message": str(exc)}


def add_blueprint_input_action_node(args):
    blueprint_name = args.get("blueprint_name")
    action_name = args.get("action_name")
    node_position = args.get("node_position") or [0, 0]

    try:
        blueprint, graph = _load_blueprint_and_graph(blueprint_name, args.get("graph_name"))
        node = create_graph_node(
            graph, "/Script/BlueprintGraph.K2Node_InputAction", node_position
        )
        set_object_property(node, "input_action_name", action_name)
        reconstruct_graph_node(node)
        return _result_for_node(blueprint, graph, node)
    except Exception as exc:
        return {"success": False, "message": str(exc)}
