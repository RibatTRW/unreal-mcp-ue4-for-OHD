def get_scs_all_nodes(scs):
    try:
        return list(scs.get_all_nodes())
    except Exception:
        pass

    try:
        return list(get_editor_property_value(scs, "all_nodes", []) or [])
    except Exception:
        pass

    return []


def get_scs_root_nodes(scs):
    try:
        return list(get_editor_property_value(scs, "root_nodes", []) or [])
    except Exception:
        return []


def get_default_scene_root_node(scs):
    try:
        return scs.get_default_scene_root_node()
    except Exception:
        return get_editor_property_value(scs, "default_scene_root_node")


def get_scs_node_name(node):
    try:
        return unreal_text(node.get_variable_name())
    except Exception:
        pass

    variable_name = get_editor_property_value(node, "internal_variable_name")
    if variable_name:
        return unreal_text(variable_name)

    component_template = get_editor_property_value(node, "component_template")
    if component_template:
        return get_object_name(component_template)

    return get_object_name(node)


def get_scs_node_template(node):
    return get_editor_property_value(node, "component_template")


def find_scs_node(blueprint_or_scs, component_name):
    if not component_name:
        return None

    scs = blueprint_or_scs
    if get_object_class_name(blueprint_or_scs).endswith("Blueprint"):
        scs = get_simple_construction_script(blueprint_or_scs)

    try:
        node = scs.find_scs_node(component_name)
        if node:
            return node
    except Exception:
        pass

    for node in get_scs_all_nodes(scs):
        node_name = get_scs_node_name(node)
        if node_name == component_name:
            return node

    return None


def get_component_template(blueprint, component_name):
    component_node = None
    if blueprint_supports_scs_lookup(blueprint):
        component_node = find_scs_node(blueprint, component_name)
        if component_node:
            component_template = get_scs_node_template(component_node)
            if not component_template:
                raise ValueError(
                    "Blueprint component template is not available: {0}".format(component_name)
                )

            return component_node, component_template

    component_template = find_blueprint_component_template(blueprint, component_name)
    if component_template:
        return None, component_template

    component_template = find_blueprint_cdo_component(blueprint, component_name)
    if component_template:
        return None, component_template

    if try_compile_blueprint(blueprint):
        component_template = find_blueprint_cdo_component(blueprint, component_name)
        if component_template:
            return None, component_template

    component_candidates = get_blueprint_component_candidates(blueprint)
    fuzzy_matches = []
    requested_name_lower = unreal_text(component_name or "").lower()
    for component_node, candidate in component_candidates:
        candidate_name_lower = get_object_name(candidate).lower()
        if (
            requested_name_lower
            and (
                requested_name_lower in candidate_name_lower
                or candidate_name_lower in requested_name_lower
            )
        ):
            fuzzy_matches.append((component_node, candidate))

    if len(fuzzy_matches) == 1:
        return fuzzy_matches[0]

    if len(component_candidates) == 1:
        return component_candidates[0]

    available_names = list_blueprint_component_names(blueprint)
    if available_names:
        raise ValueError(
            "Blueprint component not found: {0}. Available components: {1}".format(
                component_name,
                ", ".join(available_names),
            )
        )

    raise ValueError("Blueprint component not found: {0}".format(component_name))


def apply_component_property(component_template, property_name, property_value):
    try:
        if (
            property_name == "StaticMesh"
            and object_is_instance_of(component_template, unreal.StaticMeshComponent)
        ):
            static_mesh = unreal.EditorAssetLibrary.load_asset(property_value)
            if static_mesh:
                component_template.set_static_mesh(static_mesh)
                return True

        if property_name == "Material" and hasattr(component_template, "set_material"):
            material = unreal.EditorAssetLibrary.load_asset(property_value)
            if material:
                component_template.set_material(0, material)
                return True

        if (
            property_name == "Materials"
            and isinstance(property_value, list)
            and hasattr(component_template, "set_material")
        ):
            for index, material_path in enumerate(property_value):
                material = unreal.EditorAssetLibrary.load_asset(material_path)
                if material:
                    component_template.set_material(index, material)
            return True
    except Exception:
        pass

    if property_name == "SimulatePhysics":
        for setter_name in ("set_simulate_physics",):
            setter = getattr(component_template, setter_name, None)
            if callable(setter):
                try:
                    setter(bool(property_value))
                    return True
                except Exception:
                    continue

    if property_name == "EnableGravity":
        for setter_name in ("set_enable_gravity",):
            setter = getattr(component_template, setter_name, None)
            if callable(setter):
                try:
                    setter(bool(property_value))
                    return True
                except Exception:
                    continue

    if property_name == "Mass" and hasattr(component_template, "set_mass_override_in_kg"):
        try:
            bone_name = ""
            if hasattr(unreal, "Name"):
                try:
                    bone_name = unreal.Name("")
                except Exception:
                    bone_name = ""
            component_template.set_mass_override_in_kg(
                bone_name,
                float(property_value),
                True,
            )
            return True
        except Exception:
            pass

    if property_name == "LinearDamping":
        return set_object_property(component_template, "linear_damping", float(property_value))

    if property_name == "AngularDamping":
        return set_object_property(component_template, "angular_damping", float(property_value))

    if isinstance(property_value, _string_types) and property_value.startswith("/"):
        loaded_asset = unreal.EditorAssetLibrary.load_asset(property_value)
        if loaded_asset and set_object_property(component_template, property_name, loaded_asset):
            return True

    return set_object_property(component_template, property_name, property_value)
