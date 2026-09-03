def add_blueprint_variable(args):
    blueprint_name = args.get("blueprint_name")
    variable_name = args.get("variable_name")
    variable_type = args.get("variable_type")
    is_exposed = bool(args.get("is_exposed", args.get("is_public", False)))
    default_value = args.get("default_value")
    tooltip = args.get("tooltip")
    category = args.get("category")

    try:
        blueprint = load_blueprint_asset(blueprint_name)
    except Exception as exc:
        return {"success": False, "message": unreal_text(exc)}

    variables = list(get_editor_property_value(blueprint, "new_variables", []) or [])
    for existing_var in variables:
        existing_name = str(get_editor_property_value(existing_var, "var_name", ""))
        if existing_name == variable_name:
            return {
                "success": False,
                "message": "Blueprint variable already exists: {0}".format(variable_name),
            }

    variable_desc_class = getattr(unreal, "BPVariableDescription", None)
    if not variable_desc_class:
        return {
            "success": False,
            "message": "BPVariableDescription is not exposed in this UE4.25 Python environment.",
        }

    try:
        variable_desc = variable_desc_class()
        set_object_property(variable_desc, "var_name", variable_name)
        set_object_property(variable_desc, "friendly_name", variable_name)
        set_object_property(variable_desc, "var_type", _build_pin_type(variable_type))
        if tooltip:
            set_object_property(variable_desc, "tooltip", tooltip)
        if category:
            set_object_property(variable_desc, "category", category)

        if is_exposed:
            property_flags = get_editor_property_value(variable_desc, "property_flags", 0)
            set_object_property(variable_desc, "property_flags", int(property_flags) | 0x1 | 0x4)

        variables.append(variable_desc)
        set_object_property(blueprint, "new_variables", variables)
        finalize_blueprint_change(blueprint, structural=True)
        if default_value is not None:
            cdo = get_blueprint_default_object(blueprint)
            if cdo:
                set_object_property(cdo, variable_name, default_value)
                save_loaded_editor_asset(blueprint)
        return {
            "success": True,
            "blueprint": get_asset_package_name(blueprint),
            "variable_name": variable_name,
            "variable_type": variable_type,
            "default_value": default_value,
            "is_public": is_exposed,
        }
    except Exception as exc:
        return {"success": False, "message": unreal_text(exc)}


def create_variable(args):
    return add_blueprint_variable(args)


def add_blueprint_get_self_component_reference(args):
    blueprint_name = args.get("blueprint_name")
    component_name = args.get("component_name")
    node_position = args.get("node_position") or [0, 0]

    try:
        blueprint, graph = _load_blueprint_and_graph(blueprint_name, args.get("graph_name"))
        _find_component_class(blueprint, component_name)
        node = create_graph_node(
            graph,
            "/Script/BlueprintGraph.K2Node_VariableGet",
            node_position,
        )
        variable_reference = get_editor_property_value(node, "variable_reference")
        if not try_set_member_reference(variable_reference, component_name, self_context=True):
            return {
                "success": False,
                "message": "UE4.25 Python could not configure component reference nodes in this environment.",
            }

        set_object_property(node, "variable_reference", variable_reference)
        reconstruct_graph_node(node)
        return _result_for_node(blueprint, graph, node)
    except Exception as exc:
        return {"success": False, "message": unreal_text(exc)}


def add_blueprint_self_reference(args):
    blueprint_name = args.get("blueprint_name")
    node_position = args.get("node_position") or [0, 0]

    try:
        blueprint, graph = _load_blueprint_and_graph(blueprint_name, args.get("graph_name"))
        node = create_graph_node(graph, "/Script/BlueprintGraph.K2Node_Self", node_position)
        reconstruct_graph_node(node)
        return _result_for_node(blueprint, graph, node)
    except Exception as exc:
        return {"success": False, "message": unreal_text(exc)}


def find_blueprint_nodes(args):
    blueprint_name = args.get("blueprint_name")
    search_term = str(args.get("search_term") or "").strip().lower()
    graph_name = args.get("graph_name")
    node_class_filter = str(args.get("node_class") or "").strip().lower()

    try:
        blueprint = load_blueprint_asset(blueprint_name)
    except Exception as exc:
        return {"success": False, "message": unreal_text(exc), "nodes": []}

    results = []
    for graph in get_blueprint_graphs(blueprint):
        current_graph_name = get_object_name(graph)
        if graph_name and current_graph_name != graph_name:
            continue

        for node in get_graph_nodes(graph):
            node_info = serialize_graph_node(node, current_graph_name)

            if search_term and search_term not in (
                "{0} {1} {2}".format(
                    node_info["title"],
                    node_info["name"],
                    node_info["class"],
                ).lower()
            ):
                continue

            if node_class_filter and node_class_filter not in node_info["class"].lower():
                continue

            results.append(node_info)

    return {
        "success": True,
        "blueprint": get_asset_package_name(blueprint),
        "count": len(results),
        "nodes": results,
    }
