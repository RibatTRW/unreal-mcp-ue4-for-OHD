def load_material_asset(material_identifier):
    return load_asset_by_identifier(
        material_identifier,
        [
            "Material",
            "MaterialInstance",
            "MaterialInstanceConstant",
            "MaterialInterface",
        ],
    )


def apply_material_to_component(component, material_identifier, slot_index=0):
    if component is None:
        raise ValueError("A render component is required")

    material_asset = load_material_asset(material_identifier)
    if not hasattr(component, "set_material"):
        raise ValueError(
            "Component '{0}' does not support material assignment.".format(
                get_object_name(component)
            )
        )

    component.set_material(int(slot_index), material_asset)
    return material_asset


def create_material_instance_constant(
    parent_material, instance_name=None, package_path="/Game/MCP/GeneratedMaterials"
):
    material_instance_class = getattr(unreal, "MaterialInstanceConstant", None)
    material_factory_class = getattr(unreal, "MaterialInstanceConstantFactoryNew", None)
    material_library = getattr(unreal, "MaterialEditingLibrary", None)

    if material_instance_class is None or material_factory_class is None:
        raise ValueError(
            "MaterialInstanceConstant asset creation is not exposed in this UE4.25 Python environment."
        )

    instance_asset_name = sanitize_asset_name(
        instance_name or "{0}_MCPInst".format(get_object_name(parent_material)),
        fallback="GeneratedMaterialInstance",
    )
    package_path = get_asset_package_path_for_create(package_path)
    instance_asset_path = "{0}/{1}".format(package_path, instance_asset_name)

    try:
        existing_asset = unreal.EditorAssetLibrary.load_asset(instance_asset_path)
        if existing_asset:
            if material_library and hasattr(material_library, "set_material_instance_parent"):
                material_library.set_material_instance_parent(existing_asset, parent_material)
            else:
                set_object_property(existing_asset, "parent", parent_material)
            save_loaded_editor_asset(existing_asset)
            return existing_asset
    except Exception:
        pass

    factory = material_factory_class()
    material_instance = create_asset_with_factory(
        instance_asset_name,
        package_path,
        material_instance_class,
        factory,
    )
    if not material_instance:
        raise RuntimeError(
            "Failed to create material instance '{0}'".format(instance_asset_name)
        )

    if material_library and hasattr(material_library, "set_material_instance_parent"):
        material_library.set_material_instance_parent(material_instance, parent_material)
    else:
        set_object_property(material_instance, "parent", parent_material)

    save_loaded_editor_asset(material_instance)
    return material_instance


def tint_material_interface(
    material_interface,
    color_values,
    parameter_name=None,
    instance_name=None,
    package_path="/Game/MCP/GeneratedMaterials",
):
    material_library = getattr(unreal, "MaterialEditingLibrary", None)
    material_class_name = get_object_class_name(material_interface)
    parameter_candidates = []

    def _linear_colors_match(lhs, rhs, tolerance=1e-4):
        return (
            abs(float(lhs.r) - float(rhs.r)) <= tolerance
            and abs(float(lhs.g) - float(rhs.g)) <= tolerance
            and abs(float(lhs.b) - float(rhs.b)) <= tolerance
            and abs(float(lhs.a) - float(rhs.a)) <= tolerance
        )

    if parameter_name:
        parameter_candidates.append(parameter_name)
    parameter_candidates.extend(
        [
            "BaseColor",
            "Color",
            "Tint",
            "TintColor",
            "BodyColor",
            "AlbedoTint",
        ]
    )

    if material_class_name == "Material":
        material_interface = create_material_instance_constant(
            material_interface,
            instance_name=instance_name,
            package_path=package_path,
        )

    if hasattr(material_library, "get_vector_parameter_names"):
        try:
            discovered_names = material_library.get_vector_parameter_names(
                material_interface
            )
            for discovered_name in discovered_names or []:
                discovered_name = unreal_text(discovered_name)
                if discovered_name and discovered_name not in parameter_candidates:
                    parameter_candidates.append(discovered_name)
        except Exception:
            pass

    if (
        material_library is None
        or not hasattr(material_library, "set_material_instance_vector_parameter_value")
        or not hasattr(material_library, "update_material_instance")
    ):
        raise ValueError(
            "MaterialEditingLibrary vector parameter editing is not exposed in this UE4.25 Python environment."
        )

    color_value = as_linear_color(color_values)
    for parameter_candidate in parameter_candidates:
        try:
            success = material_library.set_material_instance_vector_parameter_value(
                material_interface,
                unreal.Name(parameter_candidate)
                if hasattr(unreal, "Name")
                else parameter_candidate,
                color_value,
            )
            readback_matches = False
            if hasattr(material_library, "get_material_instance_vector_parameter_value"):
                try:
                    current_value = (
                        material_library.get_material_instance_vector_parameter_value(
                            material_interface,
                            unreal.Name(parameter_candidate)
                            if hasattr(unreal, "Name")
                            else parameter_candidate,
                        )
                    )
                    readback_matches = _linear_colors_match(current_value, color_value)
                except Exception:
                    readback_matches = False
            if success or readback_matches:
                material_library.update_material_instance(material_interface)
                save_loaded_editor_asset(material_interface)
                return material_interface, parameter_candidate
        except Exception:
            continue

    raise ValueError(
        "Could not set a vector color parameter on material '{0}'.".format(
            get_object_name(material_interface)
        )
    )
