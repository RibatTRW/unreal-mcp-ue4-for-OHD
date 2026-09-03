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


OPERATIONS = {
    "read_blueprint_content": read_blueprint_content,
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
