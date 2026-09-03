def get_simple_construction_script(blueprint):
    try:
        blueprint_editor_utils = getattr(unreal, "BlueprintEditorUtils", None)
        if blueprint_editor_utils and hasattr(
            blueprint_editor_utils, "preload_construction_script"
        ):
            try:
                blueprint_editor_utils.preload_construction_script(blueprint)
            except Exception:
                pass
    except Exception:
        pass

    scs = get_editor_property_value(blueprint, "simple_construction_script")
    if scs:
        return scs

    generated_class = get_blueprint_generated_class(blueprint)
    if generated_class:
        scs = get_editor_property_value(generated_class, "simple_construction_script")
        if scs:
            return scs

    if not scs:
        raise ValueError(
            "Blueprint '{0}' does not expose a SimpleConstructionScript in UE4.25 Python.".format(
                get_object_name(blueprint)
            )
        )
    return scs


def blueprint_supports_scs_editing(blueprint):
    try:
        scs = get_simple_construction_script(blueprint)
    except Exception:
        return False

    return callable(getattr(scs, "create_node", None)) and callable(
        getattr(scs, "add_node", None)
    )


def blueprint_supports_scs_lookup(blueprint):
    try:
        scs = get_simple_construction_script(blueprint)
    except Exception:
        return False

    if hasattr(scs, "find_scs_node") and callable(getattr(scs, "find_scs_node", None)):
        return True

    try:
        return len(get_scs_all_nodes(scs)) >= 0
    except Exception:
        return False


def get_blueprint_component_templates(blueprint):
    component_templates = list(
        get_editor_property_value(blueprint, "component_templates", []) or []
    )
    if component_templates:
        return component_templates

    generated_class = get_blueprint_generated_class(blueprint)
    if generated_class:
        return list(
            get_editor_property_value(generated_class, "component_templates", []) or []
        )

    return []


def find_blueprint_component_template(blueprint, component_name):
    if not component_name:
        return None

    for component_template in get_blueprint_component_templates(blueprint):
        template_name = get_object_name(component_template)
        if component_name_matches(template_name, component_name):
            return component_template

    return None


def component_name_matches(candidate_name, component_name):
    candidate_name = str(candidate_name or "")
    component_name = str(component_name or "")

    if not candidate_name or not component_name:
        return False

    if candidate_name == component_name:
        return True

    if candidate_name.endswith("_GEN_VARIABLE") and candidate_name[: -len("_GEN_VARIABLE")] == component_name:
        return True

    return False


def blueprint_has_component(blueprint, component_name):
    if not component_name:
        return False

    try:
        if blueprint_supports_scs_lookup(blueprint):
            return find_scs_node(blueprint, component_name) is not None
    except Exception:
        pass

    return find_blueprint_component_template(blueprint, component_name) is not None


def find_blueprint_cdo_component(blueprint, component_name):
    cdo = get_blueprint_default_object(blueprint)
    if not cdo or not component_name:
        return None

    try:
        components = list(cdo.get_components_by_class(unreal.ActorComponent) or [])
    except Exception:
        return None

    for component in components:
        if component_name_matches(get_object_name(component), component_name):
            return component

    return None


def get_blueprint_component_candidates(blueprint):
    candidates = []
    seen = set()

    for component_template in get_blueprint_component_templates(blueprint):
        component_key = get_object_path_name(component_template) or get_object_name(
            component_template
        )
        if component_key in seen:
            continue
        seen.add(component_key)
        candidates.append((None, component_template))

    cdo = get_blueprint_default_object(blueprint)
    if cdo:
        try:
            for component in list(cdo.get_components_by_class(unreal.ActorComponent) or []):
                component_key = get_object_path_name(component) or get_object_name(component)
                if component_key in seen:
                    continue
                seen.add(component_key)
                candidates.append((None, component))
        except Exception:
            pass

    return candidates


def list_blueprint_component_names(blueprint):
    names = []
    seen = set()
    for _, component in get_blueprint_component_candidates(blueprint):
        component_name = get_object_name(component)
        if component_name and component_name not in seen:
            seen.add(component_name)
            names.append(component_name)
    return names


def get_blueprint_construction_graph(blueprint):
    try:
        blueprint_editor_utils = getattr(unreal, "BlueprintEditorUtils", None)
        if blueprint_editor_utils and hasattr(
            blueprint_editor_utils, "find_user_construction_script"
        ):
            construction_graph = blueprint_editor_utils.find_user_construction_script(
                blueprint
            )
            if construction_graph:
                return construction_graph
    except Exception:
        pass

    for graph in get_blueprint_graphs(blueprint):
        graph_name = get_object_name(graph).lower()
        if graph_name in ("userconstructionscript", "constructionscript"):
            return graph

    return None


def supports_kismet_component_harvest():
    return hasattr(unreal, "KismetEditorUtilities") and hasattr(
        unreal.KismetEditorUtilities, "add_components_to_blueprint"
    )
