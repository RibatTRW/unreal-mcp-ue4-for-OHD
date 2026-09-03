def get_blueprint_graphs(blueprint):
    graphs = []
    for property_name in (
        "ubergraph_pages",
        "function_graphs",
        "macro_graphs",
        "delegate_signature_graphs",
    ):
        try:
            property_value = get_editor_property_value(blueprint, property_name, []) or []
            graphs.extend(list(property_value))
        except Exception:
            continue
    return graphs


def get_blueprint_event_graph(blueprint):
    ubergraph_pages = list(get_editor_property_value(blueprint, "ubergraph_pages", []) or [])
    if ubergraph_pages:
        for graph in ubergraph_pages:
            if get_object_name(graph).lower() == "eventgraph":
                return graph
        return ubergraph_pages[0]

    for graph in get_blueprint_graphs(blueprint):
        if "event" in get_object_name(graph).lower():
            return graph

    return None


def load_graph_node_class(class_path):
    node_class = resolve_class_reference(class_path)
    if node_class:
        return node_class

    raise ValueError("Blueprint graph node class is not available: {0}".format(class_path))


def create_graph_node(graph, node_class_path, node_position=None):
    if not graph:
        raise ValueError("Blueprint graph is required")

    node_class = load_graph_node_class(node_class_path)

    if not hasattr(graph, "create_node"):
        raise ValueError(
            "Graph node creation is not exposed in this UE4.25 Python environment."
        )

    node = graph.create_node(node_class)
    if not node:
        raise RuntimeError("Failed to create graph node: {0}".format(node_class_path))

    try:
        node.create_new_guid()
    except Exception:
        pass

    if node_position and len(node_position) >= 2:
        set_object_property(node, "node_pos_x", int(node_position[0]))
        set_object_property(node, "node_pos_y", int(node_position[1]))

    try:
        node.post_placed_new_node()
    except Exception:
        pass

    try:
        if len(getattr(node, "pins", []) or []) == 0:
            node.allocate_default_pins()
    except Exception:
        pass

    return node


def try_set_member_reference(member_reference, member_name, parent_class=None, self_context=False):
    if member_reference is None:
        return False

    try:
        if self_context and hasattr(member_reference, "set_self_member"):
            member_reference.set_self_member(member_name)
            return True

        if not self_context and hasattr(member_reference, "set_external_member"):
            member_reference.set_external_member(member_name, get_UClass(parent_class))
            return True
    except Exception:
        pass

    return False


def reconstruct_graph_node(node):
    try:
        node.reconstruct_node()
        return True
    except Exception:
        pass

    try:
        node.allocate_default_pins()
        return True
    except Exception:
        return False


def get_graph_nodes(graph):
    try:
        return list(get_editor_property_value(graph, "nodes", []) or [])
    except Exception:
        return []


def get_node_guid_string(node):
    node_guid = get_editor_property_value(node, "node_guid")
    if node_guid:
        return str(node_guid)

    return get_object_name(node)


def get_node_title_text(node):
    for title_arg in (
        getattr(getattr(unreal, "NodeTitleType", None), "FULL_TITLE", None),
        0,
    ):
        if title_arg is None:
            continue
        try:
            return str(node.get_node_title(title_arg))
        except Exception:
            continue

    return get_object_name(node)


def get_pin_name(pin):
    pin_name = get_editor_property_value(pin, "pin_name")
    if pin_name:
        return str(pin_name)

    return get_object_name(pin)


def find_node_pin(node, pin_name):
    try:
        pin = node.find_pin(pin_name)
        if pin:
            return pin
    except Exception:
        pass

    for pin in list(getattr(node, "pins", []) or []):
        if get_pin_name(pin) == pin_name:
            return pin

    return None


def set_pin_default(pin, value):
    if value is None or pin is None:
        return

    if isinstance(value, bool):
        set_object_property(pin, "default_value", "true" if value else "false")
        return

    if isinstance(value, (int, float)):
        set_object_property(pin, "default_value", str(value))
        return

    if isinstance(value, _string_types) and value.startswith("/"):
        loaded_asset = unreal.EditorAssetLibrary.load_asset(value)
        if loaded_asset:
            set_object_property(pin, "default_object", loaded_asset)
            set_object_property(pin, "default_value", "")
            return

    if isinstance(value, _string_types):
        set_object_property(pin, "default_value", value)
        return

    set_object_property(pin, "default_value", json.dumps(value))


def find_blueprint_graph_node(blueprint, node_id):
    if not node_id:
        return None, None

    normalized_node_id = unreal_text(node_id)
    for graph in get_blueprint_graphs(blueprint):
        for node in get_graph_nodes(graph):
            if (
                get_node_guid_string(node) == normalized_node_id
                or get_object_name(node) == normalized_node_id
            ):
                return graph, node

    return None, None


def break_pin_links(pin, target_pin=None):
    if pin is None:
        return 0

    broken_count = 0

    if target_pin is not None:
        break_link_to = getattr(pin, "break_link_to", None)
        if callable(break_link_to):
            break_link_to(target_pin)
            return 1

        linked_pins = list(getattr(pin, "linked_to", []) or [])
        if target_pin in linked_pins:
            try:
                linked_pins.remove(target_pin)
                set_object_property(pin, "linked_to", linked_pins)
                broken_count += 1
            except Exception:
                pass

        return broken_count

    break_all_links = getattr(pin, "break_all_pin_links", None)
    if callable(break_all_links):
        linked_count = len(list(getattr(pin, "linked_to", []) or []))
        try:
            break_all_links()
            return linked_count
        except Exception:
            pass

    for linked_pin in list(getattr(pin, "linked_to", []) or []):
        try:
            if hasattr(pin, "break_link_to"):
                pin.break_link_to(linked_pin)
                broken_count += 1
        except Exception:
            continue

    return broken_count
