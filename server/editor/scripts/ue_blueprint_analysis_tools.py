import json


def _load_blueprint(blueprint_name):
    return load_blueprint_asset(blueprint_name, allow_widget=True)


def _graph_summary(graph, include_nodes=False):
    graph_name = get_object_name(graph)
    nodes = get_graph_nodes(graph)
    summary = {
        "name": graph_name,
        "class": get_object_class_name(graph),
        "node_count": len(nodes),
        "edges": get_graph_edges(graph),
    }

    if include_nodes:
        summary["nodes"] = [serialize_graph_node(node, graph_name) for node in nodes]

    return summary


def _component_summaries(blueprint):
    try:
        scs = get_simple_construction_script(blueprint)
    except Exception:
        return []

    components = []
    for node in get_scs_all_nodes(scs):
        component_template = get_scs_node_template(node)
        components.append(
            {
                "name": get_scs_node_name(node),
                "class": get_object_class_name(component_template),
                "materials": get_component_material_info(component_template),
            }
        )

    return components


def _function_graph_details(graph):
    graph_name = get_object_name(graph)
    nodes = [serialize_graph_node(node, graph_name) for node in get_graph_nodes(graph)]
    entry_nodes = [
        node
        for node in nodes
        if node["class"].endswith("FunctionEntry") or "entry" in node["title"].lower()
    ]
    call_nodes = [
        node
        for node in nodes
        if "CallFunction" in node["class"] or "call" in node["title"].lower()
    ]

    return {
        "name": graph_name,
        "class": get_object_class_name(graph),
        "node_count": len(nodes),
        "entry_nodes": entry_nodes,
        "call_nodes": call_nodes,
        "edges": get_graph_edges(graph),
    }


def read_blueprint_content(args):
    blueprint_name = args.get("blueprint_name")
    include_nodes = bool(args.get("include_nodes", False))

    try:
        blueprint = _load_blueprint(blueprint_name)
    except Exception as exc:
        return {"success": False, "message": unreal_text(exc)}

    graphs = get_blueprint_graphs(blueprint)
    variables = [
        serialize_blueprint_variable_desc(variable_desc)
        for variable_desc in get_blueprint_variable_descriptions(blueprint)
    ]

    return {
        "success": True,
        "blueprint": {
            "name": get_object_name(blueprint),
            "asset_path": get_asset_package_name(blueprint),
            "class": get_object_class_name(blueprint),
            "parent_class": get_object_name(get_blueprint_parent_class(blueprint)),
            "generated_class": get_object_name(get_blueprint_generated_class(blueprint)),
            "components": _component_summaries(blueprint),
            "variables": variables,
            "functions": [get_object_name(graph) for graph in get_blueprint_function_graphs(blueprint)],
            "graphs": [_graph_summary(graph, include_nodes=include_nodes) for graph in graphs],
        },
    }


def analyze_blueprint_graph(args):
    blueprint_name = args.get("blueprint_name")
    graph_name = args.get("graph_name")
    include_nodes = bool(args.get("include_nodes", True))

    try:
        blueprint = _load_blueprint(blueprint_name)
    except Exception as exc:
        return {"success": False, "message": unreal_text(exc)}

    target_graph = None
    if graph_name:
        for graph in get_blueprint_graphs(blueprint):
            if get_object_name(graph) == graph_name:
                target_graph = graph
                break
    else:
        target_graph = get_blueprint_event_graph(blueprint) or (
            get_blueprint_graphs(blueprint)[0] if get_blueprint_graphs(blueprint) else None
        )

    if target_graph is None:
        return {"success": False, "message": "Blueprint graph not found."}

    return {
        "success": True,
        "blueprint": get_asset_package_name(blueprint),
        "graph": _graph_summary(target_graph, include_nodes=include_nodes),
    }


def get_blueprint_variable_details(args):
    blueprint_name = args.get("blueprint_name")
    variable_name = args.get("variable_name")

    try:
        blueprint = _load_blueprint(blueprint_name)
    except Exception as exc:
        return {"success": False, "message": unreal_text(exc), "variables": []}

    variables = [
        serialize_blueprint_variable_desc(variable_desc)
        for variable_desc in get_blueprint_variable_descriptions(blueprint)
    ]

    if variable_name:
        variables = [variable for variable in variables if variable["name"] == variable_name]

    return {
        "success": True,
        "blueprint": get_asset_package_name(blueprint),
        "count": len(variables),
        "variables": variables,
    }


def get_blueprint_function_details(args):
    blueprint_name = args.get("blueprint_name")
    function_name = args.get("function_name")

    try:
        blueprint = _load_blueprint(blueprint_name)
    except Exception as exc:
        return {"success": False, "message": unreal_text(exc), "functions": []}

    function_graphs = get_blueprint_function_graphs(blueprint)
    details = []
    for graph in function_graphs:
        if function_name and get_object_name(graph) != function_name:
            continue
        details.append(_function_graph_details(graph))

    return {
        "success": True,
        "blueprint": get_asset_package_name(blueprint),
        "count": len(details),
        "functions": details,
    }


OPERATIONS = {
    "read_blueprint_content": read_blueprint_content,
    "analyze_blueprint_graph": analyze_blueprint_graph,
    "get_blueprint_variable_details": get_blueprint_variable_details,
    "get_blueprint_function_details": get_blueprint_function_details,
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
                    "message": "Unknown blueprint analysis tool operation: {0}".format(
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
